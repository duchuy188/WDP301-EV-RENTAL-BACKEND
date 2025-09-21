const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Trạng thái xác thực
  status: { 
    type: String, 
    enum: ['not_submitted', 'pending', 'approved', 'rejected'], 
    default: 'not_submitted' 
  },
  rejectionReason: { type: String, default: '' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  verificationMethod: { type: String, enum: ['auto', 'manual', ''], default: '' },
  autoApproved: { type: Boolean, default: false },
  lastUpdatedAt: { type: Date },
  
  // CMND/CCCD
  identityCard: { 
    type: String, 
    default: '',
    unique: true,  // Thêm unique
    sparse: true   // Cho phép null/empty
  }, // Số CMND/CCCD
  identityCardType: { type: String, default: '' }, // old, new, chip_front, chip_back
  identityCardTypeNew: { type: String, default: '' }, // cmnd_09_front, cmnd_12_front, cccd_12_front
  
  // Ảnh CMND/CCCD
  identityCardFrontImage: { type: String, default: '' },
  identityCardFrontImagePublicId: { type: String, default: '' },
  identityCardBackImage: { type: String, default: '' },
  identityCardBackImagePublicId: { type: String, default: '' },
  identityCardFrontUploaded: { type: Boolean, default: false },
  identityCardBackUploaded: { type: Boolean, default: false },
  
  // Thông tin OCR CMND/CCCD
  identityName: { type: String, default: '' }, 
  identityDob: { type: String, default: '' },
  identityHome: { type: String, default: '' },
  identityAddress: { type: String, default: '' },
  identityAddressEntities: {
    province: { type: String, default: '' },
    district: { type: String, default: '' },
    ward: { type: String, default: '' },
    street: { type: String, default: '' }
  },
  identitySex: { type: String, default: '' },
  identityNationality: { type: String, default: '' },
  identityDoe: { type: String, default: '' },
  identityIssueDate: { type: String, default: '' },
  identityIssueLoc: { type: String, default: '' },
  identityFeatures: { type: String, default: '' },
  identityReligion: { type: String, default: '' },
  identityEthnicity: { type: String, default: '' },
  identityOcr: { 
    front: { type: Object, default: {} },
    back: { type: Object, default: {} }
  },
  
  // Giấy phép lái xe
  licenseNumber: { 
    type: String, 
    default: '',
    unique: true,  // Thêm unique
    sparse: true   // Cho phép null/empty
  }, // Số giấy phép lái xe
  licenseImage: { type: String, default: '' },
  licenseImagePublicId: { type: String, default: '' },
  licenseBackImage: { type: String, default: '' },
  licenseBackImagePublicId: { type: String, default: '' },
  licenseExpiry: { type: Date },
  licenseExpiryText: { type: String, default: '' },
  licenseFrontUploaded: { type: Boolean, default: false },
  licenseBackUploaded: { type: Boolean, default: false },
  licenseUploaded: { type: Boolean, default: false },
  
  // Thông tin OCR GPLX
  licenseTypeOcr: { type: String, default: '' },
  licenseName: { type: String, default: '' },
  licenseDob: { type: String, default: '' },
  licenseNation: { type: String, default: '' },
  licenseAddress: { type: String, default: '' },
  licensePlaceIssue: { type: String, default: '' },
  licenseIssueDate: { type: String, default: '' },
  licenseClass: { type: String, default: '' },
  licenseClassList: [{ type: String }],
  licenseOcr: { 
    front: { type: Object, default: {} },
    back: { type: Object, default: {} }
  }
}, { timestamps: true });

// Indexes
kycSchema.index({ status: 1 });

const KYC = mongoose.model('KYC', kycSchema);

module.exports = KYC;
