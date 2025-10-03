const express = require('express');
const router = express.Router();
const AIController = require('../controllers/AIController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');

// Tất cả AI routes chỉ dành cho Admin
router.use(authenticateToken);
router.use(requireRole(['Admin']));

// Health check
router.get('/health', AIController.healthCheck);

// Dự báo nhu cầu tổng quan
router.get('/demand-forecast', AIController.getDemandForecast);

// Dự báo nhu cầu theo trạm
router.get('/demand-forecast/station/:id', AIController.getStationDemandForecast);

// Gợi ý số lượng xe
router.get('/vehicle-recommendations', AIController.getVehicleRecommendations);

// Phân tích xu hướng
router.get('/trend-analysis', AIController.getTrendAnalysis);

// Dashboard AI tổng hợp
router.get('/dashboard', AIController.getAIDashboard);

module.exports = router;
