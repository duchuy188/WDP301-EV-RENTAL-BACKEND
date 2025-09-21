const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const BlacklistToken = require('../models/BlacklistToken');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { cloudinary } = require('../config/cloudinary');
const { sendEmail, getResetPasswordEmailTemplate, getWelcomeEmailTemplate } = require('../config/nodemailer');
// const cryptoRandomString = require('crypto-random-string');

// Register a new user
exports.register = async (req, res) => {
    try {
        const { fullname, email, password } = req.body;
        
       
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã được sử dụng, vui lòng chọn email khác' });
        }
        
        const isStrongPassword = (password) => {
           
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return regex.test(password);
        };

        if (!isStrongPassword(password)) {
            return res.status(400).json({ 
                message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            fullname,
            email,
            passwordHash: hashedPassword
        });

        await newUser.save();
        
       
        try {
            await sendEmail({
                to: email,
                subject: 'Chào mừng đến với EV Rental',
                html: getWelcomeEmailTemplate(fullname)
            });
            console.log('✅ Email chào mừng đã được gửi đến:', email);
        } catch (emailError) {
            console.error('❌ Lỗi khi gửi email chào mừng:', emailError.message);
            // Không throw error, chỉ log và tiếp tục
            // Email không gửi được không ảnh hưởng đến việc đăng ký
        }
        
        res.status(201).json({ 
            message: 'Đăng ký tài khoản thành công! Vui lòng kiểm tra email để xác nhận',
            user: {
                id: newUser._id,
                fullname: newUser.fullname,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        
        if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
            return res.status(400).json({ 
                message: 'Email đã được sử dụng, vui lòng chọn email khác' 
            });
        }
        
        res.status(500).json({ message: 'Lỗi khi đăng ký người dùng', error: error.message });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Thông tin xác thực không hợp lệ' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
        
      
        const refreshTokenString = require('crypto').randomBytes(40).toString('hex');
        
        const refreshToken = new RefreshToken({
            token: refreshTokenString,
            userId: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
        });

        await refreshToken.save();
        res.status(200).json({ token, refreshToken: refreshToken.token });
    } catch (error) {
        console.error('Lỗi chi tiết:', error);
        res.status(500).json({ 
            message: 'Lỗi khi đăng nhập', 
            error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message 
        });
    }
};

// Logout user
exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            try {
                
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const expiryDate = new Date(decoded.exp * 1000);
              
                const blacklistedToken = new BlacklistToken({
                    token: token,
                    expiresAt: expiryDate
                });
                
                await blacklistedToken.save();
                console.log('Token đã được thêm vào danh sách đen');
            } catch (error) {
               
                console.log('Token không hợp lệ hoặc đã hết hạn, không thêm vào danh sách đen');
            }
        }
        
      
        if (refreshToken) {
        await RefreshToken.deleteOne({ token: refreshToken });
            console.log('Refresh token đã được xóa');
        }

        res.status(200).json({ message: 'Đăng xuất thành công' });
    } catch (error) {
        console.error('Lỗi khi đăng xuất:', error);
        res.status(500).json({ message: 'Lỗi khi đăng xuất', error: error.message });
    }
};

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const user = req.user;
        
        const userProfile = {
            id: user._id,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            address: user.address,
        };
        
        res.status(200).json(userProfile);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy thông tin người dùng', error: error.message });
    }
};

// Update profile
exports.updateProfile = async (req, res) => {
    try {
        const user = req.user;
        const { fullname, phone, address } = req.body;
        
        
        if (fullname) user.fullname = fullname;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        
        
        if (req.file) {
            
            if (user.avatar && user.avatarPublicId) {
                try {
                    await cloudinary.uploader.destroy(user.avatarPublicId);
                    console.log('Đã xóa avatar cũ');
                } catch (error) {
                    console.log('Lỗi khi xóa avatar cũ:', error);
                }
            }
            
            
            user.avatar = req.file.path; 
            user.avatarPublicId = req.file.filename; 
        }
        
        await user.save();
        
       
        const updatedProfile = {
            id: user._id,
            fullname: user.fullname,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            address: user.address,
        };
        
        res.status(200).json({ 
            message: 'Cập nhật thông tin người dùng thành công', 
            profile: updatedProfile 
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin người dùng:', error);
        res.status(500).json({ message: 'Lỗi khi cập nhật thông tin người dùng', error: error.message });
    }
};

// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;
        
   
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
        }
        
     
        const isStrongPassword = (password) => {
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return regex.test(password);
        };

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ 
                message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt' 
            });
        }
        
        
        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại' });
        }
        
       
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.passwordHash = hashedPassword;
        
        await user.save();
        
     
        await RefreshToken.deleteMany({ userId: user._id });
        
        res.status(200).json({ message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' });
    } catch (error) {
        console.error('Lỗi khi đổi mật khẩu:', error);
        res.status(500).json({ message: 'Lỗi khi đổi mật khẩu', error: error.message });
    }
};

// Forgot password - Request reset
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            
            return res.status(200).json({ message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu sẽ được gửi đến email của bạn' });
        }
        
       
        const resetToken = require('crypto').randomBytes(32).toString('hex');
        
       
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); 
        
        await user.save();
        
      
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
      
        try {
            await sendEmail({
                to: user.email,
                subject: 'Đặt lại mật khẩu EV Rental',
                html: getResetPasswordEmailTemplate(resetUrl, user.fullname)
            });
            
            res.status(200).json({ message: 'Một liên kết đặt lại mật khẩu đã được gửi đến email của bạn' });
        } catch (emailError) {
          
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();
            
            console.error('Lỗi khi gửi email:', emailError);
            res.status(500).json({ message: 'Không thể gửi email đặt lại mật khẩu', error: emailError.message });
        }
    } catch (error) {
        console.error('Lỗi khi xử lý yêu cầu quên mật khẩu:', error);
        res.status(500).json({ message: 'Lỗi khi xử lý yêu cầu quên mật khẩu', error: error.message });
    }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
    
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });
        
        if (!user) {
            return res.status(400).json({ message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' });
        }
        
  
        const isStrongPassword = (password) => {
            const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
            return regex.test(password);
        };

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ 
                message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt' 
            });
        }
        
   
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.passwordHash = hashedPassword;
        
   
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        
        await user.save();
        
     
        await RefreshToken.deleteMany({ userId: user._id });
        
        res.status(200).json({ message: 'Đặt lại mật khẩu thành công, vui lòng đăng nhập với mật khẩu mới' });
    } catch (error) {
        console.error('Lỗi khi đặt lại mật khẩu:', error);
        res.status(500).json({ message: 'Lỗi khi đặt lại mật khẩu', error: error.message });
    }
};

// Refresh token
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ message: 'Refresh token là bắt buộc' });
        }
        
       
        const refreshTokenDoc = await RefreshToken.findOne({ token: refreshToken });
        
        if (!refreshTokenDoc || refreshTokenDoc.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
        }
        
    
        const user = await User.findById(refreshTokenDoc.userId);
        if (!user) {
            return res.status(401).json({ message: 'Không tìm thấy người dùng' });
        }
        
        
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const oldToken = authHeader.split(' ')[1];
            
            try {
                
                const decoded = jwt.verify(oldToken, process.env.JWT_SECRET);
                const expiryDate = new Date(decoded.exp * 1000);
                
                const blacklistedToken = new BlacklistToken({
                    token: oldToken,
                    expiresAt: expiryDate
                });
                
                await blacklistedToken.save();
                console.log('Token cũ đã được thêm vào danh sách đen');
            } catch (error) {
                console.log('Token cũ không hợp lệ hoặc đã hết hạn');
            }
        }
        
       
        const newAccessToken = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
      
        await RefreshToken.deleteOne({ token: refreshToken });
        
      
        const newRefreshTokenString = require('crypto').randomBytes(40).toString('hex');
        const newRefreshToken = new RefreshToken({
            token: newRefreshTokenString,
            userId: user._id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        
        await newRefreshToken.save();
        
        res.status(200).json({ 
            token: newAccessToken, 
            refreshToken: newRefreshToken.token 
        });
    } catch (error) {
        console.error('Lỗi khi làm mới token:', error);
        res.status(500).json({ message: 'Lỗi khi làm mới token', error: error.message });
    }
};