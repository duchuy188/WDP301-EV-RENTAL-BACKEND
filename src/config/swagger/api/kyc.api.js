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
 * /api/kyc/identity-card:
 *   get:
 *     summary: Lấy thông tin CCCD của người dùng hiện tại
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin CCCD
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy thông tin CCCD thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     identityCard:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "123456789"
 *                         name:
 *                           type: string
 *                           example: "Nguyễn Văn A"
 *                         dob:
 *                           type: string
 *                           example: "01/01/1990"
 *                         address:
 *                           type: string
 *                           example: "123 Đường ABC, Quận 1, TP.HCM"
 *                         sex:
 *                           type: string
 *                           example: "Nam"
 *                         nationality:
 *                           type: string
 *                           example: "Việt Nam"
 *                         issueDate:
 *                           type: string
 *                           example: "01/01/2020"
 *                         issueLocation:
 *                           type: string
 *                           example: "Công an TP.HCM"
 *                         features:
 *                           type: string
 *                           example: "Nốt ruồi nhỏ bên trái"
 *                         religion:
 *                           type: string
 *                           example: "Không"
 *                         ethnicity:
 *                           type: string
 *                           example: "Kinh"
 *                         frontImage:
 *                           type: string
 *                           example: "https://cloudinary.com/image1.jpg"
 *                         backImage:
 *                           type: string
 *                           example: "https://cloudinary.com/image2.jpg"
 *                         frontUploaded:
 *                           type: boolean
 *                           example: true
 *                         backUploaded:
 *                           type: boolean
 *                           example: true
 *                         type:
 *                           type: string
 *                           example: "new_front"
 *                         typeNew:
 *                           type: string
 *                           example: "cccd_12_front"
 *       401:
 *         description: Không được phép truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/driver-license:
 *   get:
 *     summary: Lấy thông tin GPLX của người dùng hiện tại
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin GPLX
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Lấy thông tin GPLX thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     driverLicense:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "123456789"
 *                         name:
 *                           type: string
 *                           example: "Nguyễn Văn A"
 *                         dob:
 *                           type: string
 *                           example: "01/01/1990"
 *                         nationality:
 *                           type: string
 *                           example: "Việt Nam"
 *                         address:
 *                           type: string
 *                           example: "123 Đường ABC, Quận 1, TP.HCM"
 *                         placeIssue:
 *                           type: string
 *                           example: "Sở GTVT TP.HCM"
 *                         issueDate:
 *                           type: string
 *                           example: "01/01/2020"
 *                         class:
 *                           type: string
 *                           example: "A1"
 *                         classList:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["A1", "A2"]
 *                         expiry:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-01-01T00:00:00.000Z"
 *                         expiryText:
 *                           type: string
 *                           example: "01/01/2025"
 *                         frontImage:
 *                           type: string
 *                           example: "https://cloudinary.com/image1.jpg"
 *                         backImage:
 *                           type: string
 *                           example: "https://cloudinary.com/image2.jpg"
 *                         frontUploaded:
 *                           type: boolean
 *                           example: true
 *                         backUploaded:
 *                           type: boolean
 *                           example: true
 *                         uploaded:
 *                           type: boolean
 *                           example: true
 *                         type:
 *                           type: string
 *                           example: "old_front"
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

/**
 * @swagger
 * /api/kyc/staff/identity-card/front:
 *   post:
 *     summary: Staff upload mặt trước CMND/CCCD cho user
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
 *               userId:
 *                 type: string
 *                 description: ID của user cần upload KYC
 *     responses:
 *       200:
 *         description: Staff upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Staff đã tải lên mặt trước CMND/CCCD thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                     identityCard:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         dob:
 *                           type: string
 *                         address:
 *                           type: string
 *                         frontImage:
 *                           type: string
 *                     kycStatus:
 *                       type: string
 *                     needsBackImage:
 *                       type: boolean
 *                     validation:
 *                       type: object
 *                       properties:
 *                         nameComparison:
 *                           type: object
 *                           properties:
 *                             match:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                             message:
 *                               type: string
 *                         validationNotes:
 *                           type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/staff/identity-card/back:
 *   post:
 *     summary: Staff upload mặt sau CMND/CCCD cho user
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
 *               userId:
 *                 type: string
 *                 description: ID của user cần upload KYC
 *     responses:
 *       200:
 *         description: Staff upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Staff đã tải lên mặt sau CMND/CCCD thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                     identityCard:
 *                       type: object
 *                       properties:
 *                         issueDate:
 *                           type: string
 *                         issueLocation:
 *                           type: string
 *                         backImage:
 *                           type: string
 *                     kycStatus:
 *                       type: string
 *                     needsFrontImage:
 *                       type: boolean
 *                     validation:
 *                       type: object
 *                       properties:
 *                         nameComparison:
 *                           type: object
 *                           properties:
 *                             match:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                             message:
 *                               type: string
 *                         validationNotes:
 *                           type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/staff/license/front:
 *   post:
 *     summary: Staff upload mặt trước GPLX cho user
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
 *                 description: Ảnh mặt trước GPLX
 *               userId:
 *                 type: string
 *                 description: ID của user cần upload KYC
 *     responses:
 *       200:
 *         description: Staff upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Staff đã tải lên mặt trước giấy phép lái xe thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                     license:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         class:
 *                           type: string
 *                         image:
 *                           type: string
 *                     kycStatus:
 *                       type: string
 *                     needsBackImage:
 *                       type: boolean
 *                     validation:
 *                       type: object
 *                       properties:
 *                         licenseClassValid:
 *                           type: boolean
 *                         licenseClassMessage:
 *                           type: string
 *                         nameComparison:
 *                           type: object
 *                           properties:
 *                             match:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                             message:
 *                               type: string
 *                         validationNotes:
 *                           type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/staff/license/back:
 *   post:
 *     summary: Staff upload mặt sau GPLX cho user
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
 *                 description: Ảnh mặt sau GPLX
 *               userId:
 *                 type: string
 *                 description: ID của user cần upload KYC
 *     responses:
 *       200:
 *         description: Staff upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Staff đã tải lên mặt sau giấy phép lái xe thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         fullname:
 *                           type: string
 *                     license:
 *                       type: object
 *                       properties:
 *                         backImage:
 *                           type: string
 *                     kycStatus:
 *                       type: string
 *                     needsFrontImage:
 *                       type: boolean
 *                     validation:
 *                       type: object
 *                       properties:
 *                         nameComparison:
 *                           type: object
 *                           properties:
 *                             match:
 *                               type: boolean
 *                             score:
 *                               type: number
 *                             message:
 *                               type: string
 *                         validationNotes:
 *                           type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được phép truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/kyc/users-not-submitted:
 *   get:
 *     summary: Lấy danh sách users chưa submit KYC
 *     description: Staff/Admin có thể tìm kiếm và lọc users chưa có KYC hoặc bị rejected
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo email, fullname, phone
 *         example: "nguyenvana@gmail.com"
 *       - in: query
 *         name: kycStatus
 *         schema:
 *           type: string
 *           enum: [all, not_submitted, rejected]
 *           default: all
 *         description: Filter theo trạng thái KYC
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, lastLoginAt, fullname]
 *           default: createdAt
 *         description: Sort theo field nào
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Danh sách users cần upload KYC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           fullname:
 *                             type: string
 *                           email:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           kycStatus:
 *                             type: string
 *                           kycInfo:
 *                             type: object
 *                             properties:
 *                               identityUploaded:
 *                                 type: boolean
 *                               licenseUploaded:
 *                                 type: boolean
 *                               staffUploaded:
 *                                 type: boolean
 *                     pagination:
 *                       type: object
 *                     stats:
 *                       type: object
 *       403:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */