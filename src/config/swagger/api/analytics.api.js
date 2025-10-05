/**
 * @swagger
 * components:
 *   schemas:
 *     RevenueOverview:
 *       type: object
 *       properties:
 *         totalRevenue:
 *           type: number
 *           description: Tổng doanh thu
 *           example: 15000000
 *         transactionCount:
 *           type: number
 *           description: Số lượng giao dịch
 *           example: 125
 *         growthRate:
 *           type: number
 *           description: Tỷ lệ tăng trưởng (%)
 *           example: 15.5
 *         topStation:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *             stationName:
 *               type: string
 *               example: "Trạm Quận 1"
 *             revenue:
 *               type: number
 *               example: 5000000
 *         period:
 *           type: string
 *           example: "today"
 *         dateRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *             end:
 *               type: string
 *               format: date-time
 *     
 *     StationRevenue:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: ID trạm
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         stationName:
 *           type: string
 *           description: Tên trạm
 *           example: "Trạm Quận 1"
 *         stationCode:
 *           type: string
 *           description: Mã trạm
 *           example: "ST001"
 *         stationAddress:
 *           type: string
 *           description: Địa chỉ trạm
 *           example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *         revenue:
 *           type: number
 *           description: Doanh thu
 *           example: 5000000
 *         transactionCount:
 *           type: number
 *           description: Số giao dịch
 *           example: 45
 *         averageTransaction:
 *           type: number
 *           description: Giao dịch trung bình
 *           example: 111111
 *         percentage:
 *           type: number
 *           description: Phần trăm đóng góp
 *           example: 33.3
 *         growthRate:
 *           type: number
 *           description: Tỷ lệ tăng trưởng
 *           example: 12.5
 *     
 *     RevenueTrend:
 *       type: object
 *       properties:
 *         _id:
 *           type: object
 *           properties:
 *             date:
 *               type: string
 *               example: "2025-01-01"
 *         revenue:
 *           type: number
 *           example: 500000
 *         transactionCount:
 *           type: number
 *           example: 25
 *     
 *     StationRevenueDetail:
 *       type: object
 *       properties:
 *         station:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *             name:
 *               type: string
 *               example: "Trạm Quận 1"
 *             code:
 *               type: string
 *               example: "ST001"
 *             address:
 *               type: string
 *               example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *         revenueByVehicleType:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "scooter"
 *               revenue:
 *                 type: number
 *                 example: 3000000
 *               count:
 *                 type: number
 *                 example: 30
 *         revenueByHour:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: number
 *                 example: 8
 *               revenue:
 *                 type: number
 *                 example: 500000
 *               count:
 *                 type: number
 *                 example: 5
 *         topCustomers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               customerName:
 *                 type: string
 *                 example: "Nguyễn Văn A"
 *               customerEmail:
 *                 type: string
 *                 example: "nguyenvana@email.com"
 *               totalSpent:
 *                 type: number
 *                 example: 1000000
 *               rentalCount:
 *                 type: number
 *                 example: 5
 *         vehicleUtilization:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *               licensePlate:
 *                 type: string
 *                 example: "51A-12345"
 *               vehicleType:
 *                 type: string
 *                 example: "scooter"
 *               rentalCount:
 *                 type: number
 *                 example: 15
 *               totalRevenue:
 *                 type: number
 *                 example: 750000
 */

/**
 * @swagger
 * /api/analytics/revenue/overview:
 *   get:
 *     summary: Lấy tổng quan doanh thu
 *     description: Lấy thông tin tổng quan về doanh thu hệ thống
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: today
 *         description: Kỳ thống kê
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [all, cash, vnpay, bank_transfer]
 *           default: all
 *         description: Phương thức thanh toán
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
 *                   $ref: '#/components/schemas/RevenueOverview'
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/revenue/by-station:
 *   get:
 *     summary: Lấy doanh thu theo trạm
 *     description: Lấy thông tin doanh thu chi tiết theo từng trạm
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: month
 *         description: Kỳ thống kê
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Ngày thống kê (YYYY-MM-DD)
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [all, cash, vnpay, bank_transfer]
 *           default: all
 *         description: Phương thức thanh toán
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
 *                     stations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StationRevenue'
 *                     totalRevenue:
 *                       type: number
 *                       example: 15000000
 *                     period:
 *                       type: string
 *                       example: "month"
 *                     dateRange:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/revenue/trends:
 *   get:
 *     summary: Lấy xu hướng doanh thu
 *     description: Lấy thông tin xu hướng doanh thu theo thời gian
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: month
 *         description: Kỳ thống kê
 *       - in: query
 *         name: stations
 *         schema:
 *           type: string
 *           example: "all"
 *         description: ID trạm (phân cách bằng dấu phẩy) hoặc "all"
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [all, cash, vnpay, bank_transfer]
 *           default: all
 *         description: Phương thức thanh toán
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
 *                     trends:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RevenueTrend'
 *                     period:
 *                       type: string
 *                       example: "month"
 *                     groupFormat:
 *                       type: string
 *                       example: "%Y-%m-%d"
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/revenue/station-detail/{stationId}:
 *   get:
 *     summary: Lấy chi tiết doanh thu trạm
 *     description: Lấy thông tin chi tiết doanh thu của một trạm cụ thể
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stationId
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID trạm
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, year]
 *           default: month
 *         description: Kỳ thống kê
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Ngày thống kê (YYYY-MM-DD)
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [all, cash, vnpay, bank_transfer]
 *           default: all
 *         description: Phương thức thanh toán
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
 *                   $ref: '#/components/schemas/StationRevenueDetail'
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       404:
 *         description: Không tìm thấy trạm
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/peak-analysis:
 *   get:
 *     summary: Thống kê giờ cao điểm/thấp điểm
 *     description: Lấy thống kê giờ cao điểm và ngày cao điểm cho Admin
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [hours, days, both]
 *           default: both
 *         description: Loại thống kê (giờ, ngày, hoặc cả hai)
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Kỳ thống kê
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID trạm (tùy chọn)
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
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     peak_hours:
 *                       type: object
 *                       description: Thống kê giờ cao điểm (khi type=hours hoặc both)
 *                     peak_days:
 *                       type: object
 *                       description: Thống kê ngày cao điểm (khi type=days hoặc both)
 *       400:
 *         description: Tham số không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin và Station Staff mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/staff-performance:
 *   get:
 *     summary: Lấy thống kê hiệu suất nhân viên
 *     description: Lấy danh sách hiệu suất tất cả nhân viên Station Staff
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Kỳ thống kê
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID trạm (tùy chọn)
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
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     staff_performance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           staff_id:
 *                             type: string
 *                             example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                           staff_name:
 *                             type: string
 *                             example: "Nguyễn Văn A"
 *                           staff_email:
 *                             type: string
 *                             example: "nguyenvana@email.com"
 *                           station:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                               name:
 *                                 type: string
 *                                 example: "Trạm Quận 1"
 *                               address:
 *                                 type: string
 *                                 example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *                           performance_score:
 *                             type: number
 *                             example: 85.5
 *                           rental_stats:
 *                             type: object
 *                             properties:
 *                               total_rentals:
 *                                 type: number
 *                                 example: 25
 *                               pickup_count:
 *                                 type: number
 *                                 example: 15
 *                               return_count:
 *                                 type: number
 *                                 example: 10
 *                           feedback_stats:
 *                             type: object
 *                             properties:
 *                               total_ratings:
 *                                 type: number
 *                                 example: 20
 *                               avg_overall_rating:
 *                                 type: number
 *                                 example: 4.5
 *                               avg_staff_service:
 *                                 type: number
 *                                 example: 4.3
 *                               avg_vehicle_condition:
 *                                 type: number
 *                                 example: 4.7
 *                               avg_station_cleanliness:
 *                                 type: number
 *                                 example: 4.2
 *                               avg_checkout_process:
 *                                 type: number
 *                                 example: 4.6
 *                           complaint_stats:
 *                             type: object
 *                             properties:
 *                               total_complaints:
 *                                 type: number
 *                                 example: 2
 *                               pending_complaints:
 *                                 type: number
 *                                 example: 0
 *                               resolved_complaints:
 *                                 type: number
 *                                 example: 2
 *                               resolution_rate:
 *                                 type: number
 *                                 example: 100
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_staff:
 *                           type: number
 *                           example: 5
 *                         avg_performance_score:
 *                           type: number
 *                           example: 78.2
 *                         top_performer:
 *                           type: object
 *                           description: Nhân viên có điểm cao nhất
 *                         date_range:
 *                           type: object
 *                           properties:
 *                             start:
 *                               type: string
 *                               format: date-time
 *                             end:
 *                               type: string
 *                               format: date-time
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * /api/analytics/staff-performance/{staffId}:
 *   get:
 *     summary: Lấy chi tiết hiệu suất nhân viên
 *     description: Lấy thông tin chi tiết hiệu suất của một nhân viên cụ thể
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         description: ID nhân viên
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *         description: Kỳ thống kê
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
 *                     staff:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                         name:
 *                           type: string
 *                           example: "Nguyễn Văn A"
 *                         email:
 *                           type: string
 *                           example: "nguyenvana@email.com"
 *                         station:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                             name:
 *                               type: string
 *                               example: "Trạm Quận 1"
 *                             address:
 *                               type: string
 *                               example: "123 Nguyễn Huệ, Quận 1, TP.HCM"
 *                     period:
 *                       type: string
 *                       example: "30d"
 *                     performance_score:
 *                       type: number
 *                       example: 85.5
 *                     rental_stats:
 *                       type: object
 *                       properties:
 *                         total_rentals:
 *                           type: number
 *                           example: 25
 *                         pickup_count:
 *                           type: number
 *                           example: 15
 *                         return_count:
 *                           type: number
 *                           example: 10
 *                     feedback_stats:
 *                       type: object
 *                       properties:
 *                         total_ratings:
 *                           type: number
 *                           example: 20
 *                         avg_overall_rating:
 *                           type: number
 *                           example: 4.5
 *                         avg_staff_service:
 *                           type: number
 *                           example: 4.3
 *                         avg_vehicle_condition:
 *                           type: number
 *                           example: 4.7
 *                         avg_station_cleanliness:
 *                           type: number
 *                           example: 4.2
 *                         avg_checkout_process:
 *                           type: number
 *                           example: 4.6
 *                     complaint_stats:
 *                       type: object
 *                       properties:
 *                         total_complaints:
 *                           type: number
 *                           example: 2
 *                         pending_complaints:
 *                           type: number
 *                           example: 0
 *                         resolved_complaints:
 *                           type: number
 *                           example: 2
 *                         resolution_rate:
 *                           type: number
 *                           example: 100
 *                     rental_details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           rental_id:
 *                             type: string
 *                             example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                           vehicle_name:
 *                             type: string
 *                             example: "Honda Lead"
 *                           vehicle_type:
 *                             type: string
 *                             example: "scooter"
 *                           license_plate:
 *                             type: string
 *                             example: "51A-12345"
 *                           station_name:
 *                             type: string
 *                             example: "Trạm Quận 1"
 *                           customer_name:
 *                             type: string
 *                             example: "Trần Văn B"
 *                           customer_email:
 *                             type: string
 *                             example: "tranvanb@email.com"
 *                           pickup_staff_id:
 *                             type: string
 *                             example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                           return_staff_id:
 *                             type: string
 *                             example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *                           actual_start_time:
 *                             type: string
 *                             format: date-time
 *                           actual_end_time:
 *                             type: string
 *                             format: date-time
 *                           total_amount:
 *                             type: number
 *                             example: 150000
 *                           is_pickup:
 *                             type: boolean
 *                             example: true
 *                           is_return:
 *                             type: boolean
 *                             example: false
 *                     feedback_details:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *                           type:
 *                             type: string
 *                             enum: [rating, complaint]
 *                             example: "rating"
 *                           overall_rating:
 *                             type: number
 *                             example: 5
 *                           staff_service:
 *                             type: number
 *                             example: 4
 *                           vehicle_condition:
 *                             type: number
 *                             example: 5
 *                           station_cleanliness:
 *                             type: number
 *                             example: 4
 *                           checkout_process:
 *                             type: number
 *                             example: 5
 *                           title:
 *                             type: string
 *                             example: "Dịch vụ tốt"
 *                           description:
 *                             type: string
 *                             example: "Nhân viên phục vụ rất tốt"
 *                           status:
 *                             type: string
 *                             enum: [pending, resolved]
 *                             example: "resolved"
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     date_range:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Người dùng không phải là Station Staff
 *       401:
 *         description: Không có quyền truy cập
 *       403:
 *         description: Chỉ Admin mới có quyền
 *       404:
 *         description: Không tìm thấy nhân viên
 *       500:
 *         description: Lỗi server
 */

