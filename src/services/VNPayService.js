/**
 * VNPayService - Xử lý tích hợp VNPay Sandbox
 * 
 * Chức năng:
 * - Tạo URL thanh toán VNPay
 * - Xử lý callback từ VNPay
 * - Validate response từ VNPay
 * - Tạo QR Code VNPay
 */

const crypto = require('crypto');
const moment = require('moment');

class VNPayService {
  constructor() {
    // VNPay Sandbox Configuration - Sử dụng thông tin từ .env
    this.config = {
      vnp_TmnCode: process.env.VNPAY_TMN_CODE || 'Y9GMA2Q6',        
      vnp_HashSecret: process.env.VNPAY_HASH_SECRET || 'OW4GTBKCL9WHTRS7NGNCQQIIIRNRRJ29',     
      vnp_Url: process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',                
      vnp_ReturnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:5000/api/payments/vnpay/callback',   
      vnp_ApiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_CurrCode: 'VND',
      vnp_Locale: 'vn'
    };
  }

  /**
   * Tạo URL thanh toán VNPay
   * @param {Object} payment - Payment object
   * @param {String} ipAddress - IP address của user
   * @returns {Object} VNPay URL và thông tin
   */
  createPaymentUrl(payment, ipAddress = '127.0.0.1') {
    try {
      // ✅ Convert IPv6 localhost thành IPv4
      let clientIP = ipAddress;
      if (clientIP === '::1' || clientIP === '::ffff:127.0.0.1') {
        clientIP = '127.0.0.1';
      }


  const createDate = moment().format('YYYYMMDDHHmmss');
  const expireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss'); // Some gateways require this when version=2.1.0
      
     
      const originalOrderId = payment.payment_code || `PAY${Date.now()}`;
    
      let numericTxnRef = originalOrderId.replace(/[^0-9]/g, '');
      if (numericTxnRef.length === 0) {
        numericTxnRef = Date.now().toString();
      }
    
      if (numericTxnRef.length > 20) numericTxnRef = numericTxnRef.substring(0,20);
      const orderId = originalOrderId; // vẫn trả về cho hệ thống nội bộ
      const txnRef = numericTxnRef; // dùng cho VNPay
      const orderInfo = `Thanh toan ${payment.payment_type} ${orderId}`;


    
      if (!this.config.vnp_TmnCode || !this.config.vnp_HashSecret || !this.config.vnp_Url || !this.config.vnp_ReturnUrl) {
        throw new Error('Thiếu cấu hình VNPay bắt buộc');
      }


      const vnpParams = {
        vnp_Version: this.config.vnp_Version.toString(),
        vnp_Command: this.config.vnp_Command.toString(),
        vnp_TmnCode: this.config.vnp_TmnCode.toString(),
        vnp_Amount: (payment.amount * 100).toString(),
        vnp_CurrCode: this.config.vnp_CurrCode.toString(),
  vnp_TxnRef: txnRef.toString(),
        vnp_OrderInfo: this.normalizeOrderInfo(orderInfo.toString()),
        vnp_OrderType: 'other',
        vnp_Locale: this.config.vnp_Locale.toString(),
        vnp_ReturnUrl: this.config.vnp_ReturnUrl.toString(),
        vnp_IpAddr: clientIP.toString(),
        vnp_CreateDate: createDate.toString(),
        vnp_ExpireDate: expireDate.toString(),
        vnp_SecureHashType: 'HMACSHA512'
      };

      // Sắp xếp tham số theo alphabet
      const sortedParams = this.sortObject(vnpParams);

      // Chuẩn bị dữ liệu ký (theo chuẩn: encode key & value rồi nối = và &)
      const signData = this.buildSignData(sortedParams);

      // Tạo secure hash
      const secureHash = this.createSecureHash(signData);

      // Thêm secure hash
      sortedParams.vnp_SecureHash = secureHash;

      // Tạo URL cuối cùng với encoding
      const finalQueryString = this.createQueryString(sortedParams);
      const paymentUrl = `${this.config.vnp_Url}?${finalQueryString}`;

      return {
        paymentUrl,
  orderId,
  txnRef,
        orderInfo,
        amount: payment.amount,
        createDate,
        expireDate,
        params: sortedParams
      };

    } catch (error) {
      console.error('Lỗi khi tạo VNPay URL:', error);
      throw new Error('Không thể tạo URL thanh toán VNPay');
    }
  }

