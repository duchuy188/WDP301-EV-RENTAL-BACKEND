/**
 * @swagger
 * tags:
 *   name: User Management
 *   description: API quản lý người dùng và nhân viên
 */

/**
 * @swagger
 * /api/users/staff:
 *   post:
 *     summary: Tạo tài khoản Staff mới
 *     description: Admin tạo tài khoản cho nhân viên trạm
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateStaffRequest'
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã tạo tài khoản Staff thành công"
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     stationId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 temporaryPassword:
 *                   type: string
 *                   description: Mật khẩu tạm thời (chỉ hiển thị lần đầu)
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/staff/assign:
 *   post:
 *     summary: Gán Staff cho Station
 *     description: Admin gán nhân viên cho trạm cụ thể
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignStaffRequest'
 *     responses:
 *       200:
 *         description: Gán staff thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã gán staff cho trạm thành công"
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     stationId:
 *                       type: string
 *                     station:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         code:
 *                           type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy user hoặc station
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/staff/unassigned:
 *   get:
 *     summary: Lấy danh sách Staff chưa có station
 *     description: Admin xem danh sách nhân viên chưa được gán cho trạm nào
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên, email, số điện thoại
 *     responses:
 *       200:
 *         description: Lấy danh sách staff chưa có station thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Danh sách staff chưa có station"
 *                 staff:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserSummary'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lấy danh sách users
 *     description: Admin xem danh sách tất cả users với phân trang và filter
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item mỗi trang
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [Admin, Station Staff, EV Renter]
 *         description: Lọc theo vai trò
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: stationId
 *         schema:
 *           type: string
 *         description: Lọc theo trạm (chỉ áp dụng với Station Staff)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên, email, số điện thoại
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, fullname, email]
 *           default: createdAt
 *         description: Sắp xếp theo
 *     responses:
 *       200:
 *         description: Lấy danh sách users thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserSummary'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/customers:
 *   get:
 *     summary: Lấy danh sách khách hàng cho Staff
 *     description: Staff xem danh sách khách hàng (EV Renter) để upload KYC
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended]
 *           default: active
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên, email, số điện thoại
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, fullname, email]
 *           default: createdAt
 *         description: Sắp xếp theo
 *     responses:
 *       200:
 *         description: Lấy danh sách khách hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Danh sách khách hàng"
 *                 customers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       fullname:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       kycStatus:
 *                         type: string
 *                         enum: [not_submitted, pending, approved, rejected]
 *                       kycId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lấy chi tiết user
 *     description: Xem thông tin chi tiết của một user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Lấy chi tiết user thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/UserDetail'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Cập nhật thông tin user
 *     description: Cập nhật thông tin cá nhân hoặc quản lý user (Admin)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *                 example: "Nguyễn Văn A - Cập nhật"
 *               phone:
 *                 type: string
 *                 example: "0987654321"
 *               status:
 *                 $ref: '#/components/schemas/UserStatus'
 *                 description: Chỉ Admin mới có quyền thay đổi
 *               stationId:
 *                 type: string
 *                 description: Chỉ Admin mới có quyền thay đổi (cho Station Staff)
 *     responses:
 *       200:
 *         description: Cập nhật user thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã cập nhật thông tin user thành công"
 *                 user:
 *                   $ref: '#/components/schemas/UserSummary'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Khóa/mở khóa tài khoản
 *     description: Admin khóa hoặc mở khóa tài khoản user
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/UserStatus'
 *                 description: Trạng thái tài khoản
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Thay đổi trạng thái thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã khóa tài khoản thành công"
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fullname:
 *                       type: string
 *                     email:
 *                       type: string
 *                     status:
 *                       type: string
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     summary: Reset password cho user
 *     description: Admin reset password cho user và tạo mật khẩu mới
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Reset password thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã reset password thành công"
 *                 newPassword:
 *                   type: string
 *                   description: Mật khẩu mới (chỉ hiển thị lần đầu)
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/risky-customers:
 *   get:
 *     summary: Lấy danh sách khách hàng rủi ro
 *     description: Admin xem danh sách khách hàng có rủi ro cao
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng item mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách khách hàng rủi ro thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserSummary'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/users/stats/overview:
 *   get:
 *     summary: Lấy thống kê users
 *     description: Admin xem thống kê tổng quan về users
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 active:
 *                   type: integer
 *                   example: 120
 *                 suspended:
 *                   type: integer
 *                   example: 20
 *                 byRole:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "EV Renter"
 *                       count:
 *                         type: integer
 *                         example: 100
 *                 byStatus:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "active"
 *                       count:
 *                         type: integer
 *                         example: 120
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * /api/users/personal-analytics:
 *   get:
 *     summary: Lấy thống kê cá nhân
 *     description: EV Renter xem thống kê cá nhân về lịch sử thuê xe
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thống kê cá nhân thành công
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
 *                   example: "Lấy thống kê cá nhân thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_rentals:
 *                           type: integer
 *                           example: 15
 *                         total_distance:
 *                           type: number
 *                           example: 450.5
 *                         total_spent:
 *                           type: number
 *                           example: 2500000
 *                         total_days:
 *                           type: number
 *                           example: 8.5
 *                         avg_spent_per_rental:
 *                           type: number
 *                           example: 166667
 *                         avg_distance_per_rental:
 *                           type: number
 *                           example: 30
 *                         last_rental_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-01-25T10:30:00.000Z"
 *                     peak_hours:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           hour:
 *                             type: integer
 *                             example: 18
 *                           count:
 *                             type: integer
 *                             example: 5
 *                     peak_days:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: integer
 *                             example: 0
 *                           dayName:
 *                             type: string
 *                             example: "Chủ nhật"
 *                           count:
 *                             type: integer
 *                             example: 3
 *                     vehicle_preferences:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vehicle_type:
 *                             type: string
 *                             example: "scooter"
 *                           count:
 *                             type: integer
 *                             example: 10
 *                     station_preferences:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           station_id:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                                 example: "68cc3aaa90e0e948e4beefc1"
 *                               name:
 *                                 type: string
 *                                 example: "Trạm thuê xe VinFast Quận 1"
 *                               address:
 *                                 type: string
 *                                 example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *                           count:
 *                             type: integer
 *                             example: 8
 *                     monthly_stats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           year:
 *                             type: integer
 *                             example: 2025
 *                           month:
 *                             type: integer
 *                             example: 1
 *                           rentals:
 *                             type: integer
 *                             example: 3
 *                           distance:
 *                             type: number
 *                             example: 120.5
 *                           spent:
 *                             type: number
 *                             example: 500000
 *                     insights:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: 
 *                         - "Bạn đã thuê xe 15 lần"
 *                         - "Tổng quãng đường: 450.5 km"
 *                         - "Tổng chi phí: 2,500,000 VND"
 *                         - "Giờ thuê nhiều nhất: 18:00 (5 lần)"
 *                         - "Ngày thuê nhiều nhất: Chủ nhật (3 lần)"
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-01-25T10:30:00.000Z"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Chỉ EV Renter mới có quyền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */