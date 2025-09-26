/**
 * @swagger
 * /api/payments/vnpay/callback:
 *   get:
 *     summary: VNPay Callback Handler
 *     description: Xử lý callback từ VNPay sau khi thanh toán
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: Mã phản hồi từ VNPay
 *       - in: query
 *         name: vnp_TransactionNo
 *         schema:
 *           type: string
 *         description: Mã giao dịch VNPay
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: Mã tham chiếu giao dịch
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         description: Số tiền giao dịch
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         description: Mã hash bảo mật
 *     responses:
 *       302:
 *         description: Redirect về frontend với kết quả thanh toán
 *       400:
 *         description: Callback không hợp lệ
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




