const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  // Thông tin cơ bản
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
  template_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ContractTemplate',
    required: true 
  },
  
  // Trạng thái hợp đồng
  status: { 
    type: String, 
    enum: [
      'pending',      // Chờ ký
      'signed',       // Đã ký
      'cancelled',    // Đã hủy
      'expired'       // Hết hạn
    ], 
    default: 'pending' 
  },
  
  // Nội dung hợp đồng
  title: { 
    type: String, 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  }, // HTML content của hợp đồng
  terms: { 
    type: String, 
    required: true 
  }, // Điều khoản hợp đồng
  
  // Thông tin ký
  customer_signature: { 
    type: String, 
    default: '' 
  }, // Chữ ký số của khách hàng (base64)
  staff_signature: { 
    type: String, 
    default: '' 
  }, // Chữ ký số của nhân viên (base64)
  
  // Thời gian ký
  customer_signed_at: { 
    type: Date, 
    default: null 
  },
  staff_signed_at: { 
    type: Date, 
    default: null 
  },
  
  // Thông tin người ký
  customer_signed_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  staff_signed_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  
  // Thời hạn hợp đồng
  valid_from: { 
    type: Date, 
    required: true 
  },
  valid_until: { 
    type: Date, 
    required: true 
  },
  
  // Thông tin bổ sung
  special_conditions: { 
    type: String, 
    default: '' 
  }, // Điều kiện đặc biệt
  notes: { 
    type: String, 
    default: '' 
  },
  
  // File hợp đồng PDF
  contract_file_url: { 
    type: String, 
    default: '' 
  }, // URL file PDF hợp đồng
  contract_file_public_id: { 
    type: String, 
    default: '' 
  }, // Cloudinary public ID
  
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

contractSchema.index({ rental_id: 1 });
contractSchema.index({ user_id: 1 });
contractSchema.index({ vehicle_id: 1 });
contractSchema.index({ station_id: 1 });
contractSchema.index({ template_id: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ valid_from: 1, valid_until: 1 });
contractSchema.index({ user_id: 1, status: 1 });

const Contract = mongoose.model('Contract', contractSchema);

module.exports = Contract;