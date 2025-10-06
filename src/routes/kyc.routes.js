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

router.get('/identity-card', 
  authMiddleware, 
  KycController.getMyIdentityCard
);

router.get('/driver-license', 
  authMiddleware, 
  KycController.getMyDriverLicense
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

router.get('/users-not-submitted', 
  authMiddleware, 
  roleMiddleware(['Station Staff']), 
  KycController.getUsersNotSubmittedKyc
);

// Staff upload KYC cho user
router.post('/staff/identity-card/front', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']),
  identityCardUpload.single('image'), 
  KycController.staffUploadIdentityCardFront
);

router.post('/staff/identity-card/back', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']),
  identityCardUpload.single('image'), 
  KycController.staffUploadIdentityCardBack
);

router.post('/staff/license/front', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']),
  licenseUpload.single('image'), 
  KycController.staffUploadDriverLicenseFront
);

router.post('/staff/license/back', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']),
  licenseUpload.single('image'), 
  KycController.staffUploadDriverLicenseBack
);

// Lấy danh sách KYC đã completed
router.get('/completed', 
  authMiddleware, 
  roleMiddleware(['Station Staff', 'Admin']), 
  KycController.getCompletedKycRequests
);

module.exports = router;