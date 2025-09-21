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
    isAutoApproved: confidenceScore >= 70, // Tự động duyệt nếu điểm tin cậy >= 70%
    score,
    maxScore
  };
};

module.exports = {
  verifyIdentityCard,
  verifyDriverLicense,
  validateUserIdentity
};
