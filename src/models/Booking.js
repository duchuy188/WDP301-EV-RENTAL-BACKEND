const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  
  // Liên kết
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  vehicle_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vehicle',
    required: true 
  },
  station_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Station',
    required: true 
  },
  
  // Thời gian đặt xe
  start_date: { 
    type: Date, 
    required: true 
  },
  end_date: { 
    type: Date, 
    required: true 
  },
  pickup_time: { 
    type: String, 
    required: true 
  },
  return_time: { 
    type: String, 
    required: true 
  },
  
  // Trạng thái đặt xe
  status: { 
    type: String, 
    enum: [
      'pending',      // Chờ xác nhận
      'confirmed',    // Đã xác nhận
      'cancelled'     // Đã hủy
    ], 
    default: 'pending' 
  },
  
  // Thông tin đặt xe
  booking_type: { 
    type: String, 
    enum: [
      'online',       // Đặt xe online
      'walk_in'       // Đặt xe trực tiếp tại quầy
    ],
    required: true,
    default: 'online'
  },
  
  // Thông tin giá cả
  price_per_day: { 
    type: Number, 
    required: true,
    min: 0
  },
  total_days: { 
    type: Number, 
    required: true,
    min: 1
  },
  total_price: { 
    type: Number, 
    required: true,
    min: 0
  },
  deposit_amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  
  // Phí phát sinh
  late_fee: { 
    type: Number, 
    default: 0,
    min: 0
  },
  damage_fee: { 
    type: Number, 
    default: 0,
    min: 0
  },
  other_fees: { 
    type: Number, 
    default: 0,
    min: 0
  },
  final_amount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Thông tin bổ sung
  special_requests: { 
    type: String, 
    default: '' 
  },
  notes: { 
    type: String, 
    default: '' 
  },
  
  // Thông tin hủy
  cancellation_reason: { 
    type: String, 
    default: '' 
  },
  cancelled_at: { 
    type: Date, 
    default: null 
  },
  cancelled_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  // Thông tin xác nhận
  confirmed_at: { 
    type: Date, 
    default: null 
  },
  confirmed_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  // QR Code cho thuê online
  qr_code: { 
    type: String, 
    default: '' 
  }, // QR code string
  qr_expires_at: { 
    type: Date, 
    default: null 
  }, // Thời gian hết hạn QR
  qr_used_at: { 
    type: Date, 
    default: null 
  }, // Thời gian sử dụng QR
  
  // Metadata
  created_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Indexes

bookingSchema.index({ qr_code: 1 }); // Thêm index cho QR code
bookingSchema.index({ user_id: 1 });
bookingSchema.index({ vehicle_id: 1 });
bookingSchema.index({ station_id: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ start_date: 1, end_date: 1 });
bookingSchema.index({ user_id: 1, status: 1 });
bookingSchema.index({ station_id: 1, status: 1 });
bookingSchema.index({ start_date: 1, status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;