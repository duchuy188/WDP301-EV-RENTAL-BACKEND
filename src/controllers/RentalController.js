const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const User = require('../models/User');
const Payment = require('../models/Payment');
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

  // PUT /api/rentals/:id/checkout - Tự động tính phí và checkout
  static async processCheckout(req, res) {
    try {
      const { id } = req.params;
      const {
        vehicle_condition_after,
        staff_notes = '',
        customer_notes = '',
        damage_description = ''
      } = req.body;

      const rental = await Rental.findById(id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model hourly_rate daily_rate')
        .populate('station_id', 'name address')
        .populate('booking_id', 'end_time');

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

      // TÍNH PHÍ TỰ ĐỘNG
      const now = new Date();
      const plannedEndTime = rental.booking_id.end_time;
      
      // Tính phí trễ
      let late_fee = 0;
      if (now > plannedEndTime) {
        const lateHours = Math.ceil((now - plannedEndTime) / (1000 * 60 * 60));
        late_fee = lateHours * (rental.vehicle_id.hourly_rate || 10000); // 10k/giờ mặc định
      }

      // Tính phí hư hỏng dựa trên tình trạng xe
      let damage_fee = 0;
      if (vehicle_condition_after.exterior_condition === 'poor') {
        damage_fee += 200000; // Phí hư hỏng nặng
      } else if (vehicle_condition_after.exterior_condition === 'fair') {
        damage_fee += 100000; // Phí hư hỏng nhẹ
      }

      if (vehicle_condition_after.interior_condition === 'poor') {
        damage_fee += 150000; // Phí nội thất hư hỏng nặng
      } else if (vehicle_condition_after.interior_condition === 'fair') {
        damage_fee += 75000; // Phí nội thất hư hỏng nhẹ
      }

      // Tính phí dựa trên mô tả hư hỏng
      if (damage_description) {
        const desc = damage_description.toLowerCase();
        if (desc.includes('trầy xước') || desc.includes('trầy')) {
          damage_fee += 50000;
        }
        if (desc.includes('vỡ') || desc.includes('nứt')) {
          damage_fee += 100000;
        }
        if (desc.includes('hỏng') || desc.includes('bể')) {
          damage_fee += 150000;
        }
        if (desc.includes('mất') || desc.includes('thiếu')) {
          damage_fee += 200000;
        }
      }

      const other_fees = 0;
      const total_fees = late_fee + damage_fee + other_fees;

      // Cập nhật rental
      rental.actual_end_time = now;
      rental.return_staff_id = req.user._id;
      rental.vehicle_condition_after = vehicle_condition_after;
      rental.late_fee = late_fee;
      rental.damage_fee = damage_fee;
      rental.other_fees = other_fees;
      rental.total_fees = total_fees;
      rental.staff_notes = staff_notes;
      rental.customer_notes = customer_notes;
      rental.status = 'completed';

      await rental.save();

      // Cập nhật trạng thái xe
      await Vehicle.findByIdAndUpdate(rental.vehicle_id._id, {
        status: 'available',
        current_mileage: vehicle_condition_after.mileage,
        battery_level: vehicle_condition_after.battery_level
      });

      // Tạo payment nếu có phí phát sinh
      let payment = null;
      if (total_fees > 0) {
        payment = new Payment({
          rental_id: rental._id,
          user_id: rental.user_id._id,
          amount: total_fees,
          payment_method: 'cash', // Mặc định tiền mặt
          status: 'pending',
          description: `Phí phát sinh thuê xe ${rental.code}`,
          payment_type: 'additional_fees'
        });
        await payment.save();
      }

      // Gửi email receipt
      try {
        await sendCheckoutReceiptEmail(rental, payment);
      } catch (emailError) {
        console.error('Error sending checkout email:', emailError);
        // Không fail checkout vì email lỗi
      }

      res.json({
        success: true,
        message: 'Checkout thành công',
        data: {
          rental: {
            id: rental._id,
            code: rental.code,
            actual_end_time: rental.actual_end_time,
            total_fees: total_fees,
            status: rental.status
          },
          fee_breakdown: {
            late_fee,
            damage_fee,
            other_fees,
            total_fees
          },
          payment: payment ? {
            id: payment._id,
            amount: payment.amount,
            status: payment.status
          } : null
        }
      });
    } catch (error) {
      console.error('Error processing checkout:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server',
        error: error.message
      });
    }
  }

  // POST /api/rentals/:id/return-photos - Upload ảnh và báo cáo tình trạng xe
  static async uploadReturnPhotos(req, res) {
    try {
      const { id } = req.params;
      const {
        mileage,
        battery_level,
        exterior_condition,
        interior_condition,
        inspection_notes = '',
        damage_description = ''
      } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có ảnh nào được upload'
        });
      }

      // Validate vehicle condition data
      if (!mileage || battery_level === undefined || !exterior_condition || !interior_condition) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin tình trạng xe (mileage, battery_level, exterior_condition, interior_condition)'
        });
      }

      const rental = await Rental.findById(id);
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

      // Upload ảnh lên Cloudinary
      const uploadPromises = req.files.map(file => 
        uploadToCloudinary(file.buffer, `rental-return-${rental.code}`)
      );
      
      const uploadedImages = await Promise.all(uploadPromises);
      const imageUrls = uploadedImages.map(img => img.secure_url);

      // Cập nhật rental với ảnh và tình trạng xe
      rental.images_after = [...(rental.images_after || []), ...imageUrls];
      rental.vehicle_condition_after = {
        mileage: parseInt(mileage),
        battery_level: parseInt(battery_level),
        exterior_condition,
        interior_condition,
        notes: inspection_notes
      };
      rental.staff_notes = inspection_notes;
      
      await rental.save();

      res.json({
        success: true,
        message: 'Upload ảnh và báo cáo tình trạng xe thành công',
        data: {
          images_after: rental.images_after,
          new_images: imageUrls,
          vehicle_condition_after: rental.vehicle_condition_after,
          inspection_notes: inspection_notes,
          damage_description: damage_description
        }
      });
    } catch (error) {
      console.error('Error uploading return photos and inspection:', error);
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
        station_id: req.user.station_id // Staff chỉ xem rentals tại station của mình
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
        .populate('booking_id', 'start_time end_time total_amount');

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
async function sendCheckoutReceiptEmail(rental, payment) {
  try {
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
      has_payment: !!payment,
      payment_status: payment ? payment.status : null
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