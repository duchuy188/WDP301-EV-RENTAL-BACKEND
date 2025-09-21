
const jwt = require('jsonwebtoken');
const { User, BlacklistToken } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Truy cập bị từ chối. Không có token được cung cấp.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Truy cập bị từ chối. Không có token được cung cấp.' });
    }

    
    const isBlacklisted = await BlacklistToken.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token đã bị thu hồi. Vui lòng đăng nhập lại.' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'Token không hợp lệ. Không tìm thấy người dùng.' });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token không hợp lệ.' });
    }
  } catch (error) {
    console.error('Lỗi server:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
  }
};

module.exports = authMiddleware;
