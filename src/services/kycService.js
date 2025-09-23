const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Gọi API FPT.AI để nhận diện CMND/CCCD
 * @param {Buffer} imageBuffer - Buffer của ảnh cần nhận diện
 * @returns {Promise<Object>} - Kết quả nhận diện
 */
const verifyIdentityCard = async (imageBuffer) => {
  try {
    // Tạo file tạm thời từ buffer
    const tempFilePath = path.join(__dirname, `../../temp_id_${Date.now()}.jpg`);
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    // Tạo form data
    const formData = new FormData();
    formData.append('image', fs.createReadStream(tempFilePath));
    
    // Gọi API
    const response = await axios.post('https://api.fpt.ai/vision/idr/vnm', formData, {
      headers: {
        'api-key': process.env.FPT_AI_KEY,
        ...formData.getHeaders()
      }
    });
    
   
    fs.unlinkSync(tempFilePath);
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi gọi FPT.AI IDR API:', error);
    throw new Error('Không thể xác thực CMND/CCCD. Vui lòng thử lại sau.');
  }
};

/**
 * Gọi API FPT.AI để nhận diện giấy phép lái xe
 * @param {Buffer} imageBuffer - Buffer của ảnh cần nhận diện
 * @returns {Promise<Object>} - Kết quả nhận diện
 */
const verifyDriverLicense = async (imageBuffer) => {
  try {
    // Tạo file tạm thời từ buffer
    const tempFilePath = path.join(__dirname, `../../temp_license_${Date.now()}.jpg`);
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    // Tạo form data
    const formData = new FormData();
    formData.append('image', fs.createReadStream(tempFilePath));
    
    // Gọi API
    const response = await axios.post('https://api.fpt.ai/vision/dlr/vnm', formData, {
      headers: {
        'api-key': process.env.FPT_AI_KEY,
        ...formData.getHeaders()
      }
    });
    
    // Xóa file tạm
    fs.unlinkSync(tempFilePath);
    
    return response.data;
  } catch (error) {
    console.error('Lỗi khi gọi FPT.AI DLR API:', error);
    throw new Error('Không thể xác thực giấy phép lái xe. Vui lòng thử lại sau.');
  }
};

/**
 * Kiểm tra mức độ khớp giữa thông tin người dùng và kết quả OCR
 * @param {Object} user - Thông tin người dùng
 * @param {Object} ocrData - Kết quả OCR
 * @returns {Object} - Kết quả kiểm tra và điểm tin cậy
 */
const validateUserIdentity = (user, ocrData) => {
  let score = 0;
  let maxScore = 0;
  const results = {};

  // Kiểm tra tên
  if (ocrData.name && user.fullname) {
    maxScore += 3;
    // Chuẩn hóa tên để so sánh
    const normalizedOcrName = ocrData.name.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedUserName = user.fullname.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (normalizedOcrName === normalizedUserName) {
      score += 3;
      results.name = { match: true, score: 3 };
    } else {
      // Tính độ tương đồng của tên
      const nameWords = normalizedUserName.split(' ');
      const ocrNameWords = normalizedOcrName.split(' ');
      
      let nameMatchCount = 0;
      nameWords.forEach(word => {
        if (ocrNameWords.includes(word)) nameMatchCount++;
      });
      
      const nameMatchScore = nameMatchCount / Math.max(nameWords.length, ocrNameWords.length) * 3;
      score += nameMatchScore;
      results.name = { match: nameMatchScore > 1.5, score: nameMatchScore };
    }
  }

  // Kiểm tra địa chỉ nếu có
  if (ocrData.address && user.address) {
    maxScore += 2;
    const normalizedOcrAddress = ocrData.address.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedUserAddress = user.address.toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (normalizedOcrAddress.includes(normalizedUserAddress) || normalizedUserAddress.includes(normalizedOcrAddress)) {
      score += 2;
      results.address = { match: true, score: 2 };
    } else {
      // Kiểm tra từng phần của địa chỉ
      let addressMatchScore = 0;
      if (ocrData.address_entities) {
        if (normalizedUserAddress.includes(ocrData.address_entities.province?.toLowerCase() || '')) addressMatchScore += 0.5;
        if (normalizedUserAddress.includes(ocrData.address_entities.district?.toLowerCase() || '')) addressMatchScore += 0.5;
        if (normalizedUserAddress.includes(ocrData.address_entities.ward?.toLowerCase() || '')) addressMatchScore += 0.5;
      }
      
      score += addressMatchScore;
      results.address = { match: addressMatchScore > 1, score: addressMatchScore };
    }
  }

  // Tính điểm tin cậy
  const confidenceScore = maxScore > 0 ? (score / maxScore) * 100 : 0;
  
  return {
    results,
    confidenceScore,
    isAutoApproved: false, // Bỏ auto-approve, luôn cần staff duyệt thủ công
    score,
    maxScore
  };
};

