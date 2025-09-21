const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  
  // Liên kết
  booking_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking',
    required: true 
  },
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
  
  // Thời gian thực tế
  actual_start_time: { 
    type: Date, 
    required: true 
  },
  actual_end_time: { 
    type: Date, 
    default: null 
  },
  
  // Nhân viên xử lý
  pickup_staff_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  return_staff_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  // Tình trạng xe trước khi thuê
  vehicle_condition_before: {
    mileage: { type: Number, required: true, min: 0 },
    battery_level: { type: Number, required: true, min: 0, max: 100 },
    exterior_condition: { 
      type: String, 
      enum: ['excellent', 'good', 'fair', 'poor'], 
      required: true 
    },
    interior_condition: { 
      type: String, 
      enum: ['excellent', 'good', 'fair', 'poor'], 
      required: true 
    },
    notes: { type: String, default: '' }
  },
  
  // Tình trạng xe sau khi trả
  vehicle_condition_after: {
    mileage: { type: Number, default: null, min: 0 },
    battery_level: { type: Number, default: null, min: 0, max: 100 },
    exterior_condition: { 
      type: String, 
      enum: ['excellent', 'good', 'fair', 'poor'], 
      default: null 
    },
    interior_condition: { 
      type: String, 
      enum: ['excellent', 'good', 'fair', 'poor'], 
      default: null 
    },
    notes: { type: String, default: '' }
  },
  
  // Hình ảnh
  images_before: [{ type: String }], // URLs ảnh trước khi thuê
  images_after: [{ type: String }],  // URLs ảnh sau khi trả
  
  // Trạng thái
  status: { 
    type: String, 
    enum: [
      'active',       // Đang thuê
      'completed'     // Đã trả xe
    ], 
    default: 'active' 
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
  total_fees: { 
    type: Number, 
    default: 0,
    min: 0
  },
  
  // Ghi chú
  staff_notes: { 
    type: String, 
    default: '' 
  },
  customer_notes: { 
    type: String, 
    default: '' 
  },
  
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

rentalSchema.index({ booking_id: 1 });
rentalSchema.index({ user_id: 1 });
rentalSchema.index({ vehicle_id: 1 });
rentalSchema.index({ station_id: 1 });
rentalSchema.index({ status: 1 });
rentalSchema.index({ actual_start_time: 1 });
rentalSchema.index({ user_id: 1, status: 1 });
rentalSchema.index({ vehicle_id: 1, status: 1 });

const Rental = mongoose.model('Rental', rentalSchema);

module.exports = Rental;
