const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/ReportController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');
const { reportImageUpload } = require('../middlewares/vehicleImageUpload');

// USER routes (EV Renter)
router.post(
  '/',
  authenticateToken,
  reportImageUpload.array('images', 5),
  ReportController.createReport
);

router.get(
  '/my-reports',
  authenticateToken,
  ReportController.getMyReports
);

// STAFF/ADMIN routes
router.get(
  '/stats',
  authenticateToken,
  requireRole(['Station Staff', 'Admin']),
  ReportController.getReportStats
);

router.get(
  '/',
  authenticateToken,
  requireRole(['Station Staff', 'Admin']),
  ReportController.getAllReports
);

router.get(
  '/:id',
  authenticateToken,
  ReportController.getReportById
);

router.put(
  '/:id/resolve',
  authenticateToken,
  requireRole(['Station Staff', 'Admin']),
  ReportController.resolveReport
);

module.exports = router;
