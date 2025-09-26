/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Tạo contract mới
 *     description: Tạo contract từ rental (Staff/Admin only)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rental_id
 *             properties:
 *               rental_id:
 *                 type: string
 *                 description: ID của rental
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *               template_id:
 *                 type: string
 *                 description: ID của contract template (optional)
 *                 example: "60f7b3b3b3b3b3b3b3b3b3b4"
 *               special_conditions:
 *                 type: string
 *                 description: Điều kiện đặc biệt
 *                 example: "Khách hàng VIP - Ưu tiên hỗ trợ 24/7"
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm
 *                 example: "Contract cho khách hàng thân thiết"
 *           examples:
 *             basic_contract:
 *               summary: "Tạo contract cơ bản"
 *               value:
 *                 rental_id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 notes: "Contract cho thuê xe điện"
 *             vip_contract:
 *               summary: "Tạo contract VIP"
 *               value:
 *                 rental_id: "60f7b3b3b3b3b3b3b3b3b3b3"
 *                 template_id: "60f7b3b3b3b3b3b3b3b3b3b4"
 *                 special_conditions: "Khách hàng VIP - Ưu tiên hỗ trợ 24/7"
 *                 notes: "Contract đặc biệt cho khách VIP"
 *     responses:
 *       201:
 *         description: Tạo contract thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractResponse'
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
 *         description: Không tìm thấy rental hoặc template
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
 *   get:
 *     summary: Lấy danh sách contracts
 *     description: Lấy danh sách contracts với phân trang và filter
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Số lượng mỗi trang
 *         example: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, signed, cancelled, expired]
 *         description: Lọc theo trạng thái contract
 *         example: pending
 *       - in: query
 *         name: station_id
 *         schema:
 *           type: string
 *         description: Lọc theo station
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo mã contract hoặc tiêu đề
 *         example: "CT123456"
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, valid_from, valid_until]
 *           default: createdAt
 *         description: Sắp xếp theo trường
 *         example: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Thứ tự sắp xếp
 *         example: desc
 *     responses:
 *       200:
 *         description: Lấy danh sách contracts thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractListResponse'
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
 * 
 * /api/contracts/{id}:
 *   get:
 *     summary: Lấy chi tiết contract
 *     description: Lấy chi tiết contract theo ID
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của contract
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: Lấy chi tiết contract thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractDetailsResponse'
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy contract
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
 * /api/contracts/{id}/sign:
 *   put:
 *     summary: Ký contract
 *     description: Ký contract (staff hoặc customer)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của contract
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signature
 *               - signature_type
 *             properties:
 *               signature:
 *                 type: string
 *                 description: Base64 chữ ký (không có prefix data:image)
 *                 example: "iVBORw0KGgoAAAANSUhEUgAA..."
 *               signature_type:
 *                 type: string
 *                 enum: [staff, customer]
 *                 description: Loại chữ ký
 *                 example: "staff"
 *           examples:
 *             staff_signature:
 *               summary: "Ký contract bởi staff"
 *               value:
 *                 signature: "iVBORw0KGgoAAAANSUhEUgAA..."
 *                 signature_type: "staff"
 *             customer_signature:
 *               summary: "Ký contract bởi customer"
 *               value:
 *                 signature: "iVBORw0KGgoAAAANSUhEUgAA..."
 *                 signature_type: "customer"
 *     responses:
 *       200:
 *         description: Ký contract thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractResponse'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền ký contract
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy contract
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
 * /api/contracts/{id}/pdf:
 *   get:
 *     summary: Tải PDF contract
 *     description: Tải file PDF của contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của contract
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: PDF contract
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy contract
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
 * /api/contracts/{id}/view:
 *   get:
 *     summary: Xem contract online
 *     description: Xem contract dưới dạng HTML trực tiếp trên trình duyệt
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của contract
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     responses:
 *       200:
 *         description: HTML contract
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML content của contract
 *       403:
 *         description: Không có quyền truy cập
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy contract
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
 * /api/contracts/{id}/cancel:
 *   put:
 *     summary: Hủy contract
 *     description: Hủy contract (Staff/Admin only)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của contract
 *         example: "60f7b3b3b3b3b3b3b3b3b3b3"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy contract
 *                 example: "Khách hàng không đồng ý với điều khoản"
 *           examples:
 *             cancel_contract:
 *               summary: "Hủy contract"
 *               value:
 *                 reason: "Khách hàng không đồng ý với điều khoản"
 *     responses:
 *       200:
 *         description: Hủy contract thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractResponse'
 *       400:
 *         description: Contract đã được hủy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Không có quyền hủy contract
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy contract
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
