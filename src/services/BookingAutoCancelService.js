const Booking = require("../models/Booking");
const PendingBooking = require("../models/PendingBooking");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const { sendEmail } = require("../config/emailService");
const { nowVietnam } = require("../config/timezone");

/**
 * Tự động hủy các booking quá hạn
 * Booking sẽ bị hủy nếu:
 * 1. Quá 2 tiếng sau thời gian pickup (start_date + pickup_time) mà chưa được xác nhận
 * 2. Quá ngày end_date mà chưa được xác nhận
 */
const autoCancelExpiredBookings = async () => {
  try {
    const now = nowVietnam().toDate();
    
    console.log('\n🔍 ========== CHECKING EXPIRED BOOKINGS ==========');
    console.log('Current time (VN):', now.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    
    // Tìm tất cả booking PENDING (không dùng $expr vì cần tính pickup_time)
    const pendingBookings = await Booking.find({
      status: "pending"
    })
    .populate("user_id", "email fullname")
    .populate("vehicle_id", "license_plate model name")
    .populate("station_id", "name address");

    if (pendingBookings.length === 0) {
      console.log('✅ No pending bookings found');
      console.log('🔚 ========== END CHECK ==========\n');
      return 0;
    }

    console.log(`📋 Found ${pendingBookings.length} pending bookings to check`);

    // Filter bookings cần hủy
    const expiredBookings = [];
    
    for (const booking of pendingBookings) {
      let shouldCancel = false;
      let reason = "";

      // ✅ FIX: Parse pickup_time và kết hợp với start_date
      const [pickupHour, pickupMinute] = booking.pickup_time.split(':').map(Number);
      const pickupDateTime = new Date(booking.start_date);
      pickupDateTime.setHours(pickupHour, pickupMinute, 0, 0);
      
      // Grace period: 2 tiếng sau pickup time
      const gracePeriod = new Date(pickupDateTime.getTime() + 2 * 60 * 60 * 1000);
      
      console.log(`\n📦 Booking ${booking.code}:`);
      console.log(`  - Start date: ${booking.start_date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
      console.log(`  - Pickup time: ${booking.pickup_time}`);
      console.log(`  - Exact pickup: ${pickupDateTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
      console.log(`  - Grace period (pickup + 2h): ${gracePeriod.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
      console.log(`  - End date: ${booking.end_date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

      // Check 1: Quá 2 tiếng sau pickup time
      if (now > gracePeriod) {
        shouldCancel = true;
        reason = `Quá 2 tiếng sau thời gian nhận xe (${booking.pickup_time} ngày ${pickupDateTime.toLocaleDateString('vi-VN')})`;
        console.log(`  ❌ EXPIRED: ${reason}`);
      }
      // Check 2: Quá ngày end_date
      else if (now > booking.end_date) {
        shouldCancel = true;
        reason = `Quá ngày trả xe dự kiến (${booking.end_date.toLocaleDateString('vi-VN')})`;
        console.log(`  ❌ EXPIRED: ${reason}`);
      } else {
        const timeRemaining = Math.round((gracePeriod - now) / (1000 * 60)); // minutes
        console.log(`  ✅ STILL VALID (${timeRemaining} minutes remaining until grace period)`);
      }

      if (shouldCancel) {
        expiredBookings.push({ booking, reason });
      }
    }

    if (expiredBookings.length === 0) {
      console.log('\n✅ No expired bookings to cancel');
      console.log('🔚 ========== END CHECK ==========\n');
      return 0;
    }

    console.log(`\n⚠️ Cancelling ${expiredBookings.length} expired bookings...`);

    // Hủy từng booking
    for (const { booking, reason } of expiredBookings) {
      // Update booking status
      await Booking.findByIdAndUpdate(booking._id, {
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: `Tự động hủy: ${reason}`
      });

      console.log(`🚫 Cancelled booking ${booking.code}`);

      // Update vehicle status
      if (booking.vehicle_id && booking.vehicle_id._id) {
        await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
          status: "available"
        });
        console.log(`  ↳ Vehicle ${booking.vehicle_id.license_plate} set to available`);
      }

      // Send cancellation email
      try {
        await sendEmail({
          to: booking.user_id.email,
          subject: "⚠️ Thông báo hủy đặt xe tự động - EVRent",
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
              cancellation_reason: reason
            }
          }
        });
        console.log(`  ↳ ✉️ Email sent to ${booking.user_id.email}`);
      } catch (emailError) {
        console.error(`  ↳ ❌ Email failed: ${emailError.message}`);
      }
    }

    console.log(`\n✅ Successfully cancelled ${expiredBookings.length} bookings`);
    console.log('🔚 ========== END CHECK ==========\n');
    return expiredBookings.length;

  } catch (error) {
    console.error("❌ Error in autoCancelExpiredBookings:", error);
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
    const Booking = require("../models/Booking");
    const PendingBooking = require("../models/PendingBooking");
    
    console.log('\n🔓 ========== AUTO UNRESERVE EXPIRED VEHICLES ==========');
    
    // Find TẤT CẢ vehicles reserved (không chỉ có reserved_until)
    const reservedVehicles = await Vehicle.find({
      status: 'reserved'
    });
    
    if (reservedVehicles.length === 0) {
      console.log('✅ No reserved vehicles found');
      console.log('🔚 ========== END UNRESERVE ==========\n');
      return 0;
    }
    
    console.log(`📊 Found ${reservedVehicles.length} reserved vehicles to check`);
    
    let unreservedCount = 0;
    let skippedCount = 0;
    
    for (const vehicle of reservedVehicles) {
      let shouldUnreserve = false;
      let reason = '';
    
      // Check 1: Xe có reserved_until và đã quá hạn
      if (vehicle.reserved_until && vehicle.reserved_until < now) {
        shouldUnreserve = true;
        reason = `Reserved until expired (${vehicle.reserved_until.toLocaleString('vi-VN')})`;
      }
      
      // Check 2: Xe KHÔNG có reserved_until hoặc reserved_for (bị lỗi)
      if (!vehicle.reserved_until || !vehicle.reserved_for || vehicle.reserved_for === '') {
        // Cần check xem có booking/pending booking active không
        const hasActiveBooking = await Booking.findOne({
          vehicle_id: vehicle._id,
          status: { $in: ['pending', 'confirmed'] }  // Chỉ pending và confirmed, KHÔNG có checked_out
        });
        
        const hasPendingBooking = await PendingBooking.findOne({
          'booking_data.vehicle_id': vehicle._id.toString(),
          status: 'pending_payment'
        });
        
        if (!hasActiveBooking && !hasPendingBooking) {
          shouldUnreserve = true;
          reason = 'No reserved_until/reserved_for and no active booking';
        } else {
          console.log(`  ⏭️  ${vehicle.license_plate} - Has active booking, keeping reserved`);
          skippedCount++;
          continue;
        }
      }
      
      if (shouldUnreserve) {
        await Vehicle.findByIdAndUpdate(vehicle._id, {
        status: 'available',
        reserved_for: '',
        reserved_at: null,
        reserved_until: null
        });
    
        console.log(`  ✅ Unreserved: ${vehicle.license_plate} - ${reason}`);
        unreservedCount++;
      } else {
        // Xe có reserved_until nhưng chưa hết hạn
        const timeRemaining = vehicle.reserved_until ? Math.round((vehicle.reserved_until - now) / (1000 * 60)) : 0;
        console.log(`  ⏳ ${vehicle.license_plate} - Reserved until ${vehicle.reserved_until?.toLocaleString('vi-VN') || 'N/A'} (${timeRemaining} min)`);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  ✅ Unreserved: ${unreservedCount} vehicles`);
    console.log(`  ⏭️  Skipped: ${skippedCount} vehicles`);
    console.log('🔚 ========== END UNRESERVE ==========\n');
    
    return unreservedCount;
    
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

