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
 *         - deposit_percentage
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
 *         current_mileage:
 *           type: number
 *           description: Số km hiện tại của xe
 *           example: 1250
 *         price_per_day:
 *           type: number
 *           description: Giá thuê mỗi ngày (VND)
 *         deposit_percentage:
 *           type: number
 *           description: Phần trăm cọc so với tổng giá thuê (%)
 *         station_id:
 *           type: string
 *           description: ID của trạm
 *         status:
 *           type: string
 *           enum: [draft, available, reserved, rented, maintenance]
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
*         current_mileage: 1250
*         price_per_day: 150000
 *         deposit_percentage: 50
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
 *     summary: Lấy danh sách xe available cho customer
 *     description: API cho customer xem danh sách xe available, nhóm theo model và chỉ hiển thị 1 màu đại diện cho mỗi model. Chỉ hiển thị xe available tại các trạm để booking.
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
 *         name: model
 *         schema:
 *           type: string
 *         description: Lọc theo model xe
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
 *         description: Danh sách xe available - mỗi model hiển thị 1 màu đại diện
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "Klara S"
 *                         description: ID duy nhất của model (tên model)
 *                       model:
 *                         type: string
 *                         example: "Klara S"
 *                         description: Model xe để booking
 *                       color:
 *                         type: string
 *                         example: "Trắng"
 *                         description: Màu đại diện của model
 *                       brand:
 *                         type: string
 *                         example: "VinFast"
 *                       year:
 *                         type: number
 *                         example: 2024
 *                       type:
 *                         type: string
 *                         example: "scooter"
 *                       battery_capacity:
 *                         type: number
 *                         example: 2.3
 *                       max_range:
 *                         type: number
 *                         example: 80
 *                       price_per_day:
 *                         type: number
 *                         example: 150000
 *                       deposit_percentage:
 *                         type: number
 *                         example: 50
 *                       available_quantity:
 *                         type: number
 *                         example: 15
 *                         description: Tổng số xe available của tất cả màu trong model này
 *                       available_colors_count:
 *                         type: number
 *                         example: 5
 *                         description: Số màu có sẵn của model này
 *                       images:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["https://res.cloudinary.com/..."]
 *                         description: Ảnh của màu đại diện
 *                       sample_vehicle_id:
 *                         type: string
 *                         example: "60d5ec9af682fbd12a0bbaf1"
 *                         description: ID xe mẫu để xem chi tiết
 *                       stations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                               description: ID trạm có xe model này
 *                             name:
 *                               type: string
 *                               example: "Trạm VinFast Quận 1"
 *                             address:
 *                               type: string
 *                               example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *                       createdAt:
 *                         type: string
 *                         example: "15/01/2024 14:30:25"
 *                       updatedAt:
 *                         type: string
 *                         example: "15/01/2024 14:30:25"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Tổng số model xe available
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *                     timestamp:
 *                       type: string
 *                       example: "15/01/2024 14:30:25"
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Lấy chi tiết xe cho customer
 *     description: API cho customer xem chi tiết xe và tất cả màu available của cùng model. Chỉ hiển thị xe available tại trạm để booking.
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
 *         description: Chi tiết xe và tất cả màu available của model
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   description: ID xe hiện tại
 *                 model:
 *                   type: string
 *                   example: "Klara S"
 *                   description: Model xe
 *                 brand:
 *                   type: string
 *                   example: "VinFast"
 *                 year:
 *                   type: number
 *                   example: 2024
 *                 type:
 *                   type: string
 *                   example: "scooter"
 *                 battery_capacity:
 *                   type: number
 *                   example: 2.3
 *                 max_range:
 *                   type: number
 *                   example: 80
 *                 current_battery:
 *                   type: number
 *                   example: 85
 *                 deposit_percentage:
 *                   type: number
 *                   example: 50
 *                 technical_status:
 *                   type: string
 *                   example: "good"
 *                 selected_color:
 *                   type: string
 *                   example: "Trắng"
 *                   description: Màu của xe hiện tại được chọn
 *                 current_color_info:
 *                   type: object
 *                   properties:
 *                     color:
 *                       type: string
 *                       example: "Trắng"
 *                     images:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["https://res.cloudinary.com/..."]
 *                     price_per_day:
 *                       type: number
 *                       example: 150000
 *                     station:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                           example: "Trạm VinFast Quận 1"
 *                         address:
 *                           type: string
 *                           example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *                         phone:
 *                           type: string
 *                           example: "028 1234 5678"
 *                         email:
 *                           type: string
 *                           example: "q1@vinfast.com"
 *                         opening_time:
 *                           type: string
 *                           example: "06:00"
 *                         closing_time:
 *                           type: string
 *                           example: "22:00"
 *                 available_colors:
 *                   type: array
 *                   description: Tất cả màu available của model này
 *                   items:
 *                     type: object
 *                     properties:
 *                       color:
 *                         type: string
 *                         example: "Đỏ"
 *                       available_quantity:
 *                         type: number
 *                         example: 5
 *                         description: Số xe available của màu này
 *                       sample_vehicle_id:
 *                         type: string
 *                         example: "60d5ec9af682fbd12a0bbaf1"
 *                         description: ID xe mẫu của màu này
 *                       images:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["https://res.cloudinary.com/..."]
 *                         description: Ảnh của màu này
 *                       price_per_day:
 *                         type: number
 *                         example: 150000
 *                       stations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                               example: "Trạm VinFast Quận 1"
 *                             address:
 *                               type: string
 *                               example: "123 Nguyễn Huệ, Q1, TP.HCM"
 *                 total_colors:
 *                   type: number
 *                   example: 5
 *                   description: Tổng số màu có sẵn của model
 *                 total_available:
 *                   type: number
 *                   example: 20
 *                   description: Tổng số xe available của tất cả màu
 *                 createdAt:
 *                   type: string
 *                   example: "15/01/2024 14:30:25"
 *                 updatedAt:
 *                   type: string
 *                   example: "15/01/2024 14:30:25"
 *       404:
 *         description: Không tìm thấy xe hoặc xe không available để booking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Không tìm thấy xe"
 *       500:
 *         description: Lỗi server
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
 *               - deposit_percentage
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
 *               deposit_percentage:
 *                 type: number
 *                 description: Phần trăm cọc so với tổng giá thuê (%)
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
 *               model:
 *                 type: string
 *                 description: Model xe cần phân bổ
 *                 example: "Klara S"
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
 *     description: Cập nhật trạng thái xe với validation nghiêm ngặt. Xe ở trạng thái rented KHÔNG THỂ chuyển sang trạng thái nào khác bằng tay (chỉ hệ thống tự động cập nhật).
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
 *                 enum: [draft, available, reserved, rented, maintenance]
 *                 description: Trạng thái mới của xe
 *               maintenance_reason:
 *                 type: string
 *                 description: Lý do bảo trì (bắt buộc khi chuyển sang maintenance)
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
 *                   example: "Đã cập nhật trạng thái xe từ rented sang available"
 *                 vehicle:
 *                   $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc vi phạm business rules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     invalid_status:
 *                       value: "Trạng thái không hợp lệ"
 *                     invalid_transition:
 *                       value: "Không thể chuyển trạng thái từ rented sang trạng thái khác. Xe rented chỉ có thể thay đổi trạng thái bởi hệ thống tự động."
 *                     no_station:
 *                       value: "Xe phải được gán vào trạm trước khi đổi trạng thái thành available"
 *                     no_license_plate:
 *                       value: "Xe phải có biển số thật trước khi đổi trạng thái thành available"
 *                     technical_issue:
 *                       value: "Xe phải ở tình trạng kỹ thuật tốt trước khi đổi trạng thái thành available"
 *                     maintenance_reason_required:
 *                       value: "Vui lòng cung cấp lý do bảo trì"
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
 *     summary: Báo cáo bảo trì xe cho staff
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
 *               deposit_percentage:
 *                 type: number
 *                 description: Phần trăm cọc so với tổng giá thuê (%)
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
 *           enum: [available, reserved, rented, maintenance]
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
 * /api/vehicles/withdraw-from-station:
 *   post:
 *     summary: Rút xe từ trạm về trạng thái chưa phân bổ
 *     description: Admin rút xe available từ trạm để phân bổ lại sang trạm khác. Chỉ rút được xe available, không rút được xe maintenance hoặc rented.
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
 *               - station_id
 *               - quantity
 *             properties:
 *               station_id:
 *                 type: string
 *                 description: ID của trạm cần rút xe
 *                 example: "64f1a2b3c4d5e6f7g8h9i0j1"
 *               model:
 *                 type: string
 *                 description: Model xe (optional)
 *                 example: "VF8"
 *               color:
 *                 type: string
 *                 description: Màu xe (optional)
 *                 example: "Đỏ"
 *               quantity:
 *                 type: integer
 *                 description: Số lượng xe cần rút
 *                 example: 5
 *     responses:
 *       200:
 *         description: Rút xe thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Đã rút 5 xe (model VF8, màu Đỏ) từ trạm Trạm A"
 *                 withdrawn_count:
 *                   type: integer
 *                   example: 5
 *                 station:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     remaining_vehicles:
 *                       type: integer
 *                     remaining_available:
 *                       type: integer
 *                 vehicles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       model:
 *                         type: string
 *                       color:
 *                         type: string
 *                       status:
 *                         type: string
 *                         example: "draft"
 *       400:
 *         description: Lỗi validation hoặc không tìm thấy xe phù hợp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   examples:
 *                     missing_params:
 *                       value: "Vui lòng cung cấp station_id và quantity"
 *                     no_vehicles:
 *                       value: "Không tìm thấy xe available để rút với điều kiện: model VF8, màu Đỏ"
 *       403:
 *         description: Không có quyền admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bạn không có quyền thực hiện hành động này"
 *       404:
 *         description: Không tìm thấy trạm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Không tìm thấy trạm"
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/vehicles/staff/{id}:
 *   get:
 *     summary: Lấy chi tiết xe cho staff
 *     description: API cho staff xem chi tiết xe của trạm mình với thông tin quyền hạn
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
 *         description: Chi tiết xe cho staff
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vehicle:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Vehicle'
 *                     - type: object
 *                       properties:
 *                         staff_info:
 *                           type: object
 *                           properties:
 *                             can_update:
 *                               type: boolean
 *                               description: Có thể cập nhật thông tin xe không
 *                             can_change_status:
 *                               type: boolean
 *                               description: Có thể thay đổi trạng thái xe không
 *                             can_report_maintenance:
 *                               type: boolean
 *                               description: Có thể báo cáo bảo trì xe không
 *                             can_delete:
 *                               type: boolean
 *                               description: Có thể xóa xe không
 *                         has_license_plate:
 *                           type: boolean
 *                           description: Xe có biển số thật hay không
 *       403:
 *         description: Không có quyền xem xe này (xe không thuộc trạm của staff)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bạn không có quyền xem xe này. Xe không thuộc trạm của bạn."
 *       404:
 *         description: Không tìm thấy xe hoặc xe đã bị xóa
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/vehicles/admin:
 *   get:
 *     summary: Lấy danh sách xe cho admin
 *     description: API cho admin xem tất cả xe trong hệ thống (bao gồm draft, available, reserved, rented, maintenance)
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
 *           enum: [draft, available, reserved, rented, maintenance]
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
 *         description: Danh sách xe cho admin
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
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Không có quyền admin
 *       500:
 *         description: Lỗi server
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