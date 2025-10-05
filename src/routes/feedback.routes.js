const express = require('express');
const router = express.Router();
const FeedbackController = require('../controllers/FeedbackController');
const authenticateToken = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/roleMiddleware');
const { vehicleImageUpload } = require('../middlewares/vehicleImageUpload');

// Customer routes
router.post('/', 
  authenticateToken, 
  requireRole(['EV Renter']), 
  vehicleImageUpload.array('images', 5),
  FeedbackController.createFeedback
);

router.get('/customer', 
  authenticateToken, 
  requireRole(['EV Renter']), 
  FeedbackController.getMyFeedbacks
);

router.get('/customer/:id', 
  authenticateToken, 
  requireRole(['EV Renter']), 
  FeedbackController.getFeedbackById
);

// Admin routes
router.get('/', 
  authenticateToken, 
  requireRole(['Admin']), 
  FeedbackController.getAllFeedbacks
);

router.get('/stats', 
  authenticateToken, 
  requireRole(['Admin']), 
  FeedbackController.getFeedbackStats
);

router.get('/:id', 
  authenticateToken, 
  requireRole(['Admin']), 
  FeedbackController.getFeedbackById
);

router.put('/:id', 
  authenticateToken, 
  requireRole(['Admin']), 
  FeedbackController.updateFeedback
);

router.delete('/:id', 
  authenticateToken, 
  requireRole(['Admin']), 
  FeedbackController.deleteFeedback
);

module.exports = router;
