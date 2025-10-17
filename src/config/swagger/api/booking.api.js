/**
 * @swagger
 * tags:
 *   - name: Bookings
 *     description: Quản lý đặt xe
 */

/**
 * @swagger
 * /api/bookings/walk-in:
 *   post:
 *     summary: Tạo đặt xe walk-in (Chỉ Staff)
 *     description: |
 *       Staff tạo đặt xe cho khách hàng walk-in (chưa có tài khoản)
 *       
 *       **Quy trình walk-in:**
 *       1. Staff tạo tài khoản tạm thời cho khách hàng
 *       2. Tạo booking với booking_type: 'walk_in'
 *       3. Gửi email thông tin đăng nhập cho khách hàng
 *       4. Khách hàng có thể đăng nhập sau để quản lý booking
 *       
 *       **Lưu ý:** station_id sẽ được tự động lấy từ trạm của Staff đang đăng nhập
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_name
 *               - customer_phone
 *               - model
 *               - color
 *               - start_date
 *               - end_date
 *               - pickup_time
 *             properties:
 *               customer_name:
 *                 type: string
 *                 description: Tên khách hàng
 *                 example: "Nguyễn Văn A"
 *               customer_phone:
 *                 type: string
 *                 description: Số điện thoại khách hàng
 *                 example: "0123456789"
 *               customer_email:
 *                 type: string
 *                 description: Email khách hàng (tùy chọn)
 *                 example: "nguyenvana@email.com"
 *               customer_cmnd:
 *                 type: string
 *                 description: CMND/CCCD khách hàng (tùy chọn)
 *                 example: "123456789"
 *               model:
 *                 type: string
 *                 description: Model xe
 *                 example: "Honda Lead"
 *               color:
 *                 type: string
 *                 description: Màu xe
 *                 example: "Đen"
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: Ngày bắt đầu thuê
 *                 example: "2024-01-15"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: Ngày kết thúc thuê
 *                 example: "2024-01-16"
 *               pickup_time:
 *                 type: string
 *                 description: Giờ nhận xe (giờ trả xe sẽ tự động cùng giờ)
 *                 example: "08:00"
 *               return_time:
 *                 type: string
 *                 description: Giờ trả xe (tự động tính theo pickup_time, không cần nhập)
 *                 example: "08:00"
 *                 readOnly: true
 *               special_requests:
 *                 type: string
 *                 description: Yêu cầu đặc biệt
 *                 example: "Cần mũ bảo hiểm size L"
 *               notes:
 *                 type: string
 *                 description: Ghi chú
 *                 example: "Khách hàng lần đầu thuê xe điện"
 *     responses:
 *       201:
 *         description: Tạo booking walk-in thành công
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
 *                   example: "Tạo booking walk-in thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                         code:
 *                           type: string
 *                           example: "BK123456"
 *                         customer:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: "Nguyễn Văn A"
 *                             phone:
 *                               type: string
 *                               example: "0123456789"
 *                             email:
 *                               type: string
 *                               example: "nguyenvana@email.com"
 *                         vehicle:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                               example: "Honda Lead 2024"
 *                             model:
 *                               type: string
 *                               example: "Honda Lead"
 *                             color:
 *                               type: string
 *                               example: "Đen"
 *                             license_plate:
 *                               type: string
 *                               example: "51A-12345"
 *                         station:
 *                           type: string
 *                           example: "Trạm EV Quận 1"
 *                         start_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-15T00:00:00.000Z"
 *                         end_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-16T00:00:00.000Z"
 *                         total_price:
 *                           type: number
 *                           example: 200000
 *                         deposit_amount:
 *                           type: number
 *                           example: 100000
 *                         qr_code:
 *                           type: string
 *                           example: "BK123456"
 *                         qr_expires_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2024-01-16T00:00:00.000Z"
 *                     next_steps:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Upload KYC cho khách hàng", "Xác thực KYC", "Confirm booking để tạo rental"]
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Thiếu thông tin khách hàng bắt buộc (tên, số điện thoại)"
 *       403:
 *         description: Không có quyền truy cập - Chỉ Staff mới được tạo walk-in booking
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Lỗi server khi tạo booking walk-in"
 *                 error:
 *                   type: string
 *                   example: "Database connection failed"
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Tạo đặt xe mới
 *     description: Tạo đặt xe mới cho người dùng đã xác thực
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingRequest'
 *     responses:
 *       201:
 *         description: Tạo đặt xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Không có quyền truy cập - Token không hợp lệ
 *       500:
 *         description: Lỗi server
 * 
 *   get:
 *     summary: Lấy tất cả đặt xe (Chỉ Admin)
 *     description: Lấy tất cả đặt xe trong hệ thống với phân trang và lọc
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         description: Lọc theo trạng thái đặt xe
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Lọc theo ID trạm
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo mã đặt xe, tên người dùng, email, số điện thoại hoặc tên xe
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
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách đặt xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingListResponse'
 *       403:
 *         description: Không có quyền truy cập - Cần quyền Admin
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/bookings/user:
 *   get:
 *     summary: Lấy đặt xe của người dùng
 *     description: Lấy tất cả đặt xe của người dùng đã xác thực
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         description: Lọc theo trạng thái đặt xe
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
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Lấy đặt xe của người dùng thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingListResponse'
 *       401:
 *         description: Không có quyền truy cập - Token không hợp lệ
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/bookings/station/list:
 *   get:
 *     summary: Lấy đặt xe của trạm (Chỉ nhân viên)
 *     description: Lấy tất cả đặt xe của trạm được gán cho nhân viên
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         description: Lọc theo trạng thái đặt xe
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
 *           default: 10
 *         description: Số lượng mỗi trang
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo mã đặt xe, tên người dùng, email, số điện thoại hoặc tên xe
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-15"
 *         description: Ngày bắt đầu lọc (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-20"
 *         description: Ngày kết thúc lọc (YYYY-MM-DD)
 *       - in: query
 *         name: dateType
 *         schema:
 *           type: string
 *           enum: [booking, pickup, return]
 *           default: booking
 *           example: "pickup"
 *         description: Loại ngày để lọc - booking(ngày tạo), pickup(ngày lấy xe), return(ngày trả xe)
 *     responses:
 *       200:
 *         description: Lấy đặt xe của trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingListResponse'
 *       403:
 *         description: Không có quyền truy cập - Cần quyền nhân viên
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Lấy chi tiết đặt xe
 *     description: Lấy thông tin chi tiết về một đặt xe cụ thể
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đặt xe
 *     responses:
 *       200:
 *         description: Lấy chi tiết đặt xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingDetailsResponse'
 *       403:
 *         description: Không có quyền xem đặt xe này
 *       404:
 *         description: Không tìm thấy đặt xe
 *       500:
 *         description: Lỗi server
 * 
 *   delete:
 *     summary: Hủy đặt xe
 *     description: Hủy một đặt xe đang chờ xử lý
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đặt xe
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelBookingRequest'
 *     responses:
 *       200:
 *         description: Hủy đặt xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Không thể hủy đặt xe
 *       403:
 *         description: Không có quyền hủy đặt xe này
 *       404:
 *         description: Không tìm thấy đặt xe
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/bookings/{id}/confirm:
 *   put:
 *     summary: Xác nhận đặt xe (Chỉ nhân viên)
 *     description: Xác nhận đặt xe đã được check-in và tạo thanh toán, thuê xe, hợp đồng. Upload ảnh xe trước bàn giao. Yêu cầu booking đã được check-in trước.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID đặt xe
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               vehicle_condition_before:
 *                 type: object
 *                 properties:
 *                   mileage:
 *                     type: number
 *                     example: 15000
 *                   battery_level:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                     example: 85
 *                   exterior_condition:
 *                     type: string
 *                     enum: [excellent, good, fair, poor]
 *                     example: "good"
 *                   interior_condition:
 *                     type: string
 *                     enum: [excellent, good, fair, poor]
 *                     example: "good"
 *                   notes:
 *                     type: string
 *                     example: "Xe sạch sẽ, không có vết xước"
 *               staff_notes:
 *                 type: string
 *                 example: "Khách hàng thân thiện, đúng giờ"
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Ảnh xe trước bàn giao (tối đa 5 ảnh)
 *     responses:
 *       200:
 *         description: Xác nhận đặt xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Xác nhận booking thành công"
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 payment:
 *                   $ref: '#/components/schemas/Payment'
 *                 rental:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     images_before:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: URLs ảnh xe trước bàn giao
 *                     vehicle_condition_before:
 *                       type: object
 *                     staff_notes:
 *                       type: string
 *       400:
 *         description: Trạng thái đặt xe không hợp lệ, chưa được check-in hoặc KYC chưa được duyệt
 *       403:
 *         description: Không có quyền truy cập - Cần quyền nhân viên
 *       404:
 *         description: Không tìm thấy đặt xe
 *       500:
 *         description: Lỗi server
 */
