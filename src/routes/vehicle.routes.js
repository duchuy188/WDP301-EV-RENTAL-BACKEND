const express = require('express');
const router = express.Router();
const VehicleController = require('../controllers/VehicleController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const vehicleImageUpload = require('../middlewares/vehicleImageUpload');
const multer = require('multer');

// Cấu hình storage cho file Excel
const excelStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/excel');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'excel-' + uniqueSuffix + '.xlsx');
  }
});

const excelUpload = multer({
  storage: excelStorage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx)'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Public routes - Cho customer xem thông tin xe cơ bản
router.get('/', VehicleController.getPublicVehicles);
router.get('/statistics', VehicleController.getVehicleStatistics);

// Staff routes - Xem & quản lý xe tại trạm
router.get('/staff', 
  authMiddleware,
  roleMiddleware(['Admin', 'Station Staff']),
  VehicleController.getStaffVehicles
);

// Admin routes - Quản lý toàn bộ xe
router.get('/admin', 
  authMiddleware,
  roleMiddleware(['Admin']),
  VehicleController.getAdminVehicles
);

// Chi tiết xe (đặt sau các route cụ thể)
router.get('/:id', VehicleController.getPublicVehicleDetail);

// Tạo xe hàng loạt và xuất Excel template ngay lập tức
router.post('/bulk-create',
  authMiddleware,
  roleMiddleware(['Admin']),
  vehicleImageUpload.array('images', 5),
  VehicleController.bulkCreateVehicles
);

router.post('/import-license-plates',
  authMiddleware,
  roleMiddleware(['Admin']),
  excelUpload.single('excel_file'),
  VehicleController.importLicensePlates
);

router.post('/assign-by-quantity',
  authMiddleware,
  roleMiddleware(['Admin']),
  VehicleController.assignVehiclesByQuantity
);

router.put('/:id',
  authMiddleware,
  roleMiddleware(['Admin']),
  vehicleImageUpload.array('images', 5),
  VehicleController.updateVehicle
);

router.delete('/:id',
  authMiddleware,
  roleMiddleware(['Admin']),
  VehicleController.deleteVehicle
);

// Staff routes - Cập nhật trạng thái xe
router.patch('/:id/status',
  authMiddleware,
  roleMiddleware(['Admin', 'Station Staff']),
  VehicleController.updateVehicleStatus
);

router.patch('/:id/battery',
  authMiddleware,
  roleMiddleware(['Admin', 'Station Staff']),
  VehicleController.updateVehicleBattery
);

router.post('/:id/maintenance',
  authMiddleware,
  roleMiddleware(['Admin', 'Station Staff']),
  vehicleImageUpload.array('images', 5),
  VehicleController.reportMaintenance
);

// Bulk pricing update routes
router.post('/export-pricing-template',
  authMiddleware,
  roleMiddleware(['Admin']),
  VehicleController.exportPricingTemplate
);

router.post('/import-pricing-updates',
  authMiddleware,
  roleMiddleware(['Admin']),
  excelUpload.single('excel_file'),
  VehicleController.importPricingUpdates
);

module.exports = router;