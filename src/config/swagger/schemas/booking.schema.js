/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       required:
 *         - code
 *         - user_id
 *         - vehicle_id
 *         - station_id
 *         - start_date
 *         - end_date
 *         - pickup_time
 *         - return_time
 *         - price_per_day
 *         - total_days
 *         - total_price
 *         - deposit_amount
 *         - created_by
 *       properties:
 *         _id:
 *           type: string
 *           description: ID đặt xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         code:
 *           type: string
 *           description: Mã đặt xe
 *           example: "BK123456"
 *         user_id:
 *           type: string
 *           description: ID người dùng thực hiện đặt xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         vehicle_id:
 *           type: string
 *           description: ID xe được chọn tự động
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         station_id:
 *           type: string
 *           description: ID trạm
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         start_date:
 *           type: string
 *           format: date
 *           description: Ngày bắt đầu đặt xe
 *           example: "2024-01-15"
 *         end_date:
 *           type: string
 *           format: date
 *           description: Ngày kết thúc đặt xe
 *           example: "2024-01-16"
 *         pickup_time:
 *           type: string
 *           description: Thời gian nhận xe
 *           example: "09:00"
 *         return_time:
 *           type: string
 *           description: Thời gian trả xe
 *           example: "18:00"
 *         status:
 *           type: string
 *           enum: [pending, confirmed, cancelled]
 *           description: Trạng thái đặt xe
 *           example: "pending"
 *         booking_type:
 *           type: string
 *           enum: [online, walk_in]
 *           description: Loại đặt xe
 *           example: "online"
 *         price_per_day:
 *           type: number
 *           description: Giá mỗi ngày (VND)
 *           example: 500000
 *         total_days:
 *           type: number
 *           description: Tổng số ngày
 *           example: 1
 *         total_price:
 *           type: number
 *           description: Tổng giá (VND)
 *           example: 500000
 *         deposit_amount:
 *           type: number
 *           description: Số tiền đặt cọc (VND)
 *           example: 150000
 *         late_fee:
 *           type: number
 *           description: Phí trễ (VND)
 *           example: 0
 *         damage_fee:
 *           type: number
 *           description: Phí hư hỏng (VND)
 *           example: 0
 *         other_fees:
 *           type: number
 *           description: Phí khác (VND)
 *           example: 0
 *         final_amount:
 *           type: number
 *           description: Số tiền cuối cùng (VND)
 *           example: 0
 *         special_requests:
 *           type: string
 *           description: Yêu cầu đặc biệt từ người dùng
 *           example: "Cần thêm phụ kiện sạc"
 *         notes:
 *           type: string
 *           description: Ghi chú thêm
 *           example: "Khách hàng VIP"
 *         cancellation_reason:
 *           type: string
 *           description: Lý do hủy
 *           example: "Thay đổi kế hoạch"
 *         cancelled_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian hủy
 *           example: "2024-01-14T10:30:00.000Z"
 *         cancelled_by:
 *           type: string
 *           description: ID người dùng hủy đặt xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         confirmed_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian xác nhận
 *           example: "2024-01-15T09:00:00.000Z"
 *         confirmed_by:
 *           type: string
 *           description: ID nhân viên xác nhận đặt xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         qr_code:
 *           type: string
 *           description: Mã QR để nhận xe
 *           example: "QR_ABC123DEF456"
 *         qr_expires_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian hết hạn QR code
 *           example: "2024-01-16T09:00:00.000Z"
 *         qr_used_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian sử dụng QR code
 *           example: "2024-01-15T09:00:00.000Z"
 *         created_by:
 *           type: string
 *           description: ID người dùng tạo đặt xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         is_active:
 *           type: boolean
 *           description: Đặt xe có đang hoạt động không
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 *           example: "2024-01-14T08:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian cập nhật cuối
 *           example: "2024-01-15T09:00:00.000Z"
 *     
 *     CreateBookingRequest:
 *       type: object
 *       required:
 *         - model
 *         - color
 *         - station_id
 *         - start_date
 *         - end_date
 *         - pickup_time
 *         - return_time
 *       properties:
 *         model:
 *           type: string
 *           description: Model xe để booking
 *           example: "VinFast Evo 200"
 *         color:
 *           type: string
 *           description: Màu xe để booking
 *           example: "Đỏ"
 *         station_id:
 *           type: string
 *           description: ID trạm
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         start_date:
 *           type: string
 *           format: date
 *           description: Ngày bắt đầu (YYYY-MM-DD)
 *           example: "2024-01-15"
 *         end_date:
 *           type: string
 *           format: date
 *           description: Ngày kết thúc (YYYY-MM-DD)
 *           example: "2024-01-16"
 *         pickup_time:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Thời gian nhận xe (HH:MM)
 *           example: "09:00"
 *         return_time:
 *           type: string
 *           pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Thời gian trả xe (HH:MM)
 *           example: "18:00"
 *         special_requests:
 *           type: string
 *           description: Yêu cầu đặc biệt
 *           example: "Cần thêm phụ kiện sạc"
 *         notes:
 *           type: string
 *           description: Ghi chú thêm
 *           example: "Khách hàng VIP"
 *     
 *     ConfirmBookingRequest:
 *       type: object
 *       properties:
 *         vehicle_condition_before:
 *           type: object
 *           properties:
 *             mileage:
 *               type: number
 *               description: Vehicle mileage
 *               example: 15000
 *             battery_level:
 *               type: number
 *               minimum: 0
 *               maximum: 100
 *               description: Battery level percentage
 *               example: 85
 *             exterior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Exterior condition
 *               example: "good"
 *             interior_condition:
 *               type: string
 *               enum: [excellent, good, fair, poor]
 *               description: Interior condition
 *               example: "good"
 *             notes:
 *               type: string
 *               description: Condition notes
 *               example: "Xe sạch sẽ, không có vết xước"
 *         staff_notes:
 *           type: string
 *           description: Staff notes
 *           example: "Khách hàng thân thiện, đúng giờ"
 *     
 *     CancelBookingRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           description: Cancellation reason
 *           example: "Thay đổi kế hoạch"
 *     
 *     BookingResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Đặt xe thành công"
 *         booking:
 *           $ref: '#/components/schemas/Booking'
 *         requiresKYC:
 *           type: boolean
 *           description: Whether KYC verification is required
 *           example: true
 *     
 *     BookingListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy danh sách booking thành công"
 *         bookings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Booking'
 *         pagination:
 *           type: object
 *           properties:
 *             current:
 *               type: number
 *               description: Current page
 *               example: 1
 *             total:
 *               type: number
 *               description: Total pages
 *               example: 5
 *             count:
 *               type: number
 *               description: Items in current page
 *               example: 10
 *             totalRecords:
 *               type: number
 *               description: Total records
 *               example: 47
 *     
 *     BookingDetailsResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy chi tiết booking thành công"
 *         booking:
 *           $ref: '#/components/schemas/Booking'
 *         canCancel:
 *           type: boolean
 *           description: Whether booking can be cancelled
 *           example: true
 *     
 *     ConfirmBookingResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Xác nhận booking thành công"
 *         booking:
 *           $ref: '#/components/schemas/Booking'
 *         payment:
 *           type: object
 *           description: Created payment object
 *           properties:
 *             _id:
 *               type: string
 *               example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *             code:
 *               type: string
 *               example: "PAY123456"
 *             amount:
 *               type: number
 *               example: 150000
 *             payment_type:
 *               type: string
 *               example: "deposit"
 *             status:
 *               type: string
 *               example: "pending"
 *         rental:
 *           type: object
 *           description: Created rental object
 *           properties:
 *             _id:
 *               type: string
 *               example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *             code:
 *               type: string
 *               example: "RENT123456"
 *             status:
 *               type: string
 *               example: "active"
 *             actual_start_time:
 *               type: string
 *               format: date-time
 *               example: "2024-01-15T09:00:00.000Z"
 *     
 *     BookingError:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *           example: "Booking không tồn tại"
 *         error:
 *           type: string
 *           description: Detailed error information
 *           example: "ValidationError: start_date is required"
 *     
 *     BookingValidationError:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Validation error message
 *           example: "Thiếu thông tin bắt buộc"
 *         errors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "start_date"
 *               message:
 *                 type: string
 *                 example: "Ngày bắt đầu phải sau thời điểm hiện tại"
 */
