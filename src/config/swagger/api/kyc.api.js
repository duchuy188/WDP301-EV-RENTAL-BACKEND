/**
 * @swagger
 * tags:
 *   name: KYC
 *   description: API quản lý xác thực danh tính (KYC)
 */

/**
 * @swagger
 * /api/kyc/identity-card/front:
 *   post:
 *     summary: Tải lên và xác thực mặt trước CMND/CCCD
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt trước CMND/CCCD
 *     responses:
 *       200:
 *         description: Mặt trước CMND/CCCD đã được tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 identityCard:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     dob:
 *                       type: string
 *                     address:
 *                       type: string
 *                     frontImage:
 *                       type: string
 *                 kycStatus:
 *                   type: string
 *                 needsBackImage:
 *                   type: boolean
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/identity-card/back:
 *   post:
 *     summary: Tải lên và xác thực mặt sau CMND/CCCD
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt sau CMND/CCCD
 *     responses:
 *       200:
 *         description: Mặt sau CMND/CCCD đã được tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 identityCard:
 *                   type: object
 *                   properties:
 *                     issueDate:
 *                       type: string
 *                     issueLocation:
 *                       type: string
 *                     features:
 *                       type: string
 *                     backImage:
 *                       type: string
 *                 kycStatus:
 *                   type: string
 *                 needsFrontImage:
 *                   type: boolean
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/license/front:
 *   post:
 *     summary: Tải lên và xác thực mặt trước giấy phép lái xe
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt trước giấy phép lái xe
 *     responses:
 *       200:
 *         description: Mặt trước giấy phép lái xe đã được tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 license:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     class:
 *                       type: string
 *                     expiry:
 *                       type: string
 *                       format: date-time
 *                     expiryText:
 *                       type: string
 *                     image:
 *                       type: string
 *                 kycStatus:
 *                   type: string
 *                 needsBackImage:
 *                   type: boolean
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/license/back:
 *   post:
 *     summary: Tải lên và xác thực mặt sau giấy phép lái xe
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Ảnh mặt sau giấy phép lái xe
 *     responses:
 *       200:
 *         description: Mặt sau giấy phép lái xe đã được tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 license:
 *                   type: object
 *                   properties:
 *                     classList:
 *                       type: array
 *                       items:
 *                         type: string
 *                     backImage:
 *                       type: string
 *                 kycStatus:
 *                   type: string
 *                 needsFrontImage:
 *                   type: boolean
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/status:
 *   get:
 *     summary: Lấy thông tin KYC của người dùng hiện tại
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin KYC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kycStatus:
 *                   type: string
 *                   enum: [not_submitted, pending, approved, rejected]
 *                 rejectionReason:
 *                   type: string
 *                 identity:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     frontImage:
 *                       type: string
 *                     backImage:
 *                       type: string
 *                     frontUploaded:
 *                       type: boolean
 *                     backUploaded:
 *                       type: boolean
 *                 license:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     frontImage:
 *                       type: string
 *                     backImage:
 *                       type: string
 *                     expiry:
 *                       type: string
 *                       format: date-time
 *                     expiryText:
 *                       type: string
 *                     classList:
 *                       type: array
 *                       items:
 *                         type: string
 *                     frontUploaded:
 *                       type: boolean
 *                     backUploaded:
 *                       type: boolean
 *                     uploaded:
 *                       type: boolean
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/pending:
 *   get:
 *     summary: Lấy danh sách yêu cầu KYC đang chờ xử lý
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu KYC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       email:
 *                         type: string
 *                       fullname:
 *                         type: string
 *                       identityCard:
 *                         type: string
 *                       identityCardFrontImage:
 *                         type: string
 *                       identityCardBackImage:
 *                         type: string
 *                       licenseNumber:
 *                         type: string
 *                       licenseImage:
 *                         type: string
 *                       lastKycAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/verify:
 *   post:
 *     summary: Xác thực KYC thủ công
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - action
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID của người dùng cần xác thực
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Hành động xác thực
 *               rejectionReason:
 *                 type: string
 *                 description: Lý do từ chối (bắt buộc nếu action là reject)
 *     responses:
 *       200:
 *         description: Xác thực thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     kycStatus:
 *                       type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi server
 */