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
 *           example: 60d5ec9af682fbd12a0bbaf1
 *         name:
 *           type: string
 *           description: Tên xe (VH001, VH002, ...)
 *           example: VH001
 *         license_plate:
 *           type: string
 *           description: Biển số xe (51A-123.45)
 *           example: 51A-123.45
 *         brand:
 *           type: string
 *           description: Hãng xe (mặc định là VinFast)
 *           example: VinFast
 *         model:
 *           type: string
 *           description: Model xe
 *           example: Klara S
 *         year:
 *           type: number
 *           description: Năm sản xuất
 *           example: 2023
 *         color:
 *           type: string
 *           description: Màu xe
 *           example: Đỏ
 *         type:
 *           type: string
 *           enum: [scooter, motorcycle]
 *           description: Loại xe
 *           example: scooter
 *         battery_capacity:
 *           type: number
 *           description: Dung lượng pin (kWh)
 *           example: 2.3
 *         max_range:
 *           type: number
 *           description: Quãng đường tối đa (km)
 *           example: 80
 *         current_battery:
 *           type: number
 *           description: Phần trăm pin hiện tại (0-100)
 *           example: 85
 *         price_per_day:
 *           type: number
 *           description: Giá thuê mỗi ngày (VND)
 *           example: 150000
 *         deposit_amount:
 *           type: number
 *           description: Tiền đặt cọc (VND)
 *           example: 2000000
 *         station_id:
 *           type: string
 *           description: ID của trạm
 *           example: 60d5ec9af682fbd12a0bbaf2
 *         status:
 *           type: string
 *           enum: [draft, available, rented, maintenance]
 *           description: Trạng thái xe
 *           example: available
 *         technical_status:
 *           type: string
 *           enum: [good, needs_maintenance]
 *           description: Tình trạng kỹ thuật
 *           example: good
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách URL ảnh xe
 *           example: ["https://res.cloudinary.com/demo/image/upload/v1624291234/vehicles/vehicle1.jpg"]
 *         main_image:
 *           type: string
 *           description: URL ảnh chính của xe
 *           example: "https://res.cloudinary.com/demo/image/upload/v1624291234/vehicles/vehicle1.jpg"
 *         created_by:
 *           type: string
 *           description: ID người tạo
 *           example: 60d5ec9af682fbd12a0bbaf3
 *         is_active:
 *           type: boolean
 *           description: Trạng thái hoạt động
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian tạo
 *           example: "2023-06-21T15:30:45.123Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Thời gian cập nhật gần nhất
 *           example: "2023-06-22T10:15:30.456Z"
 *     
 *     VehicleBulkCreate:
 *       type: object
 *       required:
 *         - name
 *         - model
 *         - year
 *         - color
 *         - type
 *         - battery_capacity
 *         - max_range
 *         - price_per_day
 *         - deposit_amount
 *       properties:
 *         name:
 *           type: string
 *           description: Tên xe cơ bản
 *           example: VinFast Klara S
 *         model:
 *           type: string
 *           description: Model xe
 *           example: Klara S
 *         year:
 *           type: number
 *           description: Năm sản xuất
 *           example: 2023
 *         color:
 *           type: string
 *           description: Màu xe
 *           example: Đỏ
 *         type:
 *           type: string
 *           enum: [scooter, motorcycle]
 *           description: Loại xe
 *           example: scooter
 *         battery_capacity:
 *           type: number
 *           description: Dung lượng pin (kWh)
 *           example: 2.3
 *         max_range:
 *           type: number
 *           description: Quãng đường tối đa (km)
 *           example: 80
 *         current_battery:
 *           type: number
 *           default: 100
 *           description: Phần trăm pin hiện tại (0-100)
 *           example: 100
 *         price_per_day:
 *           type: number
 *           description: Giá thuê mỗi ngày (VND)
 *           example: 150000
 *         deposit_amount:
 *           type: number
 *           description: Tiền đặt cọc (VND)
 *           example: 2000000
 *         quantity:
 *           type: number
 *           default: 1
 *           description: Số lượng xe cần tạo
 *           example: 25
 *         main_image:
 *           type: string
 *           description: URL ảnh chính
 *           example: "https://res.cloudinary.com/demo/image/upload/v1624291234/vehicles/vehicle1.jpg"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Danh sách URL ảnh xe
 *           example: ["https://res.cloudinary.com/demo/image/upload/v1624291234/vehicles/vehicle1.jpg"]
 *     
 *     VehicleAssign:
 *       type: object
 *       required:
 *         - quantity
 *         - station_id
 *       properties:
 *         color:
 *           type: string
 *           description: Màu xe cần phân bổ
 *           example: Đỏ
 *         status:
 *           type: string
 *           default: draft
 *           description: Trạng thái xe cần phân bổ
 *           example: draft
 *         quantity:
 *           type: number
 *           description: Số lượng xe cần phân bổ
 *           example: 10
 *         station_id:
 *           type: string
 *           description: ID trạm đích
 *           example: 60d5ec9af682fbd12a0bbaf2
 *     
 *     VehicleStatus:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [draft, available, rented, maintenance]
 *           description: Trạng thái mới
 *           example: available
 *     
 *     VehicleBattery:
 *       type: object
 *       required:
 *         - current_battery
 *       properties:
 *         current_battery:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Phần trăm pin hiện tại
 *           example: 85
 *     
 *     VehicleMaintenance:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           description: Lý do bảo trì
 *           example: Phanh không hoạt động
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *           description: Mức độ ưu tiên
 *           example: high
 */

module.exports = {};