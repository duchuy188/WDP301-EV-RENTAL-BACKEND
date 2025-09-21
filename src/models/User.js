const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: { type: String, required: true, trim: true }, 
  
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }, 
  role: { 
    type: String, 
    enum: ['EV Renter', 'Station Staff', 'Admin'], 
    default: 'EV Renter' 
  },
  avatar: { type: String, default: '' },
  avatarPublicId: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  
  // Reset password fields
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  
  // Chỉ giữ lại trạng thái KYC (để dễ truy vấn)
  kycStatus: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
  
  // Trạng thái tài khoản
  status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
  
  // Thêm trường tham chiếu đến KYC
  kycId: { type: mongoose.Schema.Types.ObjectId, ref: 'KYC' },
  
  // Thêm trường stationId cho nhân viên điểm thuê
  stationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Station',
    default: null
    // Không bắt buộc để có thể tạo staff chưa có station
  }
}, { timestamps: true });

// Indexes
userSchema.index({ kycStatus: 1 });
userSchema.index({ role: 1 });
userSchema.index({ stationId: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;