const cron = require("node-cron");
const { 
  autoCancelExpiredBookings,
  autoCleanupExpiredPendingBookings,
  deleteOldPendingBookings,
  autoUnreserveExpiredVehicles 
} = require("../services/BookingAutoCancelService");


cron.schedule("*/30 * * * *", async () => {
  console.log("🔄 Running auto-cancel expired bookings...");
  try {
    const cancelledCount = await autoCancelExpiredBookings();
    if (cancelledCount > 0) {
      console.log(`✅ Auto-cancelled ${cancelledCount} expired bookings`);
    } else {
      console.log("✅ No expired bookings to cancel");
    }
  } catch (error) {
    console.error("❌ Error in auto-cancel cron job:", error);
  }
});

console.log("✅ Auto-cancel cron job started - running every 30 minutes");


cron.schedule("*/10 * * * *", async () => {
  console.log("🧹 Running cleanup expired pending bookings...");
  try {
    const expiredCount = await autoCleanupExpiredPendingBookings();
    if (expiredCount > 0) {
      console.log(`✅ Cleaned up ${expiredCount} expired pending bookings`);
    } else {
      console.log("✅ No expired pending bookings to cleanup");
    }
  } catch (error) {
    console.error("❌ Error in cleanup pending bookings cron job:", error);
  }
});

console.log("✅ Cleanup pending bookings cron job started - running every 10 minutes");


cron.schedule("0 3 * * *", async () => {
  console.log("🗑️ Running delete old pending bookings...");
  try {
    const deletedCount = await deleteOldPendingBookings();
    if (deletedCount > 0) {
      console.log(`✅ Deleted ${deletedCount} old pending bookings`);
    } else {
      console.log("✅ No old pending bookings to delete");
    }
  } catch (error) {
    console.error("❌ Error in delete old pending bookings cron job:", error);
  }
}, {
  timezone: "Asia/Ho_Chi_Minh"
});

console.log("✅ Delete old pending bookings cron job started - running daily at 3:00 AM");


cron.schedule("*/5 * * * *", async () => {
  console.log("🔓 Running auto unreserve expired vehicles...");
  try {
    const unreservedCount = await autoUnreserveExpiredVehicles();
    if (unreservedCount > 0) {
      console.log(`✅ Unreserved ${unreservedCount} expired vehicle reservations`);
    } else {
      console.log("✅ No expired vehicle reservations to unreserve");
    }
  } catch (error) {
    console.error("❌ Error in auto unreserve vehicles cron job:", error);
  }
});

console.log("✅ Auto unreserve vehicles cron job started - running every 5 minutes");


