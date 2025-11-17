/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       required:
 *         - code
 *         - rental_id
 *         - booking_id
 *         - user_id
 *         - vehicle_id
 *         - station_id
 *         - issue_type
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của report
 *         code:
 *           type: string
 *           description: Mã report (tự động random)
 *           example: "RPTX7K9M2"
 *         rental_id:
 *           type: string
 *           description: ID của rental
 *         booking_id:
 *           type: string
 *           description: ID của booking
 *         user_id:
 *           type: string
 *           description: ID của user báo cáo
 *         vehicle_id:
 *           type: string
 *           description: ID của xe bị sự cố
 *         station_id:
 *           type: string
 *           description: ID của trạm (để phân quyền)
 *         issue_type:
 *           type: string
 *           enum: [vehicle_breakdown, battery_issue, accident, other]
 *           description: Loại sự cố
 *           example: "battery_issue"
 *         description:
 *           type: string
 *           description: Mô tả chi tiết sự cố
 *           example: "Xe hết pin giữa đường, không thể di chuyển"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: URLs ảnh chụp sự cố
 *         status:
 *           type: string
 *           enum: [pending, resolved]
 *           default: pending
 *           description: Trạng thái xử lý
 *         resolution_notes:
 *           type: string
 *           description: Ghi chú xử lý của staff
 *         resolved_at:
 *           type: string
 *           format: date-time
 *           description: Thời gian giải quyết
 *         resolved_by:
 *           type: string
 *           description: ID staff giải quyết
 *         is_active:
 *           type: boolean
 *           default: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 * 
 *     CreateReportInput:
 *       type: object
 *       required:
 *         - rental_id
 *         - issue_type
 *         - description
 *       properties:
 *         rental_id:
 *           type: string
 *           description: ID của rental đang hoạt động
 *         issue_type:
 *           type: string
 *           enum: [vehicle_breakdown, battery_issue, accident, other]
 *           example: "battery_issue"
 *         description:
 *           type: string
 *           example: "Xe hết pin giữa đường"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: Ảnh chụp sự cố (tối đa 5 ảnh)
 * 
 *     ResolveReportInput:
 *       type: object
 *       required:
 *         - resolution_notes
 *       properties:
 *         resolution_notes:
 *           type: string
 *           example: "Đã thay pin mới cho xe, xe hoạt động bình thường"
 */

module.exports = {};
