/**
 * @swagger
 * components:
 *   schemas:
 *     UserSummary:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j1"
 *         fullname:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         email:
 *           type: string
 *           example: "user@example.com"
 *         phone:
 *           type: string
 *           example: "0123456789"
 *         role:
 *           type: string
 *           enum: [Admin, Station Staff, EV Renter]
 *           example: "EV Renter"
 *         status:
 *           type: string
 *           enum: [active, suspended, blocked]
 *           example: "active"
 *         stationId:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j2"
 *         kyc_status:
 *           type: string
 *           enum: [not_required, pending, approved, rejected]
 *           example: "approved"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-09-01T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-09-01T10:00:00.000Z"
 *
 *     UserDetail:
 *       allOf:
 *         - $ref: '#/components/schemas/UserSummary'
 *         - type: object
 *           properties:
 *             stationId:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 code:
 *                   type: string
 *                 address:
 *                   type: string
 *             kycId:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 status:
 *                   type: string
 *                 rejection_reason:
 *                   type: string
 *                 id_card_number:
 *                   type: string
 *                 license_number:
 *                   type: string
 *
 *     CreateStaffRequest:
 *       type: object
 *       properties:
 *         fullname:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         email:
 *           type: string
 *           example: "staff001@vinfast.vn"
 *         phone:
 *           type: string
 *           example: "0123456789"
 *         role:
 *           type: string
 *           enum: [Station Staff]
 *           default: "Station Staff"
 *       required:
 *         - fullname
 *         - email
 *         - phone
 *
 *     AssignStaffRequest:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j1"
 *           description: "ID của staff cần gán"
 *         stationId:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j2"
 *           description: "ID của station cần gán"
 *       required:
 *         - userId
 *         - stationId
 *
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         fullname:
 *           type: string
 *           example: "Nguyễn Văn A - Cập nhật"
 *         phone:
 *           type: string
 *           example: "0987654321"
 *         status:
 *           type: string
 *           enum: [active, suspended, blocked]
 *           description: Chỉ Admin mới có quyền thay đổi
 *         stationId:
 *           type: string
 *           description: Chỉ Admin mới có quyền thay đổi (cho Station Staff)
 *
 *     ToggleStatusRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, suspended, blocked]
 *           example: "suspended"
 *       required:
 *         - status
 *
 *     UserStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 150
 *         active:
 *           type: integer
 *           example: 120
 *         suspended:
 *           type: integer
 *           example: 20
 *         blocked:
 *           type: integer
 *           example: 10
 *         byRole:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "EV Renter"
 *               count:
 *                 type: integer
 *                 example: 100
 *         byStatus:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "active"
 *               count:
 *                 type: integer
 *                 example: 120
 *
 *     CreateStaffResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã tạo tài khoản Staff thành công"
 *         user:
 *           $ref: '#/components/schemas/UserSummary'
 *         temporaryPassword:
 *           type: string
 *           description: Mật khẩu tạm thời (chỉ hiển thị lần đầu)
 *
 *     ResetPasswordResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã reset password thành công"
 *         newPassword:
 *           type: string
 *           description: Mật khẩu mới (chỉ hiển thị lần đầu)
 *
 *     ToggleStatusResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã khóa tài khoản thành công"
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             fullname:
 *               type: string
 *             email:
 *               type: string
 *             status:
 *               type: string
 */
