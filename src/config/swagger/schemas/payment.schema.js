/**
 * @swagger
 * components:
 *   schemas:
 *     Payment:
 *       type: object
 *       required:
 *         - code
 *         - user_id
 *         - booking_id
 *         - amount
 *         - payment_method
 *         - payment_type
 *         - status
 *         - processed_by
 *       properties:
 *         _id:
 *           type: string
 *           description: Payment ID
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         code:
 *           type: string
 *           description: Payment code
 *           example: "PAY123456"
 *         amount:
 *           type: number
 *           description: Số tiền thanh toán (VND)
 *           example: 150000
 *         payment_method:
 *           type: string
 *           enum: [cash, qr_code, bank_transfer, vnpay]
 *           description: Phương thức thanh toán
 *           example: "qr_code"
 *         payment_type:
 *           type: string
 *           enum: [deposit, rental_fee, additional_fee, refund]
 *           description: Loại thanh toán
 *           example: "deposit"
 *         status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           description: Trạng thái thanh toán
 *           example: "pending"
 *         reason:
 *           type: string
 *           description: Lý do phí phát sinh
 *           example: "Phí trễ giờ"
 *         transaction_id:
 *           type: string
 *           description: Mã giao dịch
 *           example: "TXN123456789"
 *         qr_code_data:
 *           type: string
 *           description: Dữ liệu QR Code
 *           example: "{\"amount\":150000,\"content\":\"EV Rental - DEPOSIT - PAY123456\"}"
 *         qr_code_image:
 *           type: string
 *           description: URL hình ảnh QR Code
 *           example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *         vnpay_url:
 *           type: string
 *           description: URL thanh toán VNPay
 *           example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
 *         vnpay_transaction_no:
 *           type: string
 *           description: Mã giao dịch VNPay
 *           example: "VNPAY123456789"
 *         vnpay_bank_code:
 *           type: string
 *           description: Mã ngân hàng VNPay
 *           example: "NCB"
 *         notes:
 *           type: string
 *           description: Ghi chú
 *           example: "Thanh toán thành công"
 *         refund_amount:
 *           type: number
 *           description: Số tiền hoàn lại
 *           example: 0
 *         refund_reason:
 *           type: string
 *           description: Lý do hoàn tiền
 *           example: "Không có phí phát sinh"
 *         refunded_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian hoàn tiền
 *           example: "2024-01-16T18:00:00.000Z"
 *         refunded_by:
 *           type: string
 *           description: ID nhân viên hoàn tiền
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         user_id:
 *           type: string
 *           description: ID người dùng
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         booking_id:
 *           type: string
 *           description: ID booking
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         rental_id:
 *           type: string
 *           description: ID rental
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         processed_by:
 *           type: string
 *           description: ID nhân viên xử lý
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         is_active:
 *           type: boolean
 *           description: Payment có đang hoạt động không
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 *           example: "2024-01-15T09:00:00.000Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian cập nhật cuối
 *           example: "2024-01-15T09:30:00.000Z"
     
 *     CreatePaymentRequest:
 *       type: object
 *       required:
 *         - booking_id
 *         - payment_type
 *         - payment_method
 *       properties:
 *         booking_id:
 *           type: string
 *           description: ID của booking
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         payment_type:
 *           type: string
 *           enum: [deposit, rental_fee, additional_fee]
 *           description: Loại thanh toán
 *           example: "rental_fee"
 *           x-enumNames: ["Cọc xe", "Phí thuê xe", "Phí phát sinh"]
 *           x-enum-varnames: [DEPOSIT, RENTAL_FEE, ADDITIONAL_FEE]
 *         amount:
 *           type: number
 *           minimum: 0
 *           description: Số tiền thanh toán (VND) - Bắt buộc cho additional_fee, tự động tính cho deposit/rental_fee
 *           example: 150000
 *         payment_method:
 *           type: string
 *           enum: [cash, qr_code, bank_transfer, vnpay]
 *           description: Phương thức thanh toán
 *           example: "vnpay"
 *           x-enumNames: ["Tiền mặt", "QR Code", "Chuyển khoản", "VNPay"]
 *           x-enum-varnames: [CASH, QR_CODE, BANK_TRANSFER, VNPAY]
 *         reason:
 *           type: string
 *           description: Lý do phí phát sinh (cho additional_fee)
 *           example: "Phí trễ giờ"
 *         notes:
 *           type: string
 *           description: Ghi chú
 *           example: "Thanh toán cọc"
 *     
 *     ConfirmPaymentRequest:
 *       type: object
 *       properties:
 *         transaction_id:
 *           type: string
 *           description: Mã giao dịch từ ngân hàng/app
 *           example: "TXN123456789"
 *         notes:
 *           type: string
 *           description: Ghi chú bổ sung
 *           example: "Thanh toán thành công"
 *     
 *     CancelPaymentRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           description: Lý do hủy thanh toán
 *           example: "Khách hàng không thanh toán"
 *     
 *     RefundPaymentRequest:
 *       type: object
 *       required:
 *         - refund_amount
 *       properties:
 *         refund_amount:
 *           type: number
 *           minimum: 0
 *           description: Số tiền hoàn lại (VND)
 *           example: 150000
 *         refund_reason:
 *           type: string
 *           description: Lý do hoàn tiền
 *           example: "Không có phí phát sinh"
 *         refund_method:
 *           type: string
 *           enum: [cash, bank_transfer]
 *           description: Phương thức hoàn tiền
 *           example: "bank_transfer"
 *     
 *     PaymentResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Tạo payment thành công"
 *         payment:
 *           $ref: '#/components/schemas/Payment'
 *         qrData:
 *           type: object
 *           description: QR Code data (nếu có)
 *           properties:
 *             qrData:
 *               type: string
 *               description: Dữ liệu QR Code
 *             qrImageUrl:
 *               type: string
 *               description: URL hình ảnh QR Code
 *             qrText:
 *               type: string
 *               description: Văn bản hiển thị cho customer
 *     
 *     PaymentListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy danh sách payments thành công"
 *         payments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Payment'
 *         summary:
 *           type: object
 *           description: Payment summary (chỉ có trong my-payments)
 *           properties:
 *             totalAmount:
 *               type: number
 *               description: Tổng số tiền
 *             paidAmount:
 *               type: number
 *               description: Số tiền đã thanh toán
 *             pendingAmount:
 *               type: number
 *               description: Số tiền chờ thanh toán
 *             refundAmount:
 *               type: number
 *               description: Số tiền đã hoàn
 *             paymentTypes:
 *               type: object
 *               description: Thống kê theo loại thanh toán
 *             paymentMethods:
 *               type: object
 *               description: Thống kê theo phương thức thanh toán
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               description: Tổng số records
 *               example: 50
 *             page:
 *               type: number
 *               description: Trang hiện tại
 *               example: 1
 *             limit:
 *               type: number
 *               description: Số lượng mỗi trang
 *               example: 10
 *             pages:
 *               type: number
 *               description: Tổng số trang
 *               example: 5
 *             timestamp:
 *               type: string
 *               description: Thời gian lấy dữ liệu
 *               example: "25/01/2025 14:30:00"
 *     
 *     PaymentDetailsResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy chi tiết payment thành công"
 *         payment:
 *           $ref: '#/components/schemas/Payment'
 *     
 *     RefundPaymentResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Hoàn tiền thành công"
 *         originalPayment:
 *           $ref: '#/components/schemas/Payment'
 *         refundPayment:
 *           $ref: '#/components/schemas/Payment'
 *     
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Error message
 *           example: "Dữ liệu không hợp lệ"
 *         error:
 *           type: string
 *           description: Error details
 *           example: "Validation failed"
 *         code:
 *           type: string
 *           description: Error code
 *           example: "VALIDATION_ERROR"
 */
