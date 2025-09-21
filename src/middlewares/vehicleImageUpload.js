const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');


const vehicleImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'ev-rental/vehicles',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  }
});


const vehicleImageUpload = multer({
  storage: vehicleImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  }
});

module.exports = vehicleImageUpload;