/**
 * DepositService - Quản lý logic tính cọc
 * 
 * Chính sách cọc hiện tại:
 * - Thuê dưới 3 ngày: thanh toán full, không cọc
 * - Thuê từ 3 ngày trở lên: cọc 50% tổng giá thuê
 * - Cọc cố định cho Vehicle: 10 lần giá thuê 1 ngày
 */

class DepositService {
  /**
   * Lấy chính sách cọc hiện tại
   */
  static getDepositPolicy() {
    return {
      // Thuê dưới 3 ngày: thanh toán full, không cọc
      under3Days: {
        depositPercentage: 0,
        description: 'Thanh toán full, không cọc'
      },
      // Thuê từ 3 ngày trở lên: cọc 50%
      from3Days: {
        depositPercentage: 50,
        description: 'Cọc 50% tổng giá thuê'
      }
    };
  }

  /**
   * Tính cọc dựa trên số ngày thuê (cho booking)
   * @param {number} pricePerDay - Giá thuê 1 ngày
   * @param {number} totalDays - Tổng số ngày thuê
   * @returns {number} Số tiền cọc
   */
  static calculateDeposit(pricePerDay, totalDays) {
    const policy = this.getDepositPolicy();
    
    if (totalDays < 3) {
      // Thuê dưới 3 ngày: không cọc
      return 0;
    } else {
      // Thuê từ 3 ngày trở lên: cọc 50%
      const totalPrice = pricePerDay * totalDays;
      return totalPrice * (policy.from3Days.depositPercentage / 100);
    }
  }

  /**
   * Tính cọc cố định (cho Vehicle model)
   * @param {number} pricePerDay - Giá thuê 1 ngày
   * @param {number} depositPercentage - Phần trăm cọc (mặc định 1000% = 10 lần)
   * @returns {number} Số tiền cọc cố định
   */
  static calculateFixedDeposit(pricePerDay, depositPercentage = 1000) {
    // Cọc cố định = pricePerDay * (depositPercentage / 100)
    return pricePerDay * (depositPercentage / 100);
  }

  /**
   * Lấy mô tả chính sách cọc
   * @param {number} totalDays - Tổng số ngày thuê
   * @returns {string} Mô tả chính sách
   */
  static getDepositDescription(totalDays) {
    const policy = this.getDepositPolicy();
    
    if (totalDays < 3) {
      return policy.under3Days.description;
    } else {
      return policy.from3Days.description;
    }
  }
}

module.exports = DepositService;
