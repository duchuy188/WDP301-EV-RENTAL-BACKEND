/**
 * @swagger
 * components:
 *   schemas:
 *     Station:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j1"
 *         code:
 *           type: string
 *           example: "ST001"
 *           pattern: "^ST\\d{3}$"
 *         name:
 *           type: string
 *           example: "Trạm thuê xe VinFast Quận 1"
 *         address:
 *           type: string
 *           example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *         district:
 *           type: string
 *           example: "Quận 1"
 *         city:
 *           type: string
 *           example: "TP.HCM"
 *         description:
 *           type: string
 *           example: "Trạm thuê xe điện VinFast tại trung tâm Quận 1, gần chợ Bến Thành"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://res.cloudinary.com/example/image1.jpg", "https://res.cloudinary.com/example/image2.jpg"]
 *         phone:
 *           type: string
 *           example: "0123456789"
 *           pattern: "^0\\d{9,10}$"
 *         email:
 *           type: string
 *           example: "station001@vinfast.vn"
 *         opening_time:
 *           type: string
 *           example: "06:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         closing_time:
 *           type: string
 *           example: "22:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         status:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *           example: "active"
 *         max_capacity:
 *           type: integer
 *           minimum: 1
 *           example: 50
 *         current_vehicles:
 *           type: integer
 *           minimum: 0
 *           example: 25
 *         available_vehicles:
 *           type: integer
 *           minimum: 0
 *           example: 20
 *         rented_vehicles:
 *           type: integer
 *           minimum: 0
 *           example: 3
 *         maintenance_vehicles:
 *           type: integer
 *           minimum: 0
 *           example: 2
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2023-09-01T10:00:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-09-01T10:00:00.000Z"
 *       required:
 *         - name
 *         - address
 *         - district
 *         - city
 *         - phone
 *         - email
 *         - opening_time
 *         - closing_time
 *         - max_capacity
 *
 *     CreateStation:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Trạm thuê xe VinFast Quận 1"
 *         address:
 *           type: string
 *           example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *         district:
 *           type: string
 *           example: "Quận 1"
 *         city:
 *           type: string
 *           example: "TP.HCM"
 *         description:
 *           type: string
 *           example: "Trạm thuê xe điện VinFast tại trung tâm Quận 1, gần chợ Bến Thành"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: Hình ảnh của trạm (tối đa 10 ảnh, tùy chọn)
 *         phone:
 *           type: string
 *           example: "0123456789"
 *           pattern: "^0\\d{9,10}$"
 *         email:
 *           type: string
 *           example: "station001@vinfast.vn"
 *         opening_time:
 *           type: string
 *           example: "06:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         closing_time:
 *           type: string
 *           example: "22:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         max_capacity:
 *           type: integer
 *           minimum: 1
 *           example: 50
 *       required:
 *         - name
 *         - address
 *         - district
 *         - city
 *         - phone
 *         - email
 *         - opening_time
 *         - closing_time
 *         - max_capacity
 *
 *     UpdateStation:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "Trạm thuê xe VinFast Quận 1 - Cập nhật"
 *         address:
 *           type: string
 *           example: "456 Nguyễn Huệ, Quận 1, TP.HCM"
 *         district:
 *           type: string
 *           example: "Quận 1"
 *         city:
 *           type: string
 *           example: "TP.HCM"
 *         description:
 *           type: string
 *           example: "Trạm thuê xe điện VinFast tại trung tâm Quận 1, gần chợ Bến Thành - Cập nhật"
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           example: ["https://res.cloudinary.com/example/image1.jpg", "https://res.cloudinary.com/example/image2.jpg"]
 *         phone:
 *           type: string
 *           example: "0987654321"
 *           pattern: "^0\\d{9,10}$"
 *         email:
 *           type: string
 *           example: "station001@vinfast.vn"
 *         opening_time:
 *           type: string
 *           example: "07:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         closing_time:
 *           type: string
 *           example: "23:00"
 *           pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         max_capacity:
 *           type: integer
 *           minimum: 1
 *           example: 60
 *         status:
 *           type: string
 *           enum: [active, inactive, maintenance]
 *           example: "active"
 *
 *     VehicleSummary:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j2"
 *         name:
 *           type: string
 *           example: "VinFast Klara S"
 *         model:
 *           type: string
 *           example: "Klara S"
 *         type:
 *           type: string
 *           enum: [scooter, motorcycle]
 *           example: "scooter"
 *         price_per_day:
 *           type: integer
 *           example: 150000
 *         status:
 *           type: string
 *           enum: [available, rented, maintenance]
 *           example: "available"
 *         current_battery:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           example: 85
 *         main_image:
 *           type: string
 *           example: "https://res.cloudinary.com/example/vehicle_image.jpg"
 *
 *     UserSummary:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7g8h9i0j3"
 *         fullname:
 *           type: string
 *           example: "Nguyễn Văn A"
 *         email:
 *           type: string
 *           example: "staff001@vinfast.vn"
 *         phone:
 *           type: string
 *           example: "0123456789"
 *         avatar:
 *           type: string
 *           example: "https://res.cloudinary.com/example/avatar.jpg"
 *         status:
 *           type: string
 *           enum: [active, suspended, blocked]
 *           example: "active"
 *
 *     Pagination:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *           example: 100
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 10
 *         pages:
 *           type: integer
 *           example: 10
 *
 *     Error:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Lỗi xảy ra"
 *         error:
 *           type: string
 *           example: "Chi tiết lỗi"
 */
