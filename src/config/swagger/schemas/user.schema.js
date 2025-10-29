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
 *           enum: [active, suspended]
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
 *           enum: [active, suspended]
 *           description: Chỉ Admin mới có quyền thay đổi
 *         stationId:
 *           type: string
 *           description: Chỉ Admin mới có quyền thay đổi (cho Station Staff)

 *     ToggleStatusRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, suspended]
 *           example: "suspended"
 *       required:
 *         - status

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

 *     ResetPasswordResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã reset password thành công"
 *         newPassword:
 *           type: string
 *           description: Mật khẩu mới (chỉ hiển thị lần đầu)

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

 *     # RISK MANAGEMENT SCHEMAS
 *     Violation:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [late_return, damage, no_show, payment_issue, rule_violation, other]
 *           example: "late_return"
 *           description: Loại vi phạm
 *         description:
 *           type: string
 *           example: "Trả xe muộn 2 giờ"
 *           description: Mô tả vi phạm
 *         severity:
 *           type: string
 *           enum: [low, medium, high]
 *           example: "medium"
 *           description: Mức độ nghiêm trọng
 *         points:
 *           type: number
 *           example: 10
 *           description: Điểm trừ cho vi phạm
 *         date:
 *           type: string
 *           format: date-time
 *           example: "2025-01-25T10:30:00.000Z"
 *           description: Ngày vi phạm
 *         resolved:
 *           type: boolean
 *           example: false
 *           description: Đã được giải quyết chưa
 *         resolved_date:
 *           type: string
 *           format: date-time
 *           example: null
 *           description: Ngày giải quyết
 *         resolved_by:
 *           type: string
 *           example: null
 *           description: ID người giải quyết

 *     RiskInfo:
 *       type: object
 *       properties:
 *         risk_score:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           example: 75
 *           description: Điểm rủi ro (0-100)
 *         risk_level:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           example: "high"
 *           description: Mức độ rủi ro
 *         total_violations:
 *           type: number
 *           example: 3
 *           description: Tổng số vi phạm
 *         last_violation_date:
 *           type: string
 *           format: date-time
 *           example: "2025-01-25T10:30:00.000Z"
 *           description: Ngày vi phạm cuối cùng
 *         violations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Violation'
 *           description: Danh sách vi phạm

 *     AddViolationRequest:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [late_return, damage, no_show, payment_issue, rule_violation, other]
 *           example: "late_return"
 *           description: Loại vi phạm
 *         description:
 *           type: string
 *           example: "Trả xe muộn 2 giờ"
 *           description: Mô tả vi phạm
 *         severity:
 *           type: string
 *           enum: [low, medium, high]
 *           default: "low"
 *           example: "medium"
 *           description: Mức độ nghiêm trọng
 *         points:
 *           type: number
 *           default: 5
 *           example: 10
 *           description: Điểm trừ cho vi phạm
 *       required:
 *         - type
 *         - description

 *     AddViolationResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã thêm vi phạm thành công"
 *         user_id:
 *           type: string
 *           example: "68cc3aaa90e0e948e4beefc1"
 *         violation:
 *           $ref: '#/components/schemas/Violation'
 *         risk_score:
 *           type: number
 *           example: 55
 *           description: Điểm rủi ro sau khi thêm vi phạm
 *         risk_level:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           example: "medium"
 *           description: Mức độ rủi ro sau khi thêm vi phạm

 *     CheckRiskScoreResponse:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           example: "68cc3aaa90e0e948e4beefc1"
 *         risk_score:
 *           type: number
 *           example: 45
 *           description: Điểm rủi ro (0-100)
 *         risk_level:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           example: "medium"
 *           description: Mức độ rủi ro
 *         total_violations:
 *           type: number
 *           example: 2
 *           description: Tổng số vi phạm
 *         last_violation_date:
 *           type: string
 *           format: date-time
 *           example: "2025-01-20T15:30:00.000Z"
 *           description: Ngày vi phạm cuối cùng
 *         violations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Violation'
 *           description: Danh sách vi phạm chưa resolved

 *     ResetRiskScoreResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Đã reset risk score thành công"
 *         user_id:
 *           type: string
 *           example: "68cc3aaa90e0e948e4beefc1"
 *         risk_score:
 *           type: number
 *           example: 0
 *           description: Điểm rủi ro sau khi reset
 *         risk_level:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           example: "low"
 *           description: Mức độ rủi ro sau khi reset

 *     RiskyCustomerDetailResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/UserDetail'
 *         riskInfo:
 *           $ref: '#/components/schemas/RiskInfo'
 */