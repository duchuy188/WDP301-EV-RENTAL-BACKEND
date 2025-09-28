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

