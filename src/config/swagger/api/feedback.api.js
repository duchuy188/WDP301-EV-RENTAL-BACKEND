// Schemas are defined in feedback.schema.js

/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Tạo feedback (đánh giá hoặc khiếu nại)
 *     description: |
 *       Customer tạo feedback cho rental đã hoàn thành (status = 'completed')
 *       
 *       **Lưu ý quan trọng:**
 *       - Nếu `type=complaint` và `category=staff`: BẮT BUỘC phải có `staff_role` (pickup hoặc return)
 *       - `staff_role=pickup`: Khiếu nại về nhân viên nhận xe
 *       - `staff_role=return`: Khiếu nại về nhân viên trả xe
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackCreateRequest'
 *           examples:
 *             rating:
 *               summary: Tạo đánh giá
 *               value:
 *                 type: rating
 *                 rental_id: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                 overall_rating: 5
 *                 staff_service: 5
 *                 vehicle_condition: 4
 *                 station_cleanliness: 5
 *                 checkout_process: 4
 *                 comment: "Dịch vụ rất tốt, sẽ thuê lại"
 *             complaint_staff_pickup:
 *               summary: Khiếu nại nhân viên nhận xe
 *               value:
 *                 type: complaint
 *                 rental_id: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                 category: staff
 *                 staff_role: pickup
 *                 title: "Nhân viên nhận xe thái độ không tốt"
 *                 description: "Nhân viên nhận xe có thái độ thiếu chuyên nghiệp, không hướng dẫn kỹ"
 *             complaint_staff_return:
 *               summary: Khiếu nại nhân viên trả xe
 *               value:
 *                 type: complaint
 *                 rental_id: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                 category: staff
 *                 staff_role: return
 *                 title: "Nhân viên trả xe tính phí không rõ ràng"
 *                 description: "Nhân viên trả xe tính thêm phí nhưng không giải thích rõ ràng"
 *             complaint_vehicle:
 *               summary: Khiếu nại về xe
 *               value:
 *                 type: complaint
 *                 rental_id: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                 category: vehicle
 *                 title: "Xe bị hỏng phanh"
 *                 description: "Xe VH015 bị hỏng phanh trước, rất nguy hiểm"
 *     responses:
 *       201:
 *         description: Feedback được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc rental chưa hoàn thành
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy rental
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback/customer:
 *   get:
 *     summary: Lấy feedback của khách hàng
 *     description: Customer xem danh sách feedback của mình
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [rating, complaint]
 *         description: Lọc theo loại feedback
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved]
 *         description: Lọc theo trạng thái (chỉ áp dụng cho complaint)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackListResponse'
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Lấy tất cả feedback (Admin)
 *     description: Admin xem danh sách tất cả feedback trong hệ thống
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [rating, complaint]
 *         description: Lọc theo loại feedback
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved]
 *         description: Lọc theo trạng thái (chỉ áp dụng cho complaint)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [vehicle, staff, payment, service, other]
 *         description: Lọc theo danh mục (chỉ áp dụng cho complaint)
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: Lọc theo trạm
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackListResponse'
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback/stats:
 *   get:
 *     summary: Thống kê feedback (Admin)
 *     description: Lấy các số liệu thống kê về feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Kỳ thống kê
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: Lọc theo trạm
 *     responses:
 *       200:
 *         description: Thống kê feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackStatsResponse'
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback/{id}:
 *   get:
 *     summary: Lấy feedback theo ID
 *     description: Xem chi tiết feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID feedback
 *     responses:
 *       200:
 *         description: Chi tiết feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy feedback
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback/{id}:
 *   put:
 *     summary: Cập nhật feedback (Admin)
 *     description: Admin cập nhật trạng thái và phản hồi feedback
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackUpdateRequest'
 *     responses:
 *       200:
 *         description: Feedback được cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy feedback
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/feedback/{id}:
 *   delete:
 *     summary: Xóa feedback (Admin)
 *     description: Admin xóa feedback (soft delete)
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID feedback
 *     responses:
 *       200:
 *         description: Feedback được xóa thành công
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
 *                   example: "Feedback đã được xóa thành công"
 *       404:
 *         description: Không tìm thấy feedback
 *       500:
 *         description: Lỗi server
 */
