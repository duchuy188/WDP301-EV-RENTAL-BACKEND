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

const checkDuplicateLicense = async (licenseNumber, currentUserId) => {
  if (!licenseNumber) return false;
  const existing = await KYC.findOne({ 
    licenseNumber: licenseNumber,
    userId: { $ne: currentUserId } // Loại trừ user hiện tại
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
      const isDuplicate = await checkDuplicateLicense(kyc.licenseNumber, req.user.id);
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
      // Kiểm tra đầy đủ giấy tờ trước khi approve
      if (!kyc.identityCardFrontUploaded) {
        return res.status(400).json({ 
          message: 'Không thể approve: Chưa upload CCCD mặt trước' 
        });
      }
      
      if (!kyc.identityCardBackUploaded) {
        return res.status(400).json({ 
          message: 'Không thể approve: Chưa upload CCCD mặt sau' 
        });
      }
      
      if (!kyc.licenseFrontUploaded) {
        return res.status(400).json({ 
          message: 'Không thể approve: Chưa upload GPLX mặt trước' 
        });
      }
      
      if (!kyc.licenseBackUploaded) {
        return res.status(400).json({ 
          message: 'Không thể approve: Chưa upload GPLX mặt sau' 
        });
      }
      
      // Kiểm tra thông tin cơ bản
      if (!kyc.identityCard || !kyc.licenseNumber) {
        return res.status(400).json({ 
          message: 'Không thể approve: Thiếu thông tin CMND/CCCD hoặc GPLX' 
        });
      }
      
      // Kiểm tra hạng bằng lái xe (xe máy chỉ cần A, A1, A2)
      if (!kyc.licenseClass || !['A', 'A1', 'A2'].includes(kyc.licenseClass)) {
        return res.status(400).json({ 
          message: 'Không thể approve: Hạng bằng lái xe không hợp lệ. Chỉ chấp nhận A, A1, A2 cho xe máy điện' 
        });
      }
      
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
      'userId identityCard identityName identityDob identityAddress identitySex identityNationality identityIssueDate identityIssueLoc identityFeatures identityReligion identityEthnicity identityCardFrontImage identityCardBackImage licenseNumber licenseName licenseDob licenseNation licenseAddress licensePlaceIssue licenseIssueDate licenseClass licenseClassList licenseExpiry licenseExpiryText licenseImage licenseBackImage lastUpdatedAt validationScore nameComparison validationNotes'
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

// Lấy thông tin CCCD của người dùng hiện tại
exports.getMyIdentityCard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc || !kyc.identityCardFrontUploaded) {
      return res.status(200).json({
        success: true,
        message: 'Chưa có thông tin CCCD',
        data: {
          identityCard: null
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin CCCD thành công',
      data: {
        identityCard: {
          id: kyc.identityCard,
          name: kyc.identityName,
          dob: kyc.identityDob,
          address: kyc.identityAddress,
          sex: kyc.identitySex,
          nationality: kyc.identityNationality,
          issueDate: kyc.identityIssueDate,
          issueLocation: kyc.identityIssueLoc,
          features: kyc.identityFeatures,
          religion: kyc.identityReligion,
          ethnicity: kyc.identityEthnicity,
          frontImage: kyc.identityCardFrontImage,
          backImage: kyc.identityCardBackImage,
          frontUploaded: kyc.identityCardFrontUploaded,
          backUploaded: kyc.identityCardBackUploaded,
          type: kyc.identityCardType,
          typeNew: kyc.identityCardTypeNew
        }
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy thông tin CCCD:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy thông tin GPLX của người dùng hiện tại
exports.getMyDriverLicense = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    
    const kyc = await KYC.findOne({ userId: req.user.id });
    if (!kyc || !kyc.licenseFrontUploaded) {
      return res.status(200).json({
        success: true,
        message: 'Chưa có thông tin GPLX',
        data: {
          driverLicense: null
        }
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin GPLX thành công',
      data: {
        driverLicense: {
          id: kyc.licenseNumber,
          name: kyc.licenseName,
          dob: kyc.licenseDob,
          nationality: kyc.licenseNation,
          address: kyc.licenseAddress,
          placeIssue: kyc.licensePlaceIssue,
          issueDate: kyc.licenseIssueDate,
          class: kyc.licenseClass,
          classList: kyc.licenseClassList,
          expiry: kyc.licenseExpiry,
          expiryText: kyc.licenseExpiryText,
          frontImage: kyc.licenseImage,
          backImage: kyc.licenseBackImage,
          frontUploaded: kyc.licenseFrontUploaded,
          backUploaded: kyc.licenseBackUploaded,
          uploaded: kyc.licenseUploaded,
          type: kyc.licenseTypeOcr
        }
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy thông tin GPLX:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Staff upload CCCD mặt trước cho user
exports.staffUploadIdentityCardFront = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước CMND/CCCD' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const kyc = await findOrCreateKyc(userId);
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
    
    // Cập nhật thông tin KYC - Staff upload Identity Card Front
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
    kyc.identityCard = idData.id || '';
    
    // Kiểm tra duplicate
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
    
    kyc.identityCardFrontUploaded = true;
    kyc.status = 'pending';
    
    // So sánh tên giữa CCCD và GPLX nếu đã có cả hai
    if (kyc.identityCardBackUploaded && kyc.licenseFrontUploaded) {
      if (kyc.identityOcr && kyc.identityOcr.front && kyc.licenseOcr && kyc.licenseOcr.front) {
        const nameComparison = compareIdentityAndLicenseNames(kyc.identityOcr.front, kyc.licenseOcr.front);
        kyc.nameComparison = nameComparison;
        
        if (!nameComparison.match) {
          kyc.validationNotes = `Cảnh báo: ${nameComparison.message}`;
        }
      }
    }
    
    kyc.uploadedByStaff = true;
    kyc.staffUploader = req.user.id;
    
    await kyc.save();
    
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Staff đã tải lên mặt trước CMND/CCCD thành công',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullname: user.fullname
        },
        identityCard: {
          id: kyc.identityCard,
          name: kyc.identityName,
          dob: kyc.identityDob,
          address: kyc.identityAddress,
          sex: kyc.identitySex,
          nationality: kyc.identityNationality,
          frontImage: kyc.identityCardFrontImage
        },
        kycStatus: kyc.status,
        needsBackImage: !kyc.identityCardBackUploaded,
        validation: {
          nameComparison: kyc.nameComparison || null,
          validationNotes: kyc.validationNotes || null
        }
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi staff upload mặt trước CMND/CCCD:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error:
        process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Staff upload CCCD mặt sau cho user
exports.staffUploadIdentityCardBack = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau CMND/CCCD' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const kyc = await findOrCreateKyc(userId);
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
    
    kyc.identityCardBackUploaded = true;
    kyc.status = 'pending';
    
    // So sánh tên giữa CCCD và GPLX nếu đã có cả hai
    if (kyc.identityCardFrontUploaded && kyc.licenseFrontUploaded && kyc.licenseBackUploaded) {
      if (kyc.identityOcr && kyc.identityOcr.front && kyc.licenseOcr && kyc.licenseOcr.front) {
        const nameComparison = compareIdentityAndLicenseNames(kyc.identityOcr.front, kyc.licenseOcr.front);
        kyc.nameComparison = nameComparison;
        
        if (!nameComparison.match) {
          kyc.validationNotes = `Cảnh báo: ${nameComparison.message}`;
        }
      }
    }
    
    kyc.uploadedByStaff = true;
    kyc.staffUploader = req.user.id;
    
    await kyc.save();
    
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Staff đã tải lên mặt sau CMND/CCCD thành công',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullname: user.fullname
        },
        identityCard: {
          issueDate: kyc.identityIssueDate,
          issueLocation: kyc.identityIssueLoc,
          features: kyc.identityFeatures,
          religion: kyc.identityReligion,
          ethnicity: kyc.identityEthnicity,
          backImage: kyc.identityCardBackImage
        },
        kycStatus: kyc.status,
        needsFrontImage: !kyc.identityCardFrontUploaded,
        validation: {
          nameComparison: kyc.nameComparison || null,
          validationNotes: kyc.validationNotes || null
        }
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi staff upload mặt sau CMND/CCCD:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Staff upload GPLX mặt trước cho user
exports.staffUploadDriverLicenseFront = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt trước giấy phép lái xe' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const kyc = await findOrCreateKyc(userId);
    const ocrResult = await verifyDriverLicense(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực giấy phép lái xe', 
        error: ocrResult.errorMessage 
      });
    }

    const licenseData = ocrResult.data[0];
    
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
    kyc.licenseNumber = licenseData.id || '';
    
    // Kiểm tra duplicate
    if (kyc.licenseNumber) {
      const isDuplicate = await checkDuplicateLicense(kyc.licenseNumber, userId);
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
    
    kyc.licenseFrontUploaded = true;
    kyc.licenseUploaded = true;
    kyc.status = 'pending';
    
    // So sánh tên giữa CCCD và GPLX nếu đã có cả hai
    if (kyc.identityCardFrontUploaded && kyc.identityCardBackUploaded) {
      if (kyc.identityOcr && kyc.identityOcr.front && kyc.licenseOcr && kyc.licenseOcr.front) {
        const nameComparison = compareIdentityAndLicenseNames(kyc.identityOcr.front, kyc.licenseOcr.front);
        kyc.nameComparison = nameComparison;
        
        if (!nameComparison.match) {
          kyc.validationNotes = `Cảnh báo: ${nameComparison.message}`;
        }
      }
    }
    
    kyc.uploadedByStaff = true;
    kyc.staffUploader = req.user.id;
    
    await kyc.save();
    
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Staff đã tải lên mặt trước giấy phép lái xe thành công',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullname: user.fullname
        },
        license: {
          id: kyc.licenseNumber,
          name: kyc.licenseName,
          dob: kyc.licenseDob,
          nationality: kyc.licenseNation,
          address: kyc.licenseAddress,
          placeIssue: kyc.licensePlaceIssue,
          issueDate: kyc.licenseIssueDate,
          class: kyc.licenseClass,
          expiry: kyc.licenseExpiry,
          expiryText: kyc.licenseExpiryText,
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
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi staff upload mặt trước GPLX:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Staff upload GPLX mặt sau cho user
exports.staffUploadDriverLicenseBack = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng tải lên ảnh mặt sau giấy phép lái xe' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const kyc = await findOrCreateKyc(userId);
    const ocrResult = await verifyDriverLicense(req.file.buffer);
    
    if (ocrResult.errorCode !== 0) {
      return res.status(400).json({ 
        message: 'Không thể xác thực giấy phép lái xe', 
        error: ocrResult.errorMessage 
      });
    }

    const licenseData = ocrResult.data[0];
    
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
    
    kyc.licenseBackUploaded = true;
    kyc.status = 'pending';
    
    // So sánh tên giữa CCCD và GPLX nếu đã có cả hai
    if (kyc.identityCardFrontUploaded && kyc.identityCardBackUploaded && kyc.licenseFrontUploaded) {
      if (kyc.identityOcr && kyc.identityOcr.front && kyc.licenseOcr && kyc.licenseOcr.front) {
        const nameComparison = compareIdentityAndLicenseNames(kyc.identityOcr.front, kyc.licenseOcr.front);
        kyc.nameComparison = nameComparison;
        
        if (!nameComparison.match) {
          kyc.validationNotes = `Cảnh báo: ${nameComparison.message}`;
        }
      }
    }
    
    kyc.uploadedByStaff = true;
    kyc.staffUploader = req.user.id;
    
    await kyc.save();
    
    user.kycStatus = kyc.status;
    user.kycId = kyc._id;
    await user.save();
    
    return res.status(200).json({
      success: true,
      message: 'Staff đã tải lên mặt sau giấy phép lái xe thành công',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullname: user.fullname
        },
        license: {
          classList: kyc.licenseClassList,
          backImage: kyc.licenseBackImage
        },
        kycStatus: kyc.status,
        needsFrontImage: !kyc.licenseFrontUploaded,
        validation: {
          nameComparison: kyc.nameComparison || null,
          validationNotes: kyc.validationNotes || null
        }
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi staff upload mặt sau GPLX:', error);
    return res.status(500).json({
      success: false,
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

// Lấy danh sách users chưa submit KYC hoặc KYC rejected (dành cho staff)
exports.getUsersNotSubmittedKyc = async (req, res) => {
  try {
    // Kiểm tra quyền hạn - chỉ Station Staff và Admin
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này'
      });
    }
    
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      kycStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Query để tìm users không có KYC hoặc KYC rejected/not_submitted
    const query = {
      $or: [
        { kycStatus: { $in: ['not_submitted', 'rejected'] } },
        { kycStatus: { $exists: false } },
        { kycStatus: null }
      ]
    };
    
    // Filter theo kycStatus
    if (kycStatus && kycStatus !== 'all') {
      query.$and = [
        ...(query.$and || []),
        { kycStatus: kycStatus }
      ];
    }
    
    // Search theo email, fullname, phone
    if (search && search.trim()) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { fullname: { $regex: search.trim(), $options: 'i' } },
            { email: { $regex: search.trim(), $options: 'i' } },
            { phone: { $regex: search.trim(), $options: 'i' } }
          ]
        }
      ];
    }
    
    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Lấy users với pagination và sorting
    const users = await User.find(query)
      .select('_id fullname email phone kycStatus createdAt lastLoginAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Đếm total users matching query
    const total = await User.countDocuments(query);
    
    // Enrich với thông tin KYC của từng user
    const usersWithKycInfo = await Promise.all(
      users.map(async (user) => {
        const kyc = await KYC.findOne({ userId: user._id });
        return {
          id: user._id,
          fullname: user.fullname,
          email: user.email,
          phone: user.phone,
          kycStatus: user.kycStatus || 'not_submitted',
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
          kycInfo: kyc ? {
            rejectionReason: kyc.rejectionReason || null,
            identityUploaded: kyc.identityCardFrontUploaded || false,
            identityBackUploaded: kyc.identityCardBackUploaded || false,
            licenseUploaded: kyc.licenseFrontUploaded || false,
            licenseBackUploaded: kyc.licenseBackUploaded || false,
            lastUpdated: kyc.lastUpdatedAt,
            staffUploaded: kyc.uploadedByStaff || false,
            validationScore: kyc.validationScore || null
          } : {
            rejectionReason: null,
            identityUploaded: false,
            identityBackUploaded: false,
            licenseUploaded: false,
            licenseBackUploaded: false,
            lastUpdated: null,
            staffUploaded: false,
            validationScore: null
          }
        };
      })
    );
    
    // Tính stats tổng quan
    const stats = {
      notSubmitted: await User.countDocuments({ 
        $or: [
          { kycStatus: 'not_submitted' },
          { kycStatus: { $exists: false } },
          { kycStatus: null }
        ]
      }),
      rejected: await User.countDocuments({ kycStatus: 'rejected' }),
      pending: await User.countDocuments({ kycStatus: 'pending' }),
      approved: await User.countDocuments({ kycStatus: 'approved' })
    };
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách users không có KYC thành công',
      data: {
        users: usersWithKycInfo,
        pagination: { 
          page: parseInt(page), 
          limit: parseInt(limit), 
          total, 
          pages: Math.ceil(total / limit) 
        },
        filters: {
          search: search || '',
          kycStatus: kycStatus || 'all',
          sortBy,
          sortOrder
        },
        stats
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy danh sách users không có KYC:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy danh sách KYC đã completed (approved) với full thông tin
exports.getCompletedKycRequests = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      });
    }
    
    const { 
      page = 1, 
      limit = 20, 
      search = '',
      sortBy = 'approvedAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Query để tìm KYC đã approved
    const query = { status: 'approved' };
    
    // Search theo tên, email, CMND, GPLX
    if (search && search.trim()) {
      query.$or = [
        { identityName: { $regex: search.trim(), $options: 'i' } },
        { identityCard: { $regex: search.trim(), $options: 'i' } },
        { licenseNumber: { $regex: search.trim(), $options: 'i' } }
      ];
    }
    
    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Lấy KYC với pagination và sorting
    const kycs = await KYC.find(query)
      .populate('userId', '_id email fullname phone')
      .populate('approvedBy', '_id fullname email')
      .select('userId identityCard identityName identityDob identityAddress identitySex identityNationality identityIssueDate identityIssueLoc identityFeatures identityReligion identityEthnicity identityCardFrontImage identityCardBackImage licenseNumber licenseName licenseDob licenseClass licenseExpiry licenseExpiryText licenseImage licenseBackImage status validationScore nameComparison validationNotes approvedAt approvedBy lastUpdatedAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    
    const total = await KYC.countDocuments(query);
    
    
    const stats = {
      approved: await KYC.countDocuments({ status: 'approved' }),
      rejected: await KYC.countDocuments({ status: 'rejected' }),
      pending: await KYC.countDocuments({ status: 'pending' }),
      total: await KYC.countDocuments({})
    };
    
    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách KYC đã completed thành công',
      data: {
        kycs,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        stats
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi lấy danh sách KYC completed:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};
