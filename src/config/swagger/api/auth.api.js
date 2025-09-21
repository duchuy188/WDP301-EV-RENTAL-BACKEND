/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Các API liên quan đến xác thực người dùng
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký người dùng mới
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Register'
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       500:
 *         description: Lỗi khi đăng ký
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập người dùng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Login'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       404:
 *         description: Người dùng không tìm thấy
 *       401:
 *         description: Thông tin xác thực không hợp lệ
 *       500:
 *         description: Lỗi khi đăng nhập
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất người dùng
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Logout'
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       500:
 *         description: Lỗi khi đăng xuất
 */

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     tags: [Auth]
 *     summary: Lấy thông tin người dùng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60d0fe4f5311236168a109ca"
 *                 fullname:
 *                   type: string
 *                   example: "Nguyễn Văn A"
 *                 email:
 *                   type: string
 *                   example: "email@example.com"
 *                 role:
 *                   type: string
 *                   example: "EV Renter"
 *                 avatar:
 *                   type: string
 *                   example: "https://res.cloudinary.com/dcrbmfhbo/image/upload/v1234567890/ev-rental/abcdef.jpg"
 *                 phone:
 *                   type: string
 *                   example: ""
 *                 address:
 *                   type: string
 *                   example: ""
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Làm mới access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "your_refresh_token_here"
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Token đã được làm mới thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken:
 *                   type: string
 *                   example: "new_refresh_token_here"
 *       400:
 *         description: Thiếu refresh token
 *       401:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: Cập nhật thông tin người dùng
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *                 description: Họ và tên người dùng
 *               phone:
 *                 type: string
 *                 description: Số điện thoại
 *               address:
 *                 type: string
 *                 description: Địa chỉ
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File hình ảnh avatar (tùy chọn)
 *     responses:
 *       200:
 *         description: Cập nhật thông tin người dùng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cập nhật thông tin người dùng thành công"
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "60d0fe4f5311236168a109ca"
 *                     fullname:
 *                       type: string
 *                       example: "Nguyễn Văn A"
 *                     email:
 *                       type: string
 *                       example: "email@example.com"
 *                     role:
 *                       type: string
 *                       example: "EV Renter"
 *                     avatar:
 *                       type: string
 *                       example: "https://res.cloudinary.com/dcrbmfhbo/image/upload/v1234567890/ev-rental/abcdef.jpg"
 *                     phone:
 *                       type: string
 *                       example: "0987654321"
 *                     address:
 *                       type: string
 *                       example: "123 Đường ABC, Quận XYZ, TP. Hồ Chí Minh"
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đổi mật khẩu người dùng
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Mật khẩu hiện tại
 *                 example: "Password123!"
 *               newPassword:
 *                 type: string
 *                 description: Mật khẩu mới
 *                 example: "NewPassword456@"
 *             required:
 *               - currentPassword
 *               - newPassword
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đổi mật khẩu thành công, vui lòng đăng nhập lại"
 *       400:
 *         description: Mật khẩu mới không hợp lệ
 *       401:
 *         description: Mật khẩu hiện tại không đúng
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Yêu cầu đặt lại mật khẩu
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Email của tài khoản cần đặt lại mật khẩu
 *                 example: "email@example.com"
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: Yêu cầu đặt lại mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Một liên kết đặt lại mật khẩu đã được gửi đến email của bạn"
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Đặt lại mật khẩu với token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token đặt lại mật khẩu
 *                 example: "reset_token_from_email"
 *               newPassword:
 *                 type: string
 *                 description: Mật khẩu mới
 *                 example: "NewPassword456@"
 *             required:
 *               - token
 *               - newPassword
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đặt lại mật khẩu thành công, vui lòng đăng nhập với mật khẩu mới"
 *       400:
 *         description: Token không hợp lệ hoặc đã hết hạn
 *       500:
 *         description: Lỗi server
 */