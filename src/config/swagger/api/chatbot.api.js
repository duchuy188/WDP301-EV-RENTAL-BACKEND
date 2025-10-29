/**
 * @swagger
 * components:
 *   schemas:
 *     ChatbotMessage:
 *       type: object
 *       properties:
 *         role:
 *           type: string
 *           enum: [user, assistant]
 *           example: user
 *         message:
 *           type: string
 *           example: "Tôi muốn thuê xe ở quận 1"
 *         timestamp:
 *           type: string
 *           format: date-time
 *         metadata:
 *           type: object
 *           properties:
 *             suggestions:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["Tìm trạm gần nhất", "Xem lịch sử thuê xe"]
 *             actions:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["search_stations", "view_history"]
 *             context:
 *               type: string
 *               example: "Thông tin bổ sung"
 *     
 *     Conversation:
 *       type: object
 *       properties:
 *         session_id:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         user_role:
 *           type: string
 *           enum: [EV Renter, Station Staff, Admin]
 *           example: "EV Renter"
 *         status:
 *           type: string
 *           enum: [active, completed, archived]
 *           example: "active"
 *         total_messages:
 *           type: number
 *           example: 10
 *         last_activity:
 *           type: string
 *           format: date-time
 *         messages:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChatbotMessage'
 *     
 *     ChatbotResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Tôi thấy có 2 trạm ở quận 1. Trạm VinFast Quận 1 có 15 xe available."
 *         suggestions:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Đặt xe ngay", "Xem chi tiết trạm", "Tìm trạm khác"]
 *         actions:
 *           type: array
 *           items:
 *             type: string
 *           example: ["book_vehicle", "view_station_details"]
 *         context:
 *           type: string
 *           example: "Trạm gần nhất cách bạn 2km"
 *         session_id:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         conversation_id:
 *           type: string
 *           example: "64a1b2c3d4e5f6789012345"
 */

/**
 * @swagger
 * /api/chatbot/message:
 *   post:
 *     summary: Gửi tin nhắn cho chatbot
 *     description: Gửi tin nhắn và nhận phản hồi từ chatbot AI
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Tin nhắn từ user
 *                 example: "Tôi muốn thuê xe ở quận 1"
 *               session_id:
 *                 type: string
 *                 description: ID của session hội thoại (tùy chọn)
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *             required:
 *               - message
 *     responses:
 *       200:
 *         description: Phản hồi từ chatbot thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatbotResponse'
 *       400:
 *         description: Tin nhắn không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * 
 * /api/chatbot/history:
 *   get:
 *     summary: Lấy lịch sử hội thoại
 *     description: Lấy lịch sử tin nhắn của một session hội thoại
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: session_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của session hội thoại
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Lấy lịch sử hội thoại thành công
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
 *                     session_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     user_role:
 *                       type: string
 *                       example: "EV Renter"
 *                     total_messages:
 *                       type: number
 *                       example: 10
 *                     last_activity:
 *                       type: string
 *                       format: date-time
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChatbotMessage'
 *       404:
 *         description: Không tìm thấy hội thoại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * 
 * /api/chatbot/conversations:
 *   get:
 *     summary: Lấy danh sách hội thoại của user
 *     description: Lấy danh sách tất cả hội thoại của user hiện tại
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng hội thoại tối đa
 *         example: 20
 *     responses:
 *       200:
 *         description: Lấy danh sách hội thoại thành công
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
 *                     conversations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           session_id:
 *                             type: string
 *                             example: "550e8400-e29b-41d4-a716-446655440000"
 *                           user_role:
 *                             type: string
 *                             example: "EV Renter"
 *                           status:
 *                             type: string
 *                             example: "active"
 *                           total_messages:
 *                             type: number
 *                             example: 10
 *                           last_activity:
 *                             type: string
 *                             format: date-time
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: Tạo hội thoại mới
 *     description: Tạo một session hội thoại mới
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tạo hội thoại mới thành công
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
 *                   example: "Tạo hội thoại mới thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     user_role:
 *                       type: string
 *                       example: "EV Renter"
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * 
 * /api/chatbot/suggestions:
 *   get:
 *     summary: Lấy gợi ý dựa trên role
 *     description: Lấy danh sách gợi ý phù hợp với role của user
 *     tags: [Chatbot]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *         description: Ngữ cảnh để tạo gợi ý phù hợp
 *         example: "booking"
 *     responses:
 *       200:
 *         description: Lấy gợi ý thành công
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
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Tìm trạm gần nhất", "Xem lịch sử thuê xe", "Đặt xe mới"]
 *                     user_role:
 *                       type: string
 *                       example: "EV Renter"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * 
 */