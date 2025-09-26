/**
 * PaymentService - Xử lý logic thanh toán
 * 
 * Chức năng:
 * - Tạo QR Code thanh toán
 * - Xử lý payment methods
 * - Tính toán refund
 * - Validation payment
 */

const QRCode = require('qrcode');
const crypto = require('crypto');

class PaymentService {
  /**
   * Tạo QR Code thanh toán
   * @param {Object} payment - Payment object
   * @returns {Object} QR Code data và image
   */
  static async generatePaymentQR(payment) {
    try {
      // Tạo QR data cho thanh toán
      const qrData = {
        amount: payment.amount,
        content: `EV Rental - ${payment.payment_type.toUpperCase()} - ${payment.code}`,
        account: process.env.COMPANY_BANK_ACCOUNT || '1234567890',
        bank: process.env.COMPANY_BANK_NAME || 'TEST BANK',
        paymentCode: payment.code,
        timestamp: new Date().toISOString()
      };

      // Tạo QR Code image
      const qrImageUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return {
        qrData: JSON.stringify(qrData),
        qrImageUrl: qrImageUrl,
        qrText: `Chuyển khoản ${payment.amount.toLocaleString('vi-VN')} VND\nNội dung: ${qrData.content}\nTK: ${qrData.account} - ${qrData.bank}`
      };
    } catch (error) {
      console.error('Lỗi khi tạo QR Code:', error);
      throw new Error('Không thể tạo QR Code thanh toán');
    }
  }


  /**
   * Tính toán refund amount
   * @param {Number} depositAmount - Số tiền cọc
   * @param {Number} additionalFees - Tổng phí phát sinh
   * @returns {Number} Số tiền hoàn lại
   */
  static calculateRefund(depositAmount, additionalFees = 0) {
    const refundAmount = depositAmount - additionalFees;
    return Math.max(0, refundAmount); // Không được âm
  }

  /**
   * Validate payment amount
   * @param {Number} amount - Số tiền thanh toán
   * @param {Number} expectedAmount - Số tiền mong đợi
   * @returns {Boolean} Có hợp lệ không
   */
  static validatePaymentAmount(amount, expectedAmount) {
    return amount >= expectedAmount && amount > 0;
  }

  /**
   * Tạo payment code
   * @returns {String} Payment code
   */
  static generatePaymentCode() {
    const timestamp = Date.now().toString().substring(6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PAY${timestamp}${random}`;
  }

  /**
   * Format payment data cho response
   * @param {Object} payment - Payment object
   * @returns {Object} Formatted payment data
   */
  static formatPaymentResponse(payment) {
    return {
      _id: payment._id,
      code: payment.code,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_type: payment.payment_type,
      status: payment.status,
      reason: payment.reason,
      transaction_id: payment.transaction_id,
      qr_code_data: payment.qr_code_data,
      qr_code_image: payment.qr_code_image,
      vnpay_url: payment.vnpay_url,
      notes: payment.notes,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      // Populated fields
      user_id: payment.user_id,
      booking_id: payment.booking_id,
      rental_id: payment.rental_id,
      processed_by: payment.processed_by
    };
  }

  /**
   * Kiểm tra payment có thể hoàn tiền không
   * @param {Object} payment - Payment object
   * @returns {Boolean} Có thể hoàn tiền không
   */
  static canRefund(payment) {
    return payment.status === 'completed' && 
           payment.payment_type === 'deposit' && 
           payment.refund_amount === 0;
  }

  /**
   * Tạo payment summary cho customer
   * @param {Array} payments - Danh sách payments
   * @returns {Object} Payment summary
   */
  static createPaymentSummary(payments) {
    const summary = {
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0,
      refundAmount: 0,
      paymentTypes: {},
      paymentMethods: {}
    };

    payments.forEach(payment => {
      summary.totalAmount += payment.amount;
      
      if (payment.status === 'completed') {
        summary.paidAmount += payment.amount;
      } else if (payment.status === 'pending') {
        summary.pendingAmount += payment.amount;
      }

      if (payment.refund_amount > 0) {
        summary.refundAmount += payment.refund_amount;
      }

      // Count payment types
      summary.paymentTypes[payment.payment_type] = 
        (summary.paymentTypes[payment.payment_type] || 0) + 1;

      // Count payment methods
      summary.paymentMethods[payment.payment_method] = 
        (summary.paymentMethods[payment.payment_method] || 0) + 1;
    });

    return summary;
  }
}

module.exports = PaymentService;