/**
 * So sánh tên giữa CCCD và GPLX
 * @param {Object} identityData - Dữ liệu từ CCCD
 * @param {Object} licenseData - Dữ liệu từ GPLX
 * @returns {Object} - Kết quả so sánh
 */
const compareIdentityAndLicenseNames = (identityData, licenseData) => {
  if (!identityData.name || !licenseData.name) {
    return {
      match: false,
      score: 0,
      message: 'Thiếu thông tin tên từ một trong hai giấy tờ'
    };
  }

  // Chuẩn hóa tên để so sánh
  const normalizedIdentityName = identityData.name.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedLicenseName = licenseData.name.toLowerCase().replace(/\s+/g, ' ').trim();
  
  if (normalizedIdentityName === normalizedLicenseName) {
    return {
      match: true,
      score: 100,
      message: 'Tên khớp hoàn toàn'
    };
  }

  // Tính độ tương đồng của tên
  const identityWords = normalizedIdentityName.split(' ');
  const licenseWords = normalizedLicenseName.split(' ');
  
  let nameMatchCount = 0;
  identityWords.forEach(word => {
    if (licenseWords.includes(word)) nameMatchCount++;
  });
  
  const matchScore = (nameMatchCount / Math.max(identityWords.length, licenseWords.length)) * 100;
  
  return {
    match: matchScore >= 70,
    score: matchScore,
    message: matchScore >= 70 ? 'Tên khớp đủ độ tin cậy' : 'Tên không khớp, cần kiểm tra thủ công'
  };
};

/**
 * Kiểm tra hạng bằng lái xe có hợp lệ cho xe máy
 * @param {string|Array} licenseClass - Hạng bằng lái xe
 * @returns {Object} - Kết quả kiểm tra
 */
const validateLicenseClass = (licenseClass) => {
  const validClasses = ['A', 'A1', 'A2'];
  
  if (!licenseClass) {
    return {
      isValid: false,
      message: 'Không tìm thấy hạng bằng lái xe'
    };
  }

  // Xử lý trường hợp licenseClass là string hoặc array
  let classes = [];
  if (typeof licenseClass === 'string') {
    classes = [licenseClass];
  } else if (Array.isArray(licenseClass)) {
    classes = licenseClass;
  }

  // Kiểm tra xem có hạng hợp lệ không
  const hasValidClass = classes.some(cls => validClasses.includes(cls));
  
  if (hasValidClass) {
    const validClassFound = classes.find(cls => validClasses.includes(cls));
    return {
      isValid: true,
      message: `Hạng bằng ${validClassFound} hợp lệ cho xe máy`,
      validClass: validClassFound
    };
  } else {
    return {
      isValid: false,
      message: `Hạng bằng ${classes.join(', ')} không hợp lệ. Cần hạng A, A1 hoặc A2 để thuê xe máy`
    };
  }
};

module.exports = {
  verifyIdentityCard,
  verifyDriverLicense,
  validateUserIdentity,
  compareIdentityAndLicenseNames,
  validateLicenseClass
};
