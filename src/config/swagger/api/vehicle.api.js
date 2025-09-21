/**
 * @swagger
 * tags:
 *   name: Vehicles
 *   description: Quản lý xe
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Vehicle:
 *       type: object
 *       required:
 *         - name
 *         - model
 *         - year
 *         - color
 *         - type
 *         - battery_capacity
 *         - max_range
 *         - current_battery
 *         - price_per_day
 *         - deposit_amount
 *       properties:
 *         _id:
 *           type: string
 *           description: ID của xe
 *         name:
 *           type: string
 *           description: Tên xe (VH001, VH002, ...)
 *         license_plate:
 *           type: string
 *           description: Biển số xe (51A-123.45)
 *         brand:
 *           type: string
 *           description: Hãng xe (mặc định là VinFast)
 *         model:
 *           type: string
 *           description: Model xe
 *         year:
 *           type: number
 *           description: Năm sản xuất
 *         color:
 *           type: string
 *           description: Màu xe
 *         type:
 *           type: string
 *           enum: [scooter, motorcycle]
 *           description: Loại xe
 *         battery_capacity:
 *           type: number
 *           description: Dung lượng pin (kWh)
 *         max_range:
 *           type: number
 *           description: Quãng đường tối đa (km)
 *         current_battery:
 *           type: number
 *           description: Phần trăm pin hiện tại (0-100)
 *         price_per_day:
 *           type: number
 *           description: Giá thuê mỗi ngày (VND)
 *         deposit_amount:
 *           type: number
 *           description: Tiền đặt cọc (VND)
 *         station_id:
 *           type: string
 *           description: ID của trạm
 *         status:
 *           type: string
 *           enum: [draft, available, rented, maintenance]
 *           description: Trạng thái xe
 *         technical_status:
 *           type: string
 *           enum: [good, needs_maintenance]
 *           description: Tình trạng kỹ thuật
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách URL ảnh xe
 *         created_by:
 *           type: string
 *           description: ID người tạo
 *         is_active:
 *           type: boolean
 *           description: Trạng thái hoạt động
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian cập nhật gần nhất
 *       example:
 *         _id: "60d5ec9af682fbd12a0bbaf1"
 *         name: "VH001"
 *         license_plate: "51A-123.45"
 *         brand: "VinFast"
 *         model: "Klara S"
 *         year: 2023
 *         color: "Đỏ"
 *         type: "scooter"
 *         battery_capacity: 2.3
 *         max_range: 80
 *         current_battery: 85
 *         price_per_day: 150000
 *         deposit_amount: 2000000
 *         station_id: "60d5ec9af682fbd12a0bbaf2"
 *         status: "available"
 *         technical_status: "good"
 *         images: ["https://res.cloudinary.com/demo/image/upload/v1624291234/vehicles/vehicle1.jpg"]
 *         created_by: "60d5ec9af682fbd12a0bbaf3"
 *         is_active: true
 *         createdAt: "2023-06-21T15:30:45.123Z"
 *         updatedAt: "2023-06-22T10:15:30.456Z"
 */

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Lấy danh sách xe
 *     tags: [Vehicles]
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
 *           enum: [draft, available, rented, maintenance]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Lọc theo màu
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scooter, motorcycle]
 *         description: Lọc theo loại xe
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Lọc theo trạm
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Sắp xếp theo trường
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *     responses:
 *       200:
 *         description: Danh sách xe
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Lấy chi tiết xe
 *     tags: [Vehicles]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     responses:
 *       200:
 *         description: Chi tiết xe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Vehicle'
 *       404:
 *         description: Không tìm thấy xe
 */

/**
 * @swagger
 * /api/vehicles/bulk-create:
 *   post:
 *     summary: Tạo xe hàng loạt và xuất Excel template
 *     description: Tạo nhiều xe cùng loại và màu, sau đó có thể xuất Excel template để nhập biển số
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *               - year
 *               - color
 *               - type
 *               - battery_capacity
 *               - max_range
 *               - price_per_day
 *               - deposit_amount
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model xe (Klara S)
 *               year:
 *                 type: number
 *                 description: Năm sản xuất
 *               color:
 *                 type: string
 *                 description: Màu xe
 *               type:
 *                 type: string
 *                 enum: [scooter, motorcycle]
 *                 description: Loại xe
 *               battery_capacity:
 *                 type: number
 *                 description: Dung lượng pin (kWh)
 *               max_range:
 *                 type: number
 *                 description: Quãng đường tối đa (km)
 *               current_battery:
 *                 type: number
 *                 default: 100
 *                 description: Phần trăm pin hiện tại (0-100)
 *               price_per_day:
 *                 type: number
 *                 description: Giá thuê mỗi ngày (VND)
 *               deposit_amount:
 *                 type: number
 *                 description: Tiền đặt cọc (VND)
 *               quantity:
 *                 type: number
 *                 default: 1
 *                 description: Số lượng xe cần tạo
 *               export_excel:
 *                 type: boolean
 *                 default: true
 *                 description: Xuất Excel template sau khi tạo xe
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hình ảnh xe
 *     responses:
 *       200:
 *         description: File Excel template (khi export_excel=true)
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       201:
 *         description: Danh sách xe đã tạo (khi export_excel=false)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện
 */

/**
 * @swagger
 * /api/vehicles/import-license-plates:
 *   post:
 *     summary: Import biển số từ file Excel
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - excel_file
 *             properties:
 *               excel_file:
 *                 type: string
 *                 format: binary
 *                 description: File Excel chứa biển số
 *     responses:
 *       200:
 *         description: Import thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện
 */

/**
 * @swagger
 * /api/vehicles/assign-by-quantity:
 *   post:
 *     summary: Phân bổ xe theo số lượng
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *               - station_id
 *             properties:
 *               color:
 *                 type: string
 *                 description: Màu xe cần phân bổ
 *               status:
 *                 type: string
 *                 default: draft
 *                 description: Trạng thái xe cần phân bổ
 *               quantity:
 *                 type: number
 *                 description: Số lượng xe cần phân bổ
 *               station_id:
 *                 type: string
 *                 description: ID trạm đích
 *     responses:
 *       200:
 *         description: Phân bổ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc không đủ xe
 *       403:
 *         description: Không có quyền thực hiện
 *       404:
 *         description: Không tìm thấy trạm
 */

/**
 * @swagger
 * /api/vehicles/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái xe
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, available, rented, maintenance]
 *               maintenance_reason:
 *                 type: string
 *                 description: Lý do bảo trì (bắt buộc khi chuyển sang maintenance)
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Mức độ ưu tiên bảo trì
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy xe
 */

/**
 * @swagger
 * /api/vehicles/{id}/battery:
 *   patch:
 *     summary: Cập nhật pin xe
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_battery
 *             properties:
 *               current_battery:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Phần trăm pin hiện tại
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy xe
 */

/**
 * @swagger
 * /api/vehicles/{id}/maintenance:
 *   post:
 *     summary: Báo cáo bảo trì xe
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do bảo trì
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Mức độ ưu tiên
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hình ảnh lỗi
 *     responses:
 *       201:
 *         description: Báo cáo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy xe
 */

/**
 * @swagger
 * /api/vehicles/statistics:
 *   get:
 *     summary: Thống kê xe
 *     tags: [Vehicles]
 *     responses:
 *       200:
 *         description: Thống kê thành công
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Cập nhật thông tin xe
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               license_plate:
 *                 type: string
 *                 description: Biển số xe (VD 51A-123.45)
 *               name:
 *                 type: string
 *                 description: Tên xe
 *               model:
 *                 type: string
 *                 description: Model xe
 *               year:
 *                 type: number
 *                 description: Năm sản xuất
 *               color:
 *                 type: string
 *                 description: Màu xe
 *               type:
 *                 type: string
 *                 enum: [scooter, motorcycle]
 *                 description: Loại xe
 *               battery_capacity:
 *                 type: number
 *                 description: Dung lượng pin (kWh)
 *               max_range:
 *                 type: number
 *                 description: Quãng đường tối đa (km)
 *               current_battery:
 *                 type: number
 *                 description: Phần trăm pin hiện tại (0-100)
 *               price_per_day:
 *                 type: number
 *                 description: Giá thuê mỗi ngày (VND)
 *               deposit_amount:
 *                 type: number
 *                 description: Tiền đặt cọc (VND)
 *               technical_status:
 *                 type: string
 *                 enum: [good, needs_maintenance]
 *                 description: Tình trạng kỹ thuật
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Hình ảnh xe
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cập nhật thông tin xe thành công
 *                 vehicle:
 *                   $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền thực hiện
 *       404:
 *         description: Không tìm thấy xe
 */

