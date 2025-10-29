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
router.get('/:id/checkout-info', authenticateToken, requireRole(['Station Staff', 'admin']), RentalController.getCheckoutInfo);

// PUT /api/rentals/:id/checkout-normal - Checkout bình thường (không có phí phát sinh)
router.put('/:id/checkout-normal', authenticateToken, requireRole(['Station Staff', 'admin']), uploadMultiple, RentalController.processNormalCheckout);

// PUT /api/rentals/:id/checkout-fees - Checkout có phí phát sinh (staff tự nhập)
router.put('/:id/checkout-fees', authenticateToken, requireRole(['Station Staff', 'admin']), uploadMultiple, RentalController.processCheckoutWithFees);

// PUT /api/rentals/:id/checkout - Legacy endpoint (deprecated - redirect to normal for backward compatibility)
router.put('/:id/checkout', authenticateToken, requireRole(['Station Staff', 'admin']), uploadMultiple, (req, res) => {
  res.status(410).json({
    success: false,
    message: 'Endpoint /checkout đã deprecated. Vui lòng sử dụng /checkout-normal hoặc /checkout-fees',
    endpoints: {
      normal: '/api/rentals/:id/checkout-normal',
      fees: '/api/rentals/:id/checkout-fees'
    }
  });
});


module.exports = router;