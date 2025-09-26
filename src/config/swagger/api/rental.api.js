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
 *           enum: [active, completed]
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
 *           enum: [active, completed]
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
 *           enum: [active, completed]
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
 * /api/rentals/{id}/checkout:
 *   put:
 *     summary: Xử lý checkout
 *     description: Thực hiện checkout cho rental
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckoutRequest'
 *           examples:
 *             checkout_example:
 *               summary: Checkout example
 *               value:
 *                 vehicle_condition_after:
 *                   mileage: 1050
 *                   battery_level: 75
 *                   exterior_condition: "good"
 *                   interior_condition: "excellent"
 *                   notes: "Có vết trầy nhỏ ở cánh cửa"
 *                 late_fee: 50000
 *                 damage_fee: 0
 *                 other_fees: 0
 *                 staff_notes: "Khách hàng trả xe đúng giờ"
 *                 customer_notes: "Xe chạy tốt"
 *     responses:
 *       200:
 *         description: Checkout thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckoutResponse'
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
 * /api/rentals/{id}/return-photos:
 *   post:
 *     summary: Upload ảnh và báo cáo tình trạng xe
 *     description: Upload ảnh khi trả xe và báo cáo tình trạng xe (mileage, battery, exterior, interior)
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
 *                 example: "Xe sạch sẽ, không hư hỏng"
 *               damage_description:
 *                 type: string
 *                 description: Mô tả hư hỏng (nếu có)
 *                 example: "Có vết trầy nhỏ ở cánh cửa trái"
 *             required:
 *               - photos
 *               - mileage
 *               - battery_level
 *               - exterior_condition
 *               - interior_condition
 *     responses:
 *       200:
 *         description: Upload ảnh và báo cáo tình trạng xe thành công
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
 *                   example: "Upload ảnh và báo cáo tình trạng xe thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     images_after:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 *                     new_images:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 *                     vehicle_condition_after:
 *                       type: object
 *                       properties:
 *                         mileage:
 *                           type: number
 *                           example: 1050
 *                         battery_level:
 *                           type: number
 *                           example: 75
 *                         exterior_condition:
 *                           type: string
 *                           example: "good"
 *                         interior_condition:
 *                           type: string
 *                           example: "excellent"
 *                         notes:
 *                           type: string
 *                           example: "Xe sạch sẽ, không hư hỏng"
 *                     inspection_notes:
 *                       type: string
 *                       example: "Xe sạch sẽ, không hư hỏng"
 *                     damage_description:
 *                       type: string
 *                       example: "Có vết trầy nhỏ ở cánh cửa trái"
 *       400:
 *         description: Không có ảnh hoặc thiếu thông tin tình trạng xe
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
 * /api/rentals/{id}/calculate-fees:
 *   post:
 *     summary: Tính phí phát sinh
 *     description: Tính toán các phí phát sinh khi trả xe
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
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CalculateFeesRequest'
 *           examples:
 *             calculate_fees_example:
 *               summary: Calculate fees example
 *               value:
 *                 return_time: "2025-01-25T19:00:00.000Z"
 *                 vehicle_condition_after:
 *                   mileage: 1050
 *                   battery_level: 75
 *                   exterior_condition: "good"
 *                   interior_condition: "excellent"
 *                   notes: "Có vết trầy nhỏ"
 *                 damage_description: "Có vết trầy xước ở cánh cửa trái"
 *     responses:
 *       200:
 *         description: Tính phí thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CalculateFeesResponse'
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
 */
