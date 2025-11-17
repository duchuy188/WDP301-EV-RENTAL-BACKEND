const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Storage cho ảnh xe
const vehicleImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ev-rental/vehicles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});

// Storage cho ảnh trả xe
const returnImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ev-rental/return-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});

// Storage cho ảnh report sự cố
const reportImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ev-rental/reports',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});

// Middleware upload ảnh xe
const vehicleImageUpload = multer({
  storage: vehicleImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Middleware upload nhiều ảnh trả xe
const uploadMultiple = multer({
  storage: returnImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Tối đa 10 ảnh
  }
}).array('photos', 10);

// Middleware upload ảnh report (tối đa 5 ảnh)
const reportImageUpload = multer({
  storage: reportImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Tối đa 5 ảnh
  }
});

module.exports = {
  vehicleImageUpload,
  uploadMultiple,
  reportImageUpload
};