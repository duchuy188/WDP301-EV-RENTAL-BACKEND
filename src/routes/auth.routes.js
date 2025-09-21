
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middlewares/authMiddleware');
const { avatarUpload } = require('../config/cloudinary');

// Đăng ký người dùng
router.post('/register', AuthController.register);

// Đăng nhập người dùng
router.post('/login', AuthController.login);

// Đăng xuất người dùng
router.post('/logout', AuthController.logout);

// Lấy thông tin người dùng
router.get('/profile', authMiddleware, AuthController.getProfile);

// Làm mới token
router.post('/refresh-token', AuthController.refreshToken);

// Cập nhật thông tin người dùng
router.put('/profile', authMiddleware, avatarUpload.single('avatar'), AuthController.updateProfile);

// Đổi mật khẩu
router.post('/change-password', authMiddleware, AuthController.changePassword);

// Quên mật khẩu - Yêu cầu đặt lại
router.post('/forgot-password', AuthController.forgotPassword);

// Đặt lại mật khẩu với token
router.post('/reset-password', AuthController.resetPassword);

module.exports = router;
