const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Contract = require('../models/Contract');
const Booking = require('../models/Booking');
const PaymentService = require('../services/PaymentService');
const VNPayService = require('../services/VNPayService');
const { uploadToCloudinary } = require('../config/cloudinary');
const { nowVietnam } = require('../config/timezone');
const { sendEmail, getCheckoutReceiptTemplate } = require('../config/emailService');

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
      const now = nowVietnam().toDate();
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
      
      // Debug logs để kiểm tra data từ FE
      console.log('🔍 DEBUG - Raw data từ FE:');
      console.log('- mileage (raw):', mileage, typeof mileage);
      console.log('- battery_level (raw):', battery_level, typeof battery_level);
      
      const vehicle_condition_after = {
        mileage: Math.max(0, parseInt(mileage) || 0),
        battery_level: Math.max(0, Math.min(100, parseInt(battery_level) || 0)),
        exterior_condition,
        interior_condition,
        notes: inspection_notes
      };
      
      console.log('🔍 DEBUG - Sau khi parse:');
      console.log('- mileage (parsed):', vehicle_condition_after.mileage);
      console.log('- battery_level (parsed):', vehicle_condition_after.battery_level);
      const staff_notes = inspection_notes;
      const damage_description = damage_desc;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model hourly_rate price_per_day')
        .populate('station_id', 'name address')
        .populate('booking_id', 'start_date end_date pickup_time total_days total_price deposit_amount');

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

      // YÊU CẦU: Phải có contract đã ký trước khi checkout
      const signedContractWithFees = await Contract.findOne({
        rental_id: rental._id,
        status: 'signed',
        is_active: true
      });

      if (!signedContractWithFees) {
        return res.status(400).json({
          success: false,
          message: 'Chưa ký hợp đồng. Không thể checkout.'
        });
      }

      // YÊU CẦU: Phải có contract đã ký trước khi checkout
      const signedContractNormal = await Contract.findOne({
        rental_id: rental._id,
        status: 'signed',
        is_active: true
      });

      if (!signedContractNormal) {
        return res.status(400).json({
          success: false,
          message: 'Chưa ký hợp đồng. Không thể checkout.'
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

     
      const mileageBefore = rental.vehicle_condition_before.mileage;
      const mileageAfter = vehicle_condition_after.mileage;

      if (mileageAfter < mileageBefore) {
        return res.status(400).json({
          success: false,
          message: `Số km khi trả xe (${mileageAfter} km) không thể nhỏ hơn số km khi nhận xe (${mileageBefore} km). Vui lòng kiểm tra lại.`
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
      rental.actual_end_time = nowVietnam().toDate();
      rental.return_staff_id = req.user._id;
      rental.vehicle_condition_after = vehicle_condition_after;
      rental.late_fee = 0;
      rental.damage_fee = 0;
      rental.other_fees = 0;
      rental.total_fees = 0;
      rental.staff_notes = staff_notes;
      rental.customer_notes = customer_notes;
      
      // XỬ LÝ STATUS DỰA TRÊN SỐ NGÀY THUÊ
      if (rental.booking_id.total_days < 3) {
        // Thuê < 3 ngày: Đã thanh toán full → completed ngay
        rental.status = 'completed';
        
        
        await Booking.findByIdAndUpdate(rental.booking_id._id, {
          status: 'completed'
        });
      } else {
        // Thuê >= 3 ngày: Cần thanh toán cọc còn lại → pending_payment
        rental.status = 'pending_payment';
      }
      
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
        const spent = rental.booking_id.total_price + total_fees;
        
        // Lấy thông tin vehicle và station
        const vehicle = await Vehicle.findById(rental.vehicle_id._id);
        const station = await Station.findById(rental.station_id._id);
        
        // Tạo rental_date từ booking pickup_time (thời gian user muốn nhận xe)
      
        const [hour, minute] = rental.booking_id.pickup_time.split(':').map(Number);
        const rentalDate = new Date(rental.booking_id.start_date);
        rentalDate.setHours(hour, minute, 0, 0);
        
        await userStats.updateStats({
          distance: Math.max(0, distance),
          spent: spent,
          days: Math.max(0, days),
          vehicle_type: vehicle?.type,
          station_id: rental.station_id._id,
          rental_date: rentalDate // Dùng booking pickup_time thay vì actual_start_time
        });
      } catch (statsError) {
        console.error('Error updating user stats:', statsError);
        // Không fail checkout vì stats update lỗi
      }

      // Cập nhật trạng thái xe dựa trên tình trạng
      let vehicleStatus = 'available';
      let technicalStatus = 'good';
      
      // Kiểm tra tình trạng xe
      const isPoorCondition = 
        vehicle_condition_after.exterior_condition === 'poor' || 
        vehicle_condition_after.interior_condition === 'poor';
      
      const isLowBattery = vehicle_condition_after.battery_level < 20;
      
      if (isPoorCondition) {
        vehicleStatus = 'maintenance';
        technicalStatus = 'needs_maintenance';
        console.log('⚠️  Vehicle needs maintenance: poor condition');
      } else if (isLowBattery) {
        vehicleStatus = 'maintenance';
        technicalStatus = 'needs_maintenance';
        console.log(`⚠️  Vehicle needs maintenance: low battery (${vehicle_condition_after.battery_level}%)`);
      }

      // CHỈ UPDATE VEHICLE STATUS NẾU RENTAL COMPLETED
      if (rental.status === 'completed') {
        console.log('🔍 DEBUG - Updating vehicle (completed):');
        console.log('- Vehicle ID:', rental.vehicle_id._id);
        console.log('- Status:', vehicleStatus);
        console.log('- Technical Status:', technicalStatus);
        console.log('- Mileage:', vehicle_condition_after.mileage);
        console.log('- Battery:', vehicle_condition_after.battery_level);
        
        await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
          status: vehicleStatus,
          technical_status: technicalStatus,
          current_mileage: vehicle_condition_after.mileage,
          current_battery: vehicle_condition_after.battery_level
        });
        
        // Tự động tạo Maintenance report nếu cần
        if (isPoorCondition || isLowBattery) {
          const Maintenance = require('../models/Maintenance');
          const Vehicle = require('../models/Vehicle');
          
          // Lấy vehicle với station_id
          const vehicle = await Vehicle.findById(rental.vehicle_id._id).select('name station_id');
          
          if (vehicle && vehicle.station_id) {
            const maintenanceCode = `MT${Date.now().toString().substring(6)}_${vehicle.name}`;
            
            await Maintenance.create({
              code: maintenanceCode,
              vehicle_id: vehicle._id,
              station_id: vehicle.station_id,
              maintenance_type: isPoorCondition ? 'damage' : 'low_battery',
              title: isPoorCondition 
                ? `Bảo trì xe ${vehicle.name} - Tình trạng kém`
                : `Sạc pin xe ${vehicle.name}`,
              description: isPoorCondition
                ? `Xe có tình trạng kém: ${vehicle_condition_after.exterior_condition === 'poor' ? 'Ngoại thất hư hỏng' : 'Nội thất hư hỏng'}`
                : `Pin còn ${vehicle_condition_after.battery_level}% - Cần sạc đến 80% trở lên`,
              status: 'reported',
              reported_by: req.user._id
            });
            
            console.log(`✅ Auto-created ${isPoorCondition ? 'damage' : 'low_battery'} maintenance report`);
          } else {
            console.warn('⚠️ Cannot create maintenance report: vehicle has no station_id');
          }
        }
        
      } else {
        // Nếu pending_payment, chỉ update mileage và battery
        console.log('🔍 DEBUG - Updating vehicle (pending_payment):');
        console.log('- Vehicle ID:', rental.vehicle_id._id);
        console.log('- Mileage:', vehicle_condition_after.mileage);
        console.log('- Battery:', vehicle_condition_after.battery_level);
        
        await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
          current_mileage: vehicle_condition_after.mileage,
          current_battery: vehicle_condition_after.battery_level
        });
      }

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
            is_penalty_fee: false, //  Checkout bình thường, không có phí phạt
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
            
            let vnpayPaymentType;
            if (payment.payment_type === 'additional_fee') {
              vnpayPaymentType = 'checkout_fee';  
            } else if (payment.payment_type === 'deposit') {
              vnpayPaymentType = 'confirm_booking'; 
            } else if (payment.payment_type === 'rental_fee') {
              vnpayPaymentType = 'confirm_booking';  
            } else {
              vnpayPaymentType = 'holding_fee'; 
            }
            
            console.log(`💳 Creating VNPay URL - DB type: ${payment.payment_type} → VNPay type: ${vnpayPaymentType}`);
            
            const vnpayData = vnpayService.createPaymentUrl({
              payment_code: payment.code,
              amount: payment.amount,
              payment_type: payment.payment_type
            }, clientIP, vnpayPaymentType);
            
            payment.vnpay_url = vnpayData.paymentUrl;
            payment.vnpay_transaction_no = vnpayData.txnRef;
            await payment.save();
            
            paymentUrls[payment._id] = {
              paymentUrl: vnpayData.paymentUrl,
              orderId: vnpayData.orderId,
              amount: payment.amount,
              paymentType: payment.payment_type,
              description: payment.description
            };
          } catch (vnpayError) {
            console.error('VNPay URL generation failed for payment:', payment._id, vnpayError);
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
            status: rental.status // completed cho < 3 ngày, pending_payment cho >= 3 ngày
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
          } : null,
          // Thêm thông tin về logic xử lý
          checkout_info: {
            rental_days: rental.booking_id.total_days,
            payment_required: rental.booking_id.total_days >= 3,
            status_reason: rental.booking_id.total_days < 3 
              ? 'Đã thanh toán full khi confirm' 
              : 'Cần thanh toán cọc còn lại'
          }
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
      
      // Debug logs để kiểm tra data từ FE
      console.log('🔍 DEBUG - Raw data từ FE (checkout with fees):');
      console.log('- mileage (raw):', mileage, typeof mileage);
      console.log('- battery_level (raw):', battery_level, typeof battery_level);
      
      const vehicle_condition_after = {
        mileage: Math.max(0, parseInt(mileage) || 0),
        battery_level: Math.max(0, Math.min(100, parseInt(battery_level) || 0)),
        exterior_condition,
        interior_condition,
        notes: inspection_notes
      };
      
      console.log('🔍 DEBUG - Sau khi parse (checkout with fees):');
      console.log('- mileage (parsed):', vehicle_condition_after.mileage);
      console.log('- battery_level (parsed):', vehicle_condition_after.battery_level);
      const staff_notes = inspection_notes;
      const damage_description = damage_desc;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model hourly_rate price_per_day')
        .populate('station_id', 'name address')
        .populate('booking_id', 'start_date end_date pickup_time total_days total_price deposit_amount');

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

      // YÊU CẦU: Phải có contract đã ký trước khi checkout
      const signedContractWithFees = await Contract.findOne({
        rental_id: rental._id,
        status: 'signed',
        is_active: true
      });

      if (!signedContractWithFees) {
        return res.status(400).json({
          success: false,
          message: 'Chưa ký hợp đồng. Không thể checkout.'
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

      
      const mileageBefore = rental.vehicle_condition_before.mileage;
      const mileageAfter = vehicle_condition_after.mileage;

      if (mileageAfter < mileageBefore) {
        return res.status(400).json({
          success: false,
          message: `Số km khi trả xe (${mileageAfter} km) không thể nhỏ hơn số km khi nhận xe (${mileageBefore} km). Vui lòng kiểm tra lại.`
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
      rental.actual_end_time = nowVietnam().toDate();
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

      // Tạo payments cho checkout TRƯỚC KHI save rental
      const payments = [];
      
      // INVALIDATE OLD PENDING PAYMENTS cho rental này
      await Payment.updateMany(
        { 
          rental_id: rental._id,
          status: 'pending',
          is_active: true
        },
        { 
          is_active: false,
          notes: 'Invalidated due to new checkout with fees'
        }
      );
      
      // Tính cọc còn lại (nếu có)
      let remainingDeposit = 0;
      if (rental.booking_id.total_days >= 3) {
        remainingDeposit = rental.booking_id.total_price - rental.booking_id.deposit_amount;
      }
      
      // TẠO 2 PAYMENTS RIÊNG BIỆT
      
      // Payment 1: Phí phạt (nếu có)
      if (total_fees > 0) {
        const penaltyPayment = new Payment({
          code: PaymentService.generatePaymentCode(),
          rental_id: rental._id,
          user_id: rental.user_id._id,
          booking_id: rental.booking_id._id,
          amount: total_fees,
          payment_method: payment_method,
          status: 'pending',
          description: `Phí phát sinh thuê xe ${rental.code}`,
          payment_type: 'additional_fee',
          is_penalty_fee: true,
          processed_by: req.user._id
        });
        await penaltyPayment.save();
        payments.push(penaltyPayment);
      }
      
      // Payment 2: Cọc còn lại (nếu có)
      if (remainingDeposit > 0) {
        const depositPayment = new Payment({
          code: PaymentService.generatePaymentCode(),
          rental_id: rental._id,
          user_id: rental.user_id._id,
          booking_id: rental.booking_id._id,
          amount: remainingDeposit,
          payment_method: payment_method,
          status: 'pending',
          description: `Cọc còn lại thuê xe ${rental.code}`,
          payment_type: 'deposit',
          is_penalty_fee: false,
          processed_by: req.user._id
        });
        await depositPayment.save();
        payments.push(depositPayment);
      }

      // Bây giờ mới save rental
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
        const spent = rental.booking_id.total_price + total_fees;
        
        // Lấy thông tin vehicle và station
        const vehicle = await Vehicle.findById(rental.vehicle_id._id);
        const station = await Station.findById(rental.station_id._id);
        
        // Tạo violation_data nếu có phí phát sinh
        let violation_data = null;
        if (validatedLateFee > 0) {
          violation_data = {
            type: 'late_return',
            description: `Trả xe muộn - Phí: ${validatedLateFee.toLocaleString('vi-VN')} VND`,
            severity: 'medium',
            points: 5,
           
            resolved: true,
            resolved_date: nowVietnam().toDate(),
            resolved_by: req.user._id
          };
        } else if (validatedDamageFee > 0) {
          violation_data = {
            type: 'damage',
            description: `Làm hỏng xe - Phí: ${validatedDamageFee.toLocaleString('vi-VN')} VND`,
            severity: 'high',
            points: 10,
            // Auto-resolve vì đã tính phí
            resolved: true,
            resolved_date: nowVietnam().toDate(),
            resolved_by: req.user._id
          };
        } else if (validatedOtherFees > 0) {
          violation_data = {
            type: 'rule_violation',
            description: `Vi phạm quy định - Phí: ${validatedOtherFees.toLocaleString('vi-VN')} VND`,
            severity: 'low',
            points: 5,
            // Auto-resolve vì đã tính phí
            resolved: true,
            resolved_date: nowVietnam().toDate(),
            resolved_by: req.user._id
          };
        }
        
        await userStats.updateStats({
          distance: Math.max(0, distance),
          spent: spent,
          days: Math.max(0, days),
          vehicle_type: vehicle?.type,
          station_id: rental.station_id._id,
          rental_date: rental.actual_start_time,
          violation_data: violation_data
        });
      } catch (statsError) {
        console.error('Error updating user stats:', statsError);
        // Không fail checkout vì stats update lỗi
      }

      // Cập nhật trạng thái xe dựa trên tình trạng
      // CHỈ UPDATE MILEAGE VÀ BATTERY, KHÔNG ĐỔI STATUS
      // Status sẽ được update khi payment completed
      console.log('🔍 DEBUG - Updating vehicle (checkout with fees):');
      console.log('- Vehicle ID:', rental.vehicle_id._id);
      console.log('- Mileage:', vehicle_condition_after.mileage);
      console.log('- Battery:', vehicle_condition_after.battery_level);
      
      await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
        current_mileage: vehicle_condition_after.mileage,
        current_battery: vehicle_condition_after.battery_level
      });

      // Tự động tạo Maintenance report nếu phát hiện vấn đề
      const isPoorCondition = 
        vehicle_condition_after.exterior_condition === 'poor' || 
        vehicle_condition_after.interior_condition === 'poor';
      
      const isLowBattery = vehicle_condition_after.battery_level < 20;
      
      if (isPoorCondition || isLowBattery) {
        const Maintenance = require('../models/Maintenance');
        const Vehicle = require('../models/Vehicle');
        
        // Lấy vehicle với station_id
        const vehicle = await Vehicle.findById(rental.vehicle_id._id).select('name station_id');
        
        if (vehicle && vehicle.station_id) {
          const maintenanceCode = `MT${Date.now().toString().substring(6)}_${vehicle.name}`;
          
          await Maintenance.create({
            code: maintenanceCode,
            vehicle_id: vehicle._id,
            station_id: vehicle.station_id,
            maintenance_type: isPoorCondition ? 'damage' : 'low_battery',
            title: isPoorCondition 
              ? `Bảo trì xe ${vehicle.name} - Tình trạng kém`
              : `Sạc pin xe ${vehicle.name}`,
            description: isPoorCondition
              ? `Xe có tình trạng kém sau checkout: ${vehicle_condition_after.exterior_condition === 'poor' ? 'Ngoại thất hư hỏng' : 'Nội thất hư hỏng'}. Phí sửa chữa: ${validatedDamageFee.toLocaleString('vi-VN')}đ`
              : `Pin còn ${vehicle_condition_after.battery_level}% - Cần sạc đến 80% trở lên`,
            status: 'reported',
            reported_by: req.user._id
          });
          
          console.log(`✅ Auto-created ${isPoorCondition ? 'damage' : 'low_battery'} maintenance report for checkout with fees`);
        } else {
          console.warn('⚠️ Cannot create maintenance report: vehicle has no station_id');
        }
      }

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
            // ✅ FIX: Xác định đúng payment type cho VNPay redirect
            let vnpayPaymentType;
            if (payment.payment_type === 'additional_fee') {
              vnpayPaymentType = 'checkout_fee';  // Phí phạt → Staff checkout
            } else if (payment.payment_type === 'deposit') {
              vnpayPaymentType = 'confirm_booking';  // Cọc → Staff confirm
            } else if (payment.payment_type === 'rental_fee') {
              vnpayPaymentType = 'confirm_booking';  // Phí thuê → Staff confirm
            } else {
              vnpayPaymentType = 'holding_fee';  // Fallback
            }
            
            console.log(`💳 Creating VNPay URL - DB type: ${payment.payment_type} → VNPay type: ${vnpayPaymentType}`);
            
            const vnpayData = vnpayService.createPaymentUrl({
              payment_code: payment.code,
              amount: payment.amount,
              payment_type: payment.payment_type
            }, clientIP, vnpayPaymentType);
            
            payment.vnpay_url = vnpayData.paymentUrl;
            payment.vnpay_transaction_no = vnpayData.txnRef;
            await payment.save();
            
            paymentUrls[payment._id] = {
              paymentUrl: vnpayData.paymentUrl,
              orderId: vnpayData.orderId,
              amount: payment.amount,
              paymentType: payment.payment_type,
              description: payment.description
            };
          } catch (vnpayError) {
            console.error('VNPay URL generation failed for payment:', payment._id, vnpayError);
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
            total_fees,
            remaining_deposit: remainingDeposit,
            total_amount: totalPaid
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

      // Lấy thông tin payments cho từng rental
      const rentalsWithPayments = await Promise.all(
        rentals.map(async (rental) => {
          const payments = await Payment.find({
            rental_id: rental._id,
            is_active: true
          }).select('amount status payment_type payment_method created_at');
          
          return {
            ...rental.toObject(),
            payments
          };
        })
      );

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals: rentalsWithPayments,
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

      // Lấy thông tin payments cho từng rental
      const rentalsWithPayments = await Promise.all(
        rentals.map(async (rental) => {
          const payments = await Payment.find({
            rental_id: rental._id,
            is_active: true
          }).select('amount status payment_type payment_method created_at');
          
          return {
            ...rental.toObject(),
            payments
          };
        })
      );

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals: rentalsWithPayments,
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

      // Lấy thông tin payments cho từng rental
      const rentalsWithPayments = await Promise.all(
        rentals.map(async (rental) => {
          const payments = await Payment.find({
            rental_id: rental._id,
            is_active: true
          }).select('amount status payment_type payment_method created_at');
          
          return {
            ...rental.toObject(),
            payments
          };
        })
      );

      const total = await Rental.countDocuments(filter);

      res.json({
        success: true,
        data: {
          rentals: rentalsWithPayments,
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
        .populate('vehicle_id', 'name license_plate model battery_capacity current_mileage current_battery type status')
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

      // Get contract
      const contract = await Contract.findOne({
        rental_id: rental._id,
        is_active: true,
        status: { $ne: 'cancelled' } 
      })
      .sort({ createdAt: -1 }) 
      .select('status code staff_signed_at customer_signed_at staff_signed_by customer_signed_by');

      // Get ALL payments for this rental (holding_fee, deposit, rental_fee, additional_fee)
      const Payment = require('../models/Payment');
      const payments = await Payment.find({
        $or: [
          { rental_id: rental._id },
          { booking_id: rental.booking_id }
        ],
        is_active: true
      })
      .select('code payment_type amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code reason createdAt')
      .sort({ createdAt: 1 }); // Sắp xếp theo thời gian tạo

      res.json({
        success: true,
        data: {
          ...rental.toObject(),
          contract: contract ? {
            status: contract.status,
            code: contract.code,
            staff_signed_at: contract.staff_signed_at,
            customer_signed_at: contract.customer_signed_at,
            staff_signed_by: contract.staff_signed_by,
            customer_signed_by: contract.customer_signed_by,
            is_signed: contract.status === 'signed'
          } : null,
          payments: payments // ← NEW: Include all payments
        }
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