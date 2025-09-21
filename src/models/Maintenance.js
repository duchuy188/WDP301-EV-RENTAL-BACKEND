const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { type: String, required: true, unique: true, uppercase: true },
  
  // Liên kết
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  station_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  
  // Mô tả vấn đề
  title: { type: String, required: true },
  description: { type: String, required: true },
  
  // Trạng thái đơn giản
  status: { 
    type: String, 
    enum: ['reported', 'fixed'], 
    default: 'reported' 
  },
  
  // Người báo cáo
  reported_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Ghi chú
  notes: { type: String, default: '' },
  
  // Hình ảnh
  images: [{ type: String }],
  
  // Metadata
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes

maintenanceSchema.index({ vehicle_id: 1 });
maintenanceSchema.index({ station_id: 1 });
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ created_at: -1 });

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);

module.exports = Maintenance;