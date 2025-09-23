const { User, KYC } = require('../models');
const { verifyIdentityCard, verifyDriverLicense, validateUserIdentity, compareIdentityAndLicenseNames, validateLicenseClass } = require('../services/kycService');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');

// Helper function để tìm hoặc tạo KYC record
const findOrCreateKyc = async (userId) => {
  let kyc = await KYC.findOne({ userId });
  if (!kyc) {
    kyc = new KYC({ userId });
    await kyc.save();
  }
  return kyc;
};


const checkDuplicateIdentity = async (identityCard) => {
  if (!identityCard) return false;
  const existing = await KYC.findOne({ 
    identityCard: identityCard,
  });
  return !!existing;
};

const checkDuplicateLicense = async (licenseNumber) => {
  if (!licenseNumber) return false;
  const existing = await KYC.findOne({ 
    licenseNumber: licenseNumber,
    licenseNumber: { $ne: '' }  
  });
  return !!existing;
};

// Upload và xác thực mặt trước CMND/CCCD
exports.uploadIdentityCardFront = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước CMND/CCCD' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Tìm hoặc tạo KYC record
    const kyc = await findOrCreateKyc(req.user.id);
   
    const ocrResult = await verifyIdentityCard(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực CMND/CCCD', 
        error: ocrResult.errorMessage 
      });
    }

    const idData = ocrResult.data[0];
    
    if (idData.type === 'old_back' || idData.type === 'new_back' || idData.type === 'chip_back') {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước CMND/CCCD' });
    }
    
    // Cập nhật thông tin KYC
    kyc.identityCardType = idData.type || '';
    kyc.identityCardTypeNew = idData.type_new || '';
    kyc.identityName = idData.name || '';
    kyc.identityDob = idData.dob || '';
    kyc.identityHome = idData.home || '';
    kyc.identityAddress = idData.address || '';
    kyc.identityAddressEntities = idData.address_entities || {};
    kyc.identitySex = idData.sex || '';
    kyc.identityNationality = idData.nationality || '';
    kyc.identityDoe = idData.doe || '';
    
    // Cập nhật số CMND/CCCD
    kyc.identityCard = idData.id || '';
    
    // Thêm check duplicate
    if (kyc.identityCard) {
      const isDuplicate = await checkDuplicateIdentity(kyc.identityCard);
      if (isDuplicate) {
        return res.status(400).json({ 
          message: 'Số CMND/CCCD đã được sử dụng bởi tài khoản khác' 
        });
      }
    }
    
    // Upload ảnh lên Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'identity_cards');
    kyc.identityCardFrontImage = uploadResult.url;
    kyc.identityCardFrontImagePublicId = uploadResult.publicId;
    
    // Lưu kết quả OCR
    if (!kyc.identityOcr) {
      kyc.identityOcr = {};
    }
    kyc.identityOcr.front = idData;
    
    // Cập nhật trạng thái upload
    kyc.identityCardFrontUploaded = true;
    
    // Cập nhật trạng thái KYC
    if (kyc.identityCardBackUploaded) {
      const validation = validateUserIdentity(user, idData);
      kyc.status = 'pending';
      kyc.validationScore = validation.confidenceScore;
    } else {
      kyc.status = 'pending';
    }
    
    kyc.lastUpdatedAt = new Date();
    await kyc.save();
    
    // Cập nhật trạng thái KYC trong User model
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      message: 'Mặt trước CMND/CCCD đã được tải lên thành công',
      identityCard: {
        id: kyc.identityCard,
        name: kyc.identityName,
        dob: kyc.identityDob,
        address: kyc.identityAddress,
        frontImage: kyc.identityCardFrontImage
      },
      kycStatus: kyc.status,
      needsBackImage: !kyc.identityCardBackUploaded
    });
    
  } catch (error) {
    console.error('Lỗi khi xác thực mặt trước CMND/CCCD:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu xác thực CMND/CCCD',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Upload và xác thực mặt sau CMND/CCCD
exports.uploadIdentityCardBack = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau CMND/CCCD' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Tìm hoặc tạo KYC record
    const kyc = await findOrCreateKyc(req.user.id);
    
    const ocrResult = await verifyIdentityCard(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực CMND/CCCD', 
        error: ocrResult.errorMessage 
      });
    }

    const idData = ocrResult.data[0];
    
    if (idData.type !== 'old_back' && idData.type !== 'new_back' && idData.type !== 'chip_back') {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau CMND/CCCD' });
    }
    
    // Cập nhật thông tin từ mặt sau
    kyc.identityReligion = idData.religion || '';
    kyc.identityEthnicity = idData.ethnicity || '';
    kyc.identityFeatures = idData.features || '';
    kyc.identityIssueDate = idData.issue_date || '';
    kyc.identityIssueLoc = idData.issue_loc || '';
    
    // Upload ảnh lên Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'identity_cards');
    kyc.identityCardBackImage = uploadResult.url;
    kyc.identityCardBackImagePublicId = uploadResult.publicId;
    
    // Lưu kết quả OCR
    if (!kyc.identityOcr) {
      kyc.identityOcr = {};
    }
    kyc.identityOcr.back = idData;
    
    // Cập nhật trạng thái upload
    kyc.identityCardBackUploaded = true;
    
    // Cập nhật trạng thái KYC
    if (kyc.identityCardFrontUploaded) {
      if (kyc.status !== 'approved') {
        kyc.status = 'pending';
      }
    } else {
      kyc.status = 'pending';
    }
    
    kyc.lastUpdatedAt = new Date();
    await kyc.save();
    
    // Cập nhật trạng thái KYC trong User model
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      message: 'Mặt sau CMND/CCCD đã được tải lên thành công',
      identityCard: {
        issueDate: kyc.identityIssueDate,
        issueLocation: kyc.identityIssueLoc,
        features: kyc.identityFeatures,
        backImage: kyc.identityCardBackImage
      },
      kycStatus: kyc.status,
      needsFrontImage: !kyc.identityCardFrontUploaded
    });
    
  } catch (error) {
    console.error('Lỗi khi xác thực mặt sau CMND/CCCD:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu xác thực CMND/CCCD',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Upload và xác thực mặt trước GPLX
exports.uploadDriverLicenseFront = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước giấy phép lái xe' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Tìm hoặc tạo KYC record
    const kyc = await findOrCreateKyc(req.user.id);

    // Gọi API FPT.AI để xác thực GPLX
    const ocrResult = await verifyDriverLicense(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực giấy phép lái xe', 
        error: ocrResult.errorMessage 
      });
    }

    // Lấy dữ liệu từ kết quả OCR
    const licenseData = ocrResult.data[0];
    
    // Kiểm tra xem có phải mặt sau không (type = "old-back" hoặc chỉ có class và date)
    if (licenseData.type === 'old-back' || (!licenseData.id && licenseData.class)) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước giấy phép lái xe' });
    }
    
    // Cập nhật thông tin KYC
    kyc.licenseTypeOcr = licenseData.type || '';
    kyc.licenseName = licenseData.name || '';
    kyc.licenseDob = licenseData.dob || '';
    kyc.licenseNation = licenseData.nation || '';
    kyc.licenseAddress = licenseData.address || '';
    kyc.licensePlaceIssue = licenseData.place_issue || '';
    kyc.licenseIssueDate = licenseData.date || '';
    kyc.licenseClass = licenseData.class || '';
    
    // Cập nhật số giấy phép lái xe
    kyc.licenseNumber = licenseData.id || '';
    
    // Thêm check duplicate
    if (kyc.licenseNumber) {
      const isDuplicate = await checkDuplicateLicense(kyc.licenseNumber);
      if (isDuplicate) {
        return res.status(400).json({ 
          message: 'Số GPLX đã được sử dụng bởi tài khoản khác' 
        });
      }
    }
    
    // Kiểm tra hạng bằng lái xe
    const licenseClassValidation = validateLicenseClass(licenseData.class);
    if (!licenseClassValidation.isValid) {
      return res.status(400).json({ 
        message: licenseClassValidation.message 
      });
    }
    
    // Xử lý ngày hết hạn
    if (licenseData.doe) {
      // Xử lý trường hợp "KHÔNG THỜI HẠN" hoặc các giá trị đặc biệt khác
      if (licenseData.doe === "KHÔNG THỜI HẠN") {
        kyc.licenseExpiry = null;
        kyc.licenseExpiryText = "KHÔNG THỜI HẠN";
      } else {
        try {
          const [day, month, year] = licenseData.doe.split('/');
          // Kiểm tra xem có đủ 3 phần không
          if (day && month && year && !isNaN(parseInt(day)) && !isNaN(parseInt(month)) && !isNaN(parseInt(year))) {
            // Đảm bảo năm có 4 chữ số
            const fullYear = year.length === 2 ? `20${year}` : year;
            // Tạo ngày với định dạng ISO
            kyc.licenseExpiry = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
            
            // Kiểm tra xem ngày có hợp lệ không
            if (isNaN(kyc.licenseExpiry.getTime())) {
              console.error('Ngày không hợp lệ:', licenseData.doe);
              kyc.licenseExpiry = null;
              kyc.licenseExpiryText = licenseData.doe;
            }
          } else {
            console.error('Định dạng ngày không hợp lệ:', licenseData.doe);
            kyc.licenseExpiry = null;
            kyc.licenseExpiryText = licenseData.doe;
          }
        } catch (e) {
          console.error('Lỗi khi parse ngày hết hạn:', e);
          kyc.licenseExpiry = null;
          kyc.licenseExpiryText = licenseData.doe;
        }
      }
    } else {
      kyc.licenseExpiry = null;
      kyc.licenseExpiryText = '';
    }
    
    // Upload ảnh lên Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'licenses');
    kyc.licenseImage = uploadResult.url;
    kyc.licenseImagePublicId = uploadResult.publicId;
    
    // Lưu kết quả OCR
    if (!kyc.licenseOcr) {
      kyc.licenseOcr = {};
    }
    kyc.licenseOcr.front = licenseData;
    
    // Cập nhật trạng thái upload
    kyc.licenseFrontUploaded = true;
    kyc.licenseUploaded = true;
    
    // Cập nhật trạng thái KYC
    if (kyc.status === 'approved') {
      // Giữ nguyên trạng thái đã được duyệt
    } else if (kyc.identityCardFrontUploaded && kyc.identityCardBackUploaded) {
      // Nếu đã có cả CMND/CCCD mặt trước và mặt sau nhưng chưa được duyệt
      kyc.status = 'pending';
      
      // So sánh tên giữa CCCD và GPLX
      if (kyc.identityOcr && kyc.identityOcr.front && kyc.licenseOcr && kyc.licenseOcr.front) {
        const nameComparison = compareIdentityAndLicenseNames(kyc.identityOcr.front, kyc.licenseOcr.front);
        kyc.nameComparison = nameComparison;
        
        if (!nameComparison.match) {
          kyc.status = 'pending'; // Vẫn pending nhưng có cảnh báo
          kyc.validationNotes = `Cảnh báo: ${nameComparison.message}`;
        }
      }
    }
    
    kyc.lastUpdatedAt = new Date();
    await kyc.save();
    
    // Cập nhật trạng thái KYC trong User model
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      message: 'Mặt trước giấy phép lái xe đã được tải lên thành công',
      license: {
        id: kyc.licenseNumber,
        name: kyc.licenseName,
        class: kyc.licenseClass,
        expiry: kyc.licenseExpiry,
        expiryText: kyc.licenseExpiryText || null,
        image: kyc.licenseImage
      },
      kycStatus: kyc.status,
      needsBackImage: !kyc.licenseBackUploaded,
      validation: {
        licenseClassValid: licenseClassValidation.isValid,
        licenseClassMessage: licenseClassValidation.message,
        nameComparison: kyc.nameComparison || null,
        validationNotes: kyc.validationNotes || null
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi xác thực mặt trước giấy phép lái xe:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu xác thực giấy phép lái xe',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Upload và xác thực mặt sau GPLX
exports.uploadDriverLicenseBack = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau giấy phép lái xe' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    // Tìm hoặc tạo KYC record
    const kyc = await findOrCreateKyc(req.user.id);

    // Gọi API FPT.AI để xác thực GPLX
    const ocrResult = await verifyDriverLicense(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực giấy phép lái xe', 
        error: ocrResult.errorMessage 
      });
    }

    // Lấy dữ liệu từ kết quả OCR
    const licenseData = ocrResult.data[0];
    
    // Kiểm tra xem có phải mặt sau không
    if (licenseData.type !== 'old-back' && licenseData.id) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau giấy phép lái xe' });
    }
    
    // Cập nhật thông tin từ mặt sau nếu có
    if (licenseData.class) {
      if (Array.isArray(licenseData.class)) {
        kyc.licenseClassList = licenseData.class;
      } else {
        kyc.licenseClassList = [licenseData.class];
      }
    }
    
    // Upload ảnh lên Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'licenses');
    kyc.licenseBackImage = uploadResult.url;
    kyc.licenseBackImagePublicId = uploadResult.publicId;
    
    // Lưu kết quả OCR
    if (!kyc.licenseOcr) {
      kyc.licenseOcr = {};
    }
    kyc.licenseOcr.back = licenseData;
    
    // Cập nhật trạng thái upload
    kyc.licenseBackUploaded = true;
    
    // Cập nhật trạng thái KYC
    if (kyc.status !== 'approved') {
      kyc.status = 'pending';
    }
    
    kyc.lastUpdatedAt = new Date();
    await kyc.save();
    
    // Cập nhật trạng thái KYC trong User model
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      message: 'Mặt sau giấy phép lái xe đã được tải lên thành công',
      license: {
        classList: kyc.licenseClassList,
        backImage: kyc.licenseBackImage
      },
      kycStatus: kyc.status,
      needsFrontImage: !kyc.licenseFrontUploaded
    });
    
  } catch (error) {
    console.error('Lỗi khi xác thực mặt sau giấy phép lái xe:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu xác thực giấy phép lái xe',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Xác thực KYC thủ công (dành cho nhân viên)
exports.verifyKyc = async (req, res) => {
  try {
    const { userId, action, rejectionReason } = req.body;
    
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    const kyc = await KYC.findOne({ userId });
    if (!kyc) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin KYC' });
    }
    
    if (action === 'approve') {
      kyc.status = 'approved';
      kyc.approvedBy = req.user.id;
      kyc.approvedAt = new Date();
      kyc.verificationMethod = 'manual';
      kyc.rejectionReason = '';
      
      // Cập nhật User model
      user.kycStatus = 'approved';
      user.kycId = kyc._id;
    } else if (action === 'reject') {
      if (!rejectionReason) {
        return res.status(400).json({ message: 'Vui lòng cung cấp lý do từ chối' });
      }
      kyc.status = 'rejected';
      kyc.rejectionReason = rejectionReason;
      
      // Cập nhật User model
      user.kycStatus = 'rejected';
      user.kycId = kyc._id;
    } else {
      return res.status(400).json({ message: 'Hành động không hợp lệ' });
    }
    
    kyc.lastUpdatedAt = new Date();
    await kyc.save();
    await user.save();
    
    return res.status(200).json({
      message: action === 'approve' 
        ? 'Đã xác thực thông tin người dùng thành công' 
        : 'Đã từ chối xác thực thông tin người dùng',
      user: {
        id: user._id,
        email: user.email,
        fullname: user.fullname,
        kycStatus: user.kycStatus
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi xác thực KYC:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu xác thực KYC',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy danh sách yêu cầu KYC đang chờ xử lý (dành cho nhân viên)
exports.getPendingKycRequests = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const pendingKycs = await KYC.find({ 
      status: 'pending',
      identityCard: { $ne: '' } // Đảm bảo đã có CMND/CCCD
    }).populate('userId', '_id email fullname').select(
      'userId identityCard identityCardFrontImage identityCardBackImage licenseNumber licenseImage licenseBackImage lastUpdatedAt identityName identityDob identityAddress licenseName licenseDob licenseClass validationScore nameComparison validationNotes'
    );
    
    return res.status(200).json({
      count: pendingKycs.length,
      users: pendingKycs
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy danh sách yêu cầu KYC:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy thông tin KYC của người dùng hiện tại
exports.getMyKycStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc) {
      return res.status(200).json({
        kycStatus: 'not_submitted',
        rejectionReason: '',
        identity: {
          id: null,
          frontImage: null,
          backImage: null,
          frontUploaded: false,
          backUploaded: false
        },
        license: {
          id: null,
          frontImage: null,
          backImage: null,
          expiry: null,
          expiryText: null,
          classList: [],
          frontUploaded: false,
          backUploaded: false,
          uploaded: false
        },
        lastUpdated: null
      });
    }
    
    return res.status(200).json({
      kycStatus: kyc.status,
      rejectionReason: kyc.rejectionReason,
      identity: {
        id: kyc.identityCard || null,
        frontImage: kyc.identityCardFrontImage || null,
        backImage: kyc.identityCardBackImage || null,
        frontUploaded: kyc.identityCardFrontUploaded || false,
        backUploaded: kyc.identityCardBackUploaded || false
      },
      license: {
        id: kyc.licenseNumber || null,
        frontImage: kyc.licenseImage || null,
        backImage: kyc.licenseBackImage || null,
        expiry: kyc.licenseExpiry || null,
        expiryText: kyc.licenseExpiryText || null,
        classList: kyc.licenseClassList || [],
        frontUploaded: kyc.licenseFrontUploaded || false,
        backUploaded: kyc.licenseBackUploaded || false,
        uploaded: kyc.licenseUploaded || false
      },
      validation: {
        score: kyc.validationScore || null,
        nameComparison: kyc.nameComparison || null,
        notes: kyc.validationNotes || null
      },
      lastUpdated: kyc.lastUpdatedAt || null
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy thông tin KYC:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};