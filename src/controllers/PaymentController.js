const { Payment, Booking, Rental, User } = require('../models');
const PaymentService = require('../services/PaymentService');
const VNPayService = require('../services/VNPayService');
const { formatVietnamTime, nowVietnam } = require('../config/timezone');
const { sendEmail, getPaymentSuccessTemplate } = require('../config/nodemailer');

// Gửi email notification khi payment thành công
const sendPaymentSuccessEmail = async (payment, user) => {
  try {
    const paymentDetails = {
      paymentCode: payment.code,
      amount: `${payment.amount.toLocaleString('vi-VN')} VND`,
      paymentType: payment.payment_type === 'deposit' ? 'Cọc xe' : 
                   payment.payment_type === 'rental_fee' ? 'Phí thuê xe' : 
                   payment.payment_type === 'additional_fee' ? 'Phí phụ trội' : 'Hoàn tiền',
      paymentMethod: payment.payment_method === 'cash' ? 'Tiền mặt' :
                    payment.payment_method === 'qr_code' ? 'QR Code' :
                    payment.payment_method === 'vnpay' ? 'VNPay' : 
                    payment.payment_method === 'bank_transfer' ? 'Chuyển khoản' : 'Khác',
      transactionId: payment.transaction_id || 'N/A',
      completedAt: formatVietnamTime(payment.completed_at),
      bookingCode: payment.booking_id?.code || payment.booking_id || 'N/A'
    };

    const emailHtml = getPaymentSuccessTemplate(user.fullname, paymentDetails);
    
    await sendEmail({
      to: user.email,
      subject: `🎉 Thanh toán thành công - ${payment.code} | EV Rental`,
      html: emailHtml
    });

    console.log(`📧 Payment success email sent to ${user.email} for payment ${payment.code}`);
  } catch (error) {
    console.error('❌ Error sending payment success email:', error);
    // Không throw error để không ảnh hưởng đến flow chính
  }
};



