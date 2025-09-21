const multer = require('multer');

// Cấu hình multer cho upload hình ảnh station
const storage = multer.memoryStorage();

const stationImageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 
  },
  fileFilter: (req, file, cb) => {
    
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép upload file hình ảnh'), false);
    }
  }
});

module.exports = stationImageUpload;

