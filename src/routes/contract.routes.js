const express = require('express');
const router = express.Router();
const {
  createContract,
  getContractDetails,
  signContract,
  generateContractPDF,
  getContractView,
  getContracts,
  cancelContract
} = require('../controllers/ContractController');

const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

/**
 * Contract Routes
 * 
 * Base URL: /api/contracts
 */

// Tạo contract mới (Staff/Admin only)
router.post('/', authenticateToken, requireRole(['Station Staff', 'Admin']), createContract);

// Lấy chi tiết contract
router.get('/:id', authenticateToken, getContractDetails);

// Ký contract
router.put('/:id/sign', authenticateToken, signContract);

// Generate PDF contract
router.get('/:id/pdf', authenticateToken, generateContractPDF);

// Xem contract online (HTML)
router.get('/:id/view', authenticateToken, getContractView);

// Lấy danh sách contracts
router.get('/', authenticateToken, getContracts);

// Hủy contract (Staff/Admin only)
router.put('/:id/cancel', authenticateToken, requireRole(['Station Staff', 'Admin']), cancelContract);

module.exports = router;


