/**
 * ContractService - Xử lý logic contract
 * 
 * Chức năng:
 * - Generate contract code
 * - Render template với data
 * - Generate PDF từ HTML
 * - Upload PDF to Cloudinary
 * - Format contract response
 */

const crypto = require('crypto');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const { formatVietnamTime } = require('../config/timezone');

class ContractService {
  /**
   * Tạo contract code
   * @returns {String} Contract code
   */
  static async generateContractCode() {
    try {
      let code;
      let exists = true;
      
      while (exists) {
        // Tạo code ngẫu nhiên: CT + 8 ký tự
        const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
        code = `CT${randomPart}`;
        
        const Contract = require('../models/Contract');
        exists = await Contract.findOne({ code });
      }
      
      return code;
    } catch (error) {
      console.error('Lỗi khi tạo contract code:', error);
      throw new Error('Không thể tạo contract code');
    }
  }

  /**
   * Render template với data
   * @param {String} template - HTML template
   * @param {Object} data - Data để thay thế
   * @returns {String} Rendered HTML
   */
  static async renderContractTemplate(template, data) {
    try {
      // Compile template với Handlebars
      const compiledTemplate = handlebars.compile(template);
      
      // Render với data
      const renderedHTML = compiledTemplate(data);
      
      return renderedHTML;
    } catch (error) {
      console.error('Lỗi khi render template:', error);
      throw new Error('Không thể render contract template');
    }
  }

