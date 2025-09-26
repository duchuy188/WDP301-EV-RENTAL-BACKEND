/**
 * @swagger
 * components:
 *   schemas:
 *     Rental:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của rental
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         code:
 *           type: string
 *           description: Mã rental
 *           example: "RTL001"
 *         booking_id:
 *           type: string
 *           description: ID của booking
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         user_id:
 *           type: string
 *           description: ID của user
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         vehicle_id:
 *           type: string
 *           description: ID của vehicle
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         station_id:
 *           type: string
 *           description: ID của station
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         actual_start_time:
 *           type: string
 *           format: date-time
 *           description: Thời gian bắt đầu thực tế
 *           example: "2025-01-25T10:00:00.000Z"
 *         actual_end_time:
 *           type: string
 *           format: date-time
 *           description: Thời gian kết thúc thực tế
 *           example: "2025-01-25T18:00:00.000Z"
 *         pickup_staff_id:
 *           type: string
 *           description: ID nhân viên giao xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         return_staff_id:
 *           type: string
 *           description: ID nhân viên nhận xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         vehicle_condition_before:
 *           type: object
 *           properties:
 *             mileage:
 *               type: number
 *               description: Số km trước khi thuê
 *               example: 1000
 *             battery_level:
 *               type: number
 *               description: Mức pin trước khi thuê (%)
 *               example: 85
 *             exterior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng ngoại thất
 *               example: "good"
 *             interior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng nội thất
 *               example: "excellent"
 *             notes:
 *               type: string
 *               description: Ghi chú
 *               example: "Xe sạch sẽ"
 *         vehicle_condition_after:
 *           type: object
 *           properties:
 *             mileage:
 *               type: number
 *               description: Số km sau khi trả
 *               example: 1050
 *             battery_level:
 *               type: number
 *               description: Mức pin sau khi trả (%)
 *               example: 75
 *             exterior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng ngoại thất
 *               example: "good"
 *             interior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng nội thất
 *               example: "excellent"
 *             notes:
 *               type: string
 *               description: Ghi chú
 *               example: "Có vết trầy nhỏ"
 *         images_before:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs ảnh trước khi thuê
 *           example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 *         images_after:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs ảnh sau khi trả
 *           example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 *         status:
 *           type: string
 *           enum: [active, completed]
 *           description: Trạng thái rental
 *           example: "active"
 *         late_fee:
 *           type: number
 *           description: Phí trễ
 *           example: 50000
 *         damage_fee:
 *           type: number
 *           description: Phí hư hỏng
 *           example: 0
 *         other_fees:
 *           type: number
 *           description: Phí khác
 *           example: 0
 *         total_fees:
 *           type: number
 *           description: Tổng phí phát sinh
 *           example: 50000
 *         staff_notes:
 *           type: string
 *           description: Ghi chú của nhân viên
 *           example: "Khách hàng trả xe đúng giờ"
 *         customer_notes:
 *           type: string
 *           description: Ghi chú của khách hàng
 *           example: "Xe chạy tốt"
 *         created_by:
 *           type: string
 *           description: ID người tạo
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         is_active:
 *           type: boolean
 *           description: Trạng thái hoạt động
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 *           example: "2025-01-25T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian cập nhật
 *           example: "2025-01-25T18:00:00.000Z"
 * 
 *     CheckoutInfoResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             rental:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 code:
 *                   type: string
 *                   example: "RTL001"
 *                 actual_start_time:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-25T10:00:00.000Z"
 *                 vehicle_condition_before:
 *                   $ref: '#/components/schemas/Rental/properties/vehicle_condition_before'
 *                 images_before:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["https://res.cloudinary.com/..."]
 *                 rental_duration_hours:
 *                   type: number
 *                   example: 8
 *             customer:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 fullname:
 *                   type: string
 *                   example: "Nguyễn Văn A"
 *                 email:
 *                   type: string
 *                   example: "nguyenvana@email.com"
 *                 phone:
 *                   type: string
 *                   example: "0123456789"
 *             vehicle:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 name:
 *                   type: string
 *                   example: "VinFast VF8"
 *                 license_plate:
 *                   type: string
 *                   example: "30A-12345"
 *                 model:
 *                   type: string
 *                   example: "2024"
 *                 battery_capacity:
 *                   type: number
 *                   example: 89.2
 *             station:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 name:
 *                   type: string
 *                   example: "Trạm VinFast Quận 1"
 *                 address:
 *                   type: string
 *                   example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *             pickup_staff:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 fullname:
 *                   type: string
 *                   example: "Trần Văn B"
 * 
 *     CheckoutRequest:
 *       type: object
 *       required:
 *         - vehicle_condition_after
 *       properties:
 *         vehicle_condition_after:
 *           type: object
 *           required:
 *             - mileage
 *             - battery_level
 *             - exterior_condition
 *             - interior_condition
 *           properties:
 *             mileage:
 *               type: number
 *               minimum: 0
 *               description: Số km sau khi trả
 *               example: 1050
 *             battery_level:
 *               type: number
 *               minimum: 0
 *               maximum: 100
 *               description: Mức pin sau khi trả (%)
 *               example: 75
 *             exterior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng ngoại thất
 *               example: "good"
 *             interior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Tình trạng nội thất
 *               example: "excellent"
 *             notes:
 *               type: string
 *               description: Ghi chú về tình trạng xe
 *               example: "Có vết trầy nhỏ ở cánh cửa"
 *         late_fee:
 *           type: number
 *           minimum: 0
 *           description: Phí trễ
 *           example: 50000
 *         damage_fee:
 *           type: number
 *           minimum: 0
 *           description: Phí hư hỏng
 *           example: 0
 *         other_fees:
 *           type: number
 *           minimum: 0
 *           description: Phí khác
 *           example: 0
 *         staff_notes:
 *           type: string
 *           description: Ghi chú của nhân viên
 *           example: "Khách hàng trả xe đúng giờ"
 *         customer_notes:
 *           type: string
 *           description: Ghi chú của khách hàng
 *           example: "Xe chạy tốt"
 * 
 *     CalculateFeesRequest:
 *       type: object
 *       properties:
 *         return_time:
 *           type: string
 *           format: date-time
 *           description: Thời gian trả xe thực tế
 *           example: "2025-01-25T19:00:00.000Z"
 *         vehicle_condition_after:
 *           type: object
 *           properties:
 *             mileage:
 *               type: number
 *               example: 1050
 *             battery_level:
 *               type: number
 *               example: 75
 *             exterior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               example: "good"
 *             interior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               example: "excellent"
 *             notes:
 *               type: string
 *               example: "Có vết trầy nhỏ"
 *         damage_description:
 *           type: string
 *           description: Mô tả hư hỏng
 *           example: "Có vết trầy xước ở cánh cửa trái"
 * 
 *     CalculateFeesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             fee_breakdown:
 *               type: object
 *               properties:
 *                 late_fee:
 *                   type: number
 *                   example: 50000
 *                 damage_fee:
 *                   type: number
 *                   example: 0
 *                 other_fees:
 *                   type: number
 *                   example: 0
 *                 total_fees:
 *                   type: number
 *                   example: 50000
 *             time_info:
 *               type: object
 *               properties:
 *                 planned_end_time:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-25T18:00:00.000Z"
 *                 actual_return_time:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-25T19:00:00.000Z"
 *                 late_hours:
 *                   type: number
 *                   example: 1
 *             vehicle_condition:
 *               type: object
 *               properties:
 *                 mileage:
 *                   type: number
 *                   example: 1050
 *                 battery_level:
 *                   type: number
 *                   example: 75
 *                 exterior_condition:
 *                   type: string
 *                   example: "good"
 *                 interior_condition:
 *                   type: string
 *                   example: "excellent"
 *                 notes:
 *                   type: string
 *                   example: "Có vết trầy nhỏ"
 *             damage_description:
 *               type: string
 *               example: "Có vết trầy xước ở cánh cửa trái"
 * 
 *     CheckoutResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Checkout thành công"
 *         data:
 *           type: object
 *           properties:
 *             rental:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 code:
 *                   type: string
 *                   example: "RTL001"
 *                 actual_end_time:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-25T19:00:00.000Z"
 *                 total_fees:
 *                   type: number
 *                   example: 50000
 *                 status:
 *                   type: string
 *                   example: "completed"
 *             payment:
 *               type: object
 *               nullable: true
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 amount:
 *                   type: number
 *                   example: 50000
 *                 status:
 *                   type: string
 *                   example: "pending"
 * 
 *     UploadPhotosResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Upload ảnh thành công"
 *         data:
 *           type: object
 *           properties:
 *             images_after:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 *             new_images:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["https://res.cloudinary.com/...", "https://res.cloudinary.com/..."]
 * 
 *     RentalListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             rentals:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Rental'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: number
 *                   example: 1
 *                 limit:
 *                   type: number
 *                   example: 10
 *                 total:
 *                   type: number
 *                   example: 25
 *                 pages:
 *                   type: number
 *                   example: 3
 */

