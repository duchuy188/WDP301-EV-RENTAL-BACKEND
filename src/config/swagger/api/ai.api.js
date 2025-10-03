/**
 * @swagger
 * components:
 *   schemas:
 *     DemandForecast:
 *       type: object
 *       properties:
 *         hourlyTrend:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hour:
 *                 type: number
 *                 example: 8
 *               demand:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: high
 *               forecast:
 *                 type: number
 *                 example: 15
 *         weeklyTrend:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               day:
 *                 type: string
 *                 example: Monday
 *               demand:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: medium
 *               forecast:
 *                 type: number
 *                 example: 45
 *         totalForecast:
 *           type: object
 *           properties:
 *             period:
 *               type: string
 *               example: 7d
 *             predictedBookings:
 *               type: number
 *               example: 120
 *             confidence:
 *               type: number
 *               example: 85
 *         factors:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Weather", "Weekend", "Events"]
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Increase vehicles during peak hours", "Promote off-peak usage"]
 *     
 *     StationDemandForecast:
 *       type: object
 *       properties:
 *         stationInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Trạm Quận 1"
 *             currentVehicles:
 *               type: number
 *               example: 20
 *         forecast:
 *           type: object
 *           properties:
 *             period:
 *               type: string
 *               example: 7d
 *             predictedBookings:
 *               type: number
 *               example: 35
 *             confidence:
 *               type: number
 *               example: 78
 *         capacityAnalysis:
 *           type: object
 *           properties:
 *             currentUtilization:
 *               type: number
 *               example: 75.5
 *             peakDemand:
 *               type: number
 *               example: 25
 *             shortage:
 *               type: number
 *               example: 5
 *         recommendations:
 *           type: object
 *           properties:
 *             vehiclesNeeded:
 *               type: number
 *               example: 5
 *             optimalCapacity:
 *               type: number
 *               example: 25
 *             timing:
 *               type: string
 *               enum: [immediate, 1month, 3months]
 *               example: immediate
 *         peakHours:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               hour:
 *                 type: number
 *                 example: 18
 *               demand:
 *                 type: number
 *                 example: 8
 *         strategies:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Dynamic pricing", "Peak hour management"]
 *     
 *     VehicleRecommendation:
 *       type: object
 *       properties:
 *         stationId:
 *           type: string
 *           example: "64a1b2c3d4e5f6789012345"
 *         stationName:
 *           type: string
 *           example: "Trạm Quận 1"
 *         currentVehicles:
 *           type: number
 *           example: 20
 *         predictedDemand:
 *           type: number
 *           example: 35
 *         vehiclesNeeded:
 *           type: number
 *           example: 5
 *         optimalCapacity:
 *           type: number
 *           example: 25
 *         priority:
 *           type: string
 *           enum: [high, medium, low]
 *           example: high
 *         estimatedROI:
 *           type: number
 *           example: 15.5
 *         timing:
 *           type: string
 *           enum: [immediate, 1month, 3months]
 *           example: immediate
 *     
 *     TrendAnalysis:
 *       type: object
 *       properties:
 *         trends:
 *           type: object
 *           properties:
 *             overall:
 *               type: string
 *               enum: [increasing, decreasing, stable]
 *               example: increasing
 *             growthRate:
 *               type: number
 *               example: 12.5
 *             seasonality:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Weekend peak", "Holiday surge"]
 *             cyclical:
 *               type: string
 *               example: "Monthly business cycle"
 *         factors:
 *           type: object
 *           properties:
 *             weather:
 *               type: string
 *               example: moderate
 *             events:
 *               type: string
 *               example: high
 *             economic:
 *               type: string
 *               example: stable
 *         forecasts:
 *           type: object
 *           properties:
 *             shortTerm:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   example: 1month
 *                 trend:
 *                   type: string
 *                   enum: [up, down, stable]
 *                   example: up
 *                 confidence:
 *                   type: number
 *                   example: 80
 *             longTerm:
 *               type: object
 *               properties:
 *                 period:
 *                   type: string
 *                   example: 6months
 *                 trend:
 *                   type: string
 *                   enum: [up, down, stable]
 *                   example: up
 *                 confidence:
 *                   type: number
 *                   example: 70
 *         opportunities:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Weekend expansion", "Corporate partnerships"]
 *         challenges:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Weather dependency", "Competition"]
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Expand to new areas", "Improve weather resilience"]
 *     
 *     AIDashboard:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             totalStations:
 *               type: number
 *               example: 10
 *             totalVehicles:
 *               type: number
 *               example: 200
 *             vehiclesNeeded:
 *               type: number
 *               example: 25
 *             estimatedInvestment:
 *               type: number
 *               example: 1250000000
 *             predictedBookings:
 *               type: number
 *               example: 120
 *             confidence:
 *               type: number
 *               example: 85
 *         demandForecast:
 *           $ref: '#/components/schemas/DemandForecast'
 *         trendAnalysis:
 *           $ref: '#/components/schemas/TrendAnalysis'
 *         vehicleRecommendations:
 *           type: object
 *           properties:
 *             totalNeeded:
 *               type: number
 *               example: 25
 *             topPriorities:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/VehicleRecommendation'
 *             estimatedROI:
 *               type: number
 *               example: 12.8
 *         insights:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Xu hướng tổng thể: increasing", "Tăng trưởng: 12.5%"]
 *         generatedAt:
 *           type: string
 *           format: date-time
 *         period:
 *           type: string
 *           example: 30d
 */

/**
 * @swagger
 * /api/ai/health:
 *   get:
 *     summary: Kiểm tra trạng thái AI Service
 *     description: Kiểm tra xem AI Service có hoạt động bình thường không
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI Service hoạt động bình thường
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
 *                   example: AI Service is healthy
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: operational
 *                     testResponse:
 *                       type: string
 *                       example: AI Service is working
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     geminiModel:
 *                       type: string
 *                       example: gemini-1.5-flash
 *       500:
 *         description: AI Service không hoạt động
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
 *                   example: AI Service is not responding
 *                 error:
 *                   type: string
 *                   example: API key not found
 */

/**
 * @swagger
 * /api/ai/demand-forecast:
 *   get:
 *     summary: Dự báo nhu cầu tổng quan
 *     description: Dự báo nhu cầu thuê xe cho toàn hệ thống hoặc trạm cụ thể
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 7d
 *         description: Kỳ dự báo
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: ID trạm cụ thể (không bắt buộc)
 *     responses:
 *       200:
 *         description: Dự báo nhu cầu thành công
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
 *                   example: Dự báo nhu cầu thành công
 *                 data:
 *                   $ref: '#/components/schemas/DemandForecast'
 *       400:
 *         description: Tham số không hợp lệ
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
 *                   example: Kỳ dự báo không hợp lệ
 *       500:
 *         description: Lỗi server
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
 *                   example: Lỗi server khi dự báo nhu cầu
 *                 error:
 *                   type: string
 *                   example: Gemini API error
 */

/**
 * @swagger
 * /api/ai/demand-forecast/station/{id}:
 *   get:
 *     summary: Dự báo nhu cầu theo trạm
 *     description: Dự báo nhu cầu thuê xe cho trạm cụ thể
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID trạm
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 7d
 *         description: Kỳ dự báo
 *     responses:
 *       200:
 *         description: Dự báo nhu cầu trạm thành công
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
 *                   example: Dự báo nhu cầu trạm thành công
 *                 data:
 *                   $ref: '#/components/schemas/StationDemandForecast'
 *       404:
 *         description: Trạm không tồn tại
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
 *                   example: Trạm không tồn tại
 *       500:
 *         description: Lỗi server
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
 *                   example: Lỗi server khi dự báo nhu cầu trạm
 *                 error:
 *                   type: string
 *                   example: Gemini API error
 */

/**
 * @swagger
 * /api/ai/vehicle-recommendations:
 *   get:
 *     summary: Gợi ý số lượng xe
 *     description: Gợi ý số lượng xe cần thiết cho từng trạm dựa trên dự báo nhu cầu
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gợi ý xe thành công
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
 *                   example: Gợi ý xe thành công
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalStations:
 *                       type: number
 *                       example: 10
 *                     totalVehiclesNeeded:
 *                       type: number
 *                       example: 25
 *                     estimatedInvestment:
 *                       type: number
 *                       example: 1250000000
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/VehicleRecommendation'
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Lỗi server
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
 *                   example: Lỗi server khi tạo gợi ý xe
 *                 error:
 *                   type: string
 *                   example: Gemini API error
 */

/**
 * @swagger
 * /api/ai/trend-analysis:
 *   get:
 *     summary: Phân tích xu hướng
 *     description: Phân tích xu hướng nhu cầu thuê xe theo thời gian
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 1y]
 *           default: 90d
 *         description: Kỳ phân tích
 *     responses:
 *       200:
 *         description: Phân tích xu hướng thành công
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
 *                   example: Phân tích xu hướng thành công
 *                 data:
 *                   $ref: '#/components/schemas/TrendAnalysis'
 *       400:
 *         description: Tham số không hợp lệ
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
 *                   example: Kỳ phân tích không hợp lệ
 *       500:
 *         description: Lỗi server
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
 *                   example: Lỗi server khi phân tích xu hướng
 *                 error:
 *                   type: string
 *                   example: Gemini API error
 */

/**
 * @swagger
 * /api/ai/dashboard:
 *   get:
 *     summary: Dashboard AI tổng hợp
 *     description: Dashboard tổng hợp tất cả thông tin AI - dự báo, xu hướng, gợi ý xe
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 1y]
 *           default: 30d
 *         description: Kỳ phân tích cho xu hướng
 *     responses:
 *       200:
 *         description: Dashboard AI thành công
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
 *                   example: Dashboard AI thành công
 *                 data:
 *                   $ref: '#/components/schemas/AIDashboard'
 *       500:
 *         description: Lỗi server
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
 *                   example: Lỗi server khi tạo dashboard AI
 *                 error:
 *                   type: string
 *                   example: Gemini API error
 */

