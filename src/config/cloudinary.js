const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Cấu hình Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const createStorage = (folder) => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: {
            folder: `ev-rental/${folder}`, 
            allowed_formats: ['jpg', 'jpeg', 'png'], 
            transformation: [{ width: 1200, height: 1200, crop: 'limit' }] 
        }
    });
};


const memoryStorage = multer.memoryStorage();


const avatarUpload = multer({ 
    storage: createStorage('avatars'),
    limits: {
        fileSize: 2 * 1024 * 1024 
    }
});

const identityCardUpload = multer({ 
    storage: memoryStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});

const licenseUpload = multer({ 
    storage: memoryStorage,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


const uploadToCloudinary = async (buffer, folder) => {
    try {
        
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: `ev-rental/${folder}`,
                    resource_type: 'image'
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            ).end(buffer);
        });
        
        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        console.error('Lỗi khi upload lên Cloudinary:', error);
        throw new Error('Không thể upload ảnh. Vui lòng thử lại sau.');
    }
};

module.exports = {
    cloudinary,
    avatarUpload,
    identityCardUpload,
    licenseUpload,
    uploadToCloudinary
};
