const { formatVietnamTime } = require('../../../config/timezone');

class BookingFormatter {
  /**
   * Format booking confirmation message
   */
  formatConfirmation(bookingInfo, vehicle, pricing) {
    const startDate = formatVietnamTime(bookingInfo.dates.startDate, 'DD/MM/YYYY');
    const endDate = formatVietnamTime(bookingInfo.dates.endDate, 'DD/MM/YYYY');
    const duration = Math.ceil(
      (bookingInfo.dates.endDate - bookingInfo.dates.startDate) / (1000 * 60 * 60 * 24)
    );
    
    // Extract time từ dates
    const startDateObj = new Date(bookingInfo.dates.startDate);
    
    const pickupTime = startDateObj.getHours() === 0 && startDateObj.getMinutes() === 0
      ? '08:00' : `${String(startDateObj.getHours()).padStart(2, '0')}:${String(startDateObj.getMinutes()).padStart(2, '0')}`;
    
    //  Return time = pickup time (cùng giờ với pickup)
    const returnTime = pickupTime;
    
    return `🎯 **XÁC NHẬN THÔNG TIN ĐẶT XE**

🚗 **Xe:** ${vehicle.brand} ${vehicle.model} màu ${vehicle.color}
📅 **Nhận xe:** ${startDate} lúc ${pickupTime}
📅 **Trả xe:** ${endDate} lúc ${returnTime}
⏱️ **Thời gian thuê:** ${duration} ngày
📍 **Trạm:** ${vehicle.station_id?.name || 'Chưa chọn'}
💰 **Giá thuê:** ${pricing.totalPrice.toLocaleString('vi-VN')} VND
💵 **Cọc:** ${pricing.depositAmount.toLocaleString('vi-VN')} VND

⚠️ **Lưu ý quan trọng:**
• KYC sẽ được kiểm tra tại trạm
• Thanh toán tại quầy (tiền mặt/VNPay)
• Mang theo CCCD gốc khi đến trạm

Bạn xác nhận đặt xe này không?`;
  }
  
  /**
   * Format booking success message
   */
  formatSuccess(booking) {
    const startDate = formatVietnamTime(booking.start_date, 'DD/MM/YYYY HH:mm');
    
    return `✅ **ĐẶT XE THÀNH CÔNG!**

📋 **Mã booking:** ${booking.code}
🚗 **Xe:** ${booking.vehicle_id?.brand || 'N/A'} ${booking.vehicle_id?.model || 'N/A'} màu ${booking.vehicle_id?.color || 'N/A'} (${booking.vehicle_id?.license_plate || 'N/A'})
📅 **Nhận xe:** ${startDate}
📍 **Trạm:** ${booking.station_id?.name || 'N/A'}
💰 **Tổng tiền:** ${booking.total_price?.toLocaleString('vi-VN')} VND

🏢 **BƯỚC TIẾP THEO:**

1️⃣ **Đến trạm đúng giờ** (${startDate})
2️⃣ **Mang theo:**
   • CCCD gốc
   • Mã booking: ${booking.code}
   
3️⃣ **Tại trạm:**
   • Staff kiểm tra KYC
   • Ký hợp đồng
   • Thanh toán (tiền mặt/VNPay)
   • Nhận xe

📞 **Liên hệ trạm:** ${booking.station_id?.phone || 'Liên hệ hotline'}

💡 **Xem lại thông tin:**
Bạn có thể vào phần "Lịch sử đặt xe" trong ứng dụng để xem chi tiết booking và theo dõi trạng thái.

Chúc bạn có chuyến đi an toàn! 🎉`;
  }
  
  /**
   * Format vehicle options
   */
  formatVehicleOptions(vehicles) {
    if (vehicles.length === 0) {
      return '❌ Không tìm thấy xe phù hợp. Vui lòng thử lại với thông tin khác.';
    }
    
    let message = `🔍 **TÌM THẤY ${vehicles.length} XE PHÙ HỢP:**\n\n`;
    
    vehicles.forEach((vehicle, index) => {
      message += `${index + 1}. **${vehicle.brand} ${vehicle.model}** màu ${vehicle.color}\n`;
      message += `   💰 ${vehicle.price_per_day.toLocaleString('vi-VN')} VND/ngày\n`;
      message += `   🔋 Pin: ${vehicle.current_battery}%\n`;
      message += `   📍 ${vehicle.station_id?.name || 'N/A'}\n\n`;
    });
    
    message += `Bạn muốn đặt xe nào? (Trả lời số thứ tự)`;
    
    return message;
  }
  
  /**
   * Format error message
   */
  formatError(errors) {
    let message = '❌ **KHÔNG THỂ ĐẶT XE**\n\n';
    message += '**Lỗi:**\n';
    errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });
    message += '\nVui lòng kiểm tra lại thông tin và thử lại.';
    
    return message;
  }
  
  /**
   * Format missing info request
   */
  formatMissingInfo(missing) {
    return `Để đặt xe, tôi cần thêm thông tin về: **${missing.join(', ')}**

📝 **Ví dụ:**
• "Tôi muốn thuê xe Klara đỏ từ 20-22/11"
• "Đặt xe Feliz màu trắng 3 ngày tại trạm Bình Dương"
• "Thuê xe từ 25/11 đến 28/11"

Bạn vui lòng cung cấp đầy đủ thông tin nhé!`;
  }
  
  /**
   * Format message khi không có xe đúng yêu cầu nhưng có alternatives
   */
  formatNoVehicleWithAlternatives(originalRequest, alternatives) {
    const { vehicleInfo, stationInfo } = originalRequest;
    
    // Build original request description
    let requestDesc = '';
    if (vehicleInfo.model && vehicleInfo.color) {
      requestDesc = `${vehicleInfo.model} màu ${vehicleInfo.color}`;
    } else if (vehicleInfo.model) {
      requestDesc = `${vehicleInfo.model}`;
    } else if (vehicleInfo.color) {
      requestDesc = `xe màu ${vehicleInfo.color}`;
    }
    
    if (stationInfo?.stationName) {
      requestDesc += ` tại ${stationInfo.stationName}`;
    }
    
    let message = `❌ **RẤT TIẾC**\n\nHiện tại không có ${requestDesc} phù hợp với thời gian bạn chọn.\n\n`;
    
    // Show alternatives
    message += `💡 **NHƯNG BẠN CÓ THỂ QUAN TÂM:**\n\n`;
    
    // 1. Same model different color
    if (alternatives.sameModel.length > 0) {
      message += `🎨 **Xe cùng dòng khác màu:**\n`;
      alternatives.sameModel.slice(0, 3).forEach((vehicle, index) => {
        message += `${index + 1}. **${vehicle.brand} ${vehicle.model} màu ${vehicle.color}**\n`;
        message += `   💰 ${vehicle.price_per_day.toLocaleString('vi-VN')} VND/ngày | 🔋 ${vehicle.current_battery}%\n`;
        message += `   📍 ${vehicle.station_id?.name || 'N/A'}\n`;
      });
      message += '\n';
    }
    
    // 2. Same color different model
    if (alternatives.sameColor.length > 0) {
      message += `🚗 **Xe cùng màu khác dòng:**\n`;
      alternatives.sameColor.slice(0, 3).forEach((vehicle, index) => {
        message += `${index + 1}. **${vehicle.brand} ${vehicle.model} màu ${vehicle.color}**\n`;
        message += `   💰 ${vehicle.price_per_day.toLocaleString('vi-VN')} VND/ngày | 🔋 ${vehicle.current_battery}%\n`;
        message += `   📍 ${vehicle.station_id?.name || 'N/A'}\n`;
      });
      message += '\n';
    }
    
    // 3. Nearby stations
    if (alternatives.nearby.length > 0) {
      message += `📍 **Xe tương tự ở trạm gần:**\n`;
      
      // Group by station
      const byStation = {};
      alternatives.nearby.forEach(vehicle => {
        const stationName = vehicle.station_id?.name || 'N/A';
        if (!byStation[stationName]) {
          byStation[stationName] = [];
        }
        byStation[stationName].push(vehicle);
      });
      
      Object.entries(byStation).forEach(([stationName, vehicles]) => {
        message += `\n📌 **${stationName}:**\n`;
        vehicles.slice(0, 2).forEach((vehicle, index) => {
          message += `${index + 1}. ${vehicle.brand} ${vehicle.model} màu ${vehicle.color} - ${vehicle.price_per_day.toLocaleString('vi-VN')} VND/ngày\n`;
        });
      });
    }
    
    message += `\n💬 **Bạn có muốn xem chi tiết xe nào không?**`;
    
    return message;
  }
}

module.exports = new BookingFormatter();

