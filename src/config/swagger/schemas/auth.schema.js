
/**
 * @swagger
 * components:
 *   schemas:
 *     Register:
 *       type: object
 *       properties:
 *         fullname:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         email:
 *           type: string
 *           example: "email@example.com"
 *         password:
 *           type: string
 *           example: "password123"
 *       required:
 *         - fullname
 *         - email
 *         - password
 *
 *     Login:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           example: "email@example.com"
 *         password:
 *           type: string
 *           example: "password123"
 *       required:
 *         - email
 *         - password
 *
 *     Logout:
 *       type: object
 *       properties:
 *         refreshToken:
 *           type: string
 *           example: "your_refresh_token_here"
 *       required:
 *         - refreshToken

 *     GoogleLogin:
 *       type: object
 *       properties:
 *         idToken:
 *           type: string
 *           example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjU..."
 *       required:
 *         - idToken
 *
 *     # Status Enums
 *     UserStatus:
 *       type: string
 *       enum: [active, suspended, blocked]
 *       description: Trạng thái tài khoản người dùng
 *       example: "active"
 *
 *     StationStatus:
 *       type: string
 *       enum: [active, inactive, maintenance]
 *       description: Trạng thái trạm thuê xe
 *       example: "active"
 *
 *     KYCStatus:
 *       type: string
 *       enum: [not_submitted, pending, approved, rejected]
 *       description: Trạng thái xác thực danh tính
 *       example: "pending"
 *
 *     VehicleStatus:
 *       type: string
 *       enum: [available, rented, maintenance]
 *       description: Trạng thái xe
 *       example: "available"
 *
 *     BookingStatus:
 *       type: string
 *       enum: [pending, confirmed, in_progress, completed, cancelled]
 *       description: Trạng thái đặt xe
 *       example: "confirmed"
 *
 *     RentalStatus:
 *       type: string
 *       enum: [active, in_progress, completed, cancelled]
 *       description: Trạng thái thuê xe
 *       example: "active"
 */
