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
${userStats?.risk_level ? `- Mức độ rủi ro: ${userStats.risk_level}` : ''}
${userStats?.risk_score ? `- Điểm rủi ro: ${userStats.risk_score}/100` : ''}

LỊCH SỬ THUÊ XE GẦN ĐÂY:
${recentBookings?.map(booking => 
  `- ${booking.code}: ${booking.station_id?.name} (${booking.status}) - ${booking.total_price?.toLocaleString('vi-VN')} VND - ${booking.start_date ? formatVietnamTime(booking.start_date) : ''} đến ${booking.end_date ? formatVietnamTime(booking.end_date) : ''}`
).join('\n') || 'Chưa có lịch sử thuê xe'}

TRẠM GẦN NHẤT:
${nearbyStations?.map(station => 
  `- ${station.name}: ${station.address} (${station.available_vehicles}/${station.current_vehicles} xe available)`
).join('\n') || 'Không có trạm nào'}

XE MÁY ĐIỆN CÓ SẴN:
${context.availableVehicles?.map(vehicle => 
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}% - Trạm: ${vehicle.station_id?.name}`
).join('\n') || 'Không có xe nào available'}

THÔNG TIN XE MÁY ĐIỆN PHỔ BIẾN:
- VinFast Klara S: Pin 22Ah, phạm vi 120km, tốc độ tối đa 60km/h, thời gian sạc 5 giờ
- VinFast Feliz S: Pin 24Ah, phạm vi 140km, tốc độ tối đa 70km/h, thời gian sạc 6 giờ
- VinFast Theon S: Pin 30Ah, phạm vi 150km, tốc độ tối đa 80km/h, thời gian sạc 6 giờ
- VinFast Vento S: Pin 25Ah, phạm vi 130km, tốc độ tối đa 70km/h, thời gian sạc 5.5 giờ

HƯỚNG DẪN SỬ DỤNG XE MÁY ĐIỆN:
- Sạc đầy pin trước khi sử dụng
- Tốc độ tối đa: 60-80km/h tùy loại xe
- Thời gian sạc: 4-6 giờ
- Chế độ ECO tiết kiệm pin, chế độ SPORT cho hiệu suất cao
- Cảnh báo: Không để xe dưới mưa, không tự ý sửa chữa

QUY TRÌNH THUÊ XE:
1. Đặt xe qua app (chọn trạm, xe, thời gian)
2. Hoàn tất KYC nếu chưa xác thực
3. Đến trạm nhận xe theo lịch hẹn
4. Kiểm tra xe và ký hợp đồng
5. Thanh toán (100% nếu dưới 3 ngày, 50% nếu từ 3 ngày trở lên)
6. Trả xe đúng hạn tại trạm đã chọn

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, thân thiện và hữu ích
2. PHẢI sử dụng thông tin chính xác từ dữ liệu được cung cấp ở trên
3. KHÔNG được tự tạo ra thông tin không có trong dữ liệu
4. Đưa ra gợi ý cụ thể dựa trên thông tin khách hàng thực tế
5. Nếu không có đủ thông tin để trả lời, hãy nói rõ và đề xuất cách để khách hàng tìm thông tin đó
6. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
7. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
8. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
9. Nếu user chưa KYC, hướng dẫn quy trình xác thực chi tiết
10. Cung cấp thông tin giá cả và chính sách thuê xe dựa trên dữ liệu thực tế
11. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
12. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
13. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
14. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
15. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
16. Giữ giọng điệu thân thiện nhưng không quá formal
17. Sử dụng emoji phù hợp để tạo cảm giác gần gũi
18. Luôn kết thúc bằng câu hỏi để tiếp tục hỗ trợ
19. Nếu user có risk_score cao (>50), nhắc nhở họ về các chính sách an toàn và trách nhiệm
20. Nếu xe máy điện có pin dưới 30%, đề xuất sạc trước khi sử dụng

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
  `- ${rental.code}: ${rental.user_id?.fullname || rental.user_id?.name || 'Không rõ'} - ${rental.vehicle_id?.type || 'Không rõ'} (${rental.status}) - Bắt đầu: ${formatVietnamTime(rental.actual_start_time)} - Dự kiến trả: ${rental.expected_end_time ? formatVietnamTime(rental.expected_end_time) : 'Không rõ'}`
).join('\n') || 'Không có xe nào đang thuê'}

XE TRONG TRẠM:
${context.stationVehicles?.map(vehicle => 
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.status} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}% - Số km: ${vehicle.current_mileage || 0}km`
).join('\n') || 'Không có xe nào trong trạm'}

BOOKING SẮP TỚI:
${context.upcomingBookings?.map(booking => 
  `- ${booking.code}: ${booking.user_id?.fullname || booking.user_id?.name || 'Không rõ'} - ${booking.vehicle_id?.type || 'Không rõ'} - Thời gian: ${formatVietnamTime(booking.start_date)} đến ${formatVietnamTime(booking.end_date)} - Trạng thái: ${booking.status}`
).join('\n') || 'Không có booking sắp tới'}

QUY TRÌNH GIAO XE:
1. Xác minh danh tính khách hàng (KYC phải hoàn tất)
2. Kiểm tra tình trạng xe (pin, vỏ xe, đèn, phanh)
3. Chụp ảnh xe trước khi giao
4. Tạo hợp đồng thuê và yêu cầu khách ký
5. Thu tiền cọc/thanh toán theo quy định
6. Hướng dẫn sử dụng xe và các lưu ý an toàn

QUY TRÌNH NHẬN XE:
1. Kiểm tra tình trạng xe khi trả (so sánh với lúc giao)
2. Kiểm tra pin còn lại và số km đã đi
3. Tính phí phát sinh nếu có (hư hỏng, trễ hạn, v.v.)
4. Xác nhận hoàn tất thuê xe
5. Hoàn tiền cọc (nếu có) sau khi trừ phí phát sinh
6. Cập nhật trạng thái xe trong hệ thống



LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, chuyên nghiệp nhưng thân thiện
2. PHẢI sử dụng thông tin chính xác từ dữ liệu được cung cấp ở trên
3. KHÔNG được tự tạo ra thông tin không có trong dữ liệu
4. Hướng dẫn quy trình giao/nhận xe chi tiết dựa trên quy trình chuẩn
5. Tính toán phí phát sinh chính xác dựa trên bảng phí
6. Đưa ra gợi ý xử lý tình huống dựa trên dữ liệu thực tế
7. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
8. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
9. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
10. Hướng dẫn xử lý sự cố kỹ thuật với xe máy điện
11. Cung cấp thông tin bảo trì và sửa chữa dựa trên loại xe
12. Hướng dẫn quy trình thanh toán và hoàn tiền chi tiết
13. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
14. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
15. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
16. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
17. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
18. Giữ giọng điệu chuyên nghiệp nhưng gần gũi
19. Sử dụng emoji phù hợp để tạo cảm giác thân thiện
20. Đối với xe có pin dưới 30%, nhắc nhở sạc trước khi giao cho khách
21. Với xe có số km cao (>10.000km), đề xuất kiểm tra kỹ thuật trước khi giao

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
  `- ${vehicle.name} (${vehicle.brand} ${vehicle.model}): ${vehicle.license_plate} - ${vehicle.color} - ${vehicle.status} - ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày - Pin: ${vehicle.battery_level}% - Trạm: ${vehicle.station_id?.name} - Số km: ${vehicle.current_mileage || 0}km`
).join('\n') || 'Không có xe nào'}

PHÂN TÍCH HIỆU SUẤT TRẠM:
- Trạm có tỷ lệ sử dụng cao nhất: ${systemStats?.highestUtilizationStation?.name || 'Không có dữ liệu'} (${systemStats?.highestUtilizationStation?.rate || 0}%)
- Trạm có tỷ lệ sử dụng thấp nhất: ${systemStats?.lowestUtilizationStation?.name || 'Không có dữ liệu'} (${systemStats?.lowestUtilizationStation?.rate || 0}%)
- Trạm có doanh thu cao nhất: ${systemStats?.highestRevenueStation?.name || 'Không có dữ liệu'} (${systemStats?.highestRevenueStation?.revenue?.toLocaleString('vi-VN') || 0} VND)

PHÂN TÍCH KHÁCH HÀNG:
- Tổng số khách hàng: ${systemStats?.totalCustomers || 0}
- Khách hàng mới tháng này: ${systemStats?.newCustomersThisMonth || 0}
- Khách hàng có rủi ro cao: ${systemStats?.highRiskCustomers || 0}
- Tỷ lệ khách hàng quay lại: ${systemStats?.returnRate || 0}%

AI ANALYTICS:
- Demand Forecasting: Dự báo nhu cầu thuê xe theo giờ/ngày
- Trend Analysis: Phân tích xu hướng thuê xe, mùa vụ, sự kiện
- Station Performance: Đánh giá hiệu suất từng trạm, đề xuất tối ưu
- Vehicle Recommendations: Gợi ý số lượng và loại xe cần bổ sung
- Revenue Optimization: Đề xuất chiến lược giá để tối ưu doanh thu

LỊCH SỬ HỘI THOẠI TRƯỚC ĐÓ:
${conversationHistory.length > 0 ? conversationHistory.map(msg => `${msg.role}: ${msg.message}`).join('\n') : 'Chưa có lịch sử hội thoại'}

CÂU HỎI HIỆN TẠI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, chuyên nghiệp nhưng thân thiện
2. PHẢI sử dụng thông tin chính xác từ dữ liệu được cung cấp ở trên
3. KHÔNG được tự tạo ra thông tin không có trong dữ liệu
4. Phân tích dữ liệu và đưa ra insights có giá trị
5. Gợi ý chiến lược kinh doanh dựa trên số liệu thực tế
6. Hướng dẫn sử dụng AI analytics chi tiết khi được hỏi
7. QUAN TRỌNG: Sử dụng lịch sử hội thoại để hiểu ngữ cảnh và trả lời phù hợp
8. Nếu user hỏi tiếp theo, phải dựa vào câu hỏi trước đó để trả lời
9. Không hỏi lại thông tin đã được cung cấp trong cuộc trò chuyện
10. Đưa ra khuyến nghị dựa trên dữ liệu thời gian thực
11. Phân tích xu hướng và dự báo nhu cầu khi được yêu cầu
12. Gợi ý tối ưu hóa hoạt động và doanh thu dựa trên số liệu
13. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
14. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
15. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
16. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
17. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
18. Giữ giọng điệu chuyên nghiệp nhưng gần gũi
19. Sử dụng emoji phù hợp để tạo cảm giác thân thiện
20. Khi phân tích dữ liệu, nêu rõ các mối tương quan và xu hướng
21. Đề xuất các giải pháp cụ thể để cải thiện hiệu suất hệ thống
22. Khi được hỏi về dự báo, cung cấp cả dự báo ngắn hạn và dài hạn

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
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là trợ lý AI thông minh của EV Rental System - hệ thống cho thuê xe máy điện.

THÔNG TIN THỜI GIAN HIỆN TẠI:
- Ngày giờ: ${currentTime}
- Thời gian hoạt động: 24/7

CHÍNH SÁCH THANH TOÁN:
- Thuê dưới 3 ngày: Thanh toán full 100% ngay khi nhận xe
- Thuê từ 3 ngày trở lên: Cọc 50% khi nhận xe, 50% còn lại khi trả xe

THÔNG TIN XE MÁY ĐIỆN PHỔ BIẾN:
- VinFast Klara S: Pin 22Ah, phạm vi 120km, tốc độ tối đa 60km/h, thời gian sạc 5 giờ
- VinFast Feliz S: Pin 24Ah, phạm vi 140km, tốc độ tối đa 70km/h, thời gian sạc 6 giờ
- VinFast Theon S: Pin 30Ah, phạm vi 150km, tốc độ tối đa 80km/h, thời gian sạc 6 giờ
- VinFast Vento S: Pin 25Ah, phạm vi 130km, tốc độ tối đa 70km/h, thời gian sạc 5.5 giờ

QUY TRÌNH THUÊ XE:
1. Đặt xe qua app (chọn trạm, xe, thời gian)
2. Hoàn tất KYC nếu chưa xác thực
3. Đến trạm nhận xe theo lịch hẹn
4. Kiểm tra xe và ký hợp đồng
5. Thanh toán (100% nếu dưới 3 ngày, 50% nếu từ 3 ngày trở lên)
6. Trả xe đúng hạn tại trạm đã chọn

