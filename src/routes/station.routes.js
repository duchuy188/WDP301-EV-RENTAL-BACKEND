const express = require('express');
const router = express.Router();
const StationController = require('../controllers/StationController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const stationImageUpload = require('../middlewares/stationImageUpload'); // Added for image upload

// Public routes
router.get('/', StationController.getStations);
router.get('/:id', StationController.getStationDetail);

// Protected routes
router.post('/', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  stationImageUpload.array('images', 10), 
  StationController.createStation
);

router.put('/:id', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  stationImageUpload.array('images', 10), 
  StationController.updateStation
);

router.delete('/:id', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  StationController.deleteStation
);

router.post('/:id/sync', 
  authMiddleware, 
  StationController.syncVehicleCount
);

router.post('/sync-all', 
  authMiddleware, 
  roleMiddleware(['Admin']), 
  StationController.syncAllStations
);

router.get('/:id/staff', 
  authMiddleware, 
  StationController.getStationStaff
);


module.exports = router;





