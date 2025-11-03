const mongoose = require('mongoose');

/**
 * PendingBooking Model
 * Lưu temporary booking data trước khi user thanh toán holding fee
 * Data sẽ bị xóa sau khi:
 * - User thanh toán thành công (chuyển thành Booking)
 * - Hết hạn 15 phút (auto cleanup)
 */
const pendingBookingSchema = new mongoose.Schema({
  // Unique temp ID để track
  temp_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // User info
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Booking data (sẽ được copy sang Booking sau khi pay)
  booking_data: {
    model: { type: String, required: true },
    color: { type: String, required: true },
    station_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    pickup_time: { type: String, required: true },
    return_time: { type: String, required: true },
    special_requests: { type: String, default: '' },
    notes: { type: String, default: '' },
    price_per_day: { type: Number, required: true },
    total_days: { type: Number, required: true },
    total_price: { type: Number, required: true },
    deposit_amount: { type: Number, required: true }
  },
  
  // Holding fee info
  holding_fee_amount: {
    type: Number,
    default: 50000,
    required: true
  },
  
  // VNPay tracking
  vnpay_url: {
    type: String,
    default: ''
  },
  
  // Session/conversation tracking (for chatbot)
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    default: null
  },
  
  session_id: {
    type: String,
    default: ''
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending_payment', 'paid', 'completed', 'expired', 'cancelled'],
    default: 'pending_payment'
  },
  
  // Expiration (15 minutes from creation)
  expires_at: {
    type: Date,
    required: true,
    index: true
  }
  
}, { timestamps: true });

// Index for auto cleanup
pendingBookingSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Index cho queries
pendingBookingSchema.index({ user_id: 1, status: 1 });
pendingBookingSchema.index({ temp_id: 1, status: 1 });


pendingBookingSchema.index(
  { user_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending_payment',
      expires_at: { $gte: new Date() }
    },
    name: 'unique_active_pending_per_user'
  }
);

const PendingBooking = mongoose.model('PendingBooking', pendingBookingSchema);

module.exports = PendingBooking;

