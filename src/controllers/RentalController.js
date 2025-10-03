const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const User = require('../models/User');
const Payment = require('../models/Payment');
const PaymentService = require('../services/PaymentService');
const VNPayService = require('../services/VNPayService');
const { uploadToCloudinary } = require('../config/cloudinary');
const { sendEmail, getCheckoutReceiptTemplate } = require('../config/nodemailer');

class RentalController {
  // GET /api/rentals/:id/checkout-info
  static async getCheckoutInfo(req, res) {
    try {
      const { id } = req.params;
      
      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model battery_capacity')
        .populate('station_id', 'name address')
        .populate('pickup_staff_id', 'fullname');

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy rental'
        });
      }

      if (rental.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Rental đã hoàn thành hoặc không hợp lệ'
        });
      }

      // Tính thời gian thuê thực tế
      const now = new Date();
      const rentalDuration = Math.floor((now - rental.actual_start_time) / (1000 * 60 * 60)); // giờ
      
      res.json({
        success: true,
        data: {
          rental: {
            id: rental._id,
            code: rental.code,
            actual_start_time: rental.actual_start_time,
            vehicle_condition_before: rental.vehicle_condition_before,
            images_before: rental.images_before,
            rental_duration_hours: rentalDuration
          },
          customer: {
            id: rental.user_id._id,
            fullname: rental.user_id.fullname,
            email: rental.user_id.email,
            phone: rental.user_id.phone
          },
          vehicle: {
            id: rental.vehicle_id._id,
            name: rental.vehicle_id.name,
            license_plate: rental.vehicle_id.license_plate,
            model: rental.vehicle_id.model,
            battery_capacity: rental.vehicle_id.battery_capacity
          },
          station: {
            id: rental.station_id._id,
            name: rental.station_id.name,
            address: rental.station_id.address
          },
          pickup_staff: {
            id: rental.pickup_staff_id._id,
            fullname: rental.pickup_staff_id.fullname
          }
        }
      });
    } catch (error) {
      console.error('Error getting checkout info:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // PUT /api/rentals/:id/checkout_normal - Checkout bình thường (không có phí phát sinh)
  static async processNormalCheckout(req, res) {
    try {
      const { id } = req.params;
      
      // Xử lý dữ liệu từ multipart/form-data
      const {
        mileage,
        battery_level,
        exterior_condition,
        interior_condition,
        inspection_notes = '',
        damage_desc = '',
        customer_notes = '',
        payment_method = 'cash'
      } = req.body;
      
      const vehicle_condition_after = {
        mileage: parseInt(mileage),
        battery_level: parseInt(battery_level),
        exterior_condition,
        interior_condition,
        notes: inspection_notes
      };
      const staff_notes = inspection_notes;
      const damage_description = damage_desc;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model hourly_rate daily_rate')
        .populate('station_id', 'name address')
        .populate('booking_id', 'end_date total_days total_price deposit_amount');

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy rental'
        });
      }

      if (rental.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Rental đã hoàn thành'
        });
      }

      // Validate vehicle condition
      if (!vehicle_condition_after || 
          !vehicle_condition_after.mileage || 
          vehicle_condition_after.battery_level === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin tình trạng xe'
        });
      }

      // CHECKOUT BÌNH THƯỜNG - TẤT CẢ PHÍ = 0
      const total_fees = 0;

      // Files đã được upload bởi multer CloudinaryStorage
      let uploadedImages = [];
      if (req.files && req.files.length > 0) {
        uploadedImages = req.files.map(file => file.path); // CloudinaryStorage đã trả về URL
      }

      // Cập nhật rental
      rental.actual_end_time = new Date();
      rental.return_staff_id = req.user._id;
      rental.vehicle_condition_after = vehicle_condition_after;
      rental.late_fee = 0;
      rental.damage_fee = 0;
      rental.other_fees = 0;
      rental.total_fees = 0;
      rental.staff_notes = staff_notes;
      rental.customer_notes = customer_notes;
      rental.status = 'pending_payment';
      
      // THAY THẾ ảnh cũ bằng ảnh mới (không duplicate)
      if (uploadedImages.length > 0) {
        rental.images_after = uploadedImages; // Replace thay vì append
      }

      await rental.save();

      // Cập nhật UserStats
      try {
        const { UserStats } = require('../models');
        let userStats = await UserStats.findOne({ user_id: rental.user_id._id });
        
        if (!userStats) {
          userStats = new UserStats({ user_id: rental.user_id._id });
        }

        // Tính toán dữ liệu rental
        const distance = vehicle_condition_after.mileage - rental.vehicle_condition_before.mileage;
        const days = (rental.actual_end_time - rental.actual_start_time) / (1000 * 60 * 60 * 24);
        const spent = rental.total_price + total_fees;
        
        // Lấy thông tin vehicle và station
        const vehicle = await Vehicle.findById(rental.vehicle_id._id);
        const station = await Station.findById(rental.station_id._id);
        
        await userStats.updateStats({
          distance: Math.max(0, distance),
          spent: spent,
          days: Math.max(0, days),
          vehicle_type: vehicle?.type,
          station_id: rental.station_id._id,
          rental_date: rental.actual_start_time
        });
      } catch (statsError) {
        console.error('Error updating user stats:', statsError);
        // Không fail checkout vì stats update lỗi
      }

      // Cập nhật trạng thái xe dựa trên tình trạng
      let vehicleStatus = 'available';
      if (vehicle_condition_after.exterior_condition === 'poor' || 
          vehicle_condition_after.interior_condition === 'poor' ||
          vehicle_condition_after.battery_level < 20) { // Pin dưới 20% cần sạc
        vehicleStatus = 'maintenance';
      }

      await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
        status: vehicleStatus,
        current_mileage: vehicle_condition_after.mileage,
        battery_level: vehicle_condition_after.battery_level
      });

      // Tạo payments cho checkout
      const payments = [];
      
      // 1. Thanh toán chính (cọc còn lại hoặc phí thuê còn lại)
      if (rental.booking_id.total_days >= 3) {
        // Thuê >= 3 ngày: Thanh toán cọc còn lại
        const remainingDeposit = rental.booking_id.total_price - rental.booking_id.deposit_amount;
        if (remainingDeposit > 0) {
          const depositPayment = new Payment({
            code: PaymentService.generatePaymentCode(),
            rental_id: rental._id,
            user_id: rental.user_id._id,
            booking_id: rental.booking_id._id,
            amount: remainingDeposit,
            payment_method: payment_method,
            status: 'pending',
            description: `Thanh toán cọc còn lại cho thuê xe ${rental.code}`,
            payment_type: 'deposit',
            processed_by: req.user._id
          });
          await depositPayment.save();
          payments.push(depositPayment);
        }
      }
      // Thuê < 3 ngày: Đã thanh toán full khi confirm, không cần thanh toán thêm

      // Gửi email receipt
      try {
        await sendCheckoutReceiptEmail(rental, payments);
      } catch (emailError) {
        console.error('Error sending checkout email:', emailError);
        // Không fail checkout vì email lỗi
      }

      // Tính tổng thanh toán
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

      // Generate VNPay URLs nếu có payments với payment_method = 'vnpay'
      const paymentUrls = {};
      const vnpayService = new VNPayService();
      const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
      
      for (const payment of payments) {
        if (payment.payment_method === 'vnpay' && payment.amount > 0) {
          try {
            const vnpayData = vnpayService.createPaymentUrl(payment, clientIP);
            payment.vnpay_url = vnpayData.paymentUrl;
            payment.vnpay_transaction_no = vnpayData.orderId;
            await payment.save();
            
            paymentUrls[payment._id] = {
              paymentUrl: vnpayData.paymentUrl,
              orderId: vnpayData.orderId,
              amount: payment.amount,
              paymentType: payment.payment_type
            };
          } catch (vnpayError) {
            console.error('VNPay URL generation failed:', vnpayError);
            // Fallback: still return payment info, just without URL
          }
        }
      }

      res.json({
        success: true,
        message: 'Checkout bình thường thành công',
        data: {
          rental: {
            id: rental._id,
            code: rental.code,
            actual_end_time: rental.actual_end_time,
            total_fees: total_fees,
            status: rental.status // pending_payment until payments completed
          },
          fee_breakdown: {
            late_fee: 0,
            damage_fee: 0,
            other_fees: 0,
            total_fees: 0
          },
          payments: payments.map(payment => ({
            id: payment._id,
            type: payment.payment_type,
            amount: payment.amount,
            status: payment.status,
            description: payment.description,
            payment_method: payment.payment_method
          })),
          total_paid: totalPaid,
          vehicle_status: vehicleStatus,
          payment_urls: Object.keys(paymentUrls).length > 0 ? paymentUrls : undefined,
          images: uploadedImages.length > 0 ? {
            uploaded: uploadedImages
          } : null
        }
      });
    } catch (error) {
      console.error('Error processing normal checkout:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // PUT /api/rentals/:id/checkout-fees - Checkout có phí phát sinh (staff tự nhập)
  static async processCheckoutWithFees(req, res) {
    try {
      const { id } = req.params;
      
      // Xử lý dữ liệu từ multipart/form-data
      const {
        mileage,
        battery_level,
        exterior_condition,
        interior_condition,
        inspection_notes = '',
        damage_desc = '',
        customer_notes = '',
        payment_method = 'cash',
        // Manual fee inputs từ staff
        late_fee = 0,
        damage_fee = 0,
        other_fees = 0
      } = req.body;
      
      const vehicle_condition_after = {
        mileage: parseInt(mileage),
        battery_level: parseInt(battery_level),
        exterior_condition,
        interior_condition,
        notes: inspection_notes
      };
      const staff_notes = inspection_notes;
      const damage_description = damage_desc;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model hourly_rate daily_rate')
        .populate('station_id', 'name address')
        .populate('booking_id', 'end_date total_days total_price deposit_amount');

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy rental'
        });
      }

      if (rental.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Rental đã hoàn thành'
        });
      }

      // Validate vehicle condition
      if (!vehicle_condition_after || 
          !vehicle_condition_after.mileage || 
          vehicle_condition_after.battery_level === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin tình trạng xe'
        });
      }

      // Validate fee inputs (phải là số không âm)
      const validatedLateFee = Math.max(0, parseInt(late_fee) || 0);
      const validatedDamageFee = Math.max(0, parseInt(damage_fee) || 0);
      const validatedOtherFees = Math.max(0, parseInt(other_fees) || 0);

      // CHECKOUT CÓ PHÍ PHÁT SINH - STAFF TỰ NHẬP
      const total_fees = validatedLateFee + validatedDamageFee + validatedOtherFees;

      // Validate có phí phát sinh hay không
      if (total_fees === 0) {
        return res.status(400).json({
          success: false,
          message: 'Endpoint này dành cho trường hợp có phí phát sinh',
          suggestion: 'Sử dụng endpoint /checkout-normal nếu không có phí phát sinh'
        });
      }

      // Files đã được upload bởi multer CloudinaryStorage
      let uploadedImages = [];
      if (req.files && req.files.length > 0) {
        uploadedImages = req.files.map(file => file.path); // CloudinaryStorage đã trả về URL
      }

      // Cập nhật rental
      rental.actual_end_time = new Date();
      rental.return_staff_id = req.user._id;
      rental.vehicle_condition_after = vehicle_condition_after;
      rental.late_fee = validatedLateFee;
      rental.damage_fee = validatedDamageFee;
      rental.other_fees = validatedOtherFees;
      rental.total_fees = total_fees;
      rental.staff_notes = staff_notes;
      rental.customer_notes = customer_notes;
      rental.status = 'pending_payment';
      
      // THAY THẾ ảnh cũ bằng ảnh mới (không duplicate)
      if (uploadedImages.length > 0) {
        rental.images_after = uploadedImages; // Replace thay vì append
      }

      await rental.save();

      // Cập nhật UserStats
      try {
        const { UserStats } = require('../models');
        let userStats = await UserStats.findOne({ user_id: rental.user_id._id });
        
        if (!userStats) {
          userStats = new UserStats({ user_id: rental.user_id._id });
        }

        // Tính toán dữ liệu rental
        const distance = vehicle_condition_after.mileage - rental.vehicle_condition_before.mileage;
        const days = (rental.actual_end_time - rental.actual_start_time) / (1000 * 60 * 60 * 24);
        const spent = rental.total_price + total_fees;
        
        // Lấy thông tin vehicle và station
        const vehicle = await Vehicle.findById(rental.vehicle_id._id);
        const station = await Station.findById(rental.station_id._id);
        
        await userStats.updateStats({
          distance: Math.max(0, distance),
          spent: spent,
          days: Math.max(0, days),
          vehicle_type: vehicle?.type,
          station_id: rental.station_id._id,
          rental_date: rental.actual_start_time
        });
      } catch (statsError) {
        console.error('Error updating user stats:', statsError);
        // Không fail checkout vì stats update lỗi
      }

      // Cập nhật trạng thái xe dựa trên tình trạng
      let vehicleStatus = 'available';
      if (vehicle_condition_after.exterior_condition === 'poor' || 
          vehicle_condition_after.interior_condition === 'poor' ||
          damage_fee > 0 ||
          vehicle_condition_after.battery_level < 20) { // Pin dưới 20% cần sạc
        vehicleStatus = 'maintenance';
      }

      await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
        status: vehicleStatus,
        current_mileage: vehicle_condition_after.mileage,
        battery_level: vehicle_condition_after.battery_level
      });

      // Tạo payments cho checkout
      const payments = [];
      
      // 1. Thanh toán chính (cọc còn lại hoặc phí thuê còn lại)
      if (rental.booking_id.total_days >= 3) {
        // Thuê >= 3 ngày: Thanh toán cọc còn lại
        const remainingDeposit = rental.booking_id.total_price - rental.booking_id.deposit_amount;
        if (remainingDeposit > 0) {
          const depositPayment = new Payment({
            code: PaymentService.generatePaymentCode(),
            rental_id: rental._id,
            user_id: rental.user_id._id,
            booking_id: rental.booking_id._id,
            amount: remainingDeposit,
            payment_method: payment_method,
            status: 'pending',
            description: `Thanh toán cọc còn lại cho thuê xe ${rental.code}`,
            payment_type: 'deposit',
            processed_by: req.user._id
          });
          await depositPayment.save();
          payments.push(depositPayment);
        }
      }
      // Thuê < 3 ngày: Đã thanh toán full khi confirm, không cần thanh toán thêm
      
      // 2. Phí phát sinh (có luôn vì đã validate total_fees > 0)
      const additionalPayment = new Payment({
        code: PaymentService.generatePaymentCode(),
        rental_id: rental._id,
        user_id: rental.user_id._id,
        booking_id: rental.booking_id._id,
        amount: total_fees,
        payment_method: payment_method,
        status: 'pending',
        description: `Phí phát sinh thuê xe ${rental.code}`,
        payment_type: 'additional_fee',
        processed_by: req.user._id
      });
      await additionalPayment.save();
      payments.push(additionalPayment);

      // Gửi email receipt
      try {
        // await sendCheckoutReceiptEmail(rental, payments);
      } catch (emailError) {
        console.error('Error sending checkout email:', emailError);
        // Không fail checkout vì email lỗi
      }

      // Tính tổng thanh toán
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

      // Generate VNPay URLs nếu có payments với payment_method = 'vnpay'
      const paymentUrls = {};
      const vnpayService = new VNPayService();
      const clientIP = req.ip || req.connection.remoteAddress || '127.0.0.1';
      
      for (const payment of payments) {
        if (payment.payment_method === 'vnpay' && payment.amount > 0) {
          try {
            const vnpayData = vnpayService.createPaymentUrl(payment, clientIP);
            payment.vnpay_url = vnpayData.paymentUrl;
            payment.vnpay_transaction_no = vnpayData.orderId;
            await payment.save();
            
            paymentUrls[payment._id] = {
              paymentUrl: vnpayData.paymentUrl,
              orderId: vnpayData.orderId,
              amount: payment.amount,
              paymentType: payment.payment_type
            };
          } catch (vnpayError) {
            console.error('VNPay URL generation failed:', vnpayError);
            // Fallback: still return payment info, just without URL
          }
        }
      }

      res.json({
        success: true,
        message: 'Checkout có phí phát sinh thành công',
        data: {
          rental: {
            id: rental._id,
            code: rental.code,
            actual_end_time: rental.actual_end_time,
            total_fees: total_fees,
            status: rental.status // pending_payment until payments completed
          },
          fee_breakdown: {
            late_fee: validatedLateFee,
            damage_fee: validatedDamageFee,
            other_fees: validatedOtherFees,
            total_fees
          },
          payments: payments.map(payment => ({
            id: payment._id,
            type: payment.payment_type,
            amount: payment.amount,
            status: payment.status,
            description: payment.description,
            payment_method: payment.payment_method
          })),
          total_paid: totalPaid,
          vehicle_status: vehicleStatus,
          payment_urls: Object.keys(paymentUrls).length > 0 ? paymentUrls : undefined,
          images: uploadedImages.length > 0 ? {
            uploaded: uploadedImages
          } : null
        }
      });
    } catch (error) {
      console.error('Error processing checkout with fees:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // GET /api/rentals/user - Lấy rentals của customer
  static async getUserRentals(req, res) {
    try {
      const { 
        status, 
        page = 1, 
        limit = 10 
      } = req.query;

      const filter = {
        user_id: req.user._id // Customer chỉ xem rentals của mình
      };
      
      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      const rentals = await Rental.find(filter)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model')
        .populate('station_id', 'name address')
        .populate('pickup_staff_id', 'fullname')
        .populate('return_staff_id', 'fullname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting user rentals:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // GET /api/rentals/staff - Lấy rentals tại station của staff
  static async getStaffRentals(req, res) {
    try {
      const { 
        status, 
        page = 1, 
        limit = 10 
      } = req.query;

      const filter = {
        station_id: req.user.stationId // Staff chỉ xem rentals tại station của mình
      };
      
      if (status) filter.status = status;

      const skip = (page - 1) * limit;

      const rentals = await Rental.find(filter)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model')
        .populate('station_id', 'name address')
        .populate('pickup_staff_id', 'fullname')
        .populate('return_staff_id', 'fullname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting staff rentals:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // GET /api/rentals/admin - Lấy tất cả rentals (admin only)
  static async getAdminRentals(req, res) {
    try {
      const { 
        status, 
        user_id, 
        station_id, 
        page = 1, 
        limit = 10 
      } = req.query;

      const filter = {};
      
      // Admin có thể filter theo tất cả params
      if (status) filter.status = status;
      if (user_id) filter.user_id = user_id;
      if (station_id) filter.station_id = station_id;

      const skip = (page - 1) * limit;

      const rentals = await Rental.find(filter)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model')
        .populate('station_id', 'name address')
        .populate('pickup_staff_id', 'fullname')
        .populate('return_staff_id', 'fullname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Error getting admin rentals:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // GET /api/rentals/:id
  static async getRentalDetails(req, res) {
    try {
      const { id } = req.params;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model battery_capacity')
        .populate('station_id', 'name address')
        .populate('pickup_staff_id', 'fullname')
        .populate('return_staff_id', 'fullname')
        .populate('booking_id', 'start_date end_date total_price');

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy rental'
        });
      }

      res.json({
        success: true,
        data: rental
      });
    } catch (error) {
      console.error('Error getting rental details:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }
}

// Helper function để gửi email checkout receipt
async function sendCheckoutReceiptEmail(rental, payments) {
  try {
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const hasPayments = payments.length > 0;
    
    const emailContent = getCheckoutReceiptTemplate({
      customer_name: rental.user_id.fullname,
      customer_email: rental.user_id.email,
      rental_code: rental.code,
      vehicle_name: rental.vehicle_id.name,
      license_plate: rental.vehicle_id.license_plate,
      station_name: rental.station_id.name,
      actual_start_time: rental.actual_start_time,
      actual_end_time: rental.actual_end_time,
      late_fee: rental.late_fee,
      damage_fee: rental.damage_fee,
      other_fees: rental.other_fees,
      total_fees: rental.total_fees,
      staff_notes: rental.staff_notes,
      has_payment: hasPayments,
      total_paid: totalPaid,
      payment_count: payments.length
    });

    await sendEmail({
      to: rental.user_id.email,
      subject: `Biên lai trả xe - ${rental.code}`,
      html: emailContent
    });

    console.log(`✅ Checkout receipt email sent to ${rental.user_id.email}`);
  } catch (error) {
    console.error('Error sending checkout receipt email:', error);
    throw error;
  }
}

module.exports = RentalController;