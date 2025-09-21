/**
 * Middleware kiểm tra quyền hạn của người dùng
 * @param {Array} roles - Mảng các vai trò được phép truy cập
 */
const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Không được phép truy cập' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền thực hiện hành động này',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = roleMiddleware;