  /**
   * Generate PDF từ contract HTML
   * @param {Object} contract - Contract object
   * @returns {Buffer} PDF buffer
   */
  static async generateContractPDF(contract) {
    let browser;
    try {
      // Validate contract data chi tiết hơn
      if (!contract || !contract.user_id || !contract.vehicle_id || !contract.station_id) {
        console.error('Contract data validation failed:', {
          hasContract: !!contract,
          hasUserId: !!(contract && contract.user_id),
          hasVehicleId: !!(contract && contract.vehicle_id),
          hasStationId: !!(contract && contract.station_id)
        });
        throw new Error('Thiếu thông tin contract để tạo PDF');
      }

      console.log('Generating PDF for contract:', contract.code);

      // Tạo HTML content cho PDF
      const htmlContent = this.createContractHTML(contract);
      console.log('HTML content generated, length:', htmlContent.length);
      
      // Launch Puppeteer với cấu hình debug
      console.log('Launching Puppeteer...');
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ],
        timeout: 60000 // Tăng timeout lên 60s
      });
      
      const page = await browser.newPage();
      console.log('Browser page created');
      
      // Set viewport và emulate media
      await page.setViewport({ width: 1200, height: 1600 });
      await page.emulateMediaType('print');
      console.log('Page viewport and media type set');
      
      // Set content với error handling
      try {
        await page.setContent(htmlContent, {
          waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
          timeout: 60000 // Tăng timeout
        });
        console.log('HTML content set successfully');
      } catch (contentError) {
        console.error('Error setting HTML content:', contentError);
        throw new Error(`Không thể load HTML content: ${contentError.message}`);
      }
      
      // Đợi page render hoàn tất
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Waiting completed, generating PDF...');
      
      // Generate PDF với error handling
      let pdfData;
      try {
        pdfData = await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: false, // Thay đổi thành false
          displayHeaderFooter: false,
          margin: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          timeout: 60000 // Thêm timeout cho PDF generation
        });
        console.log('PDF generation completed');
      } catch (pdfError) {
        console.error('Error generating PDF:', pdfError);
        throw new Error(`Lỗi khi tạo PDF: ${pdfError.message}`);
      }
      
      // Debug PDF data type
      console.log('PDF Data info:', {
        type: typeof pdfData,
        isBuffer: Buffer.isBuffer(pdfData),
        isUint8Array: pdfData instanceof Uint8Array,
        constructor: pdfData.constructor.name,
        length: pdfData ? pdfData.length : 0
      });
      
      // Convert to Buffer if needed
      let pdfBuffer;
      if (Buffer.isBuffer(pdfData)) {
        pdfBuffer = pdfData;
      } else if (pdfData instanceof Uint8Array) {
        pdfBuffer = Buffer.from(pdfData);
        console.log('Converted Uint8Array to Buffer');
      } else {
        console.error('PDF data is neither Buffer nor Uint8Array:', typeof pdfData);
        throw new Error('Puppeteer trả về dữ liệu không hợp lệ');
      }
      
      // Validate final buffer
      if (!Buffer.isBuffer(pdfBuffer)) {
        console.error('Final PDF buffer is not a Buffer:', typeof pdfBuffer);
        throw new Error('Không thể tạo Buffer từ PDF data');
      }
      
      if (pdfBuffer.length === 0) {
        console.error('Generated PDF buffer is empty');
        throw new Error('PDF buffer rỗng');
      }
      
      // Kiểm tra PDF signature
      const first5Bytes = pdfBuffer.slice(0, 5).toString();
      console.log('PDF signature check:', first5Bytes);
      
      if (!first5Bytes.startsWith('%PDF-')) {
        console.error('Invalid PDF signature:', first5Bytes);
        // Log thêm 20 bytes đầu để debug
        const first20Bytes = pdfBuffer.slice(0, 20).toString();
        console.error('First 20 bytes:', first20Bytes);
        throw new Error('Buffer không có PDF signature hợp lệ');
      }
      
      console.log(`PDF generated successfully. Size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;
      
    } catch (error) {
      console.error('Lỗi khi generate PDF:', error);
      throw new Error(`Không thể tạo PDF contract: ${error.message}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
          console.log('Browser closed successfully');
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
    }
  }

  /**
   * Tạo HTML content cho contract
   * @param {Object} contract - Contract object
   * @returns {String} HTML content
   */
  static createContractHTML(contract) {
    const formatDate = (date) => {
      const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      const vietnamDate = formatVietnamTime(date, 'DD/MM/YYYY');
      
      const dayName = days[formatVietnamTime(date, 'd')]; 
      return `${dayName}, ${vietnamDate}`;
    };

    const formatDateTime = (date) => {
      const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      const vietnamDateTime = formatVietnamTime(date, 'DD/MM/YYYY HH:mm');
     
      const dayName = days[formatVietnamTime(date, 'd')]; 
      return `${dayName}, ${vietnamDateTime}`;
    };

    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hợp đồng thuê xe điện - ${contract.code}</title>
        <style>
            body {
                font-family: 'Times New Roman', serif;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
                color: #333;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
            }
            .company-name {
                font-size: 24px;
                font-weight: bold;
                color: #2c5530;
                margin-bottom: 10px;
            }
            .contract-title {
                font-size: 20px;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 10px;
            }
            .contract-code {
                font-size: 16px;
                color: #666;
            }
            .content {
                margin-bottom: 30px;
            }
            .section {
                margin-bottom: 20px;
            }
            .section-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #2c5530;
                text-transform: uppercase;
            }
            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .info-table td {
                padding: 8px;
                border: 1px solid #ddd;
                vertical-align: top;
            }
            .info-table .label {
                font-weight: bold;
                background-color: #f5f5f5;
                width: 30%;
            }
            .signature-section {
                margin-top: 40px;
                display: flex;
                justify-content: space-between;
            }
            .signature-box {
                text-align: center;
                width: 45%;
            }
            .signature-line {
                border-bottom: 1px solid #333;
                height: 50px;
                margin-bottom: 10px;
            }
            .signature-label {
                font-weight: bold;
            }
            .terms {
                margin-top: 30px;
                font-size: 14px;
                line-height: 1.5;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 12px;
                color: #666;
                border-top: 1px solid #ddd;
                padding-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-name">EV RENTAL COMPANY</div>
            <div class="contract-title">${contract.title}</div>
            <div class="contract-code">Mã hợp đồng: ${contract.code}</div>
        </div>

        <div class="content">
            <div class="section">
                <div class="section-title">Thông tin khách hàng</div>
                <table class="info-table">
                    <tr>
                        <td class="label">Họ và tên:</td>
                        <td>${contract.user_id.fullname}</td>
                    </tr>
                    <tr>
                        <td class="label">Email:</td>
                        <td>${contract.user_id.email}</td>
                    </tr>
                    <tr>
                        <td class="label">Số điện thoại:</td>
                        <td>${contract.user_id.phone || 'N/A'}</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Thông tin xe</div>
                <table class="info-table">
                    <tr>
                        <td class="label">Tên xe:</td>
                        <td>${contract.vehicle_id.name}</td>
                    </tr>
                    <tr>
                        <td class="label">Biển số:</td>
                        <td>${contract.vehicle_id.license_plate}</td>
                    </tr>
                    <tr>
                        <td class="label">Model:</td>
                        <td>${contract.vehicle_id.model}</td>
                    </tr>
                    <tr>
                        <td class="label">Màu sắc:</td>
                        <td>${contract.vehicle_id.color}</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Thông tin thuê</div>
                <table class="info-table">
                    <tr>
                        <td class="label">Điểm thuê:</td>
                        <td>${contract.station_id.name}</td>
                    </tr>
                    <tr>
                        <td class="label">Địa chỉ:</td>
                        <td>${contract.station_id.address}</td>
                    </tr>
                    <tr>
                        <td class="label">Ngày bắt đầu:</td>
                        <td>${formatDate(contract.valid_from)}</td>
                    </tr>
                    <tr>
                        <td class="label">Ngày kết thúc:</td>
                        <td>${formatDate(contract.valid_until)}</td>
                    </tr>
                </table>
            </div>

            ${contract.special_conditions ? `
            <div class="section">
                <div class="section-title">Điều kiện đặc biệt</div>
                <p>${contract.special_conditions}</p>
            </div>
            ` : ''}

            <div class="section">
                <div class="section-title">Nội dung hợp đồng</div>
                <div class="content">${contract.content}</div>
            </div>
        </div>

        <div class="signature-section">
            <div class="signature-box">
                <div class="signature-label">Khách hàng</div>
                ${contract.customer_signature ? 
                  `<img src="data:image/png;base64,${contract.customer_signature}" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd;" />` : 
                  '<div class="signature-line"></div>'
                }
                <div>${contract.user_id.fullname}</div>
                ${contract.customer_signed_at ? `<div>Ký ngày: ${formatDateTime(contract.customer_signed_at)}</div>` : ''}
            </div>
            <div class="signature-box">
                <div class="signature-label">Nhân viên</div>
                ${contract.staff_signature ? 
                  `<img src="data:image/png;base64,${contract.staff_signature}" style="max-width: 200px; max-height: 100px; border: 1px solid #ddd;" />` : 
                  '<div class="signature-line"></div>'
                }
                <div>${contract.staff_signed_by ? contract.staff_signed_by.fullname : 'Chưa ký'}</div>
                ${contract.staff_signed_at ? `<div>Ký ngày: ${formatDateTime(contract.staff_signed_at)}</div>` : ''}
            </div>
        </div>

        <div class="terms">
            <div class="section-title">Điều khoản hợp đồng</div>
            <div>${contract.terms}</div>
        </div>

        <div class="footer">
            <p>Hợp đồng được tạo tự động bởi hệ thống EV Rental</p>
            <p>Ngày tạo: ${formatDateTime(contract.createdAt)}</p>
            ${contract.notes ? `<p>Ghi chú: ${contract.notes}</p>` : ''}
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Kiểm tra Cloudinary config
   * @returns {Boolean} Config đã sẵn sàng
   */
  static checkCloudinaryConfig() {
    return cloudinary.config().cloud_name && 
           cloudinary.config().api_key && 
           cloudinary.config().api_secret;
  }

  /**
   * Validate PDF buffer
   * @param {Buffer} buffer - PDF buffer
   * @returns {Boolean} Is valid PDF
   */
  static validatePDFBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
      return false;
    }
    
    // Kiểm tra PDF signature đầy đủ hơn
    const pdfSignature = buffer.slice(0, 5).toString();
    return pdfSignature === '%PDF-';
  }

  /**
   * Upload PDF to Cloudinary
   * @param {Buffer} pdfBuffer - PDF buffer
   * @param {String} contractCode - Contract code
   * @returns {Object} Upload result
   */
  static async uploadContractPDF(pdfBuffer, contractCode) {
    try {
      // Kiểm tra config trước khi upload
      if (!this.checkCloudinaryConfig()) {
        throw new Error('Cloudinary chưa được cấu hình');
      }

      // Validate PDF buffer
      if (!this.validatePDFBuffer(pdfBuffer)) {
        throw new Error('Buffer không phải là PDF hợp lệ');
      }

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'ev-rental/contracts',
            public_id: `contract-${contractCode}`,
            format: 'pdf'
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        uploadStream.end(pdfBuffer);
      });
    } catch (error) {
      console.error('Lỗi khi upload PDF:', error);
      throw new Error('Không thể upload PDF contract');
    }
  }

  /**
   * Format contract response
   * @param {Object} contract - Contract object
   * @returns {Object} Formatted contract
   */
  static formatContractResponse(contract) {
    return {
      _id: contract._id,
      code: contract.code,
      title: contract.title,
      status: contract.status,
      statusText: this.getStatusText(contract.status),
      valid_from: contract.valid_from,
      valid_until: contract.valid_until,
      special_conditions: contract.special_conditions,
      notes: contract.notes,
      contract_file_url: contract.contract_file_url,
      customer_signed_at: contract.customer_signed_at,
      staff_signed_at: contract.staff_signed_at,
      created_at: contract.createdAt,
      updated_at: contract.updatedAt,
      
      // Populated fields
      rental: contract.rental_id ? {
        _id: contract.rental_id._id,
        code: contract.rental_id.code,
        status: contract.rental_id.status
      } : null,
      
      customer: contract.user_id ? {
        _id: contract.user_id._id,
        fullname: contract.user_id.fullname,
        email: contract.user_id.email,
        phone: contract.user_id.phone
      } : null,
      
      vehicle: contract.vehicle_id ? {
        _id: contract.vehicle_id._id,
        name: contract.vehicle_id.name,
        license_plate: contract.vehicle_id.license_plate,
        model: contract.vehicle_id.model,
        color: contract.vehicle_id.color
      } : null,
      
      station: contract.station_id ? {
        _id: contract.station_id._id,
        name: contract.station_id.name,
        address: contract.station_id.address
      } : null,
      
      template: contract.template_id ? {
        _id: contract.template_id._id,
        name: contract.template_id.name,
        title: contract.template_id.title
      } : null,
      
      staff_signed_by: contract.staff_signed_by ? {
        _id: contract.staff_signed_by._id,
        fullname: contract.staff_signed_by.fullname,
        email: contract.staff_signed_by.email
      } : null,
      
      customer_signed_by: contract.customer_signed_by ? {
        _id: contract.customer_signed_by._id,
        fullname: contract.customer_signed_by.fullname,
        email: contract.customer_signed_by.email
      } : null
    };
  }

  /**
   * Get status text
   * @param {String} status - Contract status
   * @returns {String} Status text
   */
  static getStatusText(status) {
    const statusMap = {
      'pending': 'Chờ ký',
      'signed': 'Đã ký',
      'cancelled': 'Đã hủy',
      'expired': 'Hết hạn'
    };
    return statusMap[status] || status;
  }

  /**
   * Validate contract data
   * @param {Object} data - Contract data
   * @returns {Boolean} Is valid
   */
  static validateContractData(data) {
    const requiredFields = ['rental_id', 'template_id'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check contract expiration
   * @param {Object} contract - Contract object
   * @returns {Boolean} Is expired
   */
  static isContractExpired(contract) {
    const now = new Date();
    return now > new Date(contract.valid_until);
  }
}

module.exports = ContractService;

