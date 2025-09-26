/**
 * @swagger
 * tags:
 *   - name: Bookings
 *     description: Quản lý đặt xe
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
 *           enum: [pending, confirmed, cancelled]
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
 *           enum: [pending, confirmed, cancelled]
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
 *           enum: [pending, confirmed, cancelled]
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
