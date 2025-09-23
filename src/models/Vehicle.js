const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Thông tin cơ bản
  license_plate: {
    type: String,
    required: function() { return this.status !== 'draft'; },
    uppercase: true,
    validate: {
      validator: function(v) {
        // Bỏ qua validation khi status là draft
        if (this.status === 'draft') return true;
        
        // Kiểm tra định dạng chỉ khi có giá trị và không phải draft
        return !v || /^[0-9]{2}[A-Z]-[0-9]{3}\.[0-9]{2}$/.test(v);
      },
      message: 'Biển số không đúng định dạng (VD: 51A-123.45)'
    }
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  brand: { 
    type: String, 
    default: 'VinFast' 
  },
  model: { 
    type: String, 
    required: true 
  },
  year: { 
    type: Number, 
    required: true,
    min: 2020,
    max: new Date().getFullYear() + 1
  },
  
  // Thêm trường color
  color: {
    type: String,
    required: true,
    trim: true
  },
  
  // Thông tin kỹ thuật
  type: { 
    type: String, 
    enum: ['scooter', 'motorcycle'], 
    required: true 
  },
  battery_capacity: { 
    type: Number, 
    required: true,
    min: 1
  }, // kWh
  max_range: { 
    type: Number, 
    required: true,
    min: 1
  }, // km
  
  // Thông tin pin
  current_battery: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  }, // % (0-100)
  
  // Thông tin thuê
  price_per_day: { 
    type: Number, 
    required: true,
    min: 50000,
    max: 300000
  }, // VND/ngày
  deposit_percentage: { 
    type: Number, 
    required: true,
    min: 0, // 0% = không cọc
    max: 100, // 100% = cọc full
    default: 50 // 50% mặc định
  }, // % của tổng giá thuê
  
  // Vị trí & trạng thái
  station_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Station',
    required: false // Sửa từ true thành false
  },
  status: { 
    type: String, 
    enum: ['draft', 'available', 'rented', 'maintenance'], 
    default: 'draft' // Sửa default từ 'available' thành 'draft'
  },
  
  // Thông tin kỹ thuật (Staff quản lý)
  technical_status: { 
    type: String, 
    enum: ['good', 'needs_maintenance'], 
    default: 'good' 
  },
  
  // Thông tin hình ảnh - Chỉ giữ lại mảng images, bỏ main_image
  images: [{ 
    type: String 
  }], // URLs của ảnh xe
  
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
vehicleSchema.index({ station_id: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ type: 1 });
vehicleSchema.index({ status: 1, station_id: 1 });
vehicleSchema.index({ price_per_day: 1 });
vehicleSchema.index({ technical_status: 1 });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;