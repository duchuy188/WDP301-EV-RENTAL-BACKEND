const express = require('express');
const router = express.Router();
const KycController = require('../controllers/KycController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const { identityCardUpload, licenseUpload } = require('../config/cloudinary');

// Routes cho người dùng
router.post('/identity-card/front', 
  authMiddleware, 
  identityCardUpload.single('image'), 
  KycController.uploadIdentityCardFront
);

router.post('/identity-card/back', 
  authMiddleware, 
  identityCardUpload.single('image'), 
  KycController.uploadIdentityCardBack
);

router.post('/license/front', authMiddleware, licenseUpload.single('image'), KycController.uploadDriverLicenseFront);
router.post('/license/back', authMiddleware, licenseUpload.single('image'), KycController.uploadDriverLicenseBack);

router.get('/status', 
  authMiddleware, 
  KycController.getMyKycStatus
);

// Routes cho nhân viên
router.get('/pending', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']), 
  KycController.getPendingKycRequests
);

router.post('/verify', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']), 
  KycController.verifyKyc
);

module.exports = router;