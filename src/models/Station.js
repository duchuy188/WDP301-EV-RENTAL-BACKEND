const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    match: /^ST\d{3}$/ // ST001, ST002...
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  district: { 
    type: String, 
    required: true 
  },
  city: { 
    type: String, 
    required: true 
  },
  
  // Thêm mô tả chi tiết
  description: {
    type: String,
    default: ''
  },
  
  // Thêm hình ảnh station
  images: [{
    type: String
  }],
  
  // Bỏ tọa độ GPS - chỉ cần địa chỉ
  
  // Thông tin liên hệ
  phone: { 
    type: String, 
    required: true,
    match: /^0\d{9,10}$/ // VN phone format
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true
  },
  
  // Giờ hoạt động
  opening_time: { 
    type: String, 
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM
  },
  closing_time: { 
    type: String, 
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM
  },
  
  // Trạng thái
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'maintenance'], 
    default: 'active' 
  },
  
  // Số lượng xe (tự động cập nhật)
  max_capacity: { 
    type: Number, 
    required: true, 
    min: 1 
  }, // Sức chứa tối đa của station
  current_vehicles: { 
    type: Number, 
    default: 0, 
    min: 0 
  }, // Tổng số xe hiện tại ở station
  available_vehicles: { 
    type: Number, 
    default: 0, 
    min: 0 
  }, // Số xe sẵn sàng cho thuê
  rented_vehicles: { 
    type: Number, 
    default: 0, 
    min: 0 
  }, // Số xe đang được thuê
  maintenance_vehicles: { 
    type: Number, 
    default: 0, 
    min: 0 
  } // Số xe đang bảo trì
}, { timestamps: true });

// Indexes

stationSchema.index({ status: 1 });
stationSchema.index({ city: 1, district: 1 });
stationSchema.index({ status: 1, available_vehicles: 1 });

// Validation: Kiểm tra business logic
stationSchema.pre('save', function(next) {
  // Kiểm tra không vượt quá sức chứa tối đa
  if (this.current_vehicles > this.max_capacity) {
    return next(new Error('Số xe vượt quá sức chứa tối đa'));
  }
  
  // Kiểm tra xe available không thể > tổng xe
  if (this.available_vehicles > this.current_vehicles) {
    return next(new Error('Xe available không thể > tổng xe'));
  }
  
  // Kiểm tra tổng xe = available + rented + maintenance
  const totalStatus = this.available_vehicles + this.rented_vehicles + this.maintenance_vehicles;
  if (totalStatus !== this.current_vehicles) {
    return next(new Error('Tổng xe không khớp với trạng thái'));
  }
  
  next();
});

// Method để sync với Vehicle collection
stationSchema.methods.syncVehicleCount = async function() {
  const Vehicle = mongoose.model('Vehicle');
  
  const counts = await Vehicle.aggregate([
    { $match: { station_id: this._id, is_active: true } },
    { $group: {
        _id: null,
        total: { $sum: 1 },
        available: { 
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
        },
        rented: { 
          $sum: { $cond: [{ $eq: ['$status', 'rented'] }, 1, 0] }
        },
        maintenance: { 
          $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (counts.length > 0) {
    this.current_vehicles = counts[0].total;
    this.available_vehicles = counts[0].available;
    this.rented_vehicles = counts[0].rented;
    this.maintenance_vehicles = counts[0].maintenance;
    await this.save();
  }
};

// Static method để sync tất cả stations
stationSchema.statics.syncAllVehicleCounts = async function() {
  const stations = await this.find({});
  
  for (const station of stations) {
    await station.syncVehicleCount();
  }
  
  return { message: 'Đã sync tất cả stations' };
};

const Station = mongoose.model('Station', stationSchema);

module.exports = Station;