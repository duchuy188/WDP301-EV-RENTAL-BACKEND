/**
 * @swagger
 * components:
 *   schemas:
 *     Feedback:
 *       type: object
 *       required:
 *         - rental_id
 *         - user_id
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *           description: ID của feedback
 *         rental_id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *           description: ID của rental (phải có status = 'completed')
 *         user_id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d3"
 *           description: ID của user tạo feedback
 *         staff_id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d4"
 *           description: ID của staff chính
 *         staff_ids:
 *           type: array
 *           items:
 *             type: string
 *           example: ["64f1a2b3c4d5e6f7a8b9c0d4", "64f1a2b3c4d5e6f7a8b9c0d5"]
 *           description: Danh sách ID của tất cả staff liên quan
 *         type:
 *           type: string
 *           enum: [rating, complaint]
 *           example: "rating"
 *           description: Loại feedback
 *         # Rating fields
 *         overall_rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá tổng thể (1-5 sao)
 *         staff_service:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *           description: Đánh giá dịch vụ nhân viên
 *         vehicle_condition:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá tình trạng xe
 *         station_cleanliness:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *           description: Đánh giá vệ sinh trạm
 *         checkout_process:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá quy trình trả xe
 *         # Complaint fields
 *         title:
 *           type: string
 *           example: "Xe bị hỏng phanh"
 *           description: Tiêu đề khiếu nại
 *         description:
 *           type: string
 *           example: "Xe VH015 bị hỏng phanh trước, rất nguy hiểm"
 *           description: Mô tả chi tiết khiếu nại
 *         category:
 *           type: string
 *           enum: [vehicle, staff, payment, service, other]
 *           example: "vehicle"
 *           description: Danh mục khiếu nại
 *         staff_role:
 *           type: string
 *           enum: [pickup, return]
 *           example: "pickup"
 *           description: Vai trò nhân viên (nhận xe hoặc trả xe) - Chỉ có khi category=staff
 *         # Status fields
 *         status:
 *           type: string
 *           enum: [pending, resolved]
 *           default: pending
 *           example: "pending"
 *           description: Trạng thái xử lý
 *         response:
 *           type: string
 *           example: "Cảm ơn bạn đã phản hồi. Chúng tôi sẽ xử lý ngay"
 *           description: Phản hồi từ admin
 *         resolved_by:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d5"
 *           description: ID admin xử lý
 *         # Common fields
 *         comment:
 *           type: string
 *           example: "Dịch vụ rất tốt, sẽ thuê lại"
 *           description: Bình luận chung
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://cloudinary.com/image1.jpg", "https://cloudinary.com/image2.jpg"]
 *           description: Hình ảnh đính kèm
 *         is_active:
 *           type: boolean
 *           default: true
 *           description: Trạng thái hoạt động
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 *           description: Thời gian tạo
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00.000Z"
 *           description: Thời gian cập nhật
 *     
 *     FeedbackCreateRequest:
 *       type: object
 *       required: [type, rental_id]
 *       properties:
 *         type:
 *           type: string
 *           enum: [rating, complaint]
 *           example: "rating"
 *           description: Loại feedback
 *         rental_id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *           description: ID rental (phải có status = 'completed')
 *         # Rating fields (required if type=rating)
 *         overall_rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá tổng thể (bắt buộc nếu type=rating)
 *         staff_service:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *           description: Đánh giá dịch vụ nhân viên
 *         vehicle_condition:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá tình trạng xe
 *         station_cleanliness:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 5
 *           description: Đánh giá vệ sinh trạm
 *         checkout_process:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *           description: Đánh giá quy trình trả xe
 *         # Complaint fields (required if type=complaint)
 *         title:
 *           type: string
 *           example: "Xe bị hỏng phanh"
 *           description: Tiêu đề khiếu nại (bắt buộc nếu type=complaint)
 *         description:
 *           type: string
 *           example: "Xe VH015 bị hỏng phanh trước, rất nguy hiểm"
 *           description: Mô tả chi tiết (bắt buộc nếu type=complaint)
 *         category:
 *           type: string
 *           enum: [vehicle, staff, payment, service, other]
 *           example: "vehicle"
 *           description: Danh mục khiếu nại (bắt buộc nếu type=complaint)
 *         staff_role:
 *           type: string
 *           enum: [pickup, return]
 *           example: "pickup"
 *           description: Vai trò staff (bắt buộc nếu category=staff)
 *         # Common fields
 *         comment:
 *           type: string
 *           example: "Dịch vụ rất tốt, sẽ thuê lại"
 *           description: Bình luận chung
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: Hình ảnh đính kèm (tối đa 5 ảnh)
 *     
 *     FeedbackUpdateRequest:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, resolved]
 *           example: "resolved"
 *           description: Trạng thái mới
 *         response:
 *           type: string
 *           example: "Cảm ơn bạn đã phản hồi. Chúng tôi sẽ xử lý ngay"
 *           description: Phản hồi từ admin
 *         comment:
 *           type: string
 *           example: "Đã xử lý xong"
 *           description: Ghi chú nội bộ
 *     
 *     FeedbackStats:
 *       type: object
 *       properties:
 *         period:
 *           type: string
 *           example: "30d"
 *           description: Kỳ thống kê
 *         dateRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *               example: "2024-01-01T00:00:00.000Z"
 *               description: Ngày bắt đầu
 *             end:
 *               type: string
 *               format: date-time
 *               example: "2024-01-31T23:59:59.999Z"
 *               description: Ngày kết thúc
 *         overview:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               example: 150
 *               description: Tổng số feedback
 *             ratings:
 *               type: number
 *               example: 120
 *               description: Số lượng đánh giá
 *             complaints:
 *               type: number
 *               example: 30
 *               description: Số lượng khiếu nại
 *             pending:
 *               type: number
 *               example: 5
 *               description: Số khiếu nại chưa xử lý
 *             resolved:
 *               type: number
 *               example: 25
 *               description: Số khiếu nại đã xử lý
 *             avgRating:
 *               type: number
 *               example: 4.2
 *               description: Điểm đánh giá trung bình
 *         byCategory:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "vehicle"
 *                 description: Danh mục
 *               count:
 *                 type: number
 *                 example: 15
 *                 description: Số lượng
 *           description: Thống kê theo danh mục khiếu nại
 *         dailyStats:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: object
 *                 properties:
 *                   year:
 *                     type: number
 *                     example: 2024
 *                   month:
 *                     type: number
 *                     example: 1
 *                   day:
 *                     type: number
 *                     example: 15
 *               ratings:
 *                 type: number
 *                 example: 5
 *                 description: Số đánh giá trong ngày
 *               complaints:
 *                 type: number
 *                 example: 2
 *                 description: Số khiếu nại trong ngày
 *           description: Thống kê theo ngày (7 ngày gần nhất)
 *     
 *     FeedbackListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             feedbacks:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Feedback'
 *             pagination:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   example: 25
 *                   description: Tổng số feedback
 *                 page:
 *                   type: number
 *                   example: 1
 *                   description: Trang hiện tại
 *                 limit:
 *                   type: number
 *                   example: 10
 *                   description: Số lượng mỗi trang
 *                 pages:
 *                   type: number
 *                   example: 3
 *                   description: Tổng số trang
 *             stats:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   example: 150
 *                 ratings:
 *                   type: number
 *                   example: 120
 *                 complaints:
 *                   type: number
 *                   example: 30
 *                 pending:
 *                   type: number
 *                   example: 5
 *                 resolved:
 *                   type: number
 *                   example: 25
 *               description: Thống kê tổng quan (chỉ có trong Admin API)
 *     
 *     FeedbackResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Feedback đã được tạo thành công"
 *         data:
 *           $ref: '#/components/schemas/Feedback'
 *     
 *     FeedbackStatsResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           $ref: '#/components/schemas/FeedbackStats'
 */
