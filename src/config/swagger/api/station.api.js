/**
 * @swagger
 * tags:
 *   name: Station
 *   description: API quản lý trạm thuê xe
 */

/**
 * @swagger
 * /api/stations:
 *   get:
 *     summary: Lấy danh sách trạm thuê xe
 *     tags: [Station]
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
 *         description: Số lượng item mỗi trang
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Lọc theo thành phố
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: Lọc theo quận/huyện
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên hoặc địa chỉ
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, available]
 *           default: name
 *         description: Sắp xếp theo
 *     responses:
 *       200:
 *         description: Lấy danh sách trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stations:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Station'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/{id}:
 *   get:
 *     summary: Lấy chi tiết trạm thuê xe
 *     tags: [Station]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của trạm
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scooter, motorcycle]
 *         description: Lọc xe theo loại
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, rented, maintenance]
 *         description: Lọc xe theo trạng thái
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, price]
 *           default: name
 *         description: Sắp xếp xe theo
 *     responses:
 *       200:
 *         description: Lấy chi tiết trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 station:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Station'
 *                     - type: object
 *                       properties:
 *                         vehicles:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/VehicleSummary'
 *                         staff_count:
 *                           type: integer
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations:
 *   post:
 *     summary: Tạo trạm thuê xe mới (tự động generate code)
 *     description: Hệ thống sẽ tự động tạo code ST001, ST002, ST003... theo thứ tự
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Trạm thuê xe VinFast Quận 1"
 *               address:
 *                 type: string
 *                 example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *               district:
 *                 type: string
 *                 example: "Quận 1"
 *               city:
 *                 type: string
 *                 example: "TP.HCM"
 *               description:
 *                 type: string
 *                 example: "Trạm thuê xe điện VinFast tại trung tâm Quận 1, gần chợ Bến Thành"
 *               phone:
 *                 type: string
 *                 example: "0123456789"
 *               email:
 *                 type: string
 *                 example: "station001@vinfast.vn"
 *               opening_time:
 *                 type: string
 *                 example: "06:00"
 *               closing_time:
 *                 type: string
 *                 example: "22:00"
 *               max_capacity:
 *                 type: integer
 *                 example: 50
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hình ảnh của trạm (tối đa 10 ảnh, tùy chọn)
 *             required:
 *               - name
 *               - address
 *               - district
 *               - city
 *               - phone
 *               - email
 *               - opening_time
 *               - closing_time
 *               - max_capacity
 *     responses:
 *       201:
 *         description: Tạo trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã tạo station thành công"
 *                 station:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/{id}:
 *   put:
 *     summary: Cập nhật thông tin trạm thuê xe
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của trạm
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Trạm thuê xe VinFast Quận 1 - Cập nhật"
 *               address:
 *                 type: string
 *                 example: "456 Nguyễn Huệ, Quận 1, TP.HCM"
 *               district:
 *                 type: string
 *                 example: "Quận 1"
 *               city:
 *                 type: string
 *                 example: "TP.HCM"
 *               description:
 *                 type: string
 *                 example: "Trạm thuê xe điện VinFast tại trung tâm Quận 1, gần chợ Bến Thành - Cập nhật"
 *               phone:
 *                 type: string
 *                 example: "0987654321"
 *               email:
 *                 type: string
 *                 example: "station001@vinfast.vn"
 *               opening_time:
 *                 type: string
 *                 example: "07:00"
 *               closing_time:
 *                 type: string
 *                 example: "23:00"
 *               max_capacity:
 *                 type: integer
 *                 example: 60
 *               status:
 *                 $ref: '#/components/schemas/StationStatus'
 *                 description: Trạng thái trạm
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hình ảnh mới để thêm vào trạm (tùy chọn)
 *     responses:
 *       200:
 *         description: Cập nhật trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã cập nhật station thành công"
 *                 station:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/{id}:
 *   delete:
 *     summary: Xóa trạm thuê xe (đánh dấu không hoạt động)
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của trạm
 *     responses:
 *       200:
 *         description: Xóa trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã đánh dấu station không hoạt động"
 *                 station:
 *                   $ref: '#/components/schemas/Station'
 *       400:
 *         description: Không thể xóa trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/{id}/sync:
 *   post:
 *     summary: Đồng bộ số lượng xe trong trạm
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của trạm
 *     responses:
 *       200:
 *         description: Đồng bộ thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã đồng bộ số lượng xe thành công"
 *                 station:
 *                   $ref: '#/components/schemas/Station'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/sync-all:
 *   post:
 *     summary: Đồng bộ số lượng xe cho tất cả trạm
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đồng bộ tất cả trạm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã đồng bộ tất cả stations thành công"
 *                 result:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Đã sync tất cả stations"
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/stations/{id}/staff:
 *   get:
 *     summary: Lấy danh sách nhân viên của trạm
 *     tags: [Station]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của trạm
 *     responses:
 *       200:
 *         description: Lấy danh sách nhân viên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 station:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     name:
 *                       type: string
 *                 staff:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserSummary'
 *                 count:
 *                   type: integer
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */


