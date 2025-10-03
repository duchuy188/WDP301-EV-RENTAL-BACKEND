const { GoogleGenerativeAI } = require('@google/generative-ai');
const { User, Station, Vehicle, Booking, Rental, UserStats, Payment } = require('../models');
const { formatVietnamTime } = require('../config/timezone');
const ExternalAPIs = require('../config/externalAPIs');

class ChatbotService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.CHATBOT_GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    });
  }

  // Xử lý message chính
  async processMessage(message, userRole, userId, conversationHistory = []) {
    try {
      // Lấy context dựa trên role
      const context = await this.getUserContext(userRole, userId);
      
      // Tạo prompt phù hợp với role
      const prompt = this.buildPrompt(message, userRole, context, conversationHistory);
      
      // Gọi Gemini AI
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Phân tích intent và tạo response
      const responseData = await this.processResponse(text, userRole, userId, message);
      
      return {
        success: true,
        message: responseData.message,
        suggestions: responseData.suggestions,
        actions: responseData.actions,
        context: responseData.context
      };
      
    } catch (error) {
      console.error('Error in ChatbotService:', error);
      return {
        success: false,
        message: 'Xin lỗi, tôi gặp sự cố kỹ thuật. Vui lòng thử lại sau.',
        suggestions: ['Liên hệ hỗ trợ', 'Thử lại sau']
      };
    }
  }

  // Lấy context dựa trên role
  async getUserContext(userRole, userId) {
    const context = { userRole, userId };
    
    try {
      switch (userRole) {
        case 'EV Renter':
          const { KYC } = require('../models');
          context.userStats = await UserStats.findOne({ user_id: userId });
          context.recentBookings = await Booking.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('station_id', 'name address')
            .populate('vehicle_id', 'type model');
          context.nearbyStations = await Station.find({ status: 'active' })
            .limit(10)
            .select('name address current_vehicles available_vehicles');
          
          // Thêm thông tin xe available
          context.availableVehicles = await Vehicle.find({ status: 'available' })
            .populate('station_id', 'name address')
            .limit(20)
            .select('name model brand type license_plate color current_mileage battery_level price_per_day');
          
          // Thêm thông tin KYC
          const kyc = await KYC.findOne({ userId: userId });
          context.kycStatus = kyc ? 'Đã xác thực' : 'Chưa xác thực';
          break;
          
        case 'Station Staff':
          const user = await User.findById(userId);
          if (user?.stationId) {
            context.station = await Station.findById(user.stationId)
              .populate('vehicles', 'type model status current_mileage battery_level');
              
            // Thêm thông tin xe trong trạm
            context.stationVehicles = await Vehicle.find({ station_id: user.stationId })
              .select('name model brand type license_plate color status current_mileage battery_level price_per_day')
              .sort({ status: 1, name: 1 });
            context.currentRentals = await Rental.find({ 
              station_id: user.stationId,
              status: 'active'
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'type model');
              
            // Thêm booking sắp tới
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            
            context.upcomingBookings = await Booking.find({
              station_id: user.stationId,
              start_date: { $gte: tomorrow, $lt: dayAfterTomorrow },
              status: 'confirmed'
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'type model')
              .limit(10);
          }
          break;
          
        case 'Admin':
          context.systemStats = await this.getSystemStats();
          context.weatherData = await ExternalAPIs.getWeather();
          
          // Thêm thông tin xe toàn hệ thống
          context.allVehicles = await Vehicle.find()
            .populate('station_id', 'name address')
            .select('name model brand type license_plate color status current_mileage battery_level price_per_day')
            .sort({ status: 1, brand: 1, model: 1 })
            .limit(50);
          break;
      }
    } catch (error) {
      console.error('Error getting user context:', error);
    }
    
    return context;
  }

  // Tạo prompt phù hợp với role
  buildPrompt(message, userRole, context, conversationHistory) {
    const rolePrompts = {
      'EV Renter': this.buildRenterPrompt(message, context, conversationHistory),
      'Station Staff': this.buildStaffPrompt(message, context, conversationHistory),
      'Admin': this.buildAdminPrompt(message, context, conversationHistory)
    };
    
    return rolePrompts[userRole] || this.buildDefaultPrompt(message, context);
  }

  // Prompt cho EV Renter
  buildRenterPrompt(message, context, conversationHistory) {
    const userStats = context.userStats;
    const recentBookings = context.recentBookings;
    const nearbyStations = context.nearbyStations;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là trợ lý AI thông minh của EV Rental System - hệ thống cho thuê xe máy điện. Bạn đang hỗ trợ khách hàng (EV Renter).

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ: ${currentTime}
- Thời gian hoạt động: 24/7

CHÍNH SÁCH THANH TOÁN:
- Thuê dưới 3 ngày: Thanh toán full 100% ngay khi nhận xe
- Thuê từ 3 ngày trở lên: Cọc 50% khi nhận xe, 50% còn lại khi trả xe

THÔNG TIN KHÁCH HÀNG:
- Tổng số lần thuê: ${userStats?.total_rentals || 0}
- Tổng quãng đường: ${userStats?.total_distance || 0} km
- Tổng chi phí: ${userStats?.total_spent?.toLocaleString('vi-VN') || 0} VND
- Lần thuê gần nhất: ${userStats?.last_rental_date ? formatVietnamTime(userStats.last_rental_date) : 'Chưa có'}
- Trạng thái KYC: ${context.kycStatus || 'Chưa xác thực'}

LỊCH SỬ THUÊ XE GẦN ĐÂY:
${recentBookings?.map(booking => 
  `- ${booking.code}: ${booking.station_id?.name} (${booking.status}) - ${booking.total_price?.toLocaleString('vi-VN')} VND`
).join('\n') || 'Chưa có lịch sử thuê xe'}

TRẠM GẦN NHẤT:
${nearbyStations?.map(station => 
  `- ${station.name}: ${station.address} (${station.available_vehicles}/${station.current_vehicles} xe available)`
).join('\n') || 'Không có trạm nào'}

XE MÁY ĐIỆN CÓ SẴN:
${context.availableVehicles?.map(vehicle => 
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}% - Trạm: ${vehicle.station_id?.name}`
).join('\n') || 'Không có xe nào available'}

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, thân thiện và hữu ích
2. Đưa ra gợi ý cụ thể dựa trên thông tin khách hàng
3. Nếu cần thông tin chi tiết, hướng dẫn cách sử dụng app
4. Luôn kết thúc bằng câu hỏi để tiếp tục hỗ trợ
5. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
6. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
7. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
8. Nếu user chưa KYC, hướng dẫn quy trình xác thực
9. Cung cấp thông tin giá cả và chính sách thuê xe
10. Hướng dẫn xử lý sự cố và liên hệ hỗ trợ
11. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
12. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
13. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
14. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
15. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
16. Giữ giọng điệu thân thiện nhưng không quá formal
17. Sử dụng emoji phù hợp để tạo cảm giác gần gũi

Trả về JSON format:
{
  "message": "Câu trả lời chính",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "actions": ["action1", "action2"],
  "context": "Thông tin bổ sung"
}
`;
  }

  // Prompt cho Station Staff
  buildStaffPrompt(message, context, conversationHistory) {
    const station = context.station;
    const currentRentals = context.currentRentals;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là trợ lý AI thông minh của EV Rental System - hệ thống cho thuê xe máy điện. Bạn đang hỗ trợ nhân viên trạm (Station Staff).

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ: ${currentTime}
- Ca làm việc: 24/7

CHÍNH SÁCH THANH TOÁN:
- Thuê dưới 3 ngày: Thanh toán full 100% ngay khi nhận xe
- Thuê từ 3 ngày trở lên: Cọc 50% khi nhận xe, 50% còn lại khi trả xe

THÔNG TIN TRẠM:
- Tên: ${station?.name || 'Chưa xác định'}
- Địa chỉ: ${station?.address || 'Chưa xác định'}
- Tổng xe: ${station?.current_vehicles || 0}
- Xe available: ${station?.available_vehicles || 0}
- Xe đang thuê: ${station?.rented_vehicles || 0}
- Xe bảo trì: ${station?.maintenance_vehicles || 0}

XE ĐANG THUÊ:
${currentRentals?.map(rental => 
  `- ${rental.code}: ${rental.user_id?.name} - ${rental.vehicle_id?.type} (${rental.status}) - Bắt đầu: ${formatVietnamTime(rental.actual_start_time)}`
).join('\n') || 'Không có xe nào đang thuê'}

XE TRONG TRẠM:
${context.stationVehicles?.map(vehicle => 
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.status} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}%`
).join('\n') || 'Không có xe nào trong trạm'}

BOOKING SẮP TỚI:
${context.upcomingBookings?.map(booking => 
  `- ${booking.code}: ${booking.user_id?.name} - ${booking.vehicle_id?.type} - ${formatVietnamTime(booking.start_date)}`
).join('\n') || 'Không có booking sắp tới'}

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, chuyên nghiệp nhưng thân thiện
2. Hướng dẫn quy trình giao/nhận xe
3. Tính toán phí phát sinh chính xác
4. Đưa ra gợi ý xử lý tình huống
5. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
6. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
7. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
8. Hướng dẫn xử lý sự cố kỹ thuật
9. Cung cấp thông tin bảo trì và sửa chữa
10. Hướng dẫn quy trình thanh toán và hoàn tiền
11. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
12. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
13. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
14. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
15. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
16. Giữ giọng điệu chuyên nghiệp nhưng gần gũi
17. Sử dụng emoji phù hợp để tạo cảm giác thân thiện

Trả về JSON format:
{
  "message": "Câu trả lời chính",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "actions": ["action1", "action2"],
  "context": "Thông tin bổ sung"
}
`;
  }

  // Prompt cho Admin
  buildAdminPrompt(message, context, conversationHistory) {
    const systemStats = context.systemStats;
    const weatherData = context.weatherData;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là trợ lý AI thông minh của EV Rental System - hệ thống cho thuê xe máy điện. Bạn đang hỗ trợ quản trị viên (Admin).

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ: ${currentTime}
- Thời gian hệ thống: 24/7

CHÍNH SÁCH THANH TOÁN:
- Thuê dưới 3 ngày: Thanh toán full 100% ngay khi nhận xe
- Thuê từ 3 ngày trở lên: Cọc 50% khi nhận xe, 50% còn lại khi trả xe

THỐNG KÊ HỆ THỐNG:
- Tổng trạm: ${systemStats?.totalStations || 0}
- Tổng xe: ${systemStats?.totalVehicles || 0}
- Xe available: ${systemStats?.availableVehicles || 0}
- Xe đang thuê: ${systemStats?.rentedVehicles || 0}
- Doanh thu tháng: ${systemStats?.monthlyRevenue?.toLocaleString('vi-VN') || 0} VND
- Tỷ lệ sử dụng: ${systemStats?.totalVehicles > 0 ? Math.round((systemStats.rentedVehicles / systemStats.totalVehicles) * 100) : 0}%

THÔNG TIN THỜI TIẾT:
- Thời tiết: ${weatherData?.weather || 'Không có dữ liệu'}
- Nhiệt độ: ${weatherData?.temperature || 'N/A'}°C
- Độ ẩm: ${weatherData?.humidity || 'N/A'}%
- Tốc độ gió: ${weatherData?.windSpeed || 'N/A'} m/s

XE MÁY ĐIỆN TRONG HỆ THỐNG:
${context.allVehicles?.map(vehicle => 
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.status} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}% - Trạm: ${vehicle.station_id?.name}`
).join('\n') || 'Không có xe nào'}

AI ANALYTICS:
- Demand Forecasting: Có sẵn
- Trend Analysis: Có sẵn
- Station Performance: Có sẵn
- Revenue Optimization: Có sẵn

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, chuyên nghiệp nhưng thân thiện
2. Phân tích dữ liệu và đưa ra insights
3. Gợi ý chiến lược kinh doanh
4. Hướng dẫn sử dụng AI analytics
5. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
6. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
7. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
8. Đưa ra khuyến nghị dựa trên dữ liệu thời gian thực
9. Phân tích xu hướng và dự báo nhu cầu
10. Gợi ý tối ưu hóa hoạt động và doanh thu
11. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
12. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
13. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
14. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
15. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
16. Giữ giọng điệu chuyên nghiệp nhưng gần gũi
17. Sử dụng emoji phù hợp để tạo cảm giác thân thiện

Trả về JSON format:
{
  "message": "Câu trả lời chính",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "actions": ["action1", "action2"],
  "context": "Thông tin bổ sung"
}
`;
  }

  // Prompt mặc định
  buildDefaultPrompt(message, context) {
    return `
Bạn là trợ lý AI thông minh của EV Rental System - hệ thống cho thuê xe máy điện.

CÂU HỎI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, thân thiện và hữu ích
2. Hướng dẫn sử dụng hệ thống
3. Đưa ra gợi ý hữu ích
4. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
5. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
6. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
7. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
8. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
9. Giữ giọng điệu thân thiện nhưng không quá formal
10. Sử dụng emoji phù hợp để tạo cảm giác gần gũi

Trả về JSON format:
{
  "message": "Câu trả lời chính",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "actions": [],
  "context": ""
}
`;
  }

  // Xử lý response từ AI
  async processResponse(aiResponse, userRole, userId, originalMessage) {
    try {
      // Parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          message: parsed.message,
          suggestions: parsed.suggestions || [],
          actions: parsed.actions || [],
          context: parsed.context || ''
        };
      }
      
      // Fallback nếu không parse được JSON
      return {
        message: aiResponse,
        suggestions: ['Hỏi thêm thông tin', 'Liên hệ hỗ trợ'],
        actions: [],
        context: ''
      };
      
    } catch (error) {
      console.error('Error processing AI response:', error);
      return {
        message: 'Xin lỗi, tôi không thể xử lý câu trả lời. Vui lòng thử lại.',
        suggestions: ['Thử lại', 'Liên hệ hỗ trợ'],
        actions: [],
        context: ''
      };
    }
  }

  // Lấy thống kê hệ thống cho Admin
  async getSystemStats() {
    try {
      const [totalStations, totalVehicles, availableVehicles, rentedVehicles] = await Promise.all([
        Station.countDocuments({ status: 'active' }),
        Vehicle.countDocuments(),
        Vehicle.countDocuments({ status: 'available' }),
        Vehicle.countDocuments({ status: 'rented' })
      ]);

      // Tính doanh thu tháng hiện tại
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      const monthlyRevenue = await Payment.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      return {
        totalStations,
        totalVehicles,
        availableVehicles,
        rentedVehicles,
        monthlyRevenue: monthlyRevenue[0]?.total || 0
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        totalStations: 0,
        totalVehicles: 0,
        availableVehicles: 0,
        rentedVehicles: 0,
        monthlyRevenue: 0
      };
    }
  }

  // Tạo gợi ý dựa trên context
  generateSuggestions(userRole, context) {
    const suggestions = [];
    
    switch (userRole) {
      case 'EV Renter':
        suggestions.push('Tìm trạm gần nhất', 'Xem lịch sử thuê xe', 'Đặt xe mới');
        if (context.userStats?.total_rentals === 0) {
          suggestions.push('Hướng dẫn đặt xe lần đầu');
        }
        break;
        
      case 'Station Staff':
        suggestions.push('Xem xe đang thuê', 'Tính phí phát sinh', 'Cập nhật trạng thái xe');
        break;
        
      case 'Admin':
        suggestions.push('Xem báo cáo doanh thu', 'Phân tích nhu cầu', 'Quản lý trạm');
        break;
    }
    
    return suggestions;
  }
}

module.exports = new ChatbotService();
