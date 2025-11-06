/**
 * @swagger
 * components:
 *   schemas:
 *     MaintenanceReport:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         code:
 *           type: string
 *           example: "MT123456"
 *         vehicle_id:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *             name:
 *               type: string
 *               example: "Xe điện Klara S"
 *             license_plate:
 *               type: string
 *               example: "51A-123.45"
 *             model:
 *               type: string
 *               example: "Klara S"
 *             type:
 *               type: string
 *               example: "scooter"
 *         station_id:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *             name:
 *               type: string
 *               example: "Trạm Quận 1"
 *             address:
 *               type: string
 *               example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *         maintenance_type:
 *           type: string
 *           enum: [low_battery, poor_condition]
 *           example: "poor_condition"
 *           description: "Loại bảo trì: low_battery (Staff tự fix) hoặc poor_condition (cần Admin)"
 *         title:
 *           type: string
 *           example: "Bảo trì xe Xe điện Klara S"
 *         description:
 *           type: string
 *           example: "Xe bị hỏng phanh trước"
 *         status:
 *           type: string
 *           enum: [reported, fixed]
 *           example: "reported"
 *         reported_by:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *             fullname:
 *               type: string
 *               example: "Nguyễn Văn A"
 *             email:
 *               type: string
 *               example: "nguyenvana@email.com"
 *         notes:
 *           type: string
 *           example: "Đã sửa xong phanh trước"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["image1.jpg", "image2.jpg"]
 *         is_active:
 *           type: boolean
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     MaintenanceStats:
 *       type: object
 *       properties:
 *         reported:
 *           type: number
 *           example: 5
 *         fixed:
 *           type: number
 *           example: 12
 */

/**
 * @swagger
 * /api/maintenance:
 *   get:
 *     summary: Lấy danh sách báo cáo bảo trì
 *     description: Lấy danh sách tất cả báo cáo bảo trì (Admin only)
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, reported, fixed]
 *           default: all
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: Lọc theo trạm
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, status]
 *           default: createdAt
 *         description: Sắp xếp theo
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MaintenanceReport'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 25
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         pages:
 *                           type: number
 *                           example: 3
 *                     stats:
 *                       $ref: '#/components/schemas/MaintenanceStats'
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/maintenance/station:
 *   get:
 *     summary: Lấy báo cáo bảo trì theo trạm
 *     description: Lấy báo cáo bảo trì của trạm hiện tại (Station Staff)
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, reported, fixed]
 *           default: all
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reports:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MaintenanceReport'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                           example: 8
 *                         page:
 *                           type: number
 *                           example: 1
 *                         limit:
 *                           type: number
 *                           example: 10
 *                         pages:
 *                           type: number
 *                           example: 1
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Station Staff mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/maintenance/{id}:
 *   get:
 *     summary: Lấy chi tiết báo cáo bảo trì
 *     description: Lấy thông tin chi tiết của một báo cáo bảo trì
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID báo cáo bảo trì
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/MaintenanceReport'
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Không có quyền truy cập
 *       404:
 *         description: Không tìm thấy báo cáo bảo trì
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/maintenance/{id}:
 *   put:
 *     summary: Cập nhật trạng thái báo cáo bảo trì
 *     description: |
 *       Cập nhật trạng thái và ghi chú của báo cáo bảo trì.
 *       
 *       **Phân quyền:**
 *       - **Staff**: Chỉ được fix maintenance_type = "low_battery" (sạc pin). Phải sạc pin đến 80%+ trước khi đánh dấu fixed.
 *       - **Admin**: Có thể fix tất cả loại maintenance.
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID báo cáo bảo trì
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reported, fixed]
 *                 example: "fixed"
 *                 description: Trạng thái mới
 *               notes:
 *                 type: string
 *                 example: "Đã sửa xong phanh trước"
 *                 description: Ghi chú
 *               battery_level:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 85
 *                 description: |
 *                   Mức pin mới sau khi sạc/sửa (tùy chọn, 0-100%).
 *                   
 *                   **Bắt buộc** khi Staff fix low_battery (phải ≥ 80%).
 *                   
 *                   **Tùy chọn** cho Admin fix poor_condition.
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Ảnh sau khi sửa chữa (tùy chọn)
 *     responses:
 *       200:
 *         description: Cập nhật thành công
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
 *                   example: "Cập nhật trạng thái báo cáo bảo trì thành công"
 *                 data:
 *                   $ref: '#/components/schemas/MaintenanceReport'
 *       400:
 *         description: |
 *           Dữ liệu không hợp lệ, thiếu battery_level, hoặc pin chưa đủ 80%
 *           
 *           Examples:
 *           - `{ "success": false, "message": "Vui lòng nhập mức pin hiện tại (battery_level) khi hoàn thành sạc pin." }`
 *           - `{ "success": false, "message": "Mức pin phải đạt ít nhất 80% (hiện tại: 65%). Vui lòng sạc thêm trước khi đánh dấu hoàn thành." }`
 *           - `{ "success": false, "message": "Mức pin phải từ 0-100%" }`
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: |
 *           Staff chỉ được phép xử lý bảo trì PIN
 *           
 *           Example: `{ "success": false, "message": "Staff chỉ được phép xử lý bảo trì PIN. Vấn đề này cần Admin duyệt.", "maintenance_type": "poor_condition" }`
 *       404:
 *         description: Không tìm thấy báo cáo bảo trì
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/maintenance/{id}:
 *   delete:
 *     summary: Xóa báo cáo bảo trì (Soft Delete)      
 *       **Permission:** Admin only
 *       
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID báo cáo bảo trì
 *     responses:
 *       200:
 *         description: Xóa thành công
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
 *                   example: "Xóa báo cáo bảo trì thành công"
 *                 note:
 *                   type: string
 *                   example: "Soft delete - dữ liệu vẫn được giữ lại trong database"
 *                 vehicle_status_updated:
 *                   type: boolean
 *                   example: true
 *                   description: True nếu xe được chuyển về available
 *                 vehicle_name:
 *                   type: string
 *                   example: "VH001"
 *                   description: Tên xe liên quan
 *       400:
 *         description: |
 *           Báo cáo đã fixed không thể xóa
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
 *                   example: "Không thể xóa báo cáo đã hoàn thành"
 *                 reason:
 *                   type: string
 *                   example: "Báo cáo đã fixed là audit trail, không nên xóa"
 *                 suggestion:
 *                   type: string
 *                   example: "Chỉ có thể xóa báo cáo đang ở trạng thái \"reported\""
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền xóa báo cáo bảo trì
 *       404:
 *         description: Không tìm thấy báo cáo bảo trì hoặc đã bị xóa trước đó
 *       500:
 *         description: Lỗi server
 */
