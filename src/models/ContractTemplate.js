const mongoose = require('mongoose');

const contractTemplateSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  
  // Nội dung mẫu
  content_template: { 
    type: String, 
    required: true 
  }, // HTML template với placeholders
  terms_template: { 
    type: String, 
    required: true 
  }, // Điều khoản mẫu
  
  // Placeholders (các trường sẽ được thay thế)
  placeholders: [{
    key: { type: String, required: true }, // {{customer_name}}
    label: { type: String, required: true }, // "Tên khách hàng"
    type: { 
      type: String, 
      enum: ['text', 'date', 'number', 'currency'],
      default: 'text' 
    },
    required: { type: Boolean, default: true }
  }],
  
  // Trạng thái
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'draft'], 
    default: 'active' 
  },
  
  // Thời hạn mặc định
  default_valid_days: { 
    type: Number, 
    default: 7 
  }, // Số ngày hiệu lực mặc định
  
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

contractTemplateSchema.index({ status: 1 });
contractTemplateSchema.index({ name: 1 });

const ContractTemplate = mongoose.model('ContractTemplate', contractTemplateSchema);

module.exports = ContractTemplate;