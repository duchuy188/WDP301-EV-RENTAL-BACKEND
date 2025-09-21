const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Tạo tài khoản Staff (chỉ Admin) - KHÔNG gán station
router.post('/staff', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.createStaffAccount
);

// Gán Staff cho Station (chỉ Admin)
router.post('/staff/assign', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.assignStaffToStation
);

// Lấy danh sách users (chỉ Admin)
router.get('/', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.getUsers
);

// Lấy danh sách khách hàng cho Staff (chỉ EV Renter)
router.get('/customers', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']), 
  UserController.getCustomers
);

// Lấy danh sách Staff chưa có station (chỉ Admin)
router.get('/staff/unassigned', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.getUnassignedStaff
);

// Lấy danh sách khách hàng rủi ro (chỉ Admin) - PHẢI ĐẶT TRƯỚC /:id
router.get('/risky-customers', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.getRiskyCustomers
);

// Lấy thống kê users (chỉ Admin) - PHẢI ĐẶT TRƯỚC /:id
router.get('/stats/overview', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.getUserStats
);

// Lấy chi tiết user - PHẢI ĐẶT CUỐI CÙNG
router.get('/:id', 
  authMiddleware, 
  UserController.getUserDetail
);

// Cập nhật thông tin user
router.put('/:id', 
  authMiddleware, 
  UserController.updateUser
);

// Khóa/mở khóa tài khoản (chỉ Admin)
router.patch('/:id/status', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.toggleUserStatus
);

// Reset password (chỉ Admin)
router.post('/:id/reset-password', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  UserController.resetUserPassword
);

module.exports = router;
  