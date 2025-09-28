const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// Tổng quan doanh thu
router.get('/revenue/overview',
    authenticateToken,
    requireRole(['Admin']),
    AnalyticsController.getRevenueOverview
);

// Doanh thu theo trạm
router.get('/revenue/by-station',
    authenticateToken,
    requireRole(['Admin']),
    AnalyticsController.getRevenueByStation
);

// Phân tích xu hướng doanh thu
router.get('/revenue/trends',
    authenticateToken,
    requireRole(['Admin']),
    AnalyticsController.getRevenueTrends
);

// Chi tiết doanh thu trạm
router.get('/revenue/station-detail/:stationId',
    authenticateToken,
    requireRole(['Admin']),
    AnalyticsController.getStationRevenueDetail
);

module.exports = router;