  /**
   * Tạo QR Code VNPay
   * @param {Object} payment - Payment object
   * @param {String} ipAddress - IP address của user
   * @returns {Object} QR Code data
   */
  async createVNPayQR(payment, ipAddress = '127.0.0.1') {
    try {
      const vnpayData = this.createPaymentUrl(payment, ipAddress);
      
      // Import QRCode dynamically
      const QRCode = require('qrcode');
      
      const qrImageUrl = await QRCode.toDataURL(vnpayData.paymentUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return {
        qrData: vnpayData.paymentUrl,
        qrImageUrl: qrImageUrl,
        qrText: `VNPay: ${payment.amount.toLocaleString('vi-VN')} VND\nQuét QR để thanh toán`,
        vnpayData: vnpayData
      };

    } catch (error) {
      console.error('Lỗi khi tạo VNPay QR:', error);
      throw new Error('Không thể tạo QR Code VNPay');
    }
  }

  /**
   * Xử lý callback từ VNPay
   * @param {Object} queryParams - Query parameters từ VNPay
   * @returns {Object} Kết quả xử lý
   */
  processCallback(queryParams) {
    try {
      // Tách secure hash
      const { vnp_SecureHash, ...params } = queryParams;

      // Sắp xếp params
      const sortedParams = this.sortObject(params);

  // Dùng cùng logic buildSignData như khi tạo URL
  const signData = this.buildSignData(sortedParams);
  const secureHash = this.createSecureHash(signData);

      // Verify hash
      const isValid = secureHash === vnp_SecureHash;

      if (!isValid) {
        return {
          success: false,
          message: 'Hash không hợp lệ',
          code: 'INVALID_HASH'
        };
      }

      // Parse response
      const responseCode = params.vnp_ResponseCode;
      const transactionNo = params.vnp_TransactionNo;
      const amount = parseInt(params.vnp_Amount) / 100; // Convert back from VNPay format
      const orderId = params.vnp_TxnRef;

      let status = 'failed';
      let message = 'Thanh toán thất bại';

      switch (responseCode) {
        case '00':
          status = 'success';
          message = 'Thanh toán thành công';
          break;
        case '07':
          status = 'failed';
          message = 'Trừ tiền thành công, giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)';
          break;
        case '09':
          status = 'failed';
          message = 'Giao dịch không thành công do: Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking';
          break;
        case '10':
          status = 'failed';
          message = 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần';
          break;
        case '11':
          status = 'failed';
          message = 'Đã hết hạn chờ thanh toán. Xin vui lòng thực hiện lại giao dịch';
          break;
        case '12':
          status = 'failed';
          message = 'Giao dịch bị hủy';
          break;
        case '24':
          status = 'failed';
          message = 'Giao dịch không thành công do: Khách hàng hủy giao dịch';
          break;
        case '51':
          status = 'failed';
          message = 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch';
          break;
        case '65':
          status = 'failed';
          message = 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày';
          break;
        case '75':
          status = 'failed';
          message = 'Ngân hàng thanh toán đang bảo trì';
          break;
        case '79':
          status = 'failed';
          message = 'Nhập sai mật khẩu thanh toán quá số lần quy định';
          break;
        default:
          status = 'failed';
          message = 'Giao dịch không thành công';
      }

      return {
        success: status === 'success',
        status,
        message,
        transactionNo,
        amount,
        orderId,
        responseCode,
        params
      };

    } catch (error) {
      console.error('Lỗi khi xử lý VNPay callback:', error);
      return {
        success: false,
        message: 'Lỗi xử lý callback',
        code: 'PROCESSING_ERROR'
      };
    }
  }

  /**
   * Kiểm tra trạng thái giao dịch
   * @param {String} orderId - Order ID
   * @returns {Object} Trạng thái giao dịch
   */
  async checkTransactionStatus(orderId) {
    try {
      const date = new Date();
      const createDate = moment(date).format('YYYYMMDDHHmmss');

      const params = {
        vnp_Version: this.config.vnp_Version,
        vnp_Command: 'querydr',
        vnp_TmnCode: this.config.vnp_TmnCode,
        vnp_TxnRef: orderId,
        vnp_CreateDate: createDate
      };

      const sortedParams = this.sortObject(params);
      const queryString = this.createQueryStringForHash(sortedParams);
      const secureHash = this.createSecureHash(queryString);

      const requestUrl = `${this.config.vnp_ApiUrl}?${queryString}&vnp_SecureHash=${secureHash}`;

      // Note: Trong thực tế, bạn cần gọi API này từ server
      // Đây chỉ là demo, VNPay Sandbox có thể không hỗ trợ đầy đủ
      return {
        success: true,
        message: 'API check status không khả dụng trong Sandbox',
        requestUrl
      };

    } catch (error) {
      console.error('Lỗi khi kiểm tra trạng thái giao dịch:', error);
      return {
        success: false,
        message: 'Không thể kiểm tra trạng thái giao dịch'
      };
    }
  }

  /**
   * Sắp xếp object theo alphabet - VNPay chuẩn
   * @param {Object} obj - Object cần sắp xếp
   * @returns {Object} Object đã sắp xếp
   */
  sortObject(obj) {
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
    keys.sort();
    const result = {};
    keys.forEach(k => {
      result[k] = obj[k];
    });
    return result;
  }

  /**
   * Tạo query string từ object - VNPay official demo way
   * @param {Object} params - Parameters
   * @returns {String} Query string với URL encoding
   */
  createQueryString(params) {
    // Encode giống lúc ký: dùng encodeURIComponent và thay %20 -> +
    const keys = Object.keys(params);
    keys.sort();
    return keys.map(k => {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]).replace(/%20/g, '+');
    }).join('&');
  }

  /**
   * Tạo query string RAW cho hash calculation - KHÔNG encode
   * @param {Object} params - Parameters
   * @returns {String} Query string RAW
   */
  createQueryStringForHash(params) {
   
    const result = [];
    for (let key in params) {
      if (params.hasOwnProperty(key) && params[key] != null && params[key] !== '') {
        result.push(key + "=" + params[key]);
      }
    }
    return result.join("&");
  }

  /**
   * Tạo secure hash - VNPay official demo
   * @param {String} queryString - Query string RAW
   * @returns {String} Secure hash
   */
  createSecureHash(queryString) {
    // ✅ VNPay official demo way - fixed Buffer deprecation warning
    const crypto = require("crypto");     
    const hmac = crypto.createHmac("sha512", this.config.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(queryString, 'utf-8')).digest("hex");
    
    return signed;
  }

  /**
   * Build sign data: encode each key & value (encodeURIComponent) then join with '=' and '&'.
   * Spaces must be encoded as '+' instead of '%20' for compatibility.
   */
  buildSignData(params) {
    const keys = Object.keys(params).filter(k => k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType');
    keys.sort();
    const pairs = keys.map(k => {
      const encKey = encodeURIComponent(k);
      const encVal = encodeURIComponent(params[k]).replace(/%20/g, '+');
      return encKey + '=' + encVal;
    });
    return pairs.join('&');
  }

  /**
   * Chuẩn hóa OrderInfo: bỏ dấu tiếng Việt, giới hạn độ dài, chỉ giữ ký tự an toàn
   */
  normalizeOrderInfo(text) {
    if (!text) return 'Thanh toan';
    // Remove Vietnamese accents
    const noAccents = text.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    // Remove any disallowed symbols (keep letters, numbers, space, hyphen, underscore)
    const safe = noAccents.replace(/[^A-Za-z0-9 _-]/g, ' ').replace(/\s+/g, ' ').trim();
    // Limit length (VNPay usually allows up to 255, but keep short)
    return safe.substring(0, 120);
  }

  /**
   * Lấy thông tin cấu hình VNPay
   * @returns {Object} Thông tin cấu hình
   */
  getConfig() {
    return {
      merchantCode: this.config.vnp_TmnCode,
      returnUrl: this.config.vnp_ReturnUrl,
      version: this.config.vnp_Version,
      currency: this.config.vnp_CurrCode,
      locale: this.config.vnp_Locale
    };
  }
}

module.exports = VNPayService;
