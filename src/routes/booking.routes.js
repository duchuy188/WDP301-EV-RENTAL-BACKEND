const express = require('express');
const router = express.Router();
const {
  createBooking,
  getUserBookings,
  getBookingDetails,
  confirmBooking,
  cancelBooking,
  getAllBookings,
  getStationBookings,
  scanQRCode
} = require('../controllers/BookingController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// User routes (EV Renter)
router.post('/', authenticateToken, createBooking);
router.get('/user', authenticateToken, getUserBookings);
router.get('/:id', authenticateToken, getBookingDetails);
router.delete('/:id', authenticateToken, cancelBooking);

// Staff routes (Station Staff)
router.put('/:id/confirm', authenticateToken, requireRole(['Station Staff', 'Admin']), confirmBooking);
router.get('/station/list', authenticateToken, requireRole(['Station Staff', 'Admin']), getStationBookings);

// QR Code routes
router.post('/scan-qr', authenticateToken, requireRole(['Station Staff', 'Admin']), scanQRCode);

// Admin routes
router.get('/', authenticateToken, requireRole(['Admin']), getAllBookings);

module.exports = router;
