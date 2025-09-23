const cron = require("node-cron");
const { autoCancelExpiredBookings } = require("../services/BookingAutoCancelService");

// Chạy mỗi 30 phút để kiểm tra và auto-cancel bookings quá hạn
cron.schedule("*/30 * * * *", async () => {
  console.log(" Running auto-cancel expired bookings...");
  try {
    const cancelledCount = await autoCancelExpiredBookings();
    if (cancelledCount > 0) {
      console.log(` Auto-cancelled ${cancelledCount} expired bookings`);
    } else {
      console.log(" No expired bookings to cancel");
    }
  } catch (error) {
    console.error(" Error in cron job:", error);
  }
});

console.log(" Auto-cancel cron job started - running every 30 minutes");


