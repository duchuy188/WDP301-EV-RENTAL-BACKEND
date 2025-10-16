const express = require('express');
const router = express.Router();
const MaintenanceController = require('../controllers/MaintenanceController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');
const { vehicleImageUpload } = require('../middlewares/vehicleImageUpload');

/**
 * Maintenance Routes
 * 
 * Base URL: /api/maintenance
 */

// Lấy danh sách báo cáo bảo trì (Admin only)
router.get('/',
    authenticateToken,
    requireRole(['Admin']),
    MaintenanceController.getAllMaintenanceReports
);

// Lấy báo cáo bảo trì theo trạm (Station Staff)
router.get('/station',
    authenticateToken,
    requireRole(['Station Staff']),
    MaintenanceController.getStationMaintenanceReports
);

// Lấy chi tiết báo cáo bảo trì
router.get('/:id',
    authenticateToken,
    requireRole(['Admin', 'Station Staff']),
    MaintenanceController.getMaintenanceReportById
);

// Cập nhật trạng thái báo cáo bảo trì
router.put('/:id',
    authenticateToken,
    requireRole(['Admin']),
    vehicleImageUpload.array('images', 5), 
    MaintenanceController.updateMaintenanceStatus
);

// Xóa báo cáo bảo trì (Admin only)
router.delete('/:id',
    authenticateToken, 
    requireRole(['Admin']),
    MaintenanceController.deleteMaintenanceReport
);

module.exports = router;
