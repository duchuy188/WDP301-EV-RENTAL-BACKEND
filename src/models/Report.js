const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Mã report
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  
  // Liên kết
  rental_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Rental',
    required: true 
  },
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
  
  // Thông tin sự cố
  issue_type: { 
    type: String, 
    enum: [
      'vehicle_breakdown',  // Xe hỏng
      'battery_issue',      // Vấn đề pin
      'accident',           // Tai nạn
      'other'               // Khác
    ],
    required: true 
  },
  description: { 
    type: String, 
    required: true,
    trim: true 
  },
  images: [{ 
    type: String 
  }], // URLs ảnh chụp sự cố
  
  // Trạng thái
  status: { 
    type: String, 
    enum: ['pending', 'resolved'],
    default: 'pending' 
  },
  
  // Ghi chú xử lý của staff
  resolution_notes: { 
    type: String, 
    default: '',
    trim: true 
  },
  resolved_at: { 
    type: Date, 
    default: null 
  },
  resolved_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  // Metadata
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Indexes
reportSchema.index({ rental_id: 1 });
reportSchema.index({ user_id: 1 });
reportSchema.index({ vehicle_id: 1 });
reportSchema.index({ station_id: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ user_id: 1, status: 1 });
reportSchema.index({ station_id: 1, status: 1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
