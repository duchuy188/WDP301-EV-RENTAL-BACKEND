const express = require('express');
const router = express.Router();
const RentalController = require('../controllers/RentalController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');
const { uploadMultiple } = require('../middlewares/vehicleImageUpload');

// GET /api/rentals/user - Lấy rentals của customer
router.get('/user', authenticateToken, requireRole(['EV Renter']), RentalController.getUserRentals);

// GET /api/rentals/staff - Lấy rentals tại station của staff
router.get('/staff', authenticateToken, requireRole(['Station Staff']), RentalController.getStaffRentals);

// GET /api/rentals/admin - Lấy tất cả rentals (admin only)
router.get('/admin', authenticateToken, requireRole(['Admin']), RentalController.getAdminRentals);

// GET /api/rentals/:id - Lấy chi tiết rental
router.get('/:id', authenticateToken, RentalController.getRentalDetails);

// GET /api/rentals/:id/checkout-info - Lấy thông tin checkout
router.get('/:id/checkout-info', authenticateToken, requireRole(['staff', 'admin']), RentalController.getCheckoutInfo);

// PUT /api/rentals/:id/checkout - Xử lý checkout (tự động tính phí)
router.put('/:id/checkout', authenticateToken, requireRole(['staff', 'admin']), RentalController.processCheckout);

// POST /api/rentals/:id/return-photos - Upload ảnh và báo cáo tình trạng xe
router.post('/:id/return-photos', authenticateToken, requireRole(['staff', 'admin']), uploadMultiple, RentalController.uploadReturnPhotos);

module.exports = router;