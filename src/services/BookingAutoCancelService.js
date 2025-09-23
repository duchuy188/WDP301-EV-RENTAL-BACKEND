const Booking = require("../models/Booking");
const Vehicle = require("../models/Vehicle");
const User = require("../models/User");
const { sendEmail } = require("../config/nodemailer");

/**
 * Tự động hủy các booking quá hạn
 * Booking sẽ bị hủy nếu:
 * 1. Quá 2 tiếng sau thời gian pickup mà chưa được xác nhận
 * 2. Quá ngày end_date mà chưa được xác nhận
 */
const autoCancelExpiredBookings = async () => {
  try {
    const now = new Date();
    
    // Tìm các booking cần hủy
    const expiredBookings = await Booking.find({
      status: "pending",
      $or: [
        // Quá 2 tiếng sau pickup time
        {
          $expr: {
            $lt: [
              { $add: ["$start_date", { $multiply: [2, 60, 60, 1000] }] }, // +2 hours
              now
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

module.exports = {
  autoCancelExpiredBookings,
  checkAndCancelExpiredBookings
};

