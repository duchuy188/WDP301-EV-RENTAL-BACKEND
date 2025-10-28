const express = require('express');
const router = express.Router();
const {
  createPayment,
  confirmPayment,
  cancelPayment,
  getUserPayments,
  getPaymentDetails,
  getAllPayments,
  updatePaymentMethod,
  handleVNPayCallback,
  handleVNPayWebhook,
  handleHoldingFeeCallback
} = require('../controllers/PaymentController');

const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

/**
 * Payment Routes
 * 
 * Base URL: /api/payments
 */

// Tạo payment mới (Staff/Admin only)
router.post('/', authenticateToken, requireRole(['Station Staff', 'Admin']), createPayment);

// Xác nhận thanh toán (Staff/Admin only)
router.put('/:id/confirm', authenticateToken, requireRole(['Station Staff', 'Admin']), confirmPayment);

// Hủy payment (Staff/Admin only)
router.put('/:id/cancel', authenticateToken, requireRole(['Station Staff', 'Admin']), cancelPayment);


// Cập nhật phương thức thanh toán (Staff/Admin only)
router.put('/:id/update-method', authenticateToken, requireRole(['Station Staff', 'Admin']), updatePaymentMethod);

// Lấy danh sách payments của user hiện tại
router.get('/my-payments', authenticateToken, getUserPayments);

// Lấy chi tiết payment
router.get('/:id', authenticateToken, getPaymentDetails);

// Lấy danh sách tất cả payments (Staff/Admin only)
router.get('/', authenticateToken, requireRole(['Station Staff', 'Admin']), getAllPayments);

// ✅ VNPay Routes (KHÔNG cần authentication)
router.get('/vnpay/callback', handleVNPayCallback);
router.post('/vnpay/webhook', handleVNPayWebhook);

// ✅ Holding Fee Callback (Online Booking) - KHÔNG cần authentication
router.get('/holding-fee/callback', handleHoldingFeeCallback);

module.exports = router;
