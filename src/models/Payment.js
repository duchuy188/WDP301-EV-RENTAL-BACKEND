const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Thông tin cơ bản
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true 
  },
  
  // Liên kết
  rental_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Rental',
    required: false // Không bắt buộc vì deposit payment chưa có rental
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  booking_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Booking',
    required: true 
  },
  
  // Thông tin thanh toán
  amount: { 
    type: Number, 
    required: true,
    min: 0
  },
  payment_method: { 
    type: String, 
    enum: [
      'cash',           // Tiền mặt
      'qr_code',        // QR Code thanh toán
      'bank_transfer',  // Chuyển khoản ngân hàng
      'vnpay'           // VNPay online
    ],
    required: true 
  },
  
  // Trạng thái thanh toán
  status: { 
    type: String, 
    enum: [
      'pending',      // Chờ thanh toán
      'completed',    // Đã thanh toán
      'cancelled'     // Đã hủy
    ], 
    default: 'pending' 
  },
  
  // Loại thanh toán
  payment_type: { 
    type: String, 
    enum: [
      'deposit',      // Đặt cọc
      'rental_fee',   // Phí thuê xe
      'additional_fee', // Phí phát sinh
      'refund'        // Hoàn tiền
    ],
    required: true 
  },
  
  // Lý do phí phát sinh (tự nhập)
  reason: { 
    type: String, 
    default: '' 
  },
  
  // Thông tin giao dịch
  transaction_id: { 
    type: String, 
    default: '' 
  },
  payment_gateway: { 
    type: String, 
    default: '' 
  },
  
  // QR Code thông tin
  qr_code_data: { 
    type: String, 
    default: '' 
  },
  qr_code_image: { 
    type: String, 
    default: '' 
  },
  
  // VNPay thông tin
  vnpay_url: { 
    type: String, 
    default: '' 
  },
  vnpay_transaction_no: { 
    type: String, 
    default: '' 
  },
  vnpay_bank_code: { 
    type: String, 
    default: '' 
  },
  
  // Thông tin hoàn tiền
  refund_amount: { 
    type: Number, 
    default: 0,
    min: 0
  },
  refund_reason: { 
    type: String, 
    default: '' 
  },
  refunded_at: { 
    type: Date, 
    default: null 
  },
  refunded_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  
  // Ghi chú
  notes: { 
    type: String, 
    default: '' 
  },
  
  // Metadata
  processed_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  is_active: { 
    type: Boolean, 
    default: true 
  }
}, { timestamps: true });

// Indexes

paymentSchema.index({ rental_id: 1 });
paymentSchema.index({ user_id: 1 });
paymentSchema.index({ booking_id: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ payment_type: 1 });
paymentSchema.index({ user_id: 1, status: 1 });
paymentSchema.index({ rental_id: 1, payment_type: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;