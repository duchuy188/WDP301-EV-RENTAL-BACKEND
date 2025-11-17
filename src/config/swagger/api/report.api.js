/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Quản lý báo cáo sự cố
 */

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Tạo báo cáo sự cố mới (USER)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - rental_id
 *               - issue_type
 *               - description
 *             properties:
 *               rental_id:
 *                 type: string
 *               issue_type:
 *                 type: string
 *                 enum: [vehicle_breakdown, battery_issue, accident, other]
 *               description:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Tạo báo cáo thành công
 *       404:
 *         description: Không tìm thấy rental đang hoạt động
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/reports/my-reports:
 *   get:
 *     summary: Xem danh sách báo cáo của mình (USER)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Danh sách báo cáo
 *       500:
 *         description: Lỗi server
 */

module.exports = {};

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Xem tất cả báo cáo (STAFF/ADMIN - Staff chỉ xem trạm mình)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, resolved]
 *       - in: query
 *         name: issue_type
 *         schema:
 *           type: string
 *           enum: [vehicle_breakdown, battery_issue, accident, other]
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Filter theo trạm (chỉ Admin)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách báo cáo
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/reports/stats:
 *   get:
 *     summary: Thống kê báo cáo (STAFF/ADMIN - Staff chỉ thống kê trạm mình)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Filter theo trạm (chỉ Admin)
 *     responses:
 *       200:
 *         description: Thống kê báo cáo
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Xem chi tiết báo cáo (STAFF chỉ xem trạm mình)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết báo cáo
 *       403:
 *         description: Không có quyền xem
 *       404:
 *         description: Không tìm thấy báo cáo
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/reports/{id}/resolve:
 *   put:
 *     summary: Giải quyết báo cáo (STAFF chỉ resolve trạm mình)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResolveReportInput'
 *     responses:
 *       200:
 *         description: Giải quyết báo cáo thành công
 *       400:
 *         description: Báo cáo đã được giải quyết hoặc thiếu ghi chú
 *       403:
 *         description: Không có quyền xử lý
 *       404:
 *         description: Không tìm thấy báo cáo
 *       500:
 *         description: Lỗi server
 */