CÂU HỎI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. Trả lời bằng tiếng Việt, thân thiện và hữu ích
2. PHẢI sử dụng thông tin chính xác từ dữ liệu được cung cấp ở trên
3. KHÔNG được tự tạo ra thông tin không có trong dữ liệu
4. Hướng dẫn sử dụng hệ thống thuê xe máy điện chi tiết
5. Đưa ra gợi ý hữu ích dựa trên thông tin thực tế
6. QUAN TRỌNG: Đây là hệ thống cho thuê xe máy điện, không phải VinFast
7. Sử dụng "xe máy điện" thay vì "xe VinFast" khi nói về phương tiện
8. Giải thích chính sách thanh toán: dưới 3 ngày = thanh toán full, từ 3 ngày = cọc 50%
9. Cung cấp thông tin chi tiết về xe: tên, hãng, model, màu sắc, giá thuê, pin
10. KHÔNG chào hỏi liên tục trong cuộc trò chuyện - chỉ chào ở tin nhắn đầu tiên
11. Giữ giọng điệu thân thiện nhưng không quá formal
12. Sử dụng emoji phù hợp để tạo cảm giác gần gũi
13. Luôn kết thúc bằng câu hỏi để tiếp tục hỗ trợ
14. Nếu không có đủ thông tin để trả lời, hãy nói rõ và đề xuất cách để người dùng tìm thông tin đó

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
        
        // Phân tích intent cơ bản
        const intent = this.detectIntent(originalMessage);
        
        // Phân tích sentiment
        const sentiment = this.analyzeSentiment(originalMessage);
        
        // Tạo suggestions dựa trên intent nếu không có
        let suggestions = parsed.suggestions || [];
        if (suggestions.length === 0) {
          suggestions = this.generateSuggestionsByIntent(intent, userRole);
        }
        
        return {
          message: parsed.message,
          suggestions: suggestions,
          actions: parsed.actions || [],
          context: parsed.context || '',
          intent: intent,
          sentiment: sentiment
        };
      }
      
      // Fallback nếu không parse được JSON
      return {
        message: aiResponse,
        suggestions: ['Hỏi thêm thông tin', 'Liên hệ hỗ trợ'],
        actions: [],
        context: '',
        intent: 'unknown',
        sentiment: 'neutral'
      };
      
    } catch (error) {
      console.error('Error processing AI response:', error);
      return {
        message: 'Xin lỗi, tôi không thể xử lý câu trả lời. Vui lòng thử lại.',
        suggestions: ['Thử lại', 'Liên hệ hỗ trợ'],
        actions: [],
        context: '',
        intent: 'error',
        sentiment: 'negative'
      };
    }
  }
  
  // Phân tích intent từ message
  detectIntent(message) {
    if (!message) return 'unknown';
    
    const messageText = message.toLowerCase();
    
    if (messageText.match(/thuê|đặt|book|reservation|đăng ký|booking/i)) return 'booking';
    if (messageText.match(/giá|phí|cost|price|cọc|thanh toán|payment/i)) return 'pricing';
    if (messageText.match(/trạm|địa điểm|station|location|ở đâu|gần đây/i)) return 'location';
    if (messageText.match(/hỏi|giúp|help|support|hướng dẫn|hỗ trợ/i)) return 'help';
    if (messageText.match(/xe|vehicle|model|loại xe|xe điện|xe máy điện/i)) return 'vehicle_info';
    if (messageText.match(/pin|battery|sạc|charge|dung lượng/i)) return 'battery';
    if (messageText.match(/hợp đồng|contract|ký|sign|điều khoản/i)) return 'contract';
    if (messageText.match(/kyc|xác thực|verify|giấy tờ|cmnd|cccd|gplx/i)) return 'kyc';
    if (messageText.match(/hủy|cancel|hoàn tiền|refund/i)) return 'cancellation';
    if (messageText.match(/trả xe|return|checkout|hoàn thành/i)) return 'return';
    if (messageText.match(/lỗi|hỏng|sự cố|problem|issue|error/i)) return 'issue';
    if (messageText.match(/cảm ơn|thank|cám ơn/i)) return 'gratitude';
    if (messageText.match(/xin chào|hello|hi|chào/i)) return 'greeting';
    
    return 'general';
  }
  
  // Phân tích sentiment từ message
  analyzeSentiment(message) {
    if (!message) return 'neutral';
    
    const messageText = message.toLowerCase();
    
    // Từ ngữ tích cực
    const positiveWords = ['tốt', 'hay', 'thích', 'tuyệt', 'hài lòng', 'cảm ơn', 'vui', 'nhanh', 'tiện', 'dễ', 'tuyệt vời', 'xuất sắc', 'tận tâm', 'hiệu quả'];
    
    // Từ ngữ tiêu cực
    const negativeWords = ['tệ', 'kém', 'chậm', 'không thích', 'phàn nàn', 'khó chịu', 'thất vọng', 'lỗi', 'hỏng', 'chán', 'tồi', 'không hài lòng', 'khó', 'phức tạp'];
    
    let score = 0;
    
    // Tính điểm sentiment
    positiveWords.forEach(word => {
      if (messageText.includes(word)) score++;
    });
    
    negativeWords.forEach(word => {
      if (messageText.includes(word)) score--;
    });
    
    // Phân loại sentiment
    if (score > 1) return 'very_positive';
    if (score === 1) return 'positive';
    if (score === 0) return 'neutral';
    if (score === -1) return 'negative';
    if (score < -1) return 'very_negative';
    
    return 'neutral';
  }
  
  // Tạo gợi ý dựa trên intent và role
  generateSuggestionsByIntent(intent, userRole) {
    const suggestions = [];
    
    // Gợi ý chung cho tất cả role
    const commonSuggestions = {
      'booking': ['Đặt xe ngay', 'Xem xe có sẵn', 'Tìm trạm gần nhất'],
      'pricing': ['Xem bảng giá', 'Chính sách đặt cọc', 'Chi phí phát sinh'],
      'location': ['Tìm trạm gần nhất', 'Xem bản đồ trạm', 'Hướng dẫn đường đi'],
      'help': ['Hướng dẫn sử dụng', 'Liên hệ hỗ trợ', 'Câu hỏi thường gặp'],
      'vehicle_info': ['Thông tin xe máy điện', 'So sánh các loại xe', 'Tính năng xe'],
      'battery': ['Thời gian sạc pin', 'Phạm vi di chuyển', 'Trạm sạc gần đây'],
      'contract': ['Điều khoản hợp đồng', 'Quy trình ký hợp đồng', 'Trách nhiệm các bên'],
      'kyc': ['Hướng dẫn xác thực', 'Giấy tờ cần thiết', 'Thời gian xác thực'],
      'cancellation': ['Chính sách hủy', 'Hoàn tiền cọc', 'Phí hủy đơn'],
      'return': ['Quy trình trả xe', 'Kiểm tra xe', 'Hoàn tất thuê xe'],
      'issue': ['Báo cáo sự cố', 'Liên hệ hỗ trợ khẩn cấp', 'Xử lý vấn đề thường gặp'],
      'gratitude': ['Đánh giá dịch vụ', 'Thuê xe lần tiếp theo', 'Khuyến mãi mới'],
      'greeting': ['Đặt xe ngay', 'Xem xe có sẵn', 'Tìm trạm gần nhất'],
      'general': ['Hỏi thêm thông tin', 'Liên hệ hỗ trợ', 'Xem hướng dẫn'],
      'unknown': ['Hỏi thêm thông tin', 'Liên hệ hỗ trợ', 'Xem hướng dẫn'],
      'error': ['Thử lại', 'Liên hệ hỗ trợ', 'Đặt câu hỏi khác']
    };
    
    // Lấy gợi ý chung
    if (commonSuggestions[intent]) {
      suggestions.push(...commonSuggestions[intent]);
    } else {
      suggestions.push(...commonSuggestions['general']);
    }
    
    // Thêm gợi ý theo role
    if (userRole === 'EV Renter') {
      if (intent === 'booking') {
        suggestions.push('Xem lịch sử thuê xe');
      } else if (intent === 'vehicle_info') {
        suggestions.push('So sánh các loại xe máy điện');
      }
    } else if (userRole === 'Station Staff') {
      if (intent === 'booking') {
        suggestions.push('Kiểm tra booking sắp tới');
      } else if (intent === 'issue') {
        suggestions.push('Báo cáo xe cần bảo trì');
      }
    } else if (userRole === 'Admin') {
      if (intent === 'booking') {
        suggestions.push('Xem thống kê booking');
      } else if (intent === 'vehicle_info') {
        suggestions.push('Quản lý đội xe');
      }
    }
    
    // Giới hạn số lượng gợi ý
    return suggestions.slice(0, 3);
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
