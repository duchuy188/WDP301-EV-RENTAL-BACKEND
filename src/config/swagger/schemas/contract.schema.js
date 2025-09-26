/**
 * @swagger
 * components:
 *   schemas:
 *     Contract:
 *       type: object
 *       required:
 *         - code
 *         - rental_id
 *         - user_id
 *         - vehicle_id
 *         - station_id
 *         - template_id
 *         - title
 *         - content
 *         - terms
 *         - valid_from
 *         - valid_until
 *         - staff_signed_by
 *         - created_by
 *       properties:
 *         _id:
 *           type: string
 *           description: Contract ID
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         code:
 *           type: string
 *           description: Contract code
 *           example: "CT12345678"
 *         title:
 *           type: string
 *           description: Tiêu đề contract
 *           example: "Hợp đồng thuê xe điện"
 *         status:
 *           type: string
 *           enum: [pending, signed, cancelled, expired]
 *           description: Trạng thái contract
 *           example: "pending"
 *         content:
 *           type: string
 *           description: Nội dung contract (HTML)
 *           example: "<h1>Hợp đồng thuê xe điện</h1><p>Nội dung...</p>"
 *         terms:
 *           type: string
 *           description: Điều khoản contract
 *           example: "1. Khách hàng cam kết sử dụng xe đúng mục đích..."
 *         special_conditions:
 *           type: string
 *           description: Điều kiện đặc biệt
 *           example: "Khách hàng VIP - Ưu tiên hỗ trợ 24/7"
 *         notes:
 *           type: string
 *           description: Ghi chú
 *           example: "Contract cho khách hàng thân thiết"
 *         customer_signature:
 *           type: string
 *           description: Chữ ký khách hàng (base64)
 *           example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *         staff_signature:
 *           type: string
 *           description: Chữ ký nhân viên (base64)
 *           example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *         customer_signed_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian khách hàng ký
 *           example: "2024-01-16T18:00:00.000Z"
 *         staff_signed_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian nhân viên ký
 *           example: "2024-01-16T17:00:00.000Z"
 *         valid_from:
 *           type: string
 *           format: date-time
 *           description: Ngày bắt đầu hiệu lực
 *           example: "2024-01-16T00:00:00.000Z"
 *         valid_until:
 *           type: string
 *           format: date-time
 *           description: Ngày kết thúc hiệu lực
 *           example: "2024-01-20T00:00:00.000Z"
 *         contract_file_url:
 *           type: string
 *           description: URL file PDF contract
 *           example: "https://res.cloudinary.com/example/contract-CT12345678.pdf"
 *         contract_file_public_id:
 *           type: string
 *           description: Cloudinary public ID
 *           example: "ev-rental/contracts/contract-CT12345678"
 *         rental_id:
 *           type: string
 *           description: ID rental
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         user_id:
 *           type: string
 *           description: ID khách hàng
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         vehicle_id:
 *           type: string
 *           description: ID xe
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         station_id:
 *           type: string
 *           description: ID trạm thuê
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         template_id:
 *           type: string
 *           description: ID template
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         staff_signed_by:
 *           type: string
 *           description: ID nhân viên ký
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         customer_signed_by:
 *           type: string
 *           description: ID khách hàng ký
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         created_by:
 *           type: string
 *           description: ID người tạo
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         is_active:
 *           type: boolean
 *           description: Contract có đang hoạt động không
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
 *     
 *     CreateContractRequest:
 *       type: object
 *       required:
 *         - rental_id
 *       properties:
 *         rental_id:
 *           type: string
 *           description: ID của rental
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         template_id:
 *           type: string
 *           description: ID của contract template (optional)
 *           example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *         special_conditions:
 *           type: string
 *           description: Điều kiện đặc biệt
 *           example: "Khách hàng VIP - Ưu tiên hỗ trợ 24/7"
 *         notes:
 *           type: string
 *           description: Ghi chú thêm
 *           example: "Contract cho khách hàng thân thiết"
 *     
 *     SignContractRequest:
 *       type: object
 *       required:
 *         - signature
 *         - signature_type
 *       properties:
 *         signature:
 *           type: string
 *           description: Chữ ký điện tử (base64)
 *           example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *         signature_type:
 *           type: string
 *           enum: [staff, customer]
 *           description: Loại chữ ký
 *           example: "staff"
 *     
 *     CancelContractRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           description: Lý do hủy contract
 *           example: "Khách hàng không đồng ý với điều khoản"
 *     
 *     ContractResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Tạo contract thành công"
 *         contract:
 *           $ref: '#/components/schemas/Contract'
 *     
 *     ContractDetailsResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy chi tiết contract thành công"
 *         contract:
 *           $ref: '#/components/schemas/Contract'
 *     
 *     ContractListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           description: Response message
 *           example: "Lấy danh sách contracts thành công"
 *         contracts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Contract'
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
 *     
 *     ContractTemplate:
 *       type: object
 *       required:
 *         - code
 *         - name
 *         - title
 *         - content_template
 *         - terms_template
 *         - created_by
 *       properties:
 *         _id:
 *           type: string
 *           description: Template ID
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         code:
 *           type: string
 *           description: Template code
 *           example: "TPL001"
 *         name:
 *           type: string
 *           description: Tên template
 *           example: "Template thuê xe điện cơ bản"
 *         title:
 *           type: string
 *           description: Tiêu đề template
 *           example: "Hợp đồng thuê xe điện"
 *         description:
 *           type: string
 *           description: Mô tả template
 *           example: "Template chuẩn cho thuê xe điện"
 *         content_template:
 *           type: string
 *           description: Template nội dung (HTML với placeholders)
 *           example: "<h1>{{title}}</h1><p>Khách hàng: {{customer_name}}</p>"
 *         terms_template:
 *           type: string
 *           description: Template điều khoản
 *           example: "1. Khách hàng {{customer_name}} cam kết..."
 *         placeholders:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 description: Placeholder key
 *                 example: "{{customer_name}}"
 *               label:
 *                 type: string
 *                 description: Placeholder label
 *                 example: "Tên khách hàng"
 *               type:
 *                 type: string
 *                 enum: [text, date, number, currency]
 *                 description: Placeholder type
 *                 example: "text"
 *               required:
 *                 type: boolean
 *                 description: Placeholder có bắt buộc không
 *                 example: true
 *         status:
 *           type: string
 *           enum: [active, inactive, draft]
 *           description: Trạng thái template
 *           example: "active"
 *         default_valid_days:
 *           type: number
 *           description: Số ngày hiệu lực mặc định
 *           example: 7
 *         created_by:
 *           type: string
 *           description: ID người tạo
 *           example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *         is_active:
 *           type: boolean
 *           description: Template có đang hoạt động không
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
 */