/**
 * @swagger
 * /api/bookings/scan-qr:
 *   post:
 *     summary: Quét QR code để lấy thông tin booking và auto check-in
 *     description: Staff quét QR code để lấy thông tin chi tiết booking và tự động check-in. Chỉ staff của station đó mới có thể quét được.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qr_code
 *             properties:
 *               qr_code:
 *                 type: string
 *                 description: Mã QR code từ booking
 *                 example: "BK4D3MU8"
 *     responses:
 *       200:
 *         description: QR code hợp lệ, trả về thông tin booking và đã check-in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "QR code hợp lệ"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68d17520f344602a72d7b154"
 *                     code:
 *                       type: string
 *                       example: "BK4D3MU8"
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *                     vehicle:
 *                       $ref: "#/components/schemas/Vehicle"
 *                     station:
 *                       $ref: "#/components/schemas/Station"
 *                     start_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-09-25T00:00:00.000Z"
 *                     end_date:
 *                       type: string
 *                       format: date
 *                       example: "2025-09-26T00:00:00.000Z"
 *                     pickup_time:
 *                       type: string
 *                       example: "09:00"
 *                     return_time:
 *                       type: string
 *                       example: "18:00"
 *                     status:
 *                       type: string
 *                       enum: [pending, confirmed, cancelled]
 *                       example: "pending"
 *                     qr_expires_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-25T09:00:00.000Z"
 *                     qr_used_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-25T09:15:00.000Z"
 *                     isCheckedIn:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: QR code không hợp lệ, đã hết hạn hoặc đã được sử dụng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "QR code đã hết hạn"
 *       403:
 *         description: Không có quyền truy cập - Cần quyền nhân viên
 *       404:
 *         description: QR code không tồn tại
 *       500:
 *         description: Lỗi server
 */
