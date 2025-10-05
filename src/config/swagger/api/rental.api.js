/**
 * @swagger
 * /api/rentals/user:
 *   get:
 *     summary: Lấy rentals của EV Renter
 *     description: EV Renter chỉ xem được rentals của chính mình
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending_payment, completed]
 *         description: Lọc theo trạng thái
 *         example: "active"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số lượng per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Danh sách rentals của EV Renter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RentalListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập (chỉ dành cho EV Renter)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/staff:
 *   get:
 *     summary: Lấy rentals tại station của staff
 *     description: Station Staff chỉ xem được rentals tại station của mình
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending_payment, completed]
 *         description: Lọc theo trạng thái
 *         example: "active"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số lượng per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Danh sách rentals tại station của staff
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RentalListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập (chỉ dành cho Station Staff)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/admin:
 *   get:
 *     summary: Lấy tất cả rentals (Admin only)
 *     description: Admin có thể xem tất cả rentals và filter theo nhiều tiêu chí
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending_payment, completed]
 *         description: Lọc theo trạng thái
 *         example: "active"
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Lọc theo user ID
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Lọc theo station ID
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số lượng per page
 *         example: 10
 *     responses:
 *       200:
 *         description: Danh sách tất cả rentals
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RentalListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập (chỉ dành cho Admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/{id}:
 *   get:
 *     summary: Lấy chi tiết rental
 *     description: Lấy thông tin chi tiết của một rental
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của rental
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Chi tiết rental
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Rental'
 *       404:
 *         description: Không tìm thấy rental
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/{id}/checkout-info:
 *   get:
 *     summary: Lấy thông tin checkout
 *     description: Lấy thông tin cần thiết để thực hiện checkout
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của rental
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Thông tin checkout
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutInfoResponse'
 *       400:
 *         description: Rental không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy rental
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/{id}/checkout-normal:
 *   put:
 *     summary: Checkout bình thường
 *     description: |
 *       Staff thực hiện checkout cho rental không có phí phát sinh
 *       
 *       **Logic xử lý:**
 *       - Thuê < 3 ngày: Status = 'completed' (đã thanh toán full khi confirm)
 *       - Thuê >= 3 ngày: Status = 'pending_payment' (cần thanh toán cọc còn lại)
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của rental
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Các file ảnh (tối đa 10 ảnh)
 *                 maxItems: 10
 *               mileage:
 *                 type: number
 *                 description: Số km sau khi trả xe
 *                 example: 1050
 *               battery_level:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Mức pin sau khi trả xe (%)
 *                 example: 75
 *               exterior_condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *                 description: Tình trạng ngoại thất
 *                 example: "good"
 *               interior_condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *                 description: Tình trạng nội thất
 *                 example: "excellent"
 *               inspection_notes:
 *                 type: string
 *                 description: Ghi chú kiểm tra xe
 *                 example: "Xe sạch sẽ, không có hư hỏng"
 *               damage_description:
 *                 type: string
 *                 description: Mô tả hư hỏng (nếu có)
 *                 example: "Không có hư hỏng"
 *               payment_method:
 *                 type: string
 *                 enum: [cash, vnpay]
 *                 default: cash
 *                 description: Phương thức thanh toán
 *                 example: "cash"
 *               customer_notes:
 *                 type: string
 *                 description: Ghi chú từ khách hàng (tùy chọn)
 *                 example: "Xe chạy tốt, không có vấn đề gì"
 *             required:
 *               - mileage
 *               - battery_level
 *               - exterior_condition
 *               - interior_condition
 *     responses:
 *       200:
 *         description: Checkout bình thường thành công
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
 *                   example: "Checkout bình thường thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rental:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                         code:
 *                           type: string
 *                           example: "RENT123456"
 *                         actual_end_time:
 *                           type: string
 *                           format: date-time
 *                         total_fees:
 *                           type: number
 *                           example: 0
 *                         status:
 *                           type: string
 *                           enum: [completed, pending_payment]
 *                           description: "completed cho thuê < 3 ngày, pending_payment cho thuê >= 3 ngày"
 *                           example: "completed"
 *                     fee_breakdown:
 *                       type: object
 *                       properties:
 *                         late_fee:
 *                           type: number
 *                           example: 0
 *                         damage_fee:
 *                           type: number
 *                           example: 0
 *                         other_fees:
 *                           type: number
 *                           example: 0
 *                         total_fees:
 *                           type: number
 *                           example: 0
 *                     payments:
 *                       type: array
 *                       example:
 *                         - id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                           type: "deposit"
 *                           amount: 500000
 *                           status: "pending"
 *                           description: "Thanh toán cọc còn lại cho thuê xe RENT123456"
 *                     total_paid:
 *                       type: number
 *                       description: Tổng số tiền cần thanh toán
 *                       example: 500000
 *                     vehicle_status:
 *                       type: string
 *                       enum: [available, maintenance]
 *                       description: Trạng thái xe sau checkout
 *                       example: "available"
 *                     images:
 *                       type: object
 *                       nullable: true
 *                       description: "Chỉ hiển thị khi có upload hình ảnh"
 *                       properties:
 *                         uploaded:
 *                           type: array
 *                           items:
 *                             type: string
 *                             description: "URL các ảnh mới upload"
 *                     checkout_info:
 *                       type: object
 *                       description: "Thông tin về logic xử lý checkout"
 *                       properties:
 *                         rental_days:
 *                           type: number
 *                           example: 2
 *                         payment_required:
 *                           type: boolean
 *                           example: false
 *                         status_reason:
 *                           type: string
 *                           example: "Đã thanh toán full khi confirm"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy rental
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/rentals/{id}/checkout-fees:
 *   put:
 *     summary: Checkout có phí phát sinh
 *     description: Staff thực hiện checkout cho rental có phí phát sinh
 *     tags: [Rentals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của rental
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Các file ảnh (tối đa 10 ảnh)
 *                 maxItems: 10
 *               mileage:
 *                 type: number
 *                 description: Số km sau khi trả xe
 *                 example: 1050
 *               battery_level:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Mức pin sau khi trả xe (%)
 *                 example: 75
 *               exterior_condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *                 description: Tình trạng ngoại thất
 *                 example: "good"
 *               interior_condition:
 *                 type: string
 *                 enum: [excellent, good, fair, poor]
 *                 description: Tình trạng nội thất
 *                 example: "excellent"
 *               inspection_notes:
 *                 type: string
 *                 description: Ghi chú kiểm tra xe
 *                 example: "Xe sạch sẽ, không có hư hỏng"
 *               damage_description:
 *                 type: string
 *                 description: Mô tả hư hỏng (nếu có)
 *                 example: "Có vết trầy nhỏ ở cánh cửa trái"
 *               payment_method:
 *                 type: string
 *                 enum: [cash, vnpay]
 *                 default: cash
 *                 description: Phương thức thanh toán
 *                 example: "vnpay"
 *               customer_notes:
 *                 type: string
 *                 description: Ghi chú từ khách hàng (tùy chọn)
 *                 example: "Xe chạy tốt, không có vấn đề gì"
 *               late_fee:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 description: Phí trễ giờ (Staff tự nhập)
 *                 example: 50000
 *               damage_fee:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 description: Phí hư hỏng xe (Staff tự nhập)
 *                 example: 75000
 *               other_fees:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 description: Phí phụ trội khác (Staff tự nhập)
 *                 example: 25000
 *             required:
 *               - mileage
 *               - battery_level
 *               - exterior_condition
 *               - interior_condition
 *     responses:
 *       200:
 *         description: Checkout có phí phát sinh thành công
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
 *                   example: "Checkout có phí phát sinh thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rental:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                         code:
 *                           type: string
 *                           example: "RENT123456"
 *                         actual_end_time:
 *                           type: string
 *                           format: date-time
 *                         total_fees:
 *                           type: number
 *                           example: 150000
 *                         status:
 *                           type: string
 *                           enum: [active, pending_payment, completed]
 *                           example: "pending_payment"
 *                     fee_breakdown:
 *                       type: object
 *                       properties:
 *                         late_fee:
 *                           type: number
 *                           example: 50000
 *                         damage_fee:
 *                           type: number
 *                           example: 75000
 *                         other_fees:
 *                           type: number
 *                           example: 25000
 *                         total_fees:
 *                           type: number
 *                           example: 150000
 *                     payments:
 *                       type: array
 *                       example:
 *                         - id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                           type: "deposit"
 *                           amount: 500000
 *                           status: "pending"
 *                           description: "Thanh toán cọc còn lại cho thuê xe RENT123456"
 *                           payment_method: "vnpay"
 *                         - id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                           type: "additional_fee"
 *                           amount: 150000
 *                           status: "pending"
 *                           description: "Phí phát sinh thuê xe RENT123456"
 *                           payment_method: "vnpay"
 *                     total_paid:
 *                       type: number
 *                       description: Tổng số tiền cần thanh toán
 *                       example: 650000
 *                     vehicle_status:
 *                       type: string
 *                       enum: [available, maintenance]
 *                       description: Trạng thái xe sau checkout
 *                       example: "maintenance"
 *                     payment_urls:
 *                       type: object
 *                       nullable: true
 *                       description: "VNPay payment URLs (nếu có)"
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           paymentUrl:
 *                             type: string
 *                           orderId:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           paymentType:
 *                             type: string
 *                     images:
 *                       type: object
 *                       nullable: true
 *                       description: "Chỉ hiển thị khi có upload hình ảnh"
 *                       properties:
 *                         uploaded:
 *                           type: array
 *                           items:
 *                             type: string
 *                             description: "URL các ảnh mới upload"
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc không có phí phát sinh
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
 *                   example: "Endpoint này dành cho trường hợp có phí phát sinh"
 *                 suggestion:
 *                   type: string
 *                   example: "Sử dụng endpoint /checkout-normal thay vì"
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy rental
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */