const Booking = require("../models/Booking");
const PendingBooking = require("../models/PendingBooking");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const { sendEmail } = require("../config/nodemailer");
const { nowVietnam } = require("../config/timezone");

/**
 * Tự động hủy các booking quá hạn
 * Booking sẽ bị hủy nếu:
 * 1. Quá 2 tiếng sau thời gian pickup mà chưa được xác nhận
 * 2. Quá ngày end_date mà chưa được xác nhận
 */
const autoCancelExpiredBookings = async () => {
  try {
  
    const now = nowVietnam().toDate();
    
    // Tìm các booking cần hủy
    const expiredBookings = await Booking.find({
      status: "pending",
      $or: [
      
        {
          $expr: {
            $gt: [
              now,
              { $add: ["$start_date", { $multiply: [2, 60, 60, 1000] }] }
            ]
          }
        },
        // Quá ngày end_date
        {
          end_date: { $lt: now }
        }
      ]
    })
    .populate("user_id", "email fullname")
    .populate("vehicle_id", "licensePlate model")
    .populate("station_id", "name address");

    if (expiredBookings.length === 0) {
      return 0;
    }

    console.log(`Found ${expiredBookings.length} expired bookings to cancel`);

    // Cập nhật trạng thái booking thành cancelled
    const bookingIds = expiredBookings.map(booking => booking._id);
    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { 
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: "Auto-cancelled due to expiration"
      }
    );

    // Cập nhật trạng thái xe thành available
    const vehicleIds = expiredBookings.map(booking => booking.vehicle_id._id);
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      { status: "available" }
    );

    // Gửi email thông báo hủy booking
    for (const booking of expiredBookings) {
      try {
        await sendEmail({
          to: booking.user_id.email,
          subject: "Thông báo hủy đặt xe tự động",
          template: "booking-cancelled",
          context: {
            user: booking.user_id,
            booking: {
              code: booking.code,
              vehicle: booking.vehicle_id,
              station: booking.station_id,
              start_date: booking.start_date,
              end_date: booking.end_date,
              pickup_time: booking.pickup_time,
              return_time: booking.return_time,
              cancellation_reason: "Tự động hủy do quá hạn"
            }
          }
        });
        console.log(`Sent cancellation email to ${booking.user_id.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${booking.user_id.email}:`, emailError);
      }
    }

    console.log(`Successfully auto-cancelled ${expiredBookings.length} bookings`);
    return expiredBookings.length;

  } catch (error) {
    console.error("Error in autoCancelExpiredBookings:", error);
    throw error;
  }
};

/**
 * Kiểm tra và hủy booking quá hạn (manual trigger)
 */
const checkAndCancelExpiredBookings = async () => {
  try {
    const cancelledCount = await autoCancelExpiredBookings();
    return {
      success: true,
      message: `Đã kiểm tra và hủy ${cancelledCount} booking quá hạn`,
      cancelledCount
    };
  } catch (error) {
    console.error("Error in checkAndCancelExpiredBookings:", error);
    return {
      success: false,
      message: "Lỗi khi kiểm tra booking quá hạn",
      error: error.message
    };
  }
};

/**
 * Tự động cleanup PendingBookings hết hạn (không thanh toán)
 * Pending bookings sẽ bị xóa nếu quá 15 phút mà chưa thanh toán
 */
const autoCleanupExpiredPendingBookings = async () => {
  try {
    const now = nowVietnam().toDate();
    
    console.log('\n🧹 ========== CLEANUP EXPIRED PENDING BOOKINGS ==========');
    
    // Find expired pending bookings
    const expiredPendingBookings = await PendingBooking.find({
      status: 'pending_payment',
      expires_at: { $lt: now }
    }).populate('user_id', 'email fullname');
    
    if (expiredPendingBookings.length === 0) {
      console.log('✅ No expired pending bookings to cleanup');
      console.log('🔚 ========== END CLEANUP ==========\n');
      return 0;
    }
    
    console.log(`⚠️ Found ${expiredPendingBookings.length} expired pending bookings`);
    
    // Update status to expired (không xóa ngay để audit)
    const pendingBookingIds = expiredPendingBookings.map(pb => pb._id);
    await PendingBooking.updateMany(
      { _id: { $in: pendingBookingIds } },
      { status: 'expired' }
    );
    
    console.log(`✅ Marked ${expiredPendingBookings.length} pending bookings as expired`);
    
    // Optional: Gửi email thông báo (nếu cần)
    for (const pendingBooking of expiredPendingBookings) {
      try {
        // Có thể gửi email nhắc nhở user rằng booking đã hết hạn
        console.log(`📧 Pending booking ${pendingBooking.temp_id} expired for user ${pendingBooking.user_id.email}`);
      } catch (error) {
        console.error(`Email error for ${pendingBooking.user_id.email}:`, error.message);
      }
    }
    
    console.log('🔚 ========== END CLEANUP ==========\n');
    return expiredPendingBookings.length;
    
  } catch (error) {
    console.error('❌ Error in autoCleanupExpiredPendingBookings:', error);
    throw error;
  }
};

/**
 * Delete old expired/completed pending bookings (cleanup storage)
 * Run this less frequently (e.g., once a day) to delete old records
 */
const deleteOldPendingBookings = async () => {
  try {
    const now = nowVietnam().toDate();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    console.log('\n🗑️ ========== DELETE OLD PENDING BOOKINGS ==========');
    
    // Delete pending bookings that are expired/completed and older than 24 hours
    const result = await PendingBooking.deleteMany({
      status: { $in: ['expired', 'completed', 'cancelled'] },
      updatedAt: { $lt: oneDayAgo }
    });
    
    console.log(`🗑️ Deleted ${result.deletedCount} old pending bookings`);
    console.log('🔚 ========== END DELETE ==========\n');
    
    return result.deletedCount;
    
  } catch (error) {
    console.error('❌ Error in deleteOldPendingBookings:', error);
    throw error;
  }
};

/**
 * Tự động unreserve vehicles với soft lock đã hết hạn
 * Chạy mỗi 5 phút để unreserve xe đang chờ thanh toán phí giữ chỗ
 */
const autoUnreserveExpiredVehicles = async () => {
  try {
    const now = nowVietnam().toDate();
    const Vehicle = require("../models/Vehicle");
    
    console.log('\n🔓 ========== AUTO UNRESERVE EXPIRED VEHICLES ==========');
    
    // Find vehicles với soft lock (holding_fee_payment) đã expired
    const expiredVehicles = await Vehicle.find({
      status: 'reserved',
      reserved_for: 'holding_fee_payment',
      reserved_until: { $lt: now }
    });
    
    if (expiredVehicles.length === 0) {
      console.log('✅ No expired vehicle reservations to release');
      console.log('🔚 ========== END UNRESERVE ==========\n');
      return 0;
    }
    
    console.log(`⚠️ Found ${expiredVehicles.length} vehicles with expired soft locks`);
    
    // Unreserve vehicles
    const vehicleIds = expiredVehicles.map(v => v._id);
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      { 
        status: 'available',
        reserved_for: '',
        reserved_at: null,
        reserved_until: null
      }
    );
    
    console.log(`✅ Unreserved ${expiredVehicles.length} vehicles`);
    
    // Log details
    for (const vehicle of expiredVehicles) {
      console.log(`  - ${vehicle.license_plate} (${vehicle.name}) - Was reserved until ${vehicle.reserved_until.toLocaleString('vi-VN')}`);
    }
    
    console.log('🔚 ========== END UNRESERVE ==========\n');
    return expiredVehicles.length;
    
  } catch (error) {
    console.error('❌ Error in autoUnreserveExpiredVehicles:', error);
    throw error;
  }
};

module.exports = {
  autoCancelExpiredBookings,
  checkAndCancelExpiredBookings,
  autoCleanupExpiredPendingBookings,
  deleteOldPendingBookings,
  autoUnreserveExpiredVehicles // NEW
};

