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
      completed_at: paymentStatus === 'completed' ? new Date() : null
    });

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
    payment.completed_at = new Date();
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
                actual_end_time: new Date()
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
                status: vehicleStatus
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
    payment.cancelled_at = new Date();
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
        vnp_PayDate: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
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
      payment.completed_at = new Date();
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
                actual_end_time: new Date() 
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
                  status: vehicleStatus
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
        vnp_PayDate: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
        vnp_ResponseCode: '00',
        vnp_TransactionNo: payment.transaction_id || 'AUTO_' + Date.now(),
        vnp_TransactionStatus: '00',
        vnp_TxnRef: payment.code
      });
      return res.redirect(`${process.env.FRONTEND_URL}/payments/success?${vnpayParams.toString()}`);
      
    } else {
      payment.status = 'cancelled';  
      payment.cancelled_at = new Date();
      payment.notes = `${payment.notes}\nVNPay: ${callbackResult.message}`;
      
      await payment.save();
      
      // Redirect về frontend với thất bại
      const vnpayParams = new URLSearchParams({
        vnp_Amount: (payment.amount * 100).toString(),
        vnp_BankCode: 'VNPAY',
        vnp_CardType: 'QRCODE',
        vnp_OrderInfo: `Thanh toan ${payment.code}`,
        vnp_PayDate: new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14),
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
      payment.completed_at = new Date();
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
      payment.cancelled_at = new Date();
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

module.exports = {
  createPayment,
  confirmPayment,
  cancelPayment,
  getUserPayments,
  getPaymentDetails,
  getAllPayments,
  updatePaymentMethod,
  handleVNPayCallback,
  handleVNPayWebhook
};