const { Booking, Vehicle, Station } = require('../../../models');
const { sendEmail, getBookingCancellationTemplate } = require('../../../config/nodemailer');

class CancelHandler {
  /**
   * Handle cancel booking request từ chatbot
   * User có thể nói: "Hủy booking BK123", "Tôi muốn hủy đặt xe", "Cancel booking của tôi"
   */
  async handle(message, userId, conversationHistory) {
    try {
      console.log('🎯 CancelHandler: Processing cancel request');
      console.log('Message:', message);
      console.log('UserId:', userId);
      
      // Extract booking code từ message (nếu có)
      const bookingCode = this.extractBookingCode(message);
      
      if (bookingCode) {
        // User nói rõ booking code → cancel luôn
        return await this.cancelBooking(bookingCode, userId);
      } else {
        // User không nói booking code → list pending bookings để chọn
        return await this.listPendingBookings(userId);
      }
      
    } catch (error) {
      console.error('❌ Error in CancelHandler:', error);
      return {
        success: false,
        message: '❌ Có lỗi xảy ra khi xử lý yêu cầu hủy booking. Vui lòng thử lại sau.',
        suggestions: ['Xem booking của tôi', 'Liên hệ hỗ trợ']
      };
    }
  }
  
  /**
   * Extract booking code từ message
   * Ví dụ: "Hủy booking BK123", "Cancel BKMH7A5JXR"
   */
  extractBookingCode(message) {
    const pattern = /\b(BK[A-Z0-9]{8,})\b/i;
    const match = message.match(pattern);
    return match ? match[1].toUpperCase() : null;
  }
  
  /**
   * List pending bookings của user để chọn
   */
  async listPendingBookings(userId) {
    try {
      const bookings = await Booking.find({
        user_id: userId,
        status: 'pending'
      })
      .populate('vehicle_id', 'name brand model color')
      .populate('station_id', 'name')
      .sort({ start_date: 1 })
      .limit(5);
      
      if (bookings.length === 0) {
        return {
          success: false,
          message: '📋 Bạn không có booking nào đang chờ xử lý.',
          suggestions: ['Đặt xe mới', 'Xem lịch sử booking']
        };
      }
      
      // Check which bookings can be cancelled
      const cancellableBookings = bookings.filter(booking => this.canCancelBooking(booking));
      
      if (cancellableBookings.length === 0) {
        return {
          success: false,
          message: '⚠️ Tất cả booking của bạn đều không thể hủy (quá gần thời gian nhận xe - dưới 2 giờ).',
          suggestions: ['Xem booking của tôi', 'Liên hệ hỗ trợ']
        };
      }
      
      // Format message
      let message = '📋 **BOOKING CÓ THỂ HỦY:**\n\n';
      const suggestions = [];
      
      cancellableBookings.forEach((booking, index) => {
        const startDate = new Date(booking.start_date);
        const dateStr = `${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
        const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        
        message += `${index + 1}. **${booking.code}**\n`;
        message += `   🚗 ${booking.vehicle_id.brand} ${booking.vehicle_id.model} ${booking.vehicle_id.color}\n`;
        message += `   📅 ${dateStr} lúc ${timeStr}\n`;
        message += `   📍 ${booking.station_id.name}\n`;
        message += `   💰 ${booking.total_price.toLocaleString('vi-VN')} VND\n\n`;
        
        suggestions.push(`Hủy booking ${booking.code}`);
      });
      
      message += 'Bạn muốn hủy booking nào? (Trả lời mã booking hoặc số thứ tự)';
      
      return {
        success: true,
        message,
        suggestions: suggestions.slice(0, 3),
        context: {
          step: 'select_booking_to_cancel',
          bookings: cancellableBookings.map(b => ({
            code: b.code,
            id: b._id.toString()
          }))
        }
      };
      
    } catch (error) {
      console.error('❌ Error listing pending bookings:', error);
      throw error;
    }
  }
  
  /**
   * Cancel booking
   */
  async cancelBooking(bookingCode, userId, reason = 'Hủy từ chatbot') {
    try {
      console.log('🎯 Cancelling booking:', bookingCode);
      
      // Find booking
      const booking = await Booking.findOne({ code: bookingCode })
        .populate('user_id', 'fullname email')
        .populate('vehicle_id', 'name brand model color license_plate')
        .populate('station_id', 'name');
      
      if (!booking) {
        return {
          success: false,
          message: `❌ Không tìm thấy booking với mã **${bookingCode}**.`,
          suggestions: ['Xem booking của tôi', 'Đặt xe mới']
        };
      }
      
      // Check permission
      if (booking.user_id._id.toString() !== userId.toString()) {
        return {
          success: false,
          message: '❌ Bạn không có quyền hủy booking này.',
          suggestions: ['Xem booking của tôi']
        };
      }
      
      // Check if can cancel
      if (!this.canCancelBooking(booking)) {
        const status = booking.status === 'pending' 
          ? 'quá gần thời gian nhận xe (dưới 2 giờ)' 
          : `đã ở trạng thái ${booking.status}`;
        
        return {
          success: false,
          message: `⚠️ Không thể hủy booking **${bookingCode}** vì ${status}.\n\nVui lòng liên hệ hotline để được hỗ trợ.`,
          suggestions: ['Xem booking của tôi', 'Liên hệ hỗ trợ']
        };
      }
      
      // Update booking status
      booking.status = 'cancelled';
      booking.cancellation_reason = reason;
      booking.cancelled_at = new Date();
      booking.cancelled_by = userId;
      await booking.save();
      
      // Update vehicle status back to available
      await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
        status: 'available'
      });
      
      // Update station stats
      const station = await Station.findById(booking.station_id._id);
      await station.syncVehicleCount();
      
      // Send cancellation email
      try {
        await sendEmail({
          to: booking.user_id.email,
          subject: 'Hủy đặt xe - EV Rental',
          html: getBookingCancellationTemplate(booking.user_id.fullname, booking)
        });
        console.log('✅ Email hủy booking đã được gửi');
      } catch (emailError) {
        console.error('❌ Lỗi khi gửi email hủy:', emailError.message);
      }
      
      // Format success message
      const startDate = new Date(booking.start_date);
      const dateStr = `${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
      const timeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      
      const message = `✅ **ĐÃ HỦY BOOKING THÀNH CÔNG**

📋 **Mã booking:** ${booking.code}
🚗 **Xe:** ${booking.vehicle_id.brand} ${booking.vehicle_id.model} ${booking.vehicle_id.color}
📅 **Thời gian:** ${dateStr} lúc ${timeStr}
📍 **Trạm:** ${booking.station_id.name}
💰 **Số tiền:** ${booking.total_price.toLocaleString('vi-VN')} VND

📧 Email xác nhận đã được gửi đến: ${booking.user_id.email}

Cảm ơn bạn đã sử dụng dịch vụ!`;
      
      return {
        success: true,
        message,
        suggestions: ['Đặt xe mới', 'Xem xe available', 'Xem lịch sử booking']
      };
      
    } catch (error) {
      console.error('❌ Error cancelling booking:', error);
      throw error;
    }
  }
  
  /**
   * Check if booking can be cancelled
   * Rules: status = 'pending' AND ít nhất 2 giờ trước start_date
   */
  canCancelBooking(booking) {
    if (booking.status !== 'pending') {
      return false;
    }
    
    const now = new Date();
    const bookingStart = new Date(booking.start_date);
    const timeDiff = bookingStart.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);
    
    // Không thể cancel trong vòng 2 giờ trước booking
    if (hoursDiff < 2) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Handle selection từ list (user chọn số thứ tự hoặc booking code)
   */
  async handleSelection(message, userId, context) {
    try {
      // Extract selection (số thứ tự hoặc booking code)
      const numberMatch = message.match(/^(\d+)$/);
      const codeMatch = message.match(/\b(BK[A-Z0-9]{8,})\b/i);
      
      let bookingCode = null;
      
      if (codeMatch) {
        // User nhập booking code
        bookingCode = codeMatch[1].toUpperCase();
      } else if (numberMatch && context.bookings) {
        // User nhập số thứ tự
        const index = parseInt(numberMatch[1]) - 1;
        if (index >= 0 && index < context.bookings.length) {
          bookingCode = context.bookings[index].code;
        }
      }
      
      if (!bookingCode) {
        return {
          success: false,
          message: '❌ Vui lòng chọn số thứ tự hoặc nhập mã booking hợp lệ.',
          suggestions: context.bookings.map((b, i) => `Hủy booking ${i + 1}`)
        };
      }
      
      // Cancel booking
      return await this.cancelBooking(bookingCode, userId);
      
    } catch (error) {
      console.error('❌ Error handling selection:', error);
      throw error;
    }
  }
}

module.exports = new CancelHandler();