/**
 * @swagger
 * /api/vehicles/staff:
 *   get:
 *     summary: Lấy danh sách xe cho nhân viên trạm
 *     description: Staff chỉ thấy xe của trạm mình, không thấy xe draft
 *     tags: [Vehicles]
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
 *           enum: [available, rented, maintenance]
 *         description: Lọc theo trạng thái (không bao gồm draft)
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Lọc theo màu
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scooter, motorcycle]
 *         description: Lọc theo loại xe
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: number
 *                     rented:
 *                       type: number
 *                     maintenance:
 *                       type: number
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     pages:
 *                       type: number
 */

/**
 * @swagger
 * /api/vehicles/admin:
 *   get:
 *     summary: Lấy danh sách xe cho admin
 *     description: Admin thấy tất cả xe trong hệ thống
 *     tags: [Vehicles]
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
 *           enum: [draft, available, rented, maintenance]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: color
 *         schema:
 *           type: string
 *         description: Lọc theo màu
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [scooter, motorcycle]
 *         description: Lọc theo loại xe
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Lọc theo trạm
 *     responses:
 *       200:
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vehicle'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     pages:
 *                       type: number
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Xóa xe (Soft Delete)
 *     description: Đánh dấu xe là không hoạt động (is_active = false) và cập nhật số lượng xe tại trạm
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của xe
 *     responses:
 *       200:
 *         description: Xóa xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Xóa xe thành công
 *       403:
 *         description: Không có quyền thực hiện (chỉ Admin)
 *       404:
 *         description: Không tìm thấy xe
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/vehicles/export-pricing-template:
 *   post:
 *     summary: Export Excel template cho bulk pricing update
 *     description: Tạo file Excel template để cập nhật giá xe hàng loạt
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model:
 *                 type: string
 *                 description: Model xe cần update giá
 *                 example: Klara S
 *               color:
 *                 type: string
 *                 description: Màu xe cần update giá
 *                 example: Đỏ
 *               year:
 *                 type: number
 *                 description: Năm sản xuất xe cần update giá
 *                 example: 2024
 *     responses:
 *       200:
 *         description: File Excel template
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Không tìm thấy xe phù hợp
 *       403:
 *         description: Không có quyền thực hiện
 */

/**
 * @swagger
 * /api/vehicles/import-pricing-updates:
 *   post:
 *     summary: Import và cập nhật giá từ Excel
 *     description: Đọc file Excel và cập nhật giá xe hàng loạt
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - excel_file
 *             properties:
 *               excel_file:
 *                 type: string
 *                 format: binary
 *                 description: File Excel chứa thông tin giá mới
 *     responses:
 *       200:
 *         description: Cập nhật giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 updated:
 *                   type: number
 *                   example: 15
 *                 failed:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: Đã cập nhật giá cho 15 xe thành công
 *                 statusStats:
 *                   type: object
 *                   properties:
 *                     available:
 *                       type: number
 *                       example: 10
 *                     maintenance:
 *                       type: number
 *                       example: 5
 *                 details:
 *                   type: object
 *                   properties:
 *                     successes:
 *                       type: array
 *                       items:
 *                         type: object
 *                     failures:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc có lỗi trong file Excel
 *       403:
 *         description: Không có quyền thực hiện
 */

module.exports = {
  
  };