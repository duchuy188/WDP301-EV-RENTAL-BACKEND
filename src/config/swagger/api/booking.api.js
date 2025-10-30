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
 *     summary: Tạo đặt xe online (yêu cầu thanh toán phí giữ chỗ)
 *     description: |
 *       **FLOW MỚI - BẮT BUỘC THANH TOÁN PHÍ GIỮ CHỖ 50,000đ:**
 *       
 *       1. User submit form booking
 *       2. Backend RESERVE XE NGAY (soft lock - 15 phút) để đảm bảo xe không bị book bởi user khác
 *       3. Backend tạo PendingBooking (tạm thời, expire 15 phút)
 *       4. Backend trả về VNPay payment URL
 *       5. Frontend redirect user đến VNPay để thanh toán 50,000đ
 *       6. User thanh toán thành công → VNPay callback
 *       7. Backend chuyển soft lock → hard lock (xe thuộc về booking chính thức)
 *       8. Backend tạo Booking chính thức
 *       9. User nhận email xác nhận với QR code
 *       
 *       **NẾU USER KHÔNG THANH TOÁN:**
 *       - Sau 15 phút: Xe tự động unreserve (về trạng thái available)
 *       - PendingBooking tự động expired và bị xóa
 *       
 *       **LƯU Ý:**
 *       - Xe được GIỮ NGAY khi click booking (không lo bị mất xe)
 *       - Phí giữ chỗ 50,000đ KHÔNG được hoàn lại khi hủy booking
 *       - Payment URL có hiệu lực 15 phút
 *       - Phí giữ chỗ sẽ được TRỪ vào deposit/rental_fee khi confirm booking
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
 *       200:
 *         description: Tạo pending booking thành công - Cần thanh toán phí giữ chỗ
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
 *                   example: "Vui lòng thanh toán phí giữ chỗ để hoàn tất đặt xe"
 *                 requiresPayment:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     pending_booking_id:
 *                       type: string
 *                       example: "673f1234567890abcdef1234"
 *                     temp_id:
 *                       type: string
 *                       example: "PB3010SMEQ"
 *                     vehicle:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Honda Klara 2024"
 *                         model:
 *                           type: string
 *                           example: "Klara"
 *                         color:
 *                           type: string
 *                           example: "Red"
 *                         license_plate:
 *                           type: string
 *                           example: "51F-12345"
 *                         price_per_day:
 *                           type: number
 *                           example: 100000
 *                     station:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           example: "Trạm EV Quận 1"
 *                         address:
 *                           type: string
 *                           example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *                     booking_details:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-11-01T02:00:00+07:00"
 *                         end_date:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-11-03T02:00:00+07:00"
 *                         pickup_time:
 *                           type: string
 *                           example: "09:00"
 *                         return_time:
 *                           type: string
 *                           example: "09:00"
 *                         total_days:
 *                           type: number
 *                           example: 2
 *                         total_price:
 *                           type: number
 *                           example: 200000
 *                         deposit_amount:
 *                           type: number
 *                           example: 100000
 *                     holding_fee:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                           example: 50000
 *                           description: "Phí giữ chỗ cố định 50,000đ"
 *                         status:
 *                           type: string
 *                           example: "unpaid"
 *                         payment_url:
 *                           type: string
 *                           example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
 *                           description: "URL thanh toán VNPay - Frontend cần redirect user đến đây"
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                           example: "2025-10-28T10:45:00+07:00"
 *                           description: "Thời gian hết hạn của payment URL (15 phút)"
 *                         expires_in_minutes:
 *                           type: number
 *                           example: 15
 *                     next_steps:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example:
 *                         - "1. Click vào payment_url để thanh toán phí giữ chỗ 50,000đ"
 *                         - "2. Link thanh toán có hiệu lực trong 15 phút"
 *                         - "3. Sau khi thanh toán thành công, booking sẽ được tạo tự động"
 *                         - "4. Bạn sẽ nhận email xác nhận booking"
 *                         - "5. Xe sẽ được giữ chỗ cho bạn"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Thiếu thông tin bắt buộc"
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
 *     description: |
 *       Hủy một đặt xe đang chờ xử lý
 *       
 *       **CHÍNH SÁCH PHÍ GIỮ CHỖ:**
 *       - Online booking: Phí giữ chỗ 50,000đ KHÔNG được hoàn lại (NON-REFUNDABLE)
 *       - Walk-in booking: Không có phí giữ chỗ
 *       
 *       **ĐIỀU KIỆN HỦY:**
 *       - Booking phải ở trạng thái 'pending'
 *       - Phải hủy trước ít nhất 2 giờ so với thời gian nhận xe
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
 *                   example: "Hủy booking thành công"
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 refund_info:
 *                   type: object
 *                   description: "Thông tin hoàn tiền (nếu có)"
 *                   properties:
 *                     holding_fee_paid:
 *                       type: number
 *                       example: 50000
 *                       description: "Số tiền phí giữ chỗ đã thanh toán"
 *                     holding_fee_refunded:
 *                       type: number
 *                       example: 0
 *                       description: "Số tiền được hoàn lại (luôn = 0 vì NON-REFUNDABLE)"
 *                     policy:
 *                       type: string
 *                       example: "NON-REFUNDABLE - Phí giữ chỗ 50,000đ KHÔNG được hoàn lại khi hủy booking"
 *                     message:
 *                       type: string
 *                       example: "❌ Bạn sẽ MẤT phí giữ chỗ 50,000đ đã thanh toán (KHÔNG HOÀN LẠI)"
 *       400:
 *         description: Không thể hủy đặt xe (đã xác nhận hoặc quá gần thời gian bắt đầu)
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
 * /api/bookings/{id}:
 *   put:
 *     summary: Chỉnh sửa booking (User only)
 *     description: |
 *       Cho phép user chỉnh sửa booking đã tạo
 *       
 *       **ĐIỀU KIỆN:**
 *       - Chỉ cho phép edit booking online đã thanh toán phí giữ chỗ
 *       - Phải ở trạng thái 'pending' (chưa confirm)
 *       - **CHỈ ĐƯỢC EDIT 1 LẦN DUY NHẤT** (edit_count < 1)
 *       - Phải edit trước thời gian nhận xe ít nhất 24 giờ
 *       
 *       **CHO PHÉP ĐỔI:**
 *       - Ngày nhận xe (start_date)
 *       - Ngày trả xe (end_date)
 *       - Trạm lấy xe (station_id)
 *       - Model xe (model & color - giống create booking)
 *       
 *       **TỰ ĐỘNG RECALCULATE:**
 *       - Total price, deposit amount, total days
 *       - Backend sẽ unreserve xe cũ và reserve xe mới
 *       
 *       **GIỮ NGUYÊN:**
 *       - Phí giữ chỗ 50,000đ (đã thanh toán)
 *       - Booking code, user, booking type
 *       
 *       **NẾU HẾT XE:**
 *       - Backend sẽ trả về danh sách model thay thế
 *       - Frontend hiển thị cho user chọn
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID booking cần update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               start_date:
 *                 type: string
 *                 format: date
 *                 description: "Ngày nhận xe mới (tùy chọn)"
 *                 example: "2025-11-15"
 *               end_date:
 *                 type: string
 *                 format: date
 *                 description: "Ngày trả xe mới (tùy chọn)"
 *                 example: "2025-11-19"
 *               station_id:
 *                 type: string
 *                 description: "ID trạm mới (tùy chọn)"
 *                 example: "673abc..."
 *               model:
 *                 type: string
 *                 description: "Tên model xe mới (tùy chọn)"
 *                 example: "VinFast Feliz"
 *               color:
 *                 type: string
 *                 description: "Màu xe mới (tùy chọn)"
 *                 example: "Đỏ"
 *               reason:
 *                 type: string
 *                 description: "Lý do chỉnh sửa booking (tùy chọn, sẽ lưu vào edit_reason)"
 *                 example: "Tôi có việc đột xuất ngày 15/11 nên cần đổi lịch"
 *     responses:
 *       200:
 *         description: Cập nhật booking thành công
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
 *                   example: "Cập nhật booking thành công"
 *                 booking:
 *                   $ref: '#/components/schemas/Booking'
 *                 changes:
 *                   type: object
 *                   properties:
 *                     old:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                         end_date:
 *                           type: string
 *                         vehicle:
 *                           type: string
 *                         station:
 *                           type: string
 *                         total_price:
 *                           type: number
 *                         deposit_amount:
 *                           type: number
 *                     new:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                         end_date:
 *                           type: string
 *                         vehicle:
 *                           type: string
 *                         station:
 *                           type: string
 *                         total_price:
 *                           type: number
 *                         deposit_amount:
 *                           type: number
 *                     price_difference:
 *                       type: number
 *                       example: 40000
 *                     note:
 *                       type: string
 *                       example: "Giá tăng 40,000đ - Bạn sẽ thanh toán thêm khi confirm"
 *                 edit_info:
 *                   type: object
 *                   description: "Thông tin về số lần edit"
 *                   properties:
 *                     edit_count:
 *                       type: number
 *                       example: 1
 *                       description: "Số lần đã edit (sau lần này)"
 *                     max_edits:
 *                       type: number
 *                       example: 1
 *                       description: "Số lần edit tối đa cho phép"
 *                     remaining_edits:
 *                       type: number
 *                       example: 0
 *                       description: "Số lần edit còn lại (0 = hết lượt)"
 *                     warning:
 *                       type: string
 *                       nullable: true
 *                       example: "⚠️ Bạn đã sử dụng hết lượt chỉnh sửa. Không thể edit thêm!"
 *                       description: "Cảnh báo nếu đã hết lượt edit"
 *       400:
 *         description: Không đủ điều kiện để edit hoặc không có xe available
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
 *                   example: "Không thể chỉnh sửa booking trong vòng 24 giờ trước khi nhận xe"
 *                 details:
 *                   type: object
 *                   description: "Chi tiết lỗi (nếu là lỗi thời gian)"
 *                 available_alternatives:
 *                   type: array
 *                   description: "Danh sách model thay thế (nếu hết xe)"
 *                   items:
 *                     type: object
 *                     properties:
 *                       model_id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       available_count:
 *                         type: number
 *                       price_per_day:
 *                         type: number
 *       403:
 *         description: Không có quyền chỉnh sửa booking này
 *       404:
 *         description: Booking không tồn tại
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