// Tạo payment mới (Staff only)
const createPayment = async (req, res) => {
  try {
    const { 
      booking_id, 
      rental_id, // Thêm rental_id vào request body
      payment_type, 
      amount, 
      payment_method, 
      reason,
      notes 
    } = req.body;


    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể tạo payment' 
      });
    }

    // Validate required fields với log chi tiết
    const missingFields = [];
    if (!booking_id) missingFields.push('booking_id');
    if (!payment_type) missingFields.push('payment_type');
    if (!payment_method) missingFields.push('payment_method');

    // Chỉ bắt buộc amount cho additional_fee
    if (payment_type === 'additional_fee' && !amount) {
      missingFields.push('amount');
    }

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
        missingFields: missingFields,
        receivedData: {
          booking_id: booking_id || 'MISSING',
          payment_type: payment_type || 'MISSING',
          amount: amount || 'MISSING',
          payment_method: payment_method || 'MISSING'
        }
      });
    }

    // Validate rental_id cho additional_fee (rental_fee có thể tạo từ booking mà chưa có rental)
    if (payment_type === 'additional_fee' && !rental_id) {
      return res.status(400).json({ 
        message: 'rental_id là bắt buộc cho additional_fee',
        payment_type: payment_type,
        rental_id: rental_id || 'MISSING'
      });
    }

    // Tìm booking
    const booking = await Booking.findById(booking_id)
      .populate('user_id', 'fullname email')
      .populate('vehicle_id', 'name model')
      .populate('station_id', 'name');

    if (!booking) {
      return res.status(404).json({ 
        message: 'Không tìm thấy booking' 
      });
    }

    // Kiểm tra booking status
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ 
        message: 'Booking chưa được xác nhận' 
      });
    }

    // Tự động tính amount dựa trên payment_type
    let calculatedAmount = amount;
    if (payment_type === 'deposit') {
      // Tính deposit từ booking
      calculatedAmount = booking.deposit_amount || 0;
    } else if (payment_type === 'rental_fee') {
      // Tính rental fee từ booking
      calculatedAmount = booking.total_price || 0;
    } else if (payment_type === 'additional_fee') {
      // additional_fee phải có amount từ user
      calculatedAmount = amount;
    }

    // Validate amount >= 0 (cho phép deposit = 0)
    if (calculatedAmount < 0) {
      return res.status(400).json({
        message: 'Số tiền thanh toán không được âm',
        payment_type: payment_type,
        calculatedAmount: calculatedAmount
      });
    }

    // Tạo payment code
    const paymentCode = PaymentService.generatePaymentCode();

    // Xác định status dựa trên amount
    let paymentStatus = 'pending';
    let qrData = null;

    // Nếu amount = 0, tự động completed (không cần thanh toán)
    if (calculatedAmount === 0) {
      paymentStatus = 'completed';
    }

    // Tạo payment
    const payment = await Payment.create({
      code: paymentCode,
      rental_id: rental_id || null, // rental_id có thể null cho deposit
      user_id: booking.user_id._id,
      booking_id: booking._id,
      amount: calculatedAmount,
      payment_method: payment_method,
      payment_type: payment_type,
      status: paymentStatus,
      reason: reason || '',
      notes: notes || '',
      is_penalty_fee: false, //  Staff tạo payment thủ công, không phải phí phạt
      processed_by: req.user._id,
      completed_at: paymentStatus === 'completed' ? nowVietnam().toDate() : null
    });


    if (!rental_id && booking._id) {
      try {
        
        const rental = await Rental.findOne({ 
          booking_id: booking._id,
          status: { $in: ['pending_deposit', 'active'] } 
        }).sort({ createdAt: -1 }); 
        
        if (rental) {
          payment.rental_id = rental._id;
          await payment.save();
          console.log(`✅ Auto-linked rental ${rental.code} (${rental._id}) to payment ${payment.code}`);
        } else {
          console.log(`⚠️ No rental found for booking ${booking.code} - Payment created without rental_id`);
        }
      } catch (linkError) {
        console.error('❌ Error linking rental to payment:', linkError);
        // Không throw error, chỉ log để không ảnh hưởng việc tạo payment
      }
    }

    // Tạo VNPay QR Code chỉ khi amount > 0, status = pending và payment_method = vnpay
    if (paymentStatus === 'pending' && calculatedAmount > 0 && payment_method === 'vnpay') {
      const vnpayService = new VNPayService();
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      qrData = await vnpayService.createVNPayQR(payment, ipAddress);
      payment.qr_code_data = qrData.qrData;
      payment.qr_code_image = qrData.qrImageUrl;
      payment.vnpay_url = qrData.vnpayData.paymentUrl;
      payment.vnpay_transaction_no = qrData.vnpayData.orderId;
      await payment.save();
    } else if (paymentStatus === 'completed') {
      // Tạo transaction_id cho payment completed
      payment.transaction_id = `AUTO_${Date.now()}`;
      await payment.save();
    }

    // Populate payment data
    const populatedPayment = await Payment.findById(payment._id)
      .populate('user_id', 'fullname email phone')
      .populate('booking_id', 'code start_date end_date')
      .populate('rental_id', 'code status')
      .populate('processed_by', 'fullname email');


    return res.status(201).json({
      message: paymentStatus === 'completed' 
        ? 'Tạo payment thành công - Tự động hoàn thành (không cần thanh toán)'
        : 'Tạo payment thành công',
      payment: PaymentService.formatPaymentResponse(populatedPayment),
      qrData: qrData
    });

  } catch (error) {
    console.error('Lỗi khi tạo payment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Xác nhận thanh toán (Staff only)
const confirmPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id, notes } = req.body;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể xác nhận thanh toán' 
      });
    }

    // Tìm payment
    const payment = await Payment.findById(id)
      .populate('user_id', 'fullname email')
      .populate('booking_id', 'code status')
      .populate('rental_id', 'code status');

    if (!payment) {
      return res.status(404).json({ 
        message: 'Không tìm thấy payment' 
      });
    }

    // Kiểm tra status
    if (payment.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Payment không ở trạng thái pending' 
      });
    }

    // Cập nhật payment
    payment.status = 'completed';
    payment.transaction_id = transaction_id || `TXN_${Date.now()}`;
    payment.notes = notes || payment.notes;
    payment.completed_at = nowVietnam().toDate();
    await payment.save();

    // Check and update rental status based on payment type
    if (payment.rental_id) {
      try {
        const Rental = require('../models/Rental');
        const Vehicle = require('../models/Vehicle');
        
        const rental = await Rental.findById(payment.rental_id);
        if (!rental) return;
        
        // Nếu payment là deposit và rental đang pending_deposit
        if (payment.payment_type === 'deposit' && rental.status === 'pending_deposit') {
          // Chuyển rental sang active và vehicle sang rented
          await Rental.findByIdAndUpdate(payment.rental_id, {
            status: 'active'
          });
          
          await Vehicle.findByIdAndUpdate(rental.vehicle_id, {
            status: 'rented'
          });
          
          console.log(`✅ Rental ${payment.rental_id} activated - deposit paid`);
        }
       
        else if (payment.payment_type === 'rental_fee' && rental.status === 'pending_deposit') {
          // Thuê < 3 ngày: rental_fee → active (vì đã thanh toán full)
          await Rental.findByIdAndUpdate(payment.rental_id, {
            status: 'active'
          });
          
          await Vehicle.findByIdAndUpdate(rental.vehicle_id, {
            status: 'rented'
          });
          
          console.log(`✅ Rental ${payment.rental_id} activated - rental fee paid (short term rental)`);
        }
        // Nếu payment là rental_fee và rental đang active
        else if (payment.payment_type === 'rental_fee' && rental.status === 'active') {
          // Chuyển rental sang completed
          await Rental.findByIdAndUpdate(payment.rental_id, {
            status: 'completed',
            actual_end_time: new Date()
          });
          
          console.log(`✅ Rental ${payment.rental_id} completed - rental fee paid`);
        }
        // Nếu có payment pending khác, kiểm tra xem có còn payment nào không
        else {
          const remainingPendingPayments = await Payment.countDocuments({
            rental_id: payment.rental_id,
            status: 'pending'
          });
          
          // Nếu không còn payment pending nào
          if (remainingPendingPayments === 0) {
            // Nếu rental đang active → completed (thanh toán rental fee)
            if (rental.status === 'active') {
              await Rental.findByIdAndUpdate(payment.rental_id, {
                status: 'completed',
                actual_end_time: nowVietnam().toDate()
              });
              
              // Cập nhật booking status thành completed
              await Booking.findByIdAndUpdate(rental.booking_id, {
                status: 'completed'
              });
              
              console.log(`✅ Rental ${payment.rental_id} completed - all payments done`);
            }
            // Nếu rental đang pending_payment → completed (đã checkout, thanh toán xong)
            else if (rental.status === 'pending_payment') {
              await Rental.findByIdAndUpdate(payment.rental_id, {
                status: 'completed'
              });
              
              
              await Booking.findByIdAndUpdate(rental.booking_id, {
                status: 'completed'
              });
              
              // Update vehicle status khi rental completed
              let vehicleStatus = 'available';
              if (rental.vehicle_condition_after) {
                const condition = rental.vehicle_condition_after;
                if (condition.exterior_condition === 'poor' || 
                    condition.interior_condition === 'poor' ||
                    rental.damage_fee > 0 ||
                    condition.battery_level < 20) {
                  vehicleStatus = 'maintenance';
                }
              }
              
              await Vehicle.findByIdAndUpdate(rental.vehicle_id, {
                status: vehicleStatus,
                reserved_for: '',
                reserved_at: null,
                reserved_until: null
              });
              
              console.log(`✅ Rental ${payment.rental_id} completed - checkout payments done`);
            }
          }
        }
      } catch (rentalUpdateError) {
        console.error('Error updating rental status:', rentalUpdateError);
        // Don't fail payment confirmation if rental update fails
      }
    }

    // Gửi email notification chỉ cho deposit payment
    if (payment.payment_type === 'deposit') {
      await sendPaymentSuccessEmail(payment, payment.user_id);
    }

    // Populate updated payment
    const updatedPayment = await Payment.findById(payment._id)
      .populate('user_id', 'fullname email phone')
      .populate('booking_id', 'code start_date end_date')
      .populate('rental_id', 'code status')
      .populate('processed_by', 'fullname email');

    return res.status(200).json({
      message: 'Xác nhận thanh toán thành công',
      payment: PaymentService.formatPaymentResponse(updatedPayment)
    });

  } catch (error) {
    console.error('Lỗi khi xác nhận thanh toán:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Hủy payment (Staff only)
const cancelPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể hủy payment' 
      });
    }

    // Tìm payment
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ 
        message: 'Không tìm thấy payment' 
      });
    }

    // Kiểm tra status
    if (payment.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Chỉ có thể hủy payment đang pending' 
      });
    }

    // Cập nhật payment
    payment.status = 'cancelled';
    payment.notes = reason || payment.notes;
    payment.cancelled_at = nowVietnam().toDate();
    await payment.save();

    return res.status(200).json({
      message: 'Hủy payment thành công',
      payment: PaymentService.formatPaymentResponse(payment)
    });

  } catch (error) {
    console.error('Lỗi khi hủy payment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách payments của user
const getUserPayments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      payment_type,
      is_penalty_fee,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    const userId = req.user._id;

    // Xây dựng query
    const query = { user_id: userId, is_active: true };
    if (status) query.status = status;
    if (payment_type) query.payment_type = payment_type;
    if (is_penalty_fee !== undefined) query.is_penalty_fee = is_penalty_fee === 'true';

    // Tính pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;

    // Lấy payments
    const payments = await Payment.find(query)
      .populate('booking_id', 'code start_date end_date')
      .populate('rental_id', 'code status')
      .populate('processed_by', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng
    const total = await Payment.countDocuments(query);

    // Format payments
    const formattedPayments = payments.map(payment => {
      const paymentObj = PaymentService.formatPaymentResponse(payment);
      paymentObj.createdAt = formatVietnamTime(payment.createdAt);
      paymentObj.updatedAt = formatVietnamTime(payment.updatedAt);
      return paymentObj;
    });

    // Tạo payment summary
    const allUserPayments = await Payment.find({ user_id: userId, is_active: true });
    const summary = PaymentService.createPaymentSummary(allUserPayments);

    return res.status(200).json({
      payments: formattedPayments,
      summary: summary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách payments:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy chi tiết payment
const getPaymentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Tìm payment
    const payment = await Payment.findById(id)
      .populate('user_id', 'fullname email phone')
      .populate('booking_id', 'code start_date end_date total_price deposit_amount')
      .populate('rental_id', 'code status actual_start_time actual_end_time')
      .populate('processed_by', 'fullname email');

    if (!payment) {
      return res.status(404).json({ 
        message: 'Không tìm thấy payment' 
      });
    }

    // Kiểm tra quyền xem (user chỉ xem được payment của mình, staff/admin xem được tất cả)
    if (req.user.role === 'Customer' && payment.user_id._id.toString() !== userId.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem payment này' 
      });
    }

    // Format payment
    const formattedPayment = PaymentService.formatPaymentResponse(payment);
    formattedPayment.createdAt = formatVietnamTime(payment.createdAt);
    formattedPayment.updatedAt = formatVietnamTime(payment.updatedAt);

    return res.status(200).json({
      payment: formattedPayment
    });

  } catch (error) {
    console.error('Lỗi khi lấy chi tiết payment:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách payments cho staff/admin
const getAllPayments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      payment_type,
      payment_method,
      station_id,
      search,
      is_penalty_fee,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem danh sách payments' 
      });
    }

    // Xây dựng query
    const query = { is_active: true };
    if (status) query.status = status;
    if (payment_type) query.payment_type = payment_type;
    if (payment_method) query.payment_method = payment_method;
    if (is_penalty_fee !== undefined) query.is_penalty_fee = is_penalty_fee === 'true';

    // Search
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { transaction_id: { $regex: search, $options: 'i' } }
      ];
    }

    // Staff chỉ xem payments của station mình
    if (req.user.role === 'Station Staff' && req.user.stationId) {
      // Cần join với booking để filter theo station
      const bookings = await Booking.find({ station_id: req.user.stationId }).select('_id');
      const bookingIds = bookings.map(b => b._id);
      query.booking_id = { $in: bookingIds };
    }

    // Tính pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;

    // Lấy payments
    const payments = await Payment.find(query)
      .populate('user_id', 'fullname email phone')
      .populate('booking_id', 'code start_date end_date')
      .populate('rental_id', 'code status')
      .populate('processed_by', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng
    const total = await Payment.countDocuments(query);

    // Format payments
    const formattedPayments = payments.map(payment => {
      const paymentObj = PaymentService.formatPaymentResponse(payment);
      paymentObj.createdAt = formatVietnamTime(payment.createdAt);
      paymentObj.updatedAt = formatVietnamTime(payment.updatedAt);
      return paymentObj;
    });

    return res.status(200).json({
      payments: formattedPayments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        timestamp: formatVietnamTime(nowVietnam(), 'DD/MM/YYYY HH:mm:ss')
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách payments:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};


// VNPay Callback Handler
const handleVNPayCallback = async (req, res) => {
  try {
    const vnpayService = new VNPayService();
    const callbackResult = vnpayService.processCallback(req.query);

    if (!callbackResult.success) {
      // Redirect về frontend với lỗi
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?status=error&message=${encodeURIComponent(callbackResult.message)}`);
    }

    // Tìm payment theo txnRef (numeric version từ VNPay)
    let payment = await Payment.findOne({ 
      vnpay_transaction_no: callbackResult.orderId
    }).populate('user_id', 'fullname email')
      .populate('booking_id', 'code start_date end_date');

    // Nếu không tìm thấy, thử tìm theo orderId (full version với PAY prefix)
    if (!payment) {
      payment = await Payment.findOne({ 
        vnpay_transaction_no: `PAY${callbackResult.orderId}`
      }).populate('user_id', 'fullname email')
        .populate('booking_id', 'code start_date end_date');
    }

    if (!payment) {
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?status=error&message=${encodeURIComponent('Không tìm thấy payment')}`);
    }

    // Nếu payment đã completed (do webhook xử lý trước), redirect luôn
    if (payment.status === 'completed') {
      const vnpayParams = new URLSearchParams({
        vnp_Amount: (payment.amount * 100).toString(),
        vnp_BankCode: 'VNPAY',
        vnp_CardType: 'QRCODE',
        vnp_OrderInfo: `Thanh toan ${payment.code}`,
        vnp_PayDate: nowVietnam().toDate().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
        vnp_ResponseCode: '00',
        vnp_TransactionNo: payment.transaction_id || 'AUTO_' + Date.now(),
        vnp_TransactionStatus: '00',
        vnp_TxnRef: payment.code
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?${vnpayParams.toString()}`);
    }

    // Cập nhật payment status
    if (callbackResult.status === 'success') {
      payment.status = 'completed';
      payment.transaction_id = callbackResult.transactionNo;
      payment.completed_at = nowVietnam().toDate();
      payment.notes = `${payment.notes}\nVNPay: ${callbackResult.message}`;
      
      await payment.save();
      
      // Check and complete rental if all payments are done
      if (payment.rental_id || payment.booking_id) {
        try {
          const Rental = require('../models/Rental');
          const Vehicle = require('../models/Vehicle');
          
          // Find rental by rental_id or by booking_id
          let rental = null;
          if (payment.rental_id) {
            rental = await Rental.findById(payment.rental_id);
          } else if (payment.booking_id) {
            rental = await Rental.findOne({ booking_id: payment.booking_id });
          }
          
          if (rental) {
            // Nếu payment là deposit và rental đang pending_deposit → active
            if (payment.payment_type === 'deposit' && rental.status === 'pending_deposit') {
              await Rental.findByIdAndUpdate(rental._id, { status: 'active' });
              await Vehicle.findByIdAndUpdate(rental.vehicle_id, { status: 'rented' });
              console.log(`✅ Rental ${rental._id} activated - deposit paid via VNPay`);
            }
          
            else if (payment.payment_type === 'rental_fee' && rental.status === 'pending_deposit') {
              await Rental.findByIdAndUpdate(rental._id, { status: 'active' });
              await Vehicle.findByIdAndUpdate(rental.vehicle_id, { status: 'rented' });
              console.log(`✅ Rental ${rental._id} activated - rental fee paid via VNPay (short term rental)`);
            }
            // Nếu payment là rental_fee và rental đang active → completed
            else if (payment.payment_type === 'rental_fee' && rental.status === 'active') {
              await Rental.findByIdAndUpdate(rental._id, { 
                status: 'completed', 
                actual_end_time: nowVietnam().toDate() 
              });
              console.log(`✅ Rental ${rental._id} completed - rental fee paid via VNPay`);
            }
            // Nếu rental đang pending_payment (sau checkout)
            else if (rental.status === 'pending_payment') {
              // Check remaining pending payments for this rental
              const remainingPendingPayments = await Payment.countDocuments({
                $or: [
                  { rental_id: rental._id },
                  { booking_id: rental.booking_id }
                ],
                status: 'pending',
                is_active: true
              });
              
              // If no pending payments for this rental, mark rental as completed
              if (remainingPendingPayments === 0) {
                await Rental.findByIdAndUpdate(rental._id, {
                  status: 'completed'
                });
                
                // Cập nhật booking status thành completed
                await Booking.findByIdAndUpdate(rental.booking_id, {
                  status: 'completed'
                });
                
                // Update vehicle status khi rental completed
                let vehicleStatus = 'available';
                
                // Kiểm tra tình trạng xe để quyết định status
                if (rental.vehicle_condition_after) {
                  const condition = rental.vehicle_condition_after;
                  if (condition.exterior_condition === 'poor' || 
                      condition.interior_condition === 'poor' ||
                      rental.damage_fee > 0 ||
                      condition.battery_level < 20) {
                    vehicleStatus = 'maintenance';
                  }
                }
                
                await Vehicle.findByIdAndUpdate(rental.vehicle_id, {
                  status: vehicleStatus,
                  reserved_for: '',
                  reserved_at: null,
                  reserved_until: null
                });
                
                console.log(`✅ Rental ${rental._id} completed - all payments done via VNPay`);
              }
            }
          }
        } catch (rentalUpdateError) {
          console.error('Error updating rental status:', rentalUpdateError);
          // Don't fail payment confirmation if rental update fails
        }
      }
      
      // Gửi email notification chỉ cho deposit payment
      if (payment.payment_type === 'deposit') {
        await sendPaymentSuccessEmail(payment, payment.user_id);
      }
      
      // Redirect về frontend với thành công
      const vnpayParams = new URLSearchParams({
        vnp_Amount: (payment.amount * 100).toString(),
        vnp_BankCode: 'VNPAY',
        vnp_CardType: 'QRCODE',
        vnp_OrderInfo: `Thanh toan ${payment.code}`,
        vnp_PayDate: nowVietnam().toDate().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
        vnp_ResponseCode: '00',
        vnp_TransactionNo: payment.transaction_id || 'AUTO_' + Date.now(),
        vnp_TransactionStatus: '00',
        vnp_TxnRef: payment.code
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?${vnpayParams.toString()}`);
      
    } else {
      payment.status = 'cancelled';  
      payment.cancelled_at = nowVietnam().toDate();
      payment.notes = `${payment.notes}\nVNPay: ${callbackResult.message}`;
      
      await payment.save();
      
      // Redirect về frontend với thất bại
      const vnpayParams = new URLSearchParams({
        vnp_Amount: (payment.amount * 100).toString(),
        vnp_BankCode: 'VNPAY',
        vnp_CardType: 'QRCODE',
        vnp_OrderInfo: `Thanh toan ${payment.code}`,
        vnp_PayDate: nowVietnam().toDate().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
        vnp_ResponseCode: '99',
        vnp_TransactionNo: payment.transaction_id || 'FAILED_' + Date.now(),
        vnp_TransactionStatus: '99',
        vnp_TxnRef: payment.code
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?${vnpayParams.toString()}`);
    }

  } catch (error) {
    console.error('Lỗi khi xử lý VNPay callback:', error);
    // Redirect về frontend với lỗi hệ thống
    return res.redirect(`${process.env.FRONTEND_URL}/payments/success?status=error&message=System error`);
  }
};

// VNPay Webhook Handler (IPN - Instant Payment Notification)
const handleVNPayWebhook = async (req, res) => {
  try {
    const vnpayService = new VNPayService();
    const webhookResult = vnpayService.processCallback(req.query);

    // Log webhook để debug
    console.log('VNPay Webhook received:', req.query);

    if (!webhookResult.success) {
      console.error('VNPay Webhook invalid:', webhookResult.message);
      return res.status(200).send('RspCode=99&Message=Invalid hash'); // VNPay yêu cầu response format này
    }

    // Tìm payment theo orderId
    const payment = await Payment.findOne({ 
      vnpay_transaction_no: webhookResult.orderId,
      status: 'pending'
    });

    if (!payment) {
      console.error('VNPay Webhook - Payment not found:', webhookResult.orderId);
      return res.status(200).send('RspCode=02&Message=Payment not found');
    }

    // Cập nhật payment status
    if (webhookResult.status === 'success') {
      payment.status = 'completed';
      payment.transaction_id = webhookResult.transactionNo;
      payment.completed_at = nowVietnam().toDate();
      payment.notes = `${payment.notes}\nVNPay IPN: ${webhookResult.message}`;
      
      await payment.save();
      
      console.log(`Payment ${payment.code} completed via VNPay IPN`);
      
      // Cập nhật rental status nếu cần
      try {
        const Rental = require('../models/Rental');
        const Vehicle = require('../models/Vehicle');
        
        // Tìm rental liên quan
        let rental = null;
        if (payment.rental_id) {
          rental = await Rental.findById(payment.rental_id);
        } else if (payment.booking_id) {
          rental = await Rental.findOne({ booking_id: payment.booking_id });
        }
        
        if (rental) {
          // Nếu payment là deposit và rental đang pending_deposit → active
          if (payment.payment_type === 'deposit' && rental.status === 'pending_deposit') {
            await Rental.findByIdAndUpdate(rental._id, { status: 'active' });
            await Vehicle.findByIdAndUpdate(rental.vehicle_id, { status: 'rented' });
            console.log(`✅ Rental ${rental._id} activated - deposit paid via VNPay IPN`);
          }
         
          else if (payment.payment_type === 'rental_fee' && rental.status === 'pending_deposit') {
            await Rental.findByIdAndUpdate(rental._id, { status: 'active' });
            await Vehicle.findByIdAndUpdate(rental.vehicle_id, { status: 'rented' });
            console.log(`✅ Rental ${rental._id} activated - rental fee paid via VNPay IPN (short term rental)`);
          }
          // Nếu payment là rental_fee và rental đang active → completed
          else if (payment.payment_type === 'rental_fee' && rental.status === 'active') {
            await Rental.findByIdAndUpdate(rental._id, { 
              status: 'completed', 
              actual_end_time: new Date() 
            });
            
            
            await Booking.findByIdAndUpdate(rental.booking_id, {
              status: 'completed'
            });
            
            console.log(`✅ Rental ${rental._id} completed - rental fee paid via VNPay IPN`);
          }
          // Các trường hợp khác tương tự như callback handler
        }
      } catch (error) {
        console.error('Error updating rental status after IPN:', error);
        // Không fail webhook response vì lỗi cập nhật rental
      }
      
      return res.status(200).send('RspCode=00&Message=Success');
      
    } else {
      payment.status = 'cancelled';
      payment.cancelled_at = nowVietnam().toDate();
      payment.notes = `${payment.notes}\nVNPay IPN: ${webhookResult.message}`;
      
      await payment.save();
      
      console.log(`Payment ${payment.code} failed via VNPay IPN: ${webhookResult.message}`);
      
      return res.status(200).send('RspCode=00&Message=Confirmed');
    }

  } catch (error) {
    console.error('Lỗi khi xử lý VNPay webhook:', error);
    return res.status(200).send('RspCode=99&Message=Unknown error');
  }
};

// Cập nhật phương thức thanh toán (Staff only)
const updatePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method } = req.body;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể cập nhật phương thức thanh toán' 
      });
    }

    // Validate payment_method
    if (!payment_method || !['cash', 'vnpay'].includes(payment_method)) {
      return res.status(400).json({ 
        message: 'Phương thức thanh toán không hợp lệ. Chỉ chấp nhận: cash, vnpay' 
      });
    }

    // Tìm payment
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ 
        message: 'Không tìm thấy payment' 
      });
    }

    // Kiểm tra status
    if (payment.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Chỉ có thể cập nhật phương thức thanh toán cho payment đang pending' 
      });
    }

    // Cập nhật payment method
    payment.payment_method = payment_method;
    
    // Nếu chuyển sang vnpay, tạo QR code
    if (payment_method === 'vnpay' && payment.amount > 0) {
      const VNPayService = require('../services/VNPayService');
      const vnpayService = new VNPayService();
      const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
      
      const qrData = await vnpayService.createVNPayQR(payment, ipAddress);
      payment.qr_code_data = qrData.qrData;
      payment.qr_code_image = qrData.qrImageUrl;
      payment.vnpay_url = qrData.vnpayData.paymentUrl;
      payment.vnpay_transaction_no = qrData.vnpayData.orderId;
    } else if (payment_method === 'cash') {
      // Xóa VNPay data nếu chuyển về cash
      payment.qr_code_data = '';
      payment.qr_code_image = '';
      payment.vnpay_url = '';
      payment.vnpay_transaction_no = '';
    }

    await payment.save();

    // Populate và trả về
    const updatedPayment = await Payment.findById(payment._id)
      .populate('user_id', 'fullname email phone')
      .populate('booking_id', 'code start_date end_date')
      .populate('rental_id', 'code status')
      .populate('processed_by', 'fullname email');

    res.json({
      success: true,
      message: 'Cập nhật phương thức thanh toán thành công',
      payment: PaymentService.formatPaymentResponse(updatedPayment)
    });

  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server',
      error: error.message 
    });
  }
};

// ========== HOLDING FEE CALLBACK HANDLER ==========
// VNPay Callback for Holding Fee (Online Booking)
const handleHoldingFeeCallback = async (req, res) => {
  try {
    console.log('\n💳 ========== HOLDING FEE CALLBACK ==========');
    console.log('Query params:', req.query);
    
    const vnpayService = new VNPayService();
    const callbackResult = vnpayService.processCallback(req.query);
    
    console.log('Callback result:', callbackResult);
    
    if (!callbackResult.success) {
      console.error('❌ VNPay callback failed:', callbackResult.message);
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=payment_failed&message=${encodeURIComponent(callbackResult.message)}`);
    }
    
   
    const orderInfo = callbackResult.params.vnp_OrderInfo || '';
    const tempIdMatch = orderInfo.match(/PENDING_\d+_[a-z0-9]+/);
    const tempId = tempIdMatch ? tempIdMatch[0] : null;
    
    console.log(`🔑 VNPay OrderInfo: ${orderInfo}`);
    console.log(`📝 Extracted temp_id: ${tempId}`);
    
    if (!tempId) {
      console.error('❌ Cannot extract temp_id from OrderInfo');
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=invalid_order`);
    }
    
    // Find pending booking bằng temp_id
    const PendingBooking = require('../models/PendingBooking');
    const pendingBooking = await PendingBooking.findOne({ 
      temp_id: tempId,
      status: 'pending_payment'
    }).populate('user_id');
    
    if (!pendingBooking) {
      console.error(`❌ Pending booking not found or expired for temp_id: ${tempId}`);
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=expired`);
    }
    
    console.log(`✅ Found pending booking: ${pendingBooking.temp_id} (${pendingBooking._id})`);
    console.log(`👤 User: ${pendingBooking.user_id.fullname} (${pendingBooking.user_id.email})`);
    
    //  DUPLICATE PAYMENT PREVENTION: Check if already paid
    if (pendingBooking.status === 'paid' || pendingBooking.status === 'completed') {
      console.log(`⚠️ PendingBooking already paid - Redirecting to success page`);
      // Tìm booking đã tạo
      const Booking = require('../models/Booking');
      const existingBooking = await Booking.findOne({
        user_id: pendingBooking.user_id._id,
        'holding_fee.payment_id': { $exists: true }
      }).sort({ createdAt: -1 }).limit(1);
      
      if (existingBooking) {
        return res.redirect(`${process.env.FRONTEND_URL}/booking-success?code=${existingBooking.code}&duplicate=true`);
      }
      return res.redirect(`${process.env.FRONTEND_URL}/booking-success?duplicate=true`);
    }
    
    // Check payment status
    if (callbackResult.responseCode !== '00') {
      console.error(`❌ Payment failed - Response code: ${callbackResult.responseCode}`);
      
      // Update pending booking status
      pendingBooking.status = 'cancelled';
      await pendingBooking.save();
      
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=payment_failed&code=${callbackResult.responseCode}`);
    }
    
    // Payment successful - Create actual booking
    console.log('💰 Payment successful - Creating booking...');
    
    const Booking = require('../models/Booking');
    const Vehicle = require('../models/Vehicle');
    const Station = require('../models/Station');
    const QRCode = require('qrcode');
    const { uploadToCloudinary } = require('../config/cloudinary');
    const { sendEmail, getBookingConfirmationTemplate } = require('../config/nodemailer');
    
    // Generate booking code
    const generateBookingCode = async () => {
      let code;
      let exists = true;
      while (exists) {
        code = 'BK' + Math.random().toString(36).substr(2, 6).toUpperCase();
        exists = await Booking.findOne({ code });
      }
      return code;
    };
    
    const code = await generateBookingCode();
    console.log(`📝 Generated booking code: ${code}`);
    
    // Generate QR code
    const qrBuffer = await QRCode.toBuffer(code, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    const cloudinaryResult = await uploadToCloudinary(qrBuffer, 'qr-codes');
    const qrExpiresAt = new Date(pendingBooking.booking_data.start_date.getTime() + 24 * 60 * 60 * 1000);
    
    // ✅ Convert soft lock → hard lock (vehicle already reserved from createBooking)
    const vehicle = await Vehicle.findOneAndUpdate(
      { 
        _id: pendingBooking.booking_data.vehicle_id,
        status: 'reserved',
        reserved_for: 'holding_fee_payment'  // Must be soft lock
      },
      { 
        reserved_for: 'booking',  // Change to hard lock
        $unset: { reserved_until: '' }  // Remove expiry time
      },
      { new: true }
    );
    
    if (!vehicle) {
      console.error('❌ Vehicle not found or not in correct reserved state');
      pendingBooking.status = 'cancelled';
      await pendingBooking.save();
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=vehicle_unavailable`);
    }
    
    console.log(`🚗 Reserved vehicle: ${vehicle.name} (${vehicle.license_plate})`);
    
    // ========== CRITICAL SECTION: Wrap in try-catch with rollback ==========
    let booking = null;
    let payment = null;
    
    try {
      // Create booking
      booking = await Booking.create({
        code,
        user_id: pendingBooking.user_id._id,
        vehicle_id: pendingBooking.booking_data.vehicle_id,
        station_id: pendingBooking.booking_data.station_id,
        start_date: pendingBooking.booking_data.start_date,
        end_date: pendingBooking.booking_data.end_date,
        pickup_time: pendingBooking.booking_data.pickup_time,
        return_time: pendingBooking.booking_data.return_time,
        booking_type: 'online',
        price_per_day: pendingBooking.booking_data.price_per_day,
        total_days: pendingBooking.booking_data.total_days,
        total_price: pendingBooking.booking_data.total_price,
        deposit_amount: pendingBooking.booking_data.deposit_amount,
        special_requests: pendingBooking.booking_data.special_requests || '',
        notes: pendingBooking.booking_data.notes || '',
        qr_code: code,
        qr_expires_at: qrExpiresAt,
        
        // Holding fee info
        holding_fee: {
          amount: 50000,
          status: 'paid',
          payment_method: 'vnpay',
          paid_at: nowVietnam().toDate()
        },
        
        created_by: pendingBooking.user_id._id
      });
      
      console.log(`✅ Created booking: ${booking.code} (${booking._id})`);
      
      // Create Payment record for holding fee
      const Payment = require('../models/Payment');
      payment = await Payment.create({
        code: 'PAY' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        rental_id: null,
        user_id: pendingBooking.user_id._id,
        booking_id: booking._id,
        amount: 50000,
        payment_method: 'vnpay',
        payment_type: 'holding_fee',
        status: 'completed',
        transaction_id: callbackResult.transactionNo,
        completed_at: nowVietnam().toDate(),
        notes: 'Phí giữ chỗ online booking',
        processed_by: pendingBooking.user_id._id
      });
      
      // Link payment to booking
      booking.holding_fee.payment_id = payment._id;
      await booking.save();
      
      console.log(`💳 Created payment: ${payment.code}`);
      
      // Update pending booking status
      pendingBooking.status = 'completed';
      await pendingBooking.save();
      
    } catch (createError) {
      // ❌ ROLLBACK: Unreserve vehicle if booking/payment creation fails
      console.error('❌ CRITICAL ERROR creating booking/payment:', createError);
      console.log('🔄 ROLLBACK: Unreserving vehicle...');
      
      await Vehicle.findByIdAndUpdate(pendingBooking.booking_data.vehicle_id, {
        status: 'available',
        reserved_for: '',
        reserved_at: null,
        reserved_until: null
      });
      
      // Mark pending booking as cancelled
      pendingBooking.status = 'cancelled';
      await pendingBooking.save();
      
      console.log('✅ Vehicle unreserved, pending booking cancelled');
      
      // Delete partial booking if created
      if (booking) {
        await Booking.findByIdAndDelete(booking._id);
        console.log('🗑️ Partial booking deleted');
      }
      
      return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=system_error&message=Failed to create booking`);
    }
    
    // Send confirmation email
    try {
      const station = await Station.findById(booking.station_id);
      const vehicle_full = await Vehicle.findById(booking.vehicle_id);
      
      await sendEmail({
        to: pendingBooking.user_id.email,
        subject: '✅ Xác nhận đặt xe thành công - EV Rental',
        html: getBookingConfirmationTemplate(pendingBooking.user_id.fullname, {
          bookingId: booking._id.toString(),
          bookingCode: booking.code,
          carModel: vehicle_full.name,
          pickupTime: `${booking.pickup_time} - ${booking.start_date.toLocaleDateString('vi-VN')}`,
          pickupLocation: station.name,
          returnTime: `${booking.return_time} - ${booking.end_date.toLocaleDateString('vi-VN')}`,
          totalCost: booking.total_price.toLocaleString('vi-VN') + ' VND',
          qrCode: booking.qr_code,
          qrCodeImage: cloudinaryResult.url,
          qrExpiresAt: booking.qr_expires_at.toLocaleString('vi-VN')
        })
      });
      console.log(`📧 Confirmation email sent to ${pendingBooking.user_id.email}`);
    } catch (emailError) {
      console.error('❌ Email error:', emailError.message);
    }
    
    // Update station stats
    try {
      const station = await Station.findById(booking.station_id);
      await station.syncVehicleCount();
    } catch (stationError) {
      console.log('Station sync failed:', stationError.message);
    }
    
   
    try {
      pendingBooking.status = 'paid';
      await pendingBooking.save();
      console.log(`✅ Marked PendingBooking ${pendingBooking.temp_id} as paid`);
    } catch (pendingError) {
      console.error('❌ Failed to mark PendingBooking as paid:', pendingError.message);
    }
    
    console.log('🔚 ========== END HOLDING FEE CALLBACK ==========\n');
    
    // Redirect to success page
    return res.redirect(`${process.env.FRONTEND_URL}/booking-success?code=${booking.code}&holdingFeePaid=true`);
    
  } catch (error) {
    console.error('❌ Error in holding fee callback:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/booking-failed?reason=system_error`);
  }
};

module.exports = {
  createPayment,
  confirmPayment,
  cancelPayment,
  getUserPayments,
  getPaymentDetails,
  getAllPayments,
  updatePaymentMethod,
  handleVNPayCallback,
  handleVNPayWebhook,
  handleHoldingFeeCallback // NEW
};