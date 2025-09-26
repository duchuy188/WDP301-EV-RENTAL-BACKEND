/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Quản lý thanh toán
 */

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Tạo payment mới
 *     description: Staff tạo payment mới cho booking (deposit, rental_fee, additional_fee)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - booking_id
 *               - payment_type
 *               - payment_method
 *             properties:
 *               booking_id:
 *                 type: string
 *                 description: ID của booking
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               rental_id:
 *                 type: string
 *                 description: ID của rental (bắt buộc cho rental_fee và additional_fee)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *               payment_type:
 *                 type: string
 *                 enum: [deposit, rental_fee, additional_fee]
 *                 description: Loại thanh toán
 *                 example: deposit
 *               amount:
 *                 type: number
 *                 minimum: 0
 *                 description: Số tiền thanh toán (VND) - Bắt buộc cho additional_fee
 *                 example: 500000
 *               payment_method:
 *                 type: string
 *                 enum: [cash, qr_code, bank_transfer, vnpay]
 *                 description: Phương thức thanh toán
 *                 example: vnpay
 *               reason:
 *                 type: string
 *                 description: Lý do phí phát sinh (bắt buộc cho additional_fee)
 *                 example: "Phí trễ giờ trả xe"
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm
 *                 example: "Thanh toán cọc xe điện"
 *           examples:
 *             deposit_vnpay:
 *               summary: "Thanh toán cọc qua VNPay"
 *               value:
 *                 booking_id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 payment_type: "deposit"
 *                 payment_method: "vnpay"
 *                 notes: "Thanh toán cọc xe điện"
 *             rental_fee_cash:
 *               summary: "Thanh toán phí thuê bằng tiền mặt"
 *               value:
 *                 booking_id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 rental_id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                 payment_type: "rental_fee"
 *                 payment_method: "cash"
 *                 notes: "Thanh toán tại quầy"
 *             additional_fee_qr:
 *               summary: "Thanh toán phí phát sinh qua QR"
 *               value:
 *                 booking_id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 rental_id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                 payment_type: "additional_fee"
 *                 amount: 100000
 *                 payment_method: "qr_code"
 *                 reason: "Phí trễ giờ trả xe"
 *                 notes: "Phí phát sinh do trễ 2 giờ"
 *     responses:
 *       201:
 *         description: Tạo payment thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResponse'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy booking
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

 *   get:
 *     summary: Lấy danh sách tất cả payments
 *     description: Staff/Admin lấy danh sách tất cả payments với filter và pagination
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Số trang (mặc định 1)
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Số lượng mỗi trang (mặc định 10)
 *         example: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Lọc theo trạng thái
 *         example: completed
 *       - in: query
 *         name: payment_type
 *         schema:
 *           type: string
 *           enum: [deposit, rental_fee, additional_fee, refund]
 *         description: Lọc theo loại thanh toán
 *         example: deposit
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [cash, qr_code, bank_transfer, vnpay]
 *         description: Lọc theo phương thức thanh toán
 *         example: vnpay
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo payment code hoặc customer name
 *         example: "PAY123"
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, amount]
 *         description: Sắp xếp theo trường (mặc định createdAt)
 *         example: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Thứ tự sắp xếp (mặc định desc)
 *         example: desc
 *     responses:
 *       200:
 *         description: Lấy danh sách payments thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentListResponse'
 *       403:
 *         description: Không có quyền truy cập
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
 */

/**
 * @swagger
 * /api/payments/my-payments:
 *   get:
 *     summary: Lấy danh sách payments của user
 *     description: User xem danh sách payments của mình với summary
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: payment_type
 *         schema:
 *           type: string
 *           enum: [deposit, rental_fee, additional_fee, refund]
 *         description: Lọc theo loại thanh toán
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Lấy danh sách payments thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentListResponse'
 */

/**
 * @swagger
 * /api/payments/{id}:
 *   get:
 *     summary: Lấy chi tiết payment
 *     description: Xem chi tiết payment theo ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Lấy chi tiết payment thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentDetailsResponse'
 *       403:
 *         description: Không có quyền xem payment này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/payments/{id}/confirm:
 *   put:
 *     summary: Xác nhận thanh toán
 *     description: Staff xác nhận payment đã được thanh toán thành công
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ConfirmPaymentRequest'
 *     responses:
 *       200:
 *         description: Xác nhận thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResponse'
 *       400:
 *         description: Payment không ở trạng thái pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền xác nhận thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/payments/{id}/cancel:
 *   put:
 *     summary: Hủy payment
 *     description: Staff hủy payment đang pending
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelPaymentRequest'
 *     responses:
 *       200:
 *         description: Hủy payment thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentResponse'
 *       400:
 *         description: Chỉ có thể hủy payment đang pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền hủy payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/payments/{id}/refund:
 *   post:
 *     summary: Hoàn tiền
 *     description: Staff hoàn tiền cho customer (chỉ áp dụng cho deposit payment)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefundPaymentRequest'
 *     responses:
 *       200:
 *         description: Hoàn tiền thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefundPaymentResponse'
 *       400:
 *         description: Payment không thể hoàn tiền hoặc số tiền không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền hoàn tiền
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */