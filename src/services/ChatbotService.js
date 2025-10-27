const { GoogleGenerativeAI } = require('@google/generative-ai');
const { User, Station, Vehicle, Booking, Rental, UserStats, Payment } = require('../models');
const { formatVietnamTime } = require('../config/timezone');
const ExternalAPIs = require('../config/externalAPIs');
const BookingHandler = require('./chatbot/booking/BookingHandler');
const CancelHandler = require('./chatbot/booking/CancelHandler');

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
    
    // Thêm cache cho thống kê
    this.statsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 phút
    
    
  }

  // Lấy thống kê xe được thuê nhiều nhất
  async getVehicleRentalStats() {
    const cacheKey = 'vehicle_rental_stats';
    const cached = this.statsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    try {
      // Lấy thống kê từ bảng Rental (thay vì Booking)
      const vehicleStats = await Rental.aggregate([
        {
          $match: {
            status: 'completed' // Chỉ tính những đơn thuê đã hoàn thành
          }
        },
        // Lookup để lấy thông tin giá từ Booking
        {
          $lookup: {
            from: 'bookings',
            localField: 'booking_id',
            foreignField: '_id',
            as: 'booking_info'
          }
        },
        {
          $unwind: '$booking_info'
        },
        {
          $group: {
            _id: '$vehicle_id',
            total_rentals: { $sum: 1 },
            total_revenue: { $sum: '$booking_info.total_price' }, // Lấy total_price từ booking
            total_fees: { $sum: '$total_fees' }, // Phí phát sinh từ rental
            last_rental: { $max: '$createdAt' }
          }
        },
        {
          $lookup: {
            from: 'vehicles',
            localField: '_id',
            foreignField: '_id',
            as: 'vehicle_info'
          }
        },
        {
          $unwind: '$vehicle_info'
        },
        {
          $sort: { total_rentals: -1 }
        },
        {
          $limit: 10
        }
      ]);

      // Cache kết quả
      this.statsCache.set(cacheKey, {
        data: vehicleStats,
        timestamp: Date.now()
      });

      return vehicleStats;
    } catch (error) {
      console.error('Error getting vehicle rental stats:', error);
      return [];
    }
  }

  // Lấy thống kê trạm được thuê nhiều nhất
  async getStationRentalStats() {
    const cacheKey = 'station_rental_stats';
    const cached = this.statsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    try {
      // Lấy thống kê từ bảng Rental theo station_id (thay vì Booking)
      const stationStats = await Rental.aggregate([
        {
          $match: {
            status: 'completed' // Chỉ tính những đơn thuê đã hoàn thành
          }
        },
        // Lookup để lấy thông tin giá từ Booking
        {
          $lookup: {
            from: 'bookings',
            localField: 'booking_id',
            foreignField: '_id',
            as: 'booking_info'
          }
        },
        {
          $unwind: '$booking_info'
        },
        {
          $group: {
            _id: '$station_id',
            total_rentals: { $sum: 1 },
            total_revenue: { $sum: '$booking_info.total_price' }, // Lấy total_price từ booking
            total_fees: { $sum: '$total_fees' }, // Phí phát sinh từ rental
            last_rental: { $max: '$createdAt' },
            unique_customers: { $addToSet: '$user_id' } // Thêm số khách hàng unique
          }
        },
        {
          $addFields: {
            unique_customers_count: { $size: '$unique_customers' },
            total_final_revenue: { $add: ['$total_revenue', '$total_fees'] } // Tổng doanh thu + phí
          }
        },
        {
          $lookup: {
            from: 'stations',
            localField: '_id',
            foreignField: '_id',
            as: 'station_info'
          }
        },
        {
          $unwind: '$station_info'
        },
        {
          $sort: { total_rentals: -1 }
        },
        {
          $limit: 10
        }
      ]);

      // Cache kết quả
      this.statsCache.set(cacheKey, {
        data: stationStats,
        timestamp: Date.now()
      });

      return stationStats;
    } catch (error) {
      console.error('Error getting station rental stats:', error);
      return [];
    }
  }

  // Lấy thống kê phí phạt
  async getPenaltyStats() {
    const cacheKey = 'penalty_stats';
    const cached = this.statsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    try {
      // Lấy thống kê phí phạt từ Payment collection với is_penalty_fee = true
      const penaltyStats = await Payment.aggregate([
        {
          $match: {
            is_penalty_fee: true,
            status: 'completed'
          }
        },
        // Lookup để lấy thông tin user
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: '$user_info'
        },
        // Lookup để lấy thông tin rental
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental_info'
          }
        },
        {
          $unwind: '$rental_info'
        },
        // Lookup để lấy thông tin vehicle
        {
          $lookup: {
            from: 'vehicles',
            localField: 'rental_info.vehicle_id',
            foreignField: '_id',
            as: 'vehicle_info'
          }
        },
        {
          $unwind: '$vehicle_info'
        },
        {
          $project: {
            user_info: {
              _id: 1,
              fullname: 1,
              email: 1,
              phone: 1
            },
            vehicle_info: {
              _id: 1,
              name: 1,
              license_plate: 1,
              brand: 1,
              model: 1
            },
            amount: 1,
            payment_type: 1,
            completed_at: 1,
            rental_info: {
            late_fee: 1,
            damage_fee: 1,
            other_fees: 1,
            total_fees: 1,
            actual_start_time: 1,
            actual_end_time: 1,
            status: 1,
              staff_notes: 1
            },
            createdAt: 1
          }
        },
        {
          $sort: { amount: -1, createdAt: -1 }
        },
        {
          $limit: 20
        }
      ]);

      // Tính tổng thống kê từ Payment collection
      const totalStats = await Payment.aggregate([
        {
          $match: {
            is_penalty_fee: true,
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            total_penalty_amount: { $sum: '$amount' },
            penalty_count: { $sum: 1 },
            users_with_penalties: { $addToSet: '$user_id' }
          }
        },
        {
          $addFields: {
            users_with_penalties: { $size: '$users_with_penalties' }
          }
        }
      ]);

      // Lấy thống kê chi tiết theo user từ Payment collection với chi tiết phí phạt
      const userPenaltyStats = await Payment.aggregate([
        {
          $match: {
            is_penalty_fee: true,
            status: 'completed'
          }
        },
        // Lookup để lấy thông tin rental với chi tiết phí phạt
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental_info'
          }
        },
        {
          $unwind: '$rental_info'
        },
        {
          $group: {
            _id: '$user_id',
            total_penalty_amount: { $sum: '$amount' },
            penalty_count: { $sum: 1 },
            latest_penalty_date: { $max: '$completed_at' },
           
            total_late_fees: { $sum: '$rental_info.late_fee' },
            total_damage_fees: { $sum: '$rental_info.damage_fee' },
            total_other_fees: { $sum: '$rental_info.other_fees' }
          }
        },
        // Lookup để lấy thông tin user
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        {
          $unwind: '$user_info'
        },
        {
          $project: {
            user_info: {
              _id: 1,
              fullname: 1,
              email: 1,
              phone: 1
            },
            total_penalty_amount: 1,
            penalty_count: 1,
            latest_penalty_date: 1,
            total_late_fees: 1,
            total_damage_fees: 1,
            total_other_fees: 1
          }
        },
        {
          $sort: { total_penalty_amount: -1, penalty_count: -1 }
        },
        {
          $limit: 10 // Top 10 người bị phạt nhiều nhất
        }
      ]);

      const result = {
        penalty_cases: penaltyStats,
        user_penalty_ranking: userPenaltyStats,
        summary: totalStats[0] || {
          total_penalty_amount: 0,
          penalty_count: 0,
          users_with_penalties: 0
        }
      };

      // Cache kết quả
      this.statsCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error getting penalty stats:', error);
      return {
        penalty_cases: [],
        user_penalty_ranking: [],
        summary: {
          total_penalty_amount: 0,
          penalty_count: 0,
          users_with_penalties: 0
        }
      };
    }
  }

  // Xử lý message chính
  async processMessage(message, userRole, userId, conversationHistory = [], sessionId = null) {
    try {
      console.log('🚀 ===== PROCESS MESSAGE DEBUG =====');
      console.log('📝 Message:', message);
      console.log('👤 User Role:', userRole);
      console.log('🆔 User ID:', userId);
      console.log('🔑 Session ID:', sessionId);
      console.log('📚 Conversation History Length:', conversationHistory.length);
      

      
      // Detect intent trước
      const intent = this.detectIntent(message);
      console.log('🎯 Detected Intent:', intent);
      
      // 🆕 HANDLE BOOKING INTENT
      if (intent === 'booking_request' && userRole === 'EV Renter') {
        console.log('📦 Handling booking request via BookingHandler');
        return await BookingHandler.handle(message, userId, conversationHistory);
      }
      
      // 🆕 HANDLE CONFIRM BOOKING
      if (intent === 'confirm_booking' && userRole === 'EV Renter') {
        console.log('✅ Handling booking confirmation');
        
        // Tìm assistant message gần nhất có bookingData
        let bookingData = null;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
          const msg = conversationHistory[i];
          if (msg.role === 'assistant' && 
              msg.metadata?.context?.step === 'confirmation' && 
              msg.metadata?.context?.bookingData) {
            bookingData = msg.metadata.context.bookingData;
            console.log('Found bookingData from conversation history');
            break;
          }
        }
        
        if (bookingData) {
          return await BookingHandler.confirmBooking(bookingData);
        } else {
          console.log('No bookingData found in conversation history');
          return {
            success: false,
            message: 'Không tìm thấy thông tin booking để xác nhận. Vui lòng đặt xe lại.',
            suggestions: ['Đặt xe mới', 'Xem xe available']
          };
        }
      }
      
      // 🆕 HANDLE CANCEL BOOKING
      if (intent === 'cancellation' && userRole === 'EV Renter') {
        console.log('❌ Handling cancel booking request');
        
        // Check if user đang trong flow chọn booking để cancel
        const lastAssistantMsg = conversationHistory
          .slice()
          .reverse()
          .find(msg => msg.role === 'assistant');
        
        if (lastAssistantMsg?.metadata?.context?.step === 'select_booking_to_cancel') {
          // User đang chọn booking từ list
          return await CancelHandler.handleSelection(
            message, 
            userId, 
            lastAssistantMsg.metadata.context
          );
        } else {
          // User mới bắt đầu cancel flow
          return await CancelHandler.handle(message, userId, conversationHistory);
        }
      }
      
      // Lấy context dựa trên role và intent
      const context = await this.getUserContext(userRole, userId, intent);
      
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
  async getUserContext(userRole, userId, messageIntent = null) {
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
          
          // Thêm thông tin xe available - Sort by color để đảm bảo đa dạng màu sắc
          context.availableVehicles = await Vehicle.find({ status: 'available' })
            .populate('station_id', 'name address')
            .sort({ color: 1, createdAt: -1 }) // Sort theo màu trước, sau đó theo thời gian tạo
            .limit(30) // Tăng limit để có nhiều màu hơn
            .select('name model brand type license_plate color current_mileage current_battery price_per_day max_range battery_capacity year');
          

          
          // Thêm thông tin KYC
          const kyc = await KYC.findOne({ userId: userId });
          context.kycStatus = kyc ? 'Đã xác thực' : 'Chưa xác thực';
          break;
          
        case 'Station Staff':
          const user = await User.findById(userId);
          if (user?.stationId) {
            console.log(`🏢 Station Staff ${userId} truy cập trạm ${user.stationId}`);
            
            // Load thông tin trạm CỦA NHÂN VIÊN NÀY
            context.station = await Station.findById(user.stationId);
            console.log(`📍 Trạm: ${context.station?.name || 'Unknown'}`);
            
            // CHỈ lấy xe TRONG TRẠM CỦA NHÂN VIÊN NÀY
            context.stationVehicles = await Vehicle.find({ station_id: user.stationId })
              .select('name model brand type license_plate color status current_mileage current_battery price_per_day')
              .sort({ status: 1, current_battery: -1 }) 
              .limit(50);
              
            console.log(`🚗 Tìm thấy ${context.stationVehicles?.length || 0} xe trong trạm ${user.stationId}`);
              
            // CHỈ lấy rental đang diễn ra TẠI TRẠM NÀY
            context.currentRentals = await Rental.find({ 
              station_id: user.stationId, // ĐẢM BẢO chỉ lấy rental của trạm này
              status: 'active'
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'name type model license_plate')
              .sort({ actual_start_time: -1 });
              
            console.log(`📋 Tìm thấy ${context.currentRentals?.length || 0} rental đang hoạt động tại trạm ${user.stationId}`);
            
            //  THÊM: CHỈ lấy rental history (đã hoàn thành) TẠI TRẠM NÀY
            context.completedRentals = await Rental.find({
              station_id: user.stationId, // CHỈ lấy rental history của trạm này
              status: 'completed'
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'name type model license_plate')
              .populate('booking_id', 'code start_date end_date total_price')
              .sort({ actual_end_time: -1 })
              .limit(20); // Top 20 rental gần đây nhất
              
            console.log(`📚 Tìm thấy ${context.completedRentals?.length || 0} rental đã hoàn thành tại trạm ${user.stationId}`);
              
            // CHỈ lấy booking sắp tới CỦA TRẠM NÀY (mở rộng lên 30 ngày để bao gồm tất cả booking tương lai)
            const now = new Date();
            const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
            
            console.log(`🔍 Tìm kiếm booking từ ${now.toISOString()} đến ${thirtyDaysLater.toISOString()}`);
            
            context.upcomingBookings = await Booking.find({
              station_id: user.stationId, // ⭐ QUAN TRỌNG: Chỉ lấy booking của trạm này
              start_date: { $gte: now, $lte: thirtyDaysLater },
              status: { $in: ['confirmed', 'pending'] } // Bao gồm cả pending
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'name type model license_plate')
              .sort({ start_date: 1 })
              .limit(10);
              
            console.log(`📅 Tìm thấy ${context.upcomingBookings?.length || 0} booking sắp tới trong 30 ngày cho trạm ${user.stationId}`);
            
            // Luôn lấy booking trong quá khứ để có thông tin tham khảo
            context.recentBookings = await Booking.find({
              station_id: user.stationId, // ĐẢM BẢO chỉ lấy booking của trạm này
              start_date: { $lt: now }, // CHỈ lấy booking trong QUÁ KHỨ
              status: { $in: ['confirmed', 'completed', 'pending'] }
            }).populate('user_id', 'fullname email phone')
              .populate('vehicle_id', 'name type model license_plate')
              .sort({ start_date: -1 })
              .limit(5);
              
            console.log(`📚 Tìm thấy ${context.recentBookings?.length || 0} booking trong quá khứ cho trạm ${user.stationId}`);
              
            // CHỈ lấy thống kê penalty CỦA TRẠM NÀY nếu cần
            if (['penalty_stats', 'penalty_calculation', 'damage_assessment'].includes(messageIntent)) {
              context.stationPenalties = await Rental.find({
                station_id: user.stationId, // ⭐ CHỈ lấy penalty của trạm này
                $or: [
                  { late_fee: { $gt: 0 } },
                  { damage_fee: { $gt: 0 } },
                  { other_fees: { $gt: 0 } }
                ]
              }).populate('user_id', 'fullname email phone')
                .populate('vehicle_id', 'name license_plate')
                .sort({ createdAt: -1 })
                .limit(10);
                
              console.log(`💰 Tìm thấy ${context.stationPenalties?.length || 0} penalty tại trạm ${user.stationId}`);
            }
            
            // Thêm thông tin bảo mật
            context.userRole = 'Station Staff';
            context.allowedStationId = user.stationId; // Lưu station ID được phép truy cập
          }
          break;
          
        case 'Admin':
          context.systemStats = await this.getSystemStats();
          
          // Luôn load vehicle rental stats cho Admin
          context.vehicleRentalStats = await this.getVehicleRentalStats();
          
          // Thêm station rental stats
          context.stationRentalStats = await this.getStationRentalStats();
          
          // Thêm penalty stats
          context.penaltyStats = await this.getPenaltyStats();
          
          // Load tất cả xe khi cần thông tin chi tiết về model
          if (['vehicle_info', 'vehicle_stats', 'analytics'].includes(messageIntent) || !messageIntent) {
            context.allVehicles = await Vehicle.find()
              .populate('station_id', 'name address')
              .select('name model brand type license_plate color status current_mileage current_battery price_per_day')
              .sort({ brand: 1, model: 1, name: 1 })
              .limit(100);
          }
          
          // Load tất cả trạm khi cần thông tin chi tiết
          if (['station_info', 'station_stats', 'analytics'].includes(messageIntent) || !messageIntent) {
            context.allStations = await Station.find()
              .select('name address status current_vehicles available_vehicles')
              .sort({ name: 1 })
              .limit(50);
          }
          
          // Load weather data nếu cần
          try {
            context.weatherData = await ExternalAPIs.getWeather();
          } catch (error) {
            console.log('Weather API not available');
            context.weatherData = null;
          }
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

  // Prompt cho EV Renter - Sales Consultant AI
  buildRenterPrompt(message, context, conversationHistory) {
    const userStats = context.userStats;
    const recentBookings = context.recentBookings;
    const nearbyStations = context.nearbyStations;
    const availableVehicles = context.availableVehicles;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là tư vấn viên AI của EV Rental System - chuyên gia tư vấn thuê xe máy điện VinFast.

⚠️ VAI TRÒ: CHỈ TƯ VẤN - Không thể đặt xe, thanh toán hay xử lý KYC trực tiếp.
📱 HƯỚNG DẪN: Để thực hiện đặt xe, khách hàng vui lòng sử dụng ứng dụng chính thức hoặc đến trực tiếp trạm.

=== THÔNG TIN THỜI GIAN ===
Hiện tại: ${currentTime} | Hoạt động: 24/7

=== THÔNG TIN KHÁCH HÀNG ===
• Tổng thuê: ${userStats?.total_rentals || 0} lần (${userStats?.total_spent?.toLocaleString('vi-VN') || 0} VND)
• Quãng đường: ${userStats?.total_distance || 0} km
• Lần cuối: ${userStats?.last_rental_date ? formatVietnamTime(userStats.last_rental_date, 'DD/MM/YYYY') : 'Chưa có'}
• KYC: ${context.kycStatus || 'Chưa xác thực'} ${context.kycStatus === 'Chưa xác thực' ? '⚠️ CẦN XÁC THỰC TRƯỚC KHI THUÊ' : '✅'}

=== � BẢNG GIÁ THAM KHẢO ===
**VinFast Klara S:**
• 💰 Giá: 150.000 - 200.000 VND/ngày | 🔋 ~120-150km
• 🎯 Phù hợp: Di chuyển thành phố, thời trang, chất lượng cao
• ⭐ Ưu điểm: Thiết kế đẹp, êm ái, pin bền | ⚠️ Giá cao hơn

**VinFast Feliz:**
• 💰 Giá: 120.000 - 180.000 VND/ngày | 🔋 ~100-130km  
• 🎯 Phù hợp: Sinh viên, đi làm hàng ngày, tiết kiệm chi phí
• ⭐ Ưu điểm: Giá rẻ, nhẹ, tiết kiệm | ⚠️ Tầm xa hạn chế

**VinFast Impes:**
• 💰 Giá: 130.000 - 190.000 VND/ngày | 🔋 ~110-140km
• 🎯 Phù hợp: Cân bằng giá và chất lượng, đa mục đích
• ⭐ Ưu điểm: Ổn định, tin cậy | ⚠️ Không có điểm nổi bật

**Phí khác:**
• Cọc: 500.000 - 1.000.000 VND (hoàn lại) | Phạt trễ: 50.000 VND/giờ
• Hư hỏng: 50.000 - 500.000 VND tùy mức độ

=== ✅ YÊU CẦU THUÊ XE ===
• **KYC:** Bắt buộc xác thực CCCD + selfie
• **Độ tuổi:** Từ 18 tuổi trở lên  
• **Giấy phép:** GPLX (khuyến nghị), không bắt buộc
• **Cọc:** 500.000 - 1.000.000 VND (hoàn lại)

=== 📱 PHƯƠNG THỨC THANH TOÁN ===
• **Tiền mặt:** Tại trạm
• **VNPay QR:** Quét mã thanh toán
• **Chính sách:** 
  - Thuê < 3 ngày: Thanh toán 100% khi nhận xe
  - Thuê ≥ 3 ngày: Cọc 50%, trả 50% còn lại khi trả xe

=== ⚠️ QUY ĐỊNH VÀ PHÍ PHẠT ===
• **Trả trễ:** 50.000 VND/giờ
• **Hư hỏng:** 50.000 - 500.000 VND (tùy mức độ)
• **Mất xe:** Đền bù theo giá trị xe
• **Vi phạm giao thông:** Khách tự chịu trách nhiệm

=== 📋 QUY TRÌNH THUÊ XE (THAM KHẢO) ===
**Bước 1: Đặt xe** 
• Qua ứng dụng chính thức hoặc đến trực tiếp trạm
• Chọn xe, trạm, thời gian thuê
• Hệ thống tạo booking với mã đặt xe

**Bước 2: Xác thực KYC (bắt buộc)**
• Upload: CCCD/CMND + selfie cầm CCCD
• Thời gian duyệt: 1-2 giờ
• Chỉ khi KYC approved mới được nhận xe

**Bước 3: Nhận xe tại trạm**
• Đến đúng giờ hẹn, mang CCCD gốc
• Nhân viên kiểm tra booking và KYC
• Ký hợp đồng, thanh toán theo quy định
• Nhận xe và bắt đầu sử dụng

**Bước 4: Trả xe**
• Đúng thời hạn tại trạm đã chọn
• Nhân viên kiểm tra tình trạng xe
• Thanh toán phần còn lại (nếu có)
• Nhận lại cọc (trừ phí phát sinh)

⚠️ **LƯU Ý:** Để thực hiện các bước trên, vui lòng sử dụng ứng dụng chính thức hoặc đến trực tiếp trạm.

=== 🚗 TRẠNG THÁI XE ===
• 'có sẵn': Sẵn sàng cho thuê
• 'đã đặt': Đã được đặt, chờ khách nhận
• 'đang thuê': Đang được thuê bởi khách hàng
• 'bảo trì': Đang bảo trì, sửa chữa
• 'inactive': Ngừng hoạt động

=== LỊCH SỬ BOOKING CỦA BẠN ===
${recentBookings?.slice(0, 3).map(booking => 
  `• ${booking.code} - ${booking.station_id?.name} (${booking.status})
   Thời gian: ${booking.start_date ? formatVietnamTime(booking.start_date, 'DD/MM HH:mm') : 'N/A'} → ${booking.end_date ? formatVietnamTime(booking.end_date, 'DD/MM HH:mm') : 'N/A'}
   Giá: ${booking.total_price?.toLocaleString('vi-VN') || 0} VND`
).join('\n') || 'Chưa có lịch sử'}

=== 🏢 TRẠM GẦN NHẤT ===
${nearbyStations?.slice(0, 3).map(station => 
  `📍 **${station.name}**
   Địa chỉ: ${station.address}
   Xe available: ${station.available_vehicles}/${station.current_vehicles} xe`
).join('\n') || '📍 Đang tìm trạm gần bạn...'}

=== 🚗 CÁC DÒNG XE HIỆN CÓ ===
${availableVehicles?.length > 0 ? (() => {
  // Nhóm xe theo model thay vì hiển thị từng xe cụ thể
  const vehicleModels = {};
  availableVehicles.forEach(vehicle => {
    const key = `${vehicle.brand} ${vehicle.model}`;
    if (!vehicleModels[key]) {
      vehicleModels[key] = {
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        count: 1,
        price_range: { min: vehicle.price_per_day, max: vehicle.price_per_day },
        battery_levels: [vehicle.current_battery || 0],
        colors: vehicle.color ? [vehicle.color] : [],
        stations: vehicle.station_id?.name ? [vehicle.station_id.name] : [],
        max_range: vehicle.max_range || 100
      };
    } else {
      vehicleModels[key].count++;
      vehicleModels[key].price_range.min = Math.min(vehicleModels[key].price_range.min, vehicle.price_per_day);
      vehicleModels[key].price_range.max = Math.max(vehicleModels[key].price_range.max, vehicle.price_per_day);
      vehicleModels[key].battery_levels.push(vehicle.current_battery || 0);
      if (vehicle.color && !vehicleModels[key].colors.includes(vehicle.color)) {
        vehicleModels[key].colors.push(vehicle.color);
      }
      if (vehicle.station_id?.name && !vehicleModels[key].stations.includes(vehicle.station_id.name)) {
        vehicleModels[key].stations.push(vehicle.station_id.name);
      }
    }
  });
  
  // Hiển thị top models phổ biến
  return Object.values(vehicleModels)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((model, index) => {
      const avgBattery = Math.round(model.battery_levels.reduce((sum, level) => sum + level, 0) / model.battery_levels.length);
      const priceRange = model.price_range.min === model.price_range.max ? 
        `${model.price_range.min.toLocaleString('vi-VN')}` : 
        `${model.price_range.min.toLocaleString('vi-VN')}-${model.price_range.max.toLocaleString('vi-VN')}`;
      
      const actualRange = Math.floor((avgBattery / 100) * model.max_range);
      const colorsText = model.colors.length > 1 ? ` | 🎨 ${model.colors.length} màu sắc` : model.colors.length === 1 ? ` | 🎨 Màu ${model.colors[0]}` : '';
      const stationsText = model.stations.length > 1 ? `${model.stations.length} trạm` : model.stations[0] || 'N/A';
      
      return `${index + 1}. **${model.brand} ${model.model}** (${model.count} xe có sẵn)
   💰 Giá: ${priceRange} VND/ngày${colorsText}
   🔋 Pin TB: ${avgBattery}% (~${actualRange}km) | 🏷️ ${model.type}
   📍 Có tại: ${stationsText}`;
    }).join('\n');
})() : '⏳ Đang cập nhật xe có sẵn...'}

=== 📚 THÔNG TIN XE ĐIỆN TRONG HỆ THỐNG ===
${availableVehicles?.length > 0 ? (() => {
  // Nhóm xe theo brand và model để tránh trùng lặp
  const vehicleModels = {};
  availableVehicles.forEach(vehicle => {
    const key = `${vehicle.brand} ${vehicle.model}`;
    if (!vehicleModels[key]) {
      vehicleModels[key] = {
        name: vehicle.name,
        brand: vehicle.brand,
        model: vehicle.model,
        type: vehicle.type,
        year: vehicle.year,
        battery_capacity: vehicle.battery_capacity,
        max_range: vehicle.max_range,
        price_range: { min: vehicle.price_per_day, max: vehicle.price_per_day },
        count: 1,
        battery_levels: [vehicle.current_battery || 0],
        colors: vehicle.color ? [vehicle.color] : []
      };
    } else {
      vehicleModels[key].count++;
      vehicleModels[key].price_range.min = Math.min(vehicleModels[key].price_range.min, vehicle.price_per_day);
      vehicleModels[key].price_range.max = Math.max(vehicleModels[key].price_range.max, vehicle.price_per_day);
      vehicleModels[key].battery_levels.push(vehicle.current_battery || 0);
      // Thêm màu sắc nếu chưa có
      if (vehicle.color && !vehicleModels[key].colors.includes(vehicle.color)) {
        vehicleModels[key].colors.push(vehicle.color);
      }
    }
  });
  
  // Hiển thị top 5 models phổ biến nhất
  return Object.values(vehicleModels)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(model => {
      const avgBattery = Math.round(model.battery_levels.reduce((sum, level) => sum + level, 0) / model.battery_levels.length);
      const priceRange = model.price_range.min === model.price_range.max ? 
        `${model.price_range.min.toLocaleString('vi-VN')}` : 
        `${model.price_range.min.toLocaleString('vi-VN')}-${model.price_range.max.toLocaleString('vi-VN')}`;
      
      // Tính phạm vi thực tế dựa trên pin hiện tại và max_range
      const actualRange = Math.floor((avgBattery / 100) * (model.max_range || 0));
      const colorsText = model.colors.length > 0 ? ` | 🎨 ${model.colors.join(', ')}` : '';
      
      return `• **${model.brand} ${model.model}** ${model.year} (${model.count} xe có sẵn)
   💰 Giá: ${priceRange} VND/ngày | 🏷️ ${model.type}${colorsText}
   🔋 Pin: ${model.battery_capacity}Ah, hiện tại ${avgBattery}% (~${actualRange}/${model.max_range}km)`;
    }).join('\n');
})() : '• Đang cập nhật thông tin xe...'}

=== 💡 HƯỚNG DẪN SỬ DỤNG XE ĐIỆN ===
• Sạc đầy pin trước khi sử dụng để đi xa nhất
• Chế độ ECO: Tiết kiệm pin, phù hợp đi trong thành phố
• Chế độ SPORT: Hiệu suất cao, tăng tốc nhanh hơn
• Lưu ý an toàn: Không để xe dưới mưa lớn, không tự ý sửa chữa
• Khi pin dưới 20%: Tìm trạm sạc gần nhất hoặc liên hệ hỗ trợ

=== 🔄 LỊCH SỬ HỘI THOẠI ===
${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.message}`).join('\n') || 'Cuộc trò chuyện mới'}

CÂU HỎI: ${message}

=== 📖 HƯỚNG DẪN TRẢ LỜI ===
**VAI TRÒ:** Tư vấn viên bán hàng chuyên nghiệp - Hỗ trợ khách hàng thuê xe

1. ✅ Thân thiện, nhiệt tình như nhân viên tư vấn chuyên nghiệp
2. ✅ **TƯ VẤN TỔNG QUAN:** Giới thiệu các dòng xe, so sánh đặc điểm
3. ✅ **HỎI NHU CẦU TRƯỚC:** "Bạn dự định đi bao xa? Thích màu nào?"
4. ✅ So sánh ưu nhược điểm giữa các dòng xe (Klara vs Feliz vs Impes)
5. ✅ Đề xuất dựa trên mục đích: trong thành phố, đi xa, tiết kiệm...
6. ✅ **KHÔNG FOCUS VÀO MỘT XE CỤ THỂ:** Đưa ra nhiều lựa chọn
7. ✅ Sử dụng CHÍNH XÁC dữ liệu xe, trạm, giá ở trên
8. ✅ Cá nhân hóa dựa trên ${userStats?.total_rentals || 0} lần thuê trước
9. ✅ **GIẢI THÍCH** quy trình khi khách hỏi chi tiết
10. ✅ **NHẤN MẠNH:** Thực hiện qua ứng dụng/website chính thức  
11. ✅ Kêu gọi: "Để đặt xe, bạn vui lòng sử dụng ứng dụng chính thức"
12. ✅ Theo dõi: "Bạn có nhu cầu gì cụ thể để tôi tư vấn phù hợp?"
13. ❌ KHÔNG "hard-sell" một xe cụ thể ngay lập tức
14. ❌ KHÔNG đưa ra biển số xe, mã xe cụ thể trừ khi khách yêu cầu
15. ❌ KHÔNG hướng dẫn thực hiện đặt xe TRỰC TIẾP qua chatbot
16. ❌ KHÔNG chào hỏi lặp lại - tập trung giải quyết vấn đề

Trả về định dạng JSON:
{
  "message": "Phản hồi tư vấn bán hàng chuyên nghiệp",
  "suggestions": ["Đặt xe qua ứng dụng", "Xem xe khác", "Tính chi phí"],
  "actions": ["book_via_app", "compare_vehicles", "calculate_cost"],
  "context": "Tư vấn cụ thể"
}
`;
  }

  // Prompt cho Station Staff
  buildStaffPrompt(message, context, conversationHistory) {
    const station = context.station;
    const currentRentals = context.currentRentals;
    const upcomingBookings = context.upcomingBookings;
    const stationVehicles = context.stationVehicles;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    
    return `
Bạn là trợ lý AI của EV Rental System hỗ trợ nhân viên trạm (Station Staff).

=== THÔNG TIN CƠ BẢN (${currentTime}) ===
- Ca làm việc: 24/7
- Chính sách thanh toán: <3 ngày = 100% ngay, ≥3 ngày = cọc 50%

=== THÔNG TIN TRẠM ===
- Tên: ${station?.name || 'Chưa xác định'}
- Địa chỉ: ${station?.address || 'Chưa xác định'}

=== HÌNH THỨC THANH TOÁN ===
**Các phương thức thanh toán được chấp nhận:**
1. **Tiền mặt (Cash):** 
   - Chấp nhận tất cả mệnh giá VND
   - Chuẩn bị tiền lẻ để trả khách
   - In hóa đơn VAT nếu khách yêu cầu

2. **VNPay (QR Code):**
   - Quét mã QR từ app VNPay
   - Kiểm tra transaction thành công trước giao xe
   - Lưu screenshot xác nhận thanh toán
   - Hỗ trợ khách cài app nếu cần

**Quy trình thu tiền:**
- Thuê <3 ngày: Thu 100% khi giao xe
- Thuê ≥3 ngày: Thu cọc 50% khi giao xe, 50% khi trả xe
- Phí phạt: Thu ngay khi trả xe (tiền mặt hoặc VNPay)

=== HỢP ĐỒNG VÀ GIẤY TỜ ===
**Quy trình ký hợp đồng:**
1. **Chuẩn bị hợp đồng:** Điền thông tin từ booking vào mẫu hợp đồng
2. **Xác minh khách hàng:** CCCD/CMND khớp với thông tin booking  
3. **Ký hợp đồng:** Khách ký 2 bản (1 bản cho khách, 1 bản lưu trạm)
4. **Biên bản bàn giao:** Ghi nhận tình trạng xe chi tiết
5. **Chụp ảnh lưu trữ:** Hợp đồng đã ký + CCCD khách + ảnh xe

**Giấy tờ cần thiết:**
- Hợp đồng thuê xe (2 bản)
- Biên bản bàn giao xe (2 bản)  
- CCCD/CMND khách hàng (bản gốc + photocopy)
- Phiếu thu tiền/hóa đơn
- Ảnh chụp xe 4 góc

**Lưu ý quan trọng:**
- Hợp đồng có hiệu lực sau khi cả 2 bên ký
- Khách hàng phải đọc và hiểu các điều khoản
- Giải thích rõ chính sách phí phạt, bảo hiểm
- Lưu trữ hồ sơ theo quy định pháp luật

=== THỐNG KÊ XE THỰC TẾ (từ database) ===
- Tổng xe trong trạm: ${stationVehicles?.length || 0}
- ✅ Available: ${stationVehicles?.filter(v => v.status === 'available').length || 0}
- 🚗 Đang thuê: ${stationVehicles?.filter(v => v.status === 'rented').length || 0}  
- 🔧 Bảo trì: ${stationVehicles?.filter(v => v.status === 'maintenance').length || 0}
- 📋 Đã đặt: ${stationVehicles?.filter(v => v.status === 'reserved').length || 0}
- ❓ Khác: ${stationVehicles?.filter(v => !['available', 'rented', 'maintenance', 'reserved'].includes(v.status)).length || 0}

=== XE ĐANG THUÊ (${currentRentals?.length || 0} xe) ===
${currentRentals?.slice(0, 5).map(rental => {
  const customerName = rental.user_id?.fullname || 'Không rõ';
  const vehicleType = rental.vehicle_id?.type || 'Không rõ';
  const startTime = rental.actual_start_time ? formatVietnamTime(rental.actual_start_time, 'DD/MM HH:mm') : 'Không rõ';
  const expectedEnd = rental.expected_end_time ? formatVietnamTime(rental.expected_end_time, 'DD/MM HH:mm') : 'Không rõ';
  
  return `• ${customerName} - ${vehicleType} (${startTime} → ${expectedEnd})`;
}).join('\n') || 'Không có xe đang thuê'}

=== XE TRONG TRẠM (${stationVehicles?.length || 0} xe) ===
${stationVehicles?.slice(0, 8).map(vehicle => {
  const status = vehicle.status === 'available' ? '✅' : 
                vehicle.status === 'rented' ? '🚗' : 
                vehicle.status === 'maintenance' ? '🔧' : '❓';
  const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
  
  return `${status} ${vehicleDisplay} (${vehicle.license_plate}) - Pin: ${vehicle.current_battery || 0}%`;
}).join('\n') || 'Không có xe trong trạm'}

=== BOOKING SẮP TỚI (${upcomingBookings?.length || 0} booking) ===
${upcomingBookings?.slice(0, 3).map(booking => {
  const customerName = booking.user_id?.fullname || 'Không rõ';
  const vehicleType = booking.vehicle_id?.type || 'Không rõ';
  const startTime = formatVietnamTime(booking.start_date, 'DD/MM HH:mm');
  
  return `• ${customerName} - ${vehicleType} (${startTime})`;
}).join('\n') || 'Không có booking sắp tới'}

=== LỊCH SỬ THUÊ XE (${context.completedRentals?.length || 0} rental đã hoàn thành) ===
${context.completedRentals?.slice(0, 3).map(rental => {
  const customerName = rental.user_id?.fullname || 'Không rõ';
  const vehicleName = rental.vehicle_id?.name || 'Không rõ';
  const endTime = rental.actual_end_time ? formatVietnamTime(rental.actual_end_time, 'DD/MM HH:mm') : 'Không rõ';
  const totalPrice = rental.booking_id?.total_price || 0;
  
  return `• ${customerName} - ${vehicleName} (Kết thúc: ${endTime}, Giá: ${totalPrice.toLocaleString('vi-VN')} VNĐ)`;
}).join('\n') || 'Chưa có rental nào hoàn thành'}

=== BẢNG PHÍ PHẠT ===
- Trả trễ: 50.000 VND/giờ (tối đa 500.000 VND/ngày)
- Hư hỏng nhẹ: 100.000-500.000 VND
- Hư hỏng nặng: 1.000.000-5.000.000 VND
- Mất xe: Toàn bộ giá trị xe

=== QUY TRÌNH NHANH ===
**Giao xe:**
1. Kiểm tra KYC + ID
2. Check xe (pin ≥50%, vỏ xe, đèn)
3. Chụp ảnh trước/sau
4. Thu tiền theo chính sách
5. Hướng dẫn sử dụng

**Nhận xe:**
1. Kiểm tra tình trạng xe
2. Tính phí phát sinh (nếu có)
3. Cập nhật hệ thống
4. Hoàn tiền cọc (trừ phí)

=== LỊCH SỬ HỘI THOẠI ===
${conversationHistory.slice(-2).map(msg => `${msg.role}: ${msg.message}`).join('\n') || 'Chưa có'}

CÂU HỎI: ${message}

HƯỚNG DẪN TRẢ LỜI:
1. SỬ DỤNG CHÍNH XÁC dữ liệu thực tế ở trên
2. KHÔNG tự tạo thông tin không có
3. ⚠️ BẮT BUỘC: Khi hỏi về số xe, PHẢI nói đầy đủ breakdown:
   - Tổng xe: X chiếc
   - Available: X xe
   - Đang thuê: X xe  
   - Bảo trì: X xe
   - Đã đặt: X xe
4. KIỂM TRA: Tổng xe = Available + Đang thuê + Bảo trì + Đã đặt + Khác
5. Trả lời ngắn gọn, thực tế
6. Tính toán phí chính xác theo bảng phí
7. Hướng dẫn quy trình cụ thể
8. Ưu tiên giải pháp nhanh chóng

VÍ DỤ TRẢ LỜI ĐÚNG cho câu hỏi về số xe:
"Hiện tại trạm có tổng cộng 35 xe máy điện:
• ✅ 20 xe đang sẵn sàng cho thuê
• 🚗 1 xe đang được thuê
• 🔧 4 xe đang bảo trì  
• 📋 10 xe đã được đặt trước"

Format JSON:
{
  "message": "Câu trả lời ngắn gọn, thực tế",
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "actions": ["action1", "action2"],
  "context": "Thông tin bổ sung"
}
`;
  }

  // Prompt cho Admin
  buildAdminPrompt(message, context, conversationHistory) {
    const systemStats = context.systemStats;
    const vehicleStats = context.vehicleRentalStats;
    const stationStats = context.stationRentalStats;
    const penaltyStats = context.penaltyStats;
    const allVehicles = context.allVehicles;
    const allStations = context.allStations;
    const currentTime = formatVietnamTime(new Date(), 'DD/MM/YYYY HH:mm');
    const currentYear = new Date().getFullYear();
    
    // Tạo danh sách model xe trong hệ thống
    const vehicleModels = allVehicles ? 
      [...new Set(allVehicles.map(v => `${v.brand} ${v.model}`))].slice(0, 10) : [];
    
  
    const totalRentalRevenue = vehicleStats?.reduce((sum, stat) => sum + (stat.total_revenue || 0), 0) || 0;
    const totalPenaltyRevenue = penaltyStats?.summary?.total_penalty_amount || 0;
    const totalRevenue = totalRentalRevenue + totalPenaltyRevenue;
    
    return `
Bạn là trợ lý AI của EV Rental System hỗ trợ Admin.

=== THỐNG KÊ HỆ THỐNG (${currentTime}) ===
- Tổng xe: ${systemStats?.totalVehicles || 0}
- Xe available: ${systemStats?.availableVehicles || 0}
- Xe đang thuê: ${systemStats?.rentedVehicles || 0}

=== DOANH THU ===
- Doanh thu tháng này: ${systemStats?.monthlyRevenue?.toLocaleString('vi-VN') || 0} VND
- DOANH THU NĂM ${currentYear}: ${systemStats?.yearlyRevenue?.toLocaleString('vi-VN') || 0} VND

=== CHI TIẾT DOANH THU (Tất cả thời gian) ===
- Doanh thu từ thuê xe: ${totalRentalRevenue.toLocaleString('vi-VN')} VND
- Doanh thu từ phí phạt: ${totalPenaltyRevenue.toLocaleString('vi-VN')} VND
- TỔNG: ${totalRevenue.toLocaleString('vi-VN')} VND
- Tỷ lệ phí phạt: ${totalRevenue > 0 ? ((totalPenaltyRevenue / totalRevenue) * 100).toFixed(1) : 0}%

=== THỐNG KÊ XE ĐƯỢC THUÊ ===
${vehicleStats?.length > 0 ? 
  vehicleStats.slice(0, 5).map((stat, index) => {
    const vehicleName = stat.vehicle_info?.name || 'Xe không rõ tên';
    const vehicleBrand = stat.vehicle_info?.brand || 'Không rõ hãng';
    const vehicleModel = stat.vehicle_info?.model || 'Không rõ model';
    const vehicleColor = stat.vehicle_info?.color || 'Không rõ màu';
    const licensePlate = stat.vehicle_info?.license_plate || 'N/A';
    const totalRentals = stat.total_rentals || 0;
    const totalRevenue = stat.total_revenue || 0;
    
    return `${index + 1}. ${vehicleName} - ${vehicleBrand} ${vehicleModel} màu ${vehicleColor} (${licensePlate}): ${totalRentals} lần thuê - ${totalRevenue.toLocaleString('vi-VN')} VND`;
  }).join('\n')
  : 'Chưa có dữ liệu thống kê xe được thuê'
}

=== THỐNG KÊ TRẠM ĐƯỢC THUÊ ===
${stationStats?.length > 0 ? 
  stationStats.slice(0, 5).map((stat, index) => {
    const stationName = stat.station_info?.name || 'Trạm không rõ tên';
    const stationAddress = stat.station_info?.address || 'Không rõ địa chỉ';
    const totalRentals = stat.total_rentals || 0;
    const totalRevenue = stat.total_revenue || 0;
    
    return `${index + 1}. ${stationName} (${stationAddress}): ${totalRentals} lần thuê - ${totalRevenue.toLocaleString('vi-VN')} VND`;
  }).join('\n')
  : 'Chưa có dữ liệu thống kê trạm được thuê'
}

=== THỐNG KÊ PHÍ PHẠT ===
${context.penaltyStats?.summary?.users_with_penalties ? `
Tổng số payment phí phạt: ${context.penaltyStats.summary.penalty_count}
Tổng tiền phạt: ${context.penaltyStats.summary.total_penalty_amount.toLocaleString('vi-VN')} VND
Số người dùng bị phạt: ${context.penaltyStats.summary.users_with_penalties}

Top người dùng bị phạt nhiều nhất:
${context.penaltyStats.user_penalty_ranking?.length > 0 ? 
  context.penaltyStats.user_penalty_ranking.slice(0, 5).map((user, index) => {
    const userName = user.user_info?.fullname || 'Không rõ tên';
    const userEmail = user.user_info?.email || 'Không rõ email';
    const penaltyAmount = user.total_penalty_amount || 0;
    const penaltyCount = user.penalty_count || 0;
    
    return `${index + 1}. ${userName} (${userEmail}): ${penaltyCount} lần vi phạm - ${penaltyAmount.toLocaleString('vi-VN')} VND`;
  }).join('\n')
  : 'Chưa có dữ liệu người dùng bị phạt'
}
` : 'Chưa có dữ liệu về phí phạt'
}

=== MODEL XE TRONG HỆ THỐNG ===
${vehicleModels.length > 0 ? 
  vehicleModels.map((model, index) => `${index + 1}. ${model}`).join('\n')
  : 'Chưa có thông tin model xe'
}

=== LỊCH SỬ HỘI THOẠI ===
${conversationHistory.slice(-2).map(msg => `${msg.role}: ${msg.message}`).join('\n') || 'Chưa có'}

CÂU HỎI: ${message}

QUAN TRỌNG - HƯỚNG DẪN TRẢ LỜI:
1. SỬ DỤNG CHÍNH XÁC dữ liệu thống kê ở trên
2. KHÔNG tự tạo ra tên trạm hoặc số liệu không có trong dữ liệu
3. Nếu hỏi về xe được thuê nhiều nhất, dùng ĐÚNG danh sách thống kê xe ở trên
4. Nếu hỏi về trạm được thuê nhiều nhất, dùng ĐÚNG danh sách thống kê trạm ở trên
5. Nếu hỏi về model xe, dùng ĐÚNG danh sách model xe ở trên
6. Nếu hỏi về doanh thu năm nay, dùng "DOANH THU NĂM ${currentYear}" ở trên
7. Nếu hỏi về doanh thu tháng này, dùng "Doanh thu tháng này" ở trên
8. Trả lời bằng tiếng Việt, chuyên nghiệp
9. Đưa ra insights dựa trên SỐ LIỆU THỰC TẾ
10. LUÔN có số liệu cụ thể, KHÔNG nói "Không có số liệu"

Format JSON:
{
  "message": "Câu trả lời với dữ liệu chính xác",
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

  // Kiểm tra chất lượng response cho Admin và Staff
  validateAdminResponse(response, context) {
    const message = response.message?.toLowerCase() || '';
    const originalMessage = (response.originalMessage || '').toLowerCase();
    const intent = this.detectIntent(response.originalMessage || '');
    
    // Check basic response quality
    if (!message || message.length < 10) {
      return false;
    }
    
    console.log('Validating response:', {
      intent,
      messageLength: message.length,
      originalMessage: originalMessage.substring(0, 50),
      hasOriginalMessage: !!response.originalMessage
    });
    
    // Special validation for upcoming_bookings intent
    if (intent === 'upcoming_bookings') {
      console.log('Validating upcoming_bookings response:', {
        upcomingBookingsCount: context.upcomingBookings?.length || 0,
        recentBookingsCount: context.recentBookings?.length || 0,
        messageLength: message.length
      });
      
      // If there are upcoming or recent bookings, response should mention them or be detailed
      if ((context.upcomingBookings?.length > 0 || context.recentBookings?.length > 0) && 
          message.length < 100) {
        console.log('Response too short for booking query with available data - triggering fallback');
        return false;
      }
      
      // If response is generic "không có booking" but we have recent bookings, should fail
      if (message.includes('không có') && message.length < 50 && context.recentBookings?.length > 0) {
        console.log('Generic no-booking response when recent bookings exist - triggering fallback');
        return false;
      }
    }
    
    // Special validation for vehicle status queries
    if (intent === 'vehicle_status' && context.stationVehicles?.length > 0) {
      const totalVehicles = context.stationVehicles.length;
      
      console.log('Vehicle status validation:', {
        totalVehicles,
        responseLength: message.length,
        isQuery: originalMessage.includes('xe') || originalMessage.includes('vehicle')
      });
      
      // Check if response is too abbreviated for vehicle status query
      const numberPattern = /(\d+)/g;
      const numbers = message.match(numberPattern) || [];
      
      // For vehicle status queries, response should be detailed
      const isAbbreviated = message.length < 150; // Too short
      const hasMinimalNumbers = numbers.length < 3; // Should have multiple numbers for breakdown
      
      // Check if mentions vehicle statuses
      const statusKeywords = [
        'available', 'sẵn sàng', 'trống',
        'rented', 'thuê', 'đang thuê', 
        'maintenance', 'bảo trì', 'sửa chữa',
        'reserved', 'đặt trước', 'đã đặt'
      ];
      
      const statusesMentioned = statusKeywords.filter(keyword => 
        message.includes(keyword)
      ).length;
      
      // Fail validation if response is too brief for detailed vehicle query
      if (isAbbreviated && hasMinimalNumbers && statusesMentioned < 2 && totalVehicles > 5) {
        console.log('Response too abbreviated for vehicle status query - triggering fallback');
        return false;
      }
      
      // Check math accuracy
      if (numbers.length >= 2) {
        const mentionedTotal = parseInt(numbers[0]);
        if (mentionedTotal !== totalVehicles && !numbers.some(num => parseInt(num) === totalVehicles)) {
          console.log('Vehicle count math error - triggering fallback');
          return false;
        }
      }
    }
    
    // Check math logic cho vehicle counts (for Station Staff)
    if (context.stationVehicles?.length > 0) {
      const totalVehicles = context.stationVehicles.length;
      const availableCount = context.stationVehicles.filter(v => v.status === 'available').length;
      const rentedCount = context.stationVehicles.filter(v => v.status === 'rented').length;
      const maintenanceCount = context.stationVehicles.filter(v => v.status === 'maintenance').length;
      const reservedCount = context.stationVehicles.filter(v => v.status === 'reserved').length;
      const otherCount = context.stationVehicles.filter(v => !['available', 'rented', 'maintenance', 'reserved'].includes(v.status)).length;
      
      const calculatedTotal = availableCount + rentedCount + maintenanceCount + reservedCount + otherCount;
      
      // Extract numbers from response but exclude license plates and dates
      // Only validate if the response is about vehicle counts/statistics
      const intent = this.detectIntent(response.originalMessage || '');
      const isVehicleStatsQuery = ['vehicle_status', 'vehicle_stats', 'analytics'].includes(intent);
      
      if (isVehicleStatsQuery) {
        const numberPattern = /(\d+)/g;
        const numbers = message.match(numberPattern);
        
        if (numbers && numbers.length >= 2) {
          // Filter out license plate numbers (usually 3+ digits after letters)
          const vehicleNumbers = numbers.filter(num => {
            const numInt = parseInt(num);
            // Skip license plate numbers (VH046 -> 046), dates (19, 10), prices (large numbers)
            return numInt <= 100 && numInt > 0; // Only count small numbers that could be vehicle counts
          });
          
          if (vehicleNumbers.length >= 2) {
            const mentionedTotal = parseInt(vehicleNumbers[0]);
            
            // Allow some flexibility - if total is mentioned and it's correct, pass validation
            if (mentionedTotal !== calculatedTotal && 
                !vehicleNumbers.some(num => parseInt(num) === calculatedTotal)) {
              console.log('Validation failed: Math error in vehicle counts');
              console.log('Expected total:', calculatedTotal, 'Vehicle numbers mentioned:', vehicleNumbers);
              return false;
            }
          }
          
          // Additional check - if response mentions detailed breakdown, verify it
          if (vehicleNumbers.length >= 4) {
            const mentionedAvailable = vehicleNumbers.find((num, idx) => {
              const numInt = parseInt(num);
              return numInt === availableCount && 
                     (message.includes('available') || message.includes('sẵn sàng') || message.includes('trống'));
            });
            
            if (mentionedAvailable && parseInt(mentionedAvailable) !== availableCount) {
              console.log('Validation failed: Available count mismatch');
              return false;
            }
          }
        }
      }
    }
    
    // Check xem có sử dụng dữ liệu thật không khi hỏi về vehicle stats
    if (context.vehicleRentalStats?.length > 0) {
      const intent = this.detectIntent(response.originalMessage || '');
      
      if (intent === 'vehicle_stats') {
        // Kiểm tra xem có sử dụng tên xe thật không
        let hasRealVehicleData = false;
        
        for (const stat of context.vehicleRentalStats) {
          const vehicleName = stat.vehicle_info?.name?.toLowerCase() || '';
          const vehicleBrand = stat.vehicle_info?.brand?.toLowerCase() || '';
          const vehicleModel = stat.vehicle_info?.model?.toLowerCase() || '';
          const totalRentals = stat.total_rentals?.toString() || '';
          
          if ((vehicleName && message.includes(vehicleName)) ||
              (vehicleBrand && message.includes(vehicleBrand)) ||
              (vehicleModel && message.includes(vehicleModel)) ||
              (totalRentals && message.includes(totalRentals))) {
            hasRealVehicleData = true;
            break;
          }
        }
        
        // Nếu không có data thật mà nói có thống kê thì fail
        if (!hasRealVehicleData && message.includes('top') && message.includes('xe')) {
          console.log('Validation failed: No real vehicle data used');
          return false;
        }
      }
    }
    
    // Check xem có sử dụng dữ liệu thật không khi hỏi về station stats
    if (context.stationRentalStats?.length > 0) {
      const intent = this.detectIntent(response.originalMessage || '');
      
      if (intent === 'station_stats') {
        let hasRealStationData = false;
        
        for (const stat of context.stationRentalStats) {
          const stationName = stat.station_info?.name?.toLowerCase() || '';
          const stationAddress = stat.station_info?.address?.toLowerCase() || '';
          const totalRentals = stat.total_rentals?.toString() || '';
          
          if ((stationName && message.includes(stationName)) ||
              (stationAddress && message.includes(stationAddress)) ||
              (totalRentals && message.includes(totalRentals))) {
            hasRealStationData = true;
            break;
          }
        }
        
        if (!hasRealStationData && message.includes('trạm') && message.includes('không có dữ liệu')) {
          console.log('Validation failed: No real station data used');
          return false;
        }
      }
    }
    
    // Check xem có sử dụng dữ liệu thật không khi hỏi về penalty stats
    if (context.penaltyStats?.summary?.users_with_penalties > 0) {
      const intent = this.detectIntent(response.originalMessage || '');
      
      if (intent === 'penalty_stats' || intent === 'penalty_users') {
        let hasRealPenaltyData = false;
        
        // Check if response mentions actual penalty data
        const penaltyAmount = context.penaltyStats.summary.total_penalties?.toString() || '';
        const penaltyCount = context.penaltyStats.summary.users_with_penalties?.toString() || '';
        const lateFee = context.penaltyStats.summary.total_late_fees?.toString() || '';
        const damageFee = context.penaltyStats.summary.total_damage_fees?.toString() || '';
        
        // Kiểm tra cả user ranking data
        const userRanking = context.penaltyStats.user_penalty_ranking || [];
        let hasUserData = false;
        
        for (const user of userRanking) {
          const userName = user.user_info?.fullname?.toLowerCase() || '';
          const userEmail = user.user_info?.email?.toLowerCase() || '';
          const userPenaltyAmount = user.total_penalty_amount?.toString() || '';
          
          if ((userName && message.includes(userName)) ||
              (userEmail && message.includes(userEmail)) ||
              (userPenaltyAmount && message.includes(userPenaltyAmount))) {
            hasUserData = true;
            break;
          }
        }
        
        if ((penaltyAmount && message.includes(penaltyAmount)) ||
            (penaltyCount && message.includes(penaltyCount)) ||
            (lateFee && message.includes(lateFee)) ||
            (damageFee && message.includes(damageFee)) ||
            hasUserData) {
          hasRealPenaltyData = true;
        }
        
        // Nếu không có data thật mà nói có penalty thì fail
        if (!hasRealPenaltyData && (message.includes('phí phạt') || message.includes('penalty')) && 
            message.includes('không có dữ liệu')) {
          console.log('Validation failed: No real penalty data used');
          return false;
        }
      }
    }

    // Check for obvious hallucination patterns
    const hallucinationPatterns = [
      /top \d+ xe đều là/i,
      /tất cả.*đều là.*vinfast klara/i,
      /5 xe.*cùng.*model/i,
      /chưa thống kê.*trạm/i,
      /không có.*dữ liệu.*trạm/i,
      /chưa có.*dữ liệu.*phí phạt/i,
      /không có.*vi phạm/i,
      /chưa thống kê.*penalty/i
    ];
    
    for (const pattern of hallucinationPatterns) {
      if (pattern.test(message)) {
        console.log('Validation failed: Hallucination pattern detected');
        return false;
      }
    }
    
    return true;
  }

  // Tạo response dựa trên dữ liệu thật
  generateDataDrivenResponse(message, context) {
    const intent = this.detectIntent(message);
    
    if ((intent === 'penalty_stats' || intent === 'penalty_users') && context.penaltyStats?.summary?.users_with_penalties > 0) {
      const penaltyStats = context.penaltyStats.summary;
      const userRanking = context.penaltyStats.user_penalty_ranking || [];
      
      let responseMessage = `📊 **THỐNG KÊ PHÍ PHẠT HỆ THỐNG**\n\n`;
      
      responseMessage += `🔍 **Tổng quan:**\n`;
      responseMessage += `• Tổng số payment phí phạt: **${penaltyStats.penalty_count}** trường hợp\n`;
      responseMessage += `• Tổng tiền phạt: **${penaltyStats.total_penalty_amount.toLocaleString('vi-VN')} VND**\n`;
      responseMessage += `• Số người dùng bị phạt: **${penaltyStats.users_with_penalties}** người\n\n`;
      
      // Hiển thị top người dùng bị phạt nhiều nhất
      if (userRanking.length > 0) {
        responseMessage += `\n👥 **Top người dùng bị phạt nhiều nhất:**\n`;
        
        userRanking.slice(0, 5).forEach((user, index) => {
          const userName = user.user_info?.fullname || 'Không rõ tên';
          const userEmail = user.user_info?.email || 'Không rõ email';
          const penaltyAmount = user.total_penalty_amount || 0;
          const penaltyCount = user.penalty_count || 0;
          
          responseMessage += `${index + 1}. **${userName}** (${userEmail})\n`;
          responseMessage += `   - Số lần vi phạm: ${penaltyCount} lần\n`;
          responseMessage += `   - Tổng tiền phạt: ${penaltyAmount.toLocaleString('vi-VN')} VND\n`;
          
          // Chi tiết loại phí từ rental data
          if (user.total_late_fees > 0) {
            responseMessage += `   - Phí trả trễ: ${user.total_late_fees.toLocaleString('vi-VN')} VND\n`;
          }
          if (user.total_damage_fees > 0) {
            responseMessage += `   - Phí hư hỏng: ${user.total_damage_fees.toLocaleString('vi-VN')} VND\n`;
          }
          if (user.total_other_fees > 0) {
            responseMessage += `   - Phí khác: ${user.total_other_fees.toLocaleString('vi-VN')} VND\n`;
          }
          responseMessage += '\n';
        });
      }
      
      // Phân tích insights
      responseMessage += `📈 **Phân tích:**\n`;
      
      if (penaltyStats.total_penalty_amount > 0) {
        const avgPenaltyPerUser = (penaltyStats.total_penalty_amount / penaltyStats.users_with_penalties).toFixed(0);
        const avgPenaltyPerCase = (penaltyStats.total_penalty_amount / penaltyStats.penalty_count).toFixed(0);
        
        responseMessage += `• Trung bình mỗi người bị phạt: **${avgPenaltyPerUser} VND**\n`;
        responseMessage += `• Trung bình mỗi lần phạt: **${avgPenaltyPerCase} VND**\n`;
        
        if (userRanking.length > 0) {
          const topUser = userRanking[0];
          responseMessage += `• 🏆 Người dùng bị phạt nhiều nhất: **${topUser.user_info?.fullname}** với ${topUser.total_penalty_amount.toLocaleString('vi-VN')} VND (${topUser.penalty_count} lần)\n`;
        }
        
        if (penaltyStats.penalty_count > penaltyStats.users_with_penalties) {
          responseMessage += `• ⚠️ Có người dùng bị phạt nhiều lần (${penaltyStats.penalty_count} lần phạt / ${penaltyStats.users_with_penalties} người)\n`;
        }
      }
      
      return {
        message: responseMessage,
        suggestions: ['Xem chi tiết từng người dùng', 'Phân tích xu hướng theo thời gian', 'Đề xuất biện pháp giảm thiểu'],
        actions: ['view_user_penalty_details', 'export_penalty_report', 'contact_users', 'prevention_measures'],
        context: 'Thống kê phí phạt chi tiết bao gồm danh sách người dùng bị phạt'
      };
    }

    // Handle vehicle color search queries
    if (intent === 'vehicle_color_search') {
      if (!context.availableVehicles?.length) {
        return {
          message: `🔍 **TÌM KIẾM XE THEO MÀU SẮC**\n\nRất tiếc, hiện tại hệ thống không tìm thấy xe nào có sẵn. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.\n\n📞 **Liên hệ hỗ trợ:** 1900-1234\n🕐 **Thời gian:** 24/7`,
          suggestions: ['Liên hệ hỗ trợ', 'Thử lại sau', 'Xem thông tin trạm'],
          actions: ['contact_support', 'retry_search', 'view_stations'],
          context: 'Không có xe available trong hệ thống'
        };
      }
      
      const message_lower = message.toLowerCase();
      
      // Extract color từ message
      const colorMap = {
        'đỏ': ['đỏ', 'do', 'red', 'đo'],
        'trắng': ['trắng', 'trang', 'white', 'bạc', 'bac', 'tráng'],
        'xanh dương': ['xanh dương', 'xanh duong', 'blue', 'navy', 'xanh đương', 'xanh duong', 'xanhduong', 'xanhduong'],
        'xanh lá': ['xanh lá', 'xanh la', 'green', 'xanhla', 'xanhlá'],
        'đen': ['đen', 'den', 'black', 'đền'],
        'vàng': ['vàng', 'vang', 'yellow', 'gold', 'vàng'],
        'hồng': ['hồng', 'hong', 'pink', 'hông'],
        'xám': ['xám', 'xam', 'grey', 'gray', 'xấm'],
        'cam': ['cam', 'orange', 'cẩm']
      };
      
      let requestedColor = null;
      let requestedBrand = null;
      let requestedModel = null;
      
      // Tìm màu được yêu cầu
      for (const [color, variants] of Object.entries(colorMap)) {
        if (variants.some(variant => message_lower.includes(variant))) {
          requestedColor = color;
          break;
        }
      }
      
      // Tìm brand và model được yêu cầu
      if (message_lower.includes('vinfast')) requestedBrand = 'VinFast';
      if (message_lower.includes('klara')) requestedModel = 'Klara S';
      if (message_lower.includes('feliz')) requestedModel = 'Feliz S';
      if (message_lower.includes('theon')) requestedModel = 'Theon S';
      if (message_lower.includes('vento')) requestedModel = 'Vento S';
      
      // Filter xe theo điều kiện
      let filteredVehicles = context.availableVehicles;
      
      if (requestedBrand) {
        filteredVehicles = filteredVehicles.filter(v => v.brand?.toLowerCase().includes(requestedBrand.toLowerCase()));
      }
      
      if (requestedModel) {
        filteredVehicles = filteredVehicles.filter(v => v.model?.toLowerCase().includes(requestedModel.toLowerCase()));
      }
      
      if (requestedColor) {
        filteredVehicles = filteredVehicles.filter(v => {
          const vehicleColor = (v.color || '').toLowerCase().trim();
          
          // Normalize cả vehicleColor và colorVariant để so sánh chính xác hơn
          const normalizeString = (str) => {
            return str.toLowerCase()
              .replace(/á|à|ả|ã|ạ|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/g, 'a')
              .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/g, 'e')
              .replace(/í|ì|ỉ|ĩ|ị/g, 'i')
              .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/g, 'o')
              .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/g, 'u')
              .replace(/ý|ỳ|ỷ|ỹ|ỵ/g, 'y')
              .replace(/đ/g, 'd')
              .replace(/\s+/g, '');
          };
          
          const normalizedVehicleColor = normalizeString(vehicleColor);
          
          return colorMap[requestedColor].some(colorVariant => {
            const normalizedVariant = normalizeString(colorVariant);
            return normalizedVehicleColor.includes(normalizedVariant) || 
                   vehicleColor.includes(colorVariant.toLowerCase()) ||
                   colorVariant.toLowerCase().includes(vehicleColor);
          });
        });
      }
      
      let responseMessage = '';
      let suggestions = [];
      let actions = [];
      
      if (filteredVehicles.length > 0) {
        const searchTerms = [
          requestedBrand,
          requestedModel, 
          requestedColor ? `màu ${requestedColor}` : null
        ].filter(Boolean).join(' ');
        
        responseMessage = `🔍 **TÌM THẤY ${filteredVehicles.length} XE ${searchTerms.toUpperCase()}**\n\n`;
        
        // Group by color để hiển thị tổng hợp
        const colorGroups = {};
        filteredVehicles.forEach(vehicle => {
          const color = vehicle.color || 'Không rõ màu';
          if (!colorGroups[color]) {
            colorGroups[color] = [];
          }
          colorGroups[color].push(vehicle);
        });
        
        Object.entries(colorGroups).forEach(([color, vehicles]) => {
          responseMessage += `🎨 **Màu ${color}** (${vehicles.length} xe):\n`;
          
          vehicles.slice(0, 3).forEach((vehicle, index) => {
            const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
            responseMessage += `${index + 1}. **${vehicleDisplay}**\n`;
            responseMessage += `   💰 ${vehicle.price_per_day?.toLocaleString('vi-VN')} VND/ngày\n`;
            const batteryLevel = vehicle.current_battery || 0;
            responseMessage += `   🔋 Pin: ${batteryLevel}% (~${Math.floor(batteryLevel * (vehicle.max_range || 100) / 100)}km)\n`;
            responseMessage += `   📍 ${vehicle.station_id?.name || 'Đang cập nhật'}\n`;
            responseMessage += `   🔖 Biển số: ${vehicle.license_plate}\n\n`;
          });
          
          if (vehicles.length > 3) {
            responseMessage += `   ...và ${vehicles.length - 3} xe khác\n\n`;
          }
        });
        
        suggestions = [
          'Xem tất cả xe có sẵn',
          'Đặt xe ngay',
          'So sánh giá các màu khác'
        ];
        actions = [
          'view_all_vehicles',
          'book_vehicle',
          'compare_colors'
        ];
        
      } else {
        // Không tìm thấy xe theo yêu cầu
        const availableColors = [...new Set(context.availableVehicles.map(v => v.color).filter(Boolean))];
        const searchTerms = [
          requestedBrand,
          requestedModel,
          requestedColor ? `màu ${requestedColor}` : null
        ].filter(Boolean).join(' ');
        
        responseMessage = `Chào bạn, rất tiếc hiện tại hệ thống của EV Rental System chưa có xe ${searchTerms}. `;
        
        if (requestedBrand && requestedModel) {
          // Tìm xe cùng brand+model nhưng khác màu
          const sameModelVehicles = context.availableVehicles.filter(v => 
            v.brand?.toLowerCase().includes(requestedBrand.toLowerCase()) &&
            v.model?.toLowerCase().includes(requestedModel.toLowerCase())
          );
          
          if (sameModelVehicles.length > 0) {
            const modelColors = [...new Set(sameModelVehicles.map(v => v.color).filter(Boolean))];
            responseMessage += `Các xe ${requestedBrand} ${requestedModel} hiện chỉ có màu ${modelColors.join(' và ')} thôi ạ. `;
          }
        }
        
        responseMessage += `Bạn có muốn tôi tìm kiếm các xe màu khác hoặc các dòng xe khác `;
        if (requestedColor) {
          responseMessage += `có màu ${requestedColor} `;
        }
        responseMessage += `không? Hoặc tôi có thể gợi ý các xe `;
        if (availableColors.length > 0) {
          responseMessage += `màu ${availableColors.slice(0, 3).join('/')} `;
        }
        responseMessage += `đang có sẵn ở trạm gần bạn nhất để bạn tham khảo nhé.`;
        
        suggestions = availableColors.slice(0, 3).map(color => `Xem xe màu ${color.toLowerCase()}`);
        suggestions.push('Tìm dòng xe khác');
        
        actions = availableColors.slice(0, 3).map(color => `view_${color.toLowerCase().replace(/\s+/g, '_')}_vehicles`);
        actions.push('find_other_models');
      }
      
      return {
        message: responseMessage,
        suggestions: suggestions,
        actions: actions,
        context: requestedColor ? `Tư vấn màu sắc xe` : 'Tìm kiếm xe theo màu sắc'
      };
    }

    if (intent === 'station_stats' && context.stationRentalStats?.length > 0) {
      const topStations = context.stationRentalStats.slice(0, 5);
      const topStation = topStations[0];
      
      // Tạo response với dữ liệu thật
      let responseMessage = `Dựa trên dữ liệu thống kê thuê xe, đây là top ${topStations.length} trạm được thuê nhiều nhất:\n\n`;
      
      topStations.forEach((stat, index) => {
        const stationName = stat.station_info?.name || 'Trạm không rõ tên';
        const stationAddress = stat.station_info?.address || 'Không rõ địa chỉ';
        const totalRentals = stat.total_rentals || 0;
        const totalRevenue = stat.total_revenue || 0;
        
        responseMessage += `${index + 1}. **${stationName}**\n`;
        responseMessage += `   - Địa chỉ: ${stationAddress}\n`;
        responseMessage += `   - Số lần thuê: ${totalRentals} lần\n`;
        responseMessage += `   - Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND\n\n`;
      });
      
      responseMessage += `Trạm được thuê nhiều nhất là **${topStation.station_info?.name}** với ${topStation.total_rentals} lần thuê. 🏆`;
      
      return {
        message: responseMessage,
        suggestions: ['Xem thống kê theo tháng', 'Phân tích xu hướng theo địa điểm', 'So sánh hiệu suất các trạm'],
        actions: ['view_station_details', 'export_station_report'],
        context: 'Thống kê trạm dựa trên dữ liệu thực từ database'
      };
    }

    // Handle upcoming bookings queries for Station Staff - CHỈ BOOKING CỦA TRẠM NÀY
    if (intent === 'upcoming_bookings' && context.userRole === 'Station Staff') {
      const upcomingBookings = context.upcomingBookings;
      const recentBookings = context.recentBookings;
      const stationName = context.station?.name || 'trạm này';
      
      if (upcomingBookings?.length > 0) {
        let responseMessage = `📅 **BOOKING SẮP TỚI TẠI ${stationName.toUpperCase()}**\n\n`;
        responseMessage += `⏰ **Có ${upcomingBookings.length} booking sắp tới trong 30 ngày:**\n`;
        
        upcomingBookings.slice(0, 5).forEach((booking, index) => {
          const customerName = booking.user_id?.fullname || 'Không rõ';
          const customerPhone = booking.user_id?.phone || 'Không có SĐT';
          const vehicleName = booking.vehicle_id?.name || 'Không rõ xe';
          const startTime = booking.start_date ? formatVietnamTime(booking.start_date, 'DD/MM/YYYY HH:mm') : 'Không rõ';
          const status = booking.status || 'Không rõ';
          
          responseMessage += `${index + 1}. **${customerName}**\n`;
          responseMessage += `   📞 SĐT: ${customerPhone}\n`;
          responseMessage += `   🚗 Xe: ${vehicleName}\n`;
          responseMessage += `   🕐 Thời gian: ${startTime}\n`;
          responseMessage += `   📋 Status: ${status}\n\n`;
        });
        
        responseMessage += `🎯 **Chuẩn bị cho trạm ${stationName}:**\n`;
        responseMessage += `• Kiểm tra xe sẵn sàng\n`;
        responseMessage += `• Chuẩn bị giấy tờ\n`;
        responseMessage += `• Liên hệ khách nếu cần\n\n`;
        responseMessage += `🔒 **Lưu ý:** Chỉ hiển thị booking của trạm ${stationName}`;
        
        return {
          message: responseMessage,
          suggestions: ['Kiểm tra xe cho booking gần nhất', 'Liên hệ khách hàng sắp đến', 'Chuẩn bị giấy tờ giao xe'],
          actions: ['check_vehicle_readiness', 'prepare_documents', 'contact_customer'],
          context: `${upcomingBookings.length} booking sắp tới tại ${stationName} - nhân viên cần chuẩn bị`
        };
      } else if (recentBookings?.length > 0) {
        let responseMessage = `📅 **BOOKING TẠI ${stationName.toUpperCase()}**\n\n`;
        responseMessage += `⏰ Hiện tại không có booking sắp tới trong 24 giờ tới tại trạm ${stationName}.\n\n`;
        responseMessage += `📋 **Booking gần đây tại trạm này:**\n`;
        
        recentBookings.slice(0, 3).forEach((booking, index) => {
          const customerName = booking.user_id?.fullname || 'Không rõ';
          const vehicleName = booking.vehicle_id?.name || 'Không rõ xe';
          const startTime = booking.start_date ? new Date(booking.start_date).toLocaleString('vi-VN') : 'Không rõ';
          const status = booking.status || 'Không rõ';
          
          responseMessage += `${index + 1}. ${customerName} - ${vehicleName} (${startTime}) - ${status}\n`;
        });
        
        responseMessage += `\n🔒 **Lưu ý:** Chỉ hiển thị booking của trạm ${stationName}`;
        
        return {
          message: responseMessage,
          suggestions: ['Kiểm tra trạng thái tất cả xe', 'Chuẩn bị cho ca tiếp theo', 'Báo cáo tình hình trạm'],
          actions: ['check_all_vehicles', 'prepare_next_shift', 'station_report'],
          context: `Không có booking sắp tới tại ${stationName} - có ${recentBookings.length} booking gần đây`
        };
      } else {
        return {
          message: `📅 **BOOKING TẠI ${stationName.toUpperCase()}**\n\nHiện tại không có booking sắp tới nào trong 30 ngày tại trạm ${stationName}.\n\nTrạm đang ở trạng thái rảnh, bạn có thể:\n• Kiểm tra và bảo trì xe\n• Dọn dẹp khu vực trạm\n• Báo cáo tình hình cho quản lý\n\n🔒 **Lưu ý:** Chỉ kiểm tra booking của trạm ${stationName}`,
          suggestions: ['Kiểm tra xe cần bảo trì', 'Dọn dẹp và sắp xếp trạm', 'Báo cáo ca làm việc'],
          actions: ['maintenance_check', 'station_cleanup', 'shift_report'],
          context: `Không có booking sắp tới tại ${stationName} - trạm rảnh`
        };
      }
    }
    
    if (intent === 'vehicle_stats' && context.vehicleRentalStats?.length > 0) {
      const topVehicles = context.vehicleRentalStats.slice(0, 5);
      const topVehicle = topVehicles[0];
      
      // Tạo response với dữ liệu thật
      let responseMessage = `Dựa trên dữ liệu thống kê thuê xe, đây là top ${topVehicles.length} xe được thuê nhiều nhất:\n\n`;
      
      topVehicles.forEach((stat, index) => {
        const vehicleName = stat.vehicle_info?.name || 'Xe không rõ tên';
        const vehicleBrand = stat.vehicle_info?.brand || 'Không rõ';
        const vehicleModel = stat.vehicle_info?.model || 'Không rõ';
        const totalRentals = stat.total_rentals || 0;
        const totalRevenue = stat.total_revenue || 0;
        
        responseMessage += `${index + 1}. **${vehicleName}** (${vehicleBrand} ${vehicleModel})\n`;
        responseMessage += `   - Số lần thuê: ${totalRentals} lần\n`;
        responseMessage += `   - Doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND\n\n`;
      });
      
      responseMessage += `Xe được thuê nhiều nhất là **${topVehicle.vehicle_info?.name}** với ${topVehicle.total_rentals} lần thuê. 📊`;
      
      return {
        message: responseMessage,
        suggestions: ['Xem thống kê theo tháng', 'Phân tích xu hướng thuê xe', 'So sánh doanh thu theo model'],
        actions: ['view_detailed_stats', 'export_report'],
        context: 'Thống kê dựa trên dữ liệu thực từ database'
      };
    }

    // Handle Station Staff suggestion actions
    if (intent === 'check_vehicle_for_booking' && context.userRole === 'Station Staff') {
      const upcomingBookings = context.upcomingBookings;
      const stationVehicles = context.stationVehicles;
      const stationName = context.station?.name || 'trạm này';
      
      if (upcomingBookings?.length > 0) {
        const nextBooking = upcomingBookings[0]; // Booking gần nhất
        const vehicleName = nextBooking.vehicle_id?.name || 'Không rõ xe';
        const vehiclePlate = nextBooking.vehicle_id?.license_plate || 'Không rõ biển số';
        const customerName = nextBooking.user_id?.fullname || 'Không rõ khách';
        const startTime = nextBooking.start_date ? formatVietnamTime(nextBooking.start_date, 'DD/MM/YYYY HH:mm') : 'Không rõ';
        
        // Tìm xe cần kiểm tra
        const vehicleToCheck = stationVehicles?.find(v => v._id?.toString() === nextBooking.vehicle_id?._id?.toString());
        
        let responseMessage = `🔍 **KIỂM TRA XE CHO BOOKING GẦN NHẤT**\n\n`;
        responseMessage += `📅 **Booking sắp tới:**\n`;
        responseMessage += `• Khách hàng: **${customerName}**\n`;
        responseMessage += `• Thời gian: **${startTime}**\n`;
        responseMessage += `• Xe: **${vehicleName}** (${vehiclePlate})\n\n`;
        
        if (vehicleToCheck) {
          responseMessage += `🚗 **Trạng thái xe hiện tại:**\n`;
          responseMessage += `• Status: **${vehicleToCheck.status}**\n`;
          responseMessage += `• Pin: **${vehicleToCheck.current_battery || 0}%**\n`;
          responseMessage += `• Km đã đi: **${vehicleToCheck.current_mileage || 0} km**\n\n`;
          
          responseMessage += `✅ **Checklist cần làm:**\n`;
          responseMessage += `• Kiểm tra pin ≥ 80%\n`;
          responseMessage += `• Kiểm tra vỏ xe, đèn, gương\n`;
          responseMessage += `• Vệ sinh xe sạch sẽ\n`;
          responseMessage += `• Chuẩn bị giấy tờ giao xe\n`;
          responseMessage += `• Chụp ảnh xe trước khi giao`;
        } else {
          responseMessage += `⚠️ **Lưu ý:** Không tìm thấy xe trong hệ thống trạm`;
        }
        
        return {
          message: responseMessage,
          suggestions: ['Liên hệ khách hàng xác nhận', 'Chuẩn bị giấy tờ giao xe', 'Báo cáo nếu xe có vấn đề'],
          actions: ['contact_customer', 'prepare_documents', 'report_issue'],
          context: `Kiểm tra xe ${vehicleName} cho booking ${customerName} lúc ${startTime}`
        };
      } else {
        return {
          message: `🔍 **KIỂM TRA XE CHO BOOKING**\n\nHiện tại không có booking sắp tới trong 30 ngày tại ${stationName}.\n\nBạn có thể:\n• Kiểm tra tổng trạng thái xe\n• Bảo trì xe định kỳ\n• Chuẩn bị cho ca tiếp theo`,
          suggestions: ['Kiểm tra tất cả xe trong trạm', 'Lập kế hoạch bảo trì', 'Báo cáo ca làm việc'],
          actions: ['check_all_vehicles', 'maintenance_planning', 'shift_report'],
          context: `Không có booking để kiểm tra xe tại ${stationName}`
        };
      }
    }
    
    if (intent === 'contact_upcoming_customer' && context.userRole === 'Station Staff') {
      const upcomingBookings = context.upcomingBookings;
      const stationName = context.station?.name || 'trạm này';
      
      if (upcomingBookings?.length > 0) {
        let responseMessage = `📞 **LIÊN HỆ KHÁCH HÀNG SẮP ĐẾN**\n\n`;
        
        upcomingBookings.slice(0, 3).forEach((booking, index) => {
          const customerName = booking.user_id?.fullname || 'Không rõ';
          const customerPhone = booking.user_id?.phone || 'Không có SĐT';
          const vehicleName = booking.vehicle_id?.name || 'Không rõ xe';
          const startTime = booking.start_date ? formatVietnamTime(booking.start_date, 'DD/MM/YYYY HH:mm') : 'Không rõ';
          
          responseMessage += `${index + 1}. **${customerName}**\n`;
          responseMessage += `   📞 SĐT: ${customerPhone}\n`;
          responseMessage += `   🕐 Thời gian: ${startTime}\n`;
          responseMessage += `   🚗 Xe: ${vehicleName}\n\n`;
        });
        
        responseMessage += `💬 **Nội dung liên hệ gợi ý:**\n`;
        responseMessage += `• Xác nhận thời gian nhận xe\n`;
        responseMessage += `• Nhắc nhở mang giấy tờ tùy thân\n`;
        responseMessage += `• Thông báo địa chỉ trạm chính xác\n`;
        responseMessage += `• Hướng dẫn quy trình giao xe`;
        
        return {
          message: responseMessage,
          suggestions: ['Kiểm tra xe cho khách đầu tiên', 'Chuẩn bị giấy tờ giao xe', 'Xem chi tiết booking'],
          actions: ['check_first_vehicle', 'prepare_documents', 'view_booking_details'],
          context: `Thông tin liên hệ ${upcomingBookings.length} khách hàng sắp đến ${stationName}`
        };
      } else {
        return {
          message: `📞 **LIÊN HỆ KHÁCH HÀNG**\n\nHiện tại không có khách hàng nào sắp đến ${stationName}.\n\nBạn có thể thực hiện các công việc khác tại trạm.`,
          suggestions: ['Kiểm tra xe trong trạm', 'Dọn dẹp trạm', 'Báo cáo ca làm việc'],
          actions: ['check_vehicles', 'cleanup_station', 'shift_report'],
          context: `Không có khách hàng sắp đến ${stationName}`
        };
      }
    }
    
    if (intent === 'prepare_handover_documents' && context.userRole === 'Station Staff') {
      const stationName = context.station?.name || 'trạm này';
      
      return {
        message: `📋 **CHUẨN BỊ GIẤY TỜ GIAO XE**\n\n✅ **Checklist giấy tờ cần thiết:**\n\n📄 **Cho mỗi giao dịch:**\n• Hợp đồng thuê xe (2 bản)\n• Biên bản bàn giao xe (2 bản)\n• Phiếu thu tiền cọc/thanh toán\n• Bảng kiểm tra tình trạng xe\n\n🆔 **Kiểm tra giấy tờ khách:**\n• CCCD/CMND (bản gốc + photocopy)\n• Giấy phép lái xe (nếu yêu cầu)\n• Xác minh thông tin booking\n\n📸 **Hồ sơ ảnh:**\n• Chụp ảnh xe trước khi giao\n• Chụp ảnh giấy tờ khách hàng\n• Chụp ảnh hợp đồng đã ký\n\n🔒 **Lưu ý bảo mật:**\n• Chỉ xử lý giấy tờ tại ${stationName}\n• Bảo mật thông tin khách hàng\n• Lưu trữ hồ sơ theo quy định`,
        suggestions: ['Kiểm tra xe trước khi giao', 'Liên hệ khách xác nhận giấy tờ', 'Xem quy trình giao xe chi tiết'],
        actions: ['check_vehicle_condition', 'verify_customer_documents', 'view_handover_process'],
        context: `Hướng dẫn chuẩn bị giấy tờ giao xe tại ${stationName}`
      };
    }
    
    if (intent === 'maintenance_check' && context.userRole === 'Station Staff') {
      const stationVehicles = context.stationVehicles;
      const stationName = context.station?.name || 'trạm này';
      
      if (stationVehicles?.length > 0) {
        const maintenanceVehicles = stationVehicles.filter(v => v.status === 'maintenance');
        const lowBatteryVehicles = stationVehicles.filter(v => (v.current_battery || 0) < 50);
        const availableVehicles = stationVehicles.filter(v => v.status === 'available');
        
        let responseMessage = `🔧 **KIỂM TRA BẢO TRÌ XE TẠI ${stationName.toUpperCase()}**\n\n`;
        
        if (maintenanceVehicles.length > 0) {
          responseMessage += `⚠️ **Xe đang bảo trì (${maintenanceVehicles.length} xe):**\n`;
           maintenanceVehicles.forEach(vehicle => {
            const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
            responseMessage += `• ${vehicleDisplay} (${vehicle.license_plate}) - Pin: ${vehicle.current_battery || 0}%\n`;
          });
          responseMessage += '\n';
        }
        
        if (lowBatteryVehicles.length > 0) {
          responseMessage += `🔋 **Xe pin yếu cần sạc (${lowBatteryVehicles.length} xe):**\n`;
          lowBatteryVehicles.forEach(vehicle => {
            const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
            responseMessage += `• ${vehicleDisplay} (${vehicle.license_plate}) - Pin: ${vehicle.current_battery || 0}%\n`;
          });
          responseMessage += '\n';
        }
        
        responseMessage += `✅ **Xe sẵn sàng (${availableVehicles.length} xe):**\n`;
        availableVehicles.slice(0, 3).forEach(vehicle => {
          const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
          responseMessage += `• ${vehicleDisplay} (${vehicle.license_plate}) - Pin: ${vehicle.battery_level || vehicle.current_battery || 0}%\n`;
        });
        
        responseMessage += `\n🔧 **Nhiệm vụ bảo trì:**\n`;
        responseMessage += `• Sạc đầy pin cho xe pin yếu\n`;
        responseMessage += `• Kiểm tra và báo cáo xe maintenance\n`;
        responseMessage += `• Vệ sinh xe định kỳ\n`;
        responseMessage += `• Cập nhật trạng thái xe khi cần`;
        
        return {
          message: responseMessage,
          suggestions: ['Sạc pin cho xe yếu', 'Báo cáo xe cần sửa chữa', 'Vệ sinh xe available'],
          actions: ['charge_low_battery', 'report_maintenance_needed', 'clean_vehicles'],
          context: `Tình trạng bảo trì ${stationVehicles.length} xe tại ${stationName}`
        };
      } else {
        return {
          message: `🔧 **KIỂM TRA BẢO TRÌ XE**\n\nKhông có thông tin xe tại ${stationName} để kiểm tra bảo trì.\n\nVui lòng liên hệ quản lý để cập nhật thông tin xe.`,
          suggestions: ['Liên hệ quản lý trạm', 'Báo cáo tình trạng trạm', 'Kiểm tra kết nối hệ thống'],
          actions: ['contact_manager', 'report_station_status', 'check_system'],
          context: `Không có thông tin xe để bảo trì tại ${stationName}`
        };
      }
    }
    
    // Handle payment methods queries
    if (intent === 'payment_methods') {
      let responseMessage = `💳 **PHƯƠNG THỨC THANH TOÁN**\n\n`;
      
      // Thông tin thanh toán cho Staff
      if (context.userRole === 'Station Staff') {
        responseMessage += `📋 **Hướng dẫn thu tiền cho nhân viên trạm:**\n\n`;
        responseMessage += `💵 **1. THANH TOÁN TIỀN MẶT:**\n`;
        responseMessage += `• Nhận tiền mặt từ khách hàng\n`;
        responseMessage += `• Kiểm tra kỹ số tiền (đếm lại)\n`;
        responseMessage += `• Cập nhật trạng thái "Đã thanh toán" trong hệ thống\n`;
        responseMessage += `• Đưa biên lai thanh toán cho khách\n\n`;
        
        responseMessage += `📱 **2. THANH TOÁN VNPAY (QR CODE):**\n`;
        responseMessage += `• Tạo mã QR từ hệ thống booking\n`;
        responseMessage += `• Khách hàng quét mã QR bằng app ngân hàng\n`;
        responseMessage += `• Chờ xác nhận thanh toán (1-2 phút)\n`;
        responseMessage += `• Hệ thống tự động cập nhật trạng thái\n`;
        responseMessage += `• In biên lai điện tử cho khách\n\n`;
        
        responseMessage += `⏰ **Lưu ý thời gian thanh toán:**\n`;
        responseMessage += `• Booking < 3 ngày: Thanh toán ngay khi nhận xe\n`;
        responseMessage += `• Booking ≥ 3 ngày: Thu cọc trước, thanh toán full khi nhận xe\n\n`;
        
        responseMessage += `❗ **Quan trọng:**\n`;
        responseMessage += `• Luôn kiểm tra trạng thái thanh toán trước giao xe\n`;
        responseMessage += `• Không giao xe khi chưa thanh toán đủ\n`;
        responseMessage += `• Liên hệ quản lý nếu có vấn đề thanh toán`;
        
        return {
          message: responseMessage,
          suggestions: ['Tạo mã QR thanh toán', 'Kiểm tra thanh toán', 'Xem booking cần thu tiền'],
          actions: ['create_payment_qr', 'check_payment_status', 'view_pending_payments'],
          context: 'Hướng dẫn thanh toán cho Station Staff'
        };
      } else {
        // Thông tin thanh toán cho khách hàng
        responseMessage += `💰 **Các phương thức thanh toán được hỗ trợ:**\n\n`;
        responseMessage += `💵 **Tiền mặt:**\n`;
        responseMessage += `• Thanh toán trực tiếp tại trạm\n`;
        responseMessage += `• Nhận biên lai ngay lập tức\n\n`;
        
        responseMessage += `📱 **VNPay (QR Code):**\n`;
        responseMessage += `• Quét mã QR bằng app ngân hàng\n`;
        responseMessage += `• Thanh toán nhanh chóng, an toàn\n`;
        responseMessage += `• Tự động xác nhận thanh toán\n\n`;
        
        responseMessage += `⏰ **Thời điểm thanh toán:**\n`;
        responseMessage += `• Booking gần (< 3 ngày): Thanh toán khi nhận xe\n`;
        responseMessage += `• Booking xa (≥ 3 ngày): Đặt cọc trước, thanh toán full khi nhận xe`;
        
        return {
          message: responseMessage,
          suggestions: ['Xem cách đặt cọc', 'Hướng dẫn thanh toán VNPay'],
          actions: ['view_deposit_guide', 'vnpay_tutorial'],
          context: 'Thông tin thanh toán cho khách hàng'
        };
      }
    }
    
    // Handle rental history queries for Station Staff
    if (intent === 'rental_history' && context.userRole === 'Station Staff') {
      const completedRentals = context.completedRentals;
      const stationName = context.station?.name || 'trạm này';
      
      if (completedRentals && completedRentals.length > 0) {
        let responseMessage = `📚 **LỊCH SỬ THUÊ XE TẠI ${stationName.toUpperCase()}**\n\n`;
        
        responseMessage += `📊 **Tổng quan:**\n`;
        responseMessage += `• Tổng số rental đã hoàn thành: **${completedRentals.length}** lượt\n`;
        
        // Thống kê theo khách hàng
        const customerStats = {};
        completedRentals.forEach(rental => {
          const customerName = rental.user_id?.fullname || 'Unknown';
          if (!customerStats[customerName]) {
            customerStats[customerName] = 0;
          }
          customerStats[customerName]++;
        });
        
        const topCustomers = Object.entries(customerStats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        
        if (topCustomers.length > 0) {
          responseMessage += `\n👥 **Top khách hàng thường xuyên:**\n`;
          topCustomers.forEach(([name, count], index) => {
            responseMessage += `${index + 1}. ${name}: ${count} lượt thuê\n`;
          });
        }
        
        responseMessage += `\n📋 **Rental gần đây nhất:**\n`;
        completedRentals.slice(0, 5).forEach((rental, index) => {
          const customerName = rental.user_id?.fullname || 'Unknown';
          const vehicleName = rental.vehicle_id?.name || 'Unknown';
          const endTime = rental.actual_end_time ? 
            formatVietnamTime(new Date(rental.actual_end_time), 'DD/MM HH:mm') : 'N/A';
          const totalPrice = rental.booking_id?.total_price || 0;
          
          responseMessage += `${index + 1}. **${customerName}** - ${vehicleName}\n`;
          responseMessage += `   • Kết thúc: ${endTime}\n`;
          responseMessage += `   • Giá trị: ${totalPrice.toLocaleString('vi-VN')} VNĐ\n`;
          responseMessage += `   • Phone: ${rental.user_id?.phone || 'N/A'}\n\n`;
        });
        
        return {
          message: responseMessage,
          suggestions: ['Xem chi tiết rental cụ thể', 'Thống kê doanh thu', 'Liên hệ khách hàng cũ'],
          actions: ['view_rental_details', 'revenue_analysis', 'contact_previous_customer'],
          context: `Lịch sử ${completedRentals.length} rental tại ${stationName}`
        };
      } else {
        return {
          message: `📚 **LỊCH SỬ THUÊ XE TẠI ${stationName.toUpperCase()}**\n\nChưa có rental nào được hoàn thành tại ${stationName}.\n\nCó thể do:\n• Trạm mới hoạt động\n• Chưa có khách hàng hoàn thành thuê xe\n• Dữ liệu chưa được cập nhật`,
          suggestions: ['Kiểm tra rental đang diễn ra', 'Xem booking sắp tới', 'Báo cáo tình trạng trạm'],
          actions: ['check_active_rentals', 'view_upcoming_bookings', 'station_report'],
          context: `Không có lịch sử rental tại ${stationName}`
        };
      }
    }
    
    // Handle contract queries
    if (intent === 'contract') {
      let responseMessage = `📋 **HỢP ĐỒNG THUÊ XE ĐIỆN**\n\n`;
      
      // Thông tin hợp đồng cho Staff
      if (context.userRole === 'Station Staff') {
        responseMessage += `👨‍💼 **Quy trình hợp đồng cho nhân viên trạm:**\n\n`;
        responseMessage += `📝 **1. CHUẨN BỊ HỢP ĐỒNG:**\n`;
        responseMessage += `• Kiểm tra thông tin KYC khách hàng\n`;
        responseMessage += `• In hợp đồng từ template có sẵn\n`;
        responseMessage += `• Điền thông tin: xe, thời gian, giá cả\n`;
        responseMessage += `• Chuẩn bị biên bản bàn giao xe\n\n`;
        
        responseMessage += `✍️ **2. KÝ HỢP ĐỒNG:**\n`;
        responseMessage += `• Yêu cầu khách xuất trình CCCD gốc\n`;
        responseMessage += `• Đối chiếu CCCD với thông tin đăng ký\n`;
        responseMessage += `• Hướng dẫn khách đọc điều khoản\n`;
        responseMessage += `• Ký tên và đóng dấu nhận\n`;
        responseMessage += `• Chụp ảnh CCCD + hợp đồng đã ký\n\n`;
        
        responseMessage += `📸 **3. LƯU TRỮ TÀI LIỆU:**\n`;
        responseMessage += `• Chụp ảnh hợp đồng đã ký\n`;
        responseMessage += `• Upload lên hệ thống booking\n`;
        responseMessage += `• Lưu bản cứng tại trạm (nếu có)\n`;
        responseMessage += `• Gửi bản scan cho khách (nếu yêu cầu)\n\n`;
        
        responseMessage += `⚠️ **Lưu ý quan trọng:**\n`;
        responseMessage += `• Không giao xe nếu chưa ký hợp đồng\n`;
        responseMessage += `• Kiểm tra kỹ thông tin trước khi ký\n`;
        responseMessage += `• Báo quản lý nếu có vấn đề pháp lý`;
        
        return {
          message: responseMessage,
          suggestions: ['Xem mẫu hợp đồng', 'Kiểm tra KYC khách hàng', 'Upload tài liệu hợp đồng'],
          actions: ['view_contract_template', 'check_customer_kyc', 'upload_contract_docs'],
          context: 'Hướng dẫn hợp đồng cho Station Staff'
        };
      } else {
        // Thông tin hợp đồng cho khách hàng
        responseMessage += `📄 **Thông tin về hợp đồng thuê xe:**\n\n`;
        responseMessage += `✅ **Điều kiện ký hợp đồng:**\n`;
        responseMessage += `• Hoàn thành xác thực KYC\n`;
        responseMessage += `• Mang theo CCCD/GPLX gốc\n`;
        responseMessage += `• Thanh toán đặt cọc (nếu có)\n\n`;
        
        responseMessage += `📋 **Nội dung hợp đồng:**\n`;
        responseMessage += `• Thông tin xe thuê và thời gian\n`;
        responseMessage += `• Giá thuê và phí phát sinh\n`;
        responseMessage += `• Trách nhiệm bên thuê và cho thuê\n`;
        responseMessage += `• Điều khoản bồi thường hư hỏng\n`;
        responseMessage += `• Quy định về trả xe trễ\n\n`;
        
        responseMessage += `⏰ **Thời điểm ký:**\n`;
        responseMessage += `• Khi nhận xe tại trạm\n`;
        responseMessage += `• Trước khi giao xe cho khách\n\n`;
        
        responseMessage += `💡 **Lưu ý:**\n`;
        responseMessage += `• Đọc kỹ điều khoản trước khi ký\n`;
        responseMessage += `• Yêu cầu bản sao hợp đồng\n`;
        responseMessage += `• Liên hệ support nếu có thắc mắc`;
        
        return {
          message: responseMessage,
          suggestions: ['Xem điều khoản chi tiết', 'Hướng dẫn KYC', 'Chính sách bồi thường'],
          actions: ['view_terms_conditions', 'kyc_guide', 'compensation_policy'],
          context: 'Thông tin hợp đồng cho khách hàng'
        };
      }
    }
    
    if (intent === 'vehicle_info' && context.allVehicles?.length > 0) {
      const vehicleModels = [...new Set(context.allVehicles.map(v => `${v.brand} ${v.model}`))];
      const totalVehicles = context.allVehicles.length;
      
      let responseMessage = `Hệ thống hiện có ${totalVehicles} xe máy điện với các model sau:\n\n`;
      
      vehicleModels.slice(0, 10).forEach((model, index) => {
        const count = context.allVehicles.filter(v => `${v.brand} ${v.model}` === model).length;
        responseMessage += `${index + 1}. ${model}: ${count} xe\n`;
      });
      
      return {
        message: responseMessage,
        suggestions: ['Xem chi tiết từng model', 'Thống kê trạng thái xe', 'Phân tích hiệu suất'],
        actions: ['view_vehicle_details', 'filter_by_model'],
        context: 'Danh sách model xe từ database'
      };
    }
    
    // Handle Station Staff vehicle status queries - CHỈ XE CỦA TRẠM NÀY
    if (intent === 'vehicle_status' && context.stationVehicles?.length > 0) {
      const stationVehicles = context.stationVehicles;
      const stationName = context.station?.name || 'trạm này';
      const availableVehicles = stationVehicles.filter(v => v.status === 'available');
      const rentedVehicles = stationVehicles.filter(v => v.status === 'rented');
      const maintenanceVehicles = stationVehicles.filter(v => v.status === 'maintenance');
      const reservedVehicles = stationVehicles.filter(v => v.status === 'reserved');
      
      let responseMessage = `📊 **THỐNG KÊ XE TẠI ${stationName.toUpperCase()}**\n\n`;
      responseMessage += `🏢 **Tổng quan trạm:**\n`;
      responseMessage += `• Tổng xe: **${stationVehicles.length}** chiếc\n`;
      responseMessage += `• ✅ Available: **${availableVehicles.length}** xe\n`;
      responseMessage += `• 🚗 Đang thuê: **${rentedVehicles.length}** xe\n`;
      responseMessage += `• 🔧 Bảo trì: **${maintenanceVehicles.length}** xe\n`;
      responseMessage += `• 📋 Đã đặt: **${reservedVehicles.length}** xe\n\n`;
      
      if (availableVehicles.length > 0) {
        responseMessage += `✅ **Xe sẵn sàng cho thuê tại ${stationName}:**\n`;
        availableVehicles.slice(0, 5).forEach(vehicle => {
          const vehicleDisplay = `${vehicle.brand || 'N/A'} ${vehicle.model || 'N/A'} màu ${vehicle.color || 'N/A'}`;
          responseMessage += `• ${vehicleDisplay} (${vehicle.license_plate}) - Pin: ${vehicle.battery_level || vehicle.current_battery || 0}%\n`;
        });
      }
      
      responseMessage += `\n🔒 **Lưu ý:** Chỉ hiển thị xe thuộc trạm ${stationName}`;
      
      return {
        message: responseMessage,
        suggestions: ['Giao xe cho khách', 'Kiểm tra pin xe', 'Cập nhật trạng thái xe'],
        actions: ['handover_vehicle', 'check_battery', 'update_status'],
        context: `Thống kê xe tại ${stationName} dựa trên dữ liệu thực tế`
      };
    }
    
    return {
      message: 'Tôi cần thêm thông tin để trả lời chính xác. Bạn có thể cụ thể hơn không?',
      suggestions: ['Xem thống kê tổng quan', 'Phân tích doanh thu', 'Quản lý xe và trạm'],
      actions: [],
      context: ''
    };
  }

  // Xử lý response từ AI
  async processResponse(aiResponse, userRole, userId, originalMessage) {
    try {
      // Parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // QUAN TRỌNG: Thêm originalMessage vào parsed object để validation sử dụng
        parsed.originalMessage = originalMessage;
        
        // Get context and intent for validation
        const intent = this.detectIntent(originalMessage);
        const context = await this.getUserContext(userRole, userId, intent);
        

        
        // Validate cho Admin và Staff response
        if (userRole === 'Admin' || userRole === 'Station Staff') {
          if (!this.validateAdminResponse(parsed, context)) {
            // Tạo response thay thế với dữ liệu thật
            return this.generateDataDrivenResponse(originalMessage, context);
          }
        }
        
        // THÊM: Sử dụng data-driven response cho EV Renter khi search xe theo màu
        if (userRole === 'EV Renter' && intent === 'vehicle_color_search') {
          return this.generateDataDrivenResponse(originalMessage, context);
        }
        
        // Phân tích sentiment
        const sentiment = this.analyzeSentiment(originalMessage);
        
        // Tạo suggestions dựa trên intent nếu không có
        let suggestions = parsed.suggestions || [];
        if (suggestions.length === 0) {
          suggestions = await this.generateSuggestionsByIntent(intent, userRole, originalMessage);
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
    
    
    // Pattern cho confirm booking (phải check TRƯỚC các pattern khác)
    if (messageText.match(/^(?:xác nhận|confirm|đồng ý|ok|yes)(?:\s+(?:đặt\s+xe|booking))?$/i)) {
      return 'confirm_booking';
    }
    
 
    
    // Pattern 1: Có dates cụ thể → Booking
    // Ví dụ: "Tôi muốn thuê xe Klara từ 20-22/11", "Đặt xe từ ngày 20/11"
    if (messageText.match(/(?:thuê|đặt|book).*xe.*(?:từ|ngày|đến|tới|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})/i)) {
      return 'booking_request';
    }
    
    // Pattern 2: Có location + dates
    // Ví dụ: "Thuê xe ở quận 1 từ 20/11"
    if (messageText.match(/(?:thuê|đặt|book).*xe.*(?:ở|tại|quận|district).*(?:từ|ngày|\d{1,2}\/\d{1,2})/i)) {
      return 'booking_request';
    }
    
    // Pattern 3: Có "nhận xe lúc" (pickup time)
    // Ví dụ: "Thuê xe Klara nhận xe lúc 10h"
    if (messageText.match(/(?:thuê|đặt|book).*xe.*(?:nhận xe|pickup|lúc \d+h)/i)) {
      return 'booking_request';
    }
    
    // ⚠️ KHÔNG match "Tôi muốn thuê xe Klara" (không có dates) → để AI tư vấn
    
    // Thêm pattern cho staff operations
    if (messageText.match(/giao xe|bàn giao|check in|nhận xe từ khách/i)) return 'vehicle_handover';
    // ⚠️ "nhận xe" trong context booking phải check sau booking_request
    // Chỉ match "trả xe" hoặc "nhận xe" từ staff (không có context thuê/đặt)
    if (messageText.match(/trả xe|check out|hoàn thành|thu xe/i)) return 'vehicle_return';
    if (messageText.match(/tính phí|phí phát sinh|tính tiền|damage|hư hỏng|phạt/i)) return 'penalty_calculation';
    if (messageText.match(/xe nào|trạng thái xe|xe available|xe sẵn sàng|có mấy xe|xe trong trạm|tổng.*xe|vehicle.*status|how many.*vehicle|xe.*count/i)) return 'vehicle_status';
    if (messageText.match(/booking.*sắp|khách.*sắp|lịch.*hôm nay|booking.*tới|khách.*tới|có.*booking|booking.*nào|lịch hẹn|khách hàng.*đến|có ai.*đặt|ai.*book|khách.*book|lịch.*book|booking.*trạm|schedule.*today|upcoming.*booking/i)) return 'upcoming_bookings';
    if (messageText.match(/báo cáo|thống kê trạm|doanh thu trạm/i)) return 'station_report';
    
    // Thêm pattern cho suggestion actions
    if (messageText.match(/kiểm tra xe.*booking|kiểm tra xe.*gần nhất|check.*vehicle.*booking/i)) return 'check_vehicle_for_booking';
    if (messageText.match(/liên hệ.*khách.*sắp|gọi.*khách.*hàng|contact.*customer/i)) return 'contact_upcoming_customer';
    if (messageText.match(/chuẩn bị.*giấy tờ|prepare.*document|chuẩn bị.*giao xe/i)) return 'prepare_handover_documents';
    if (messageText.match(/kiểm tra.*tất cả.*xe|check.*all.*vehicle|kiểm tra.*trạng thái.*xe/i)) return 'vehicle_status';
    if (messageText.match(/báo cáo.*ca|shift.*report|báo cáo.*tình hình|station.*report/i)) return 'station_report';
    if (messageText.match(/bảo trì|maintenance|sửa chữa|repair/i)) return 'maintenance_check';
    
    // Thêm pattern cho payment methods
    if (messageText.match(/thanh toán|payment|tiền mặt|cash|vnpay|qr.*code|mã.*qr|phương thức.*thanh toán|cách.*trả tiền/i)) return 'payment_methods';
    
    // Thêm pattern cho rental history (ưu tiên cao hơn location)
    if (messageText.match(/xem.*rental|rental.*gần|lịch sử.*thuê|rental.*history|thuê.*trước|đã.*thuê|completed.*rental|xe.*đã.*trả|rental.*cũ|khách.*cũ|rental.*hoàn thành/i)) return 'rental_history';
    
    // Thêm pattern cho penalty/fine statistics
    if (messageText.match(/phí phạt|phạt|fine|penalty|bị phạt|vi phạm|late fee|damage fee|phí trễ|phí hỏng|có ai.*phạt/i)) return 'penalty_stats';
    
    // Thêm pattern cụ thể cho ai bị phạt (user penalty details)
    if (messageText.match(/ai.*bị.*phạt|người.*phạt|danh sách.*phạt|khách hàng.*phạt|user.*penalty|who.*fined/i)) return 'penalty_users';
    
    // Thêm pattern cho station statistics
    if (messageText.match(/trạm.*nhiều nhất|trạm.*phổ biến|trạm.*được thuê|thống kê trạm|trạm nào|top trạm/i)) return 'station_stats';
    if (messageText.match(/doanh thu.*trạm|trạm.*doanh thu|revenue.*station/i)) return 'station_revenue';
    
    // Thêm pattern cho vehicle statistics
    if (messageText.match(/xe.*nhiều nhất|xe.*phổ biến|xe.*được thuê|thống kê xe|xe nào|top xe|xe được yêu thích/i)) return 'vehicle_stats';
    if (messageText.match(/doanh thu.*xe|xe.*doanh thu|revenue.*vehicle|xe kiếm được/i)) return 'vehicle_revenue';
    if (messageText.match(/thống kê|báo cáo|report|analytics|phân tích/i)) return 'analytics';
    
    // 🆕 CANCELLATION - CHECK TRƯỚC BOOKING (vì "hủy booking" có cả 2 từ)
    // Support cả 2 dấu: hủy (dấu hỏi) và huỷ (dấu nặng)
    if (messageText.match(/hủy|huỷ|cancel/i)) return 'cancellation';
    
    // Pattern chung cho booking (fallback)
    if (messageText.match(/thuê|đặt|book|reservation|đăng ký|booking/i)) return 'booking';
    if (messageText.match(/giá|phí|cost|price|cọc|thanh toán|payment/i)) return 'pricing';
    if (messageText.match(/trạm|địa điểm|station|location|ở đâu|gần đây/i)) return 'location';
    if (messageText.match(/hỏi|giúp|help|support|hướng dẫn|hỗ trợ/i)) return 'help';
    if (messageText.match(/xe.*màu|màu.*xe|color.*vehicle|vehicle.*color|xe.*đỏ|xe.*trắng|xe.*xanh|xe.*đen|xe.*vàng|xe.*hồng|có.*màu|màu.*nào|màu.*gì|màu.*không|màu.*ko/i)) {
      return 'vehicle_color_search';
    }
    
    // Smart Conversational Booking Detection

    

    
    if (messageText.match(/xe|vehicle|model|loại xe|xe điện|xe máy điện/i)) return 'vehicle_info';
    if (messageText.match(/pin|battery|sạc|charge|dung lượng/i)) return 'battery';
    if (messageText.match(/hợp đồng|contract|ký|sign|điều khoản/i)) return 'contract';
    if (messageText.match(/kyc|xác thực|verify|giấy tờ|cmnd|cccd|gplx/i)) return 'kyc';
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
  async generateSuggestionsByIntent(intent, userRole, message = '') {
    const suggestions = [];
    const messageText = message.toLowerCase();
    
    // 🆕 SMART SUGGESTIONS - Context-aware cho EV Renter
    if (userRole === 'EV Renter') {
      // Extract vehicle model từ message (lấy từ DB)
      let mentionedModel = null;
      try {
        // Lấy tất cả models từ DB
        const vehicles = await Vehicle.find({ is_active: true }).distinct('model');
        
        for (const model of vehicles) {
          if (messageText.includes(model.toLowerCase())) {
            mentionedModel = model;
            break;
          }
        }
      } catch (error) {
        console.error('Error fetching vehicle models:', error);
      }
      
      // Extract location từ message (lấy từ DB)
      let mentionedLocation = null;
      try {
        // Lấy tất cả stations từ DB
        const stations = await Station.find({ status: 'active' });
        
        for (const station of stations) {
          const stationName = station.name.toLowerCase();
          const address = station.address?.toLowerCase() || '';
          
          // Check nếu message có tên trạm hoặc địa chỉ
          if (messageText.includes(stationName) || 
              (address && messageText.includes(address))) {
            mentionedLocation = station.name;
            break;
          }
          
          // Check các pattern địa chỉ phổ biến
          const addressPatterns = ['quận 1', 'quận 2', 'quận 3', 'quận 7', 'thủ đức'];
          for (const pattern of addressPatterns) {
            if (address.includes(pattern) && messageText.includes(pattern)) {
              mentionedLocation = pattern;
              break;
            }
          }
          if (mentionedLocation) break;
        }
      } catch (error) {
        console.error('Error fetching stations:', error);
      }
      
      // 1. User hỏi về xe cụ thể → Suggest đặt xe đó
      if (mentionedModel && intent === 'vehicle_info') {
        return [
          `Đặt xe ${mentionedModel}`,
          `Xem trạm có xe ${mentionedModel}`,
          'Xem xe khác'
        ];
      }
      
      // 2. User hỏi về trạm/location → Suggest đặt xe tại đó
      if ((mentionedLocation || intent === 'location') && !mentionedModel) {
        return [
          mentionedLocation ? `Xem xe tại ${mentionedLocation}` : 'Xem xe có sẵn',
          'Tìm trạm gần nhất',
          'Xem tất cả trạm'
        ];
      }
      
      // 3. User hỏi về giá → Suggest xem xe và đặt
      if (intent === 'pricing') {
        return [
          'Xem xe có sẵn',
          'Đặt xe ngay',
          'Xem chính sách đặt cọc'
        ];
      }
      
      // 4. User vừa hỏi về xe và location → Suggest đặt booking
      if (mentionedModel && mentionedLocation) {
        return [
          `Đặt xe ${mentionedModel} tại ${mentionedLocation}`,
          'Xem giá thuê',
          'Xem xe khác'
        ];
      }
    }
    
    // Gợi ý chung cho tất cả role (fallback)
    const commonSuggestions = {
      'booking': ['Đặt xe ngay', 'Xem xe có sẵn', 'Tìm trạm gần nhất'],
      'pricing': ['Xem bảng giá', 'Chính sách đặt cọc', 'Chi phí phát sinh'],
      'location': ['Tìm trạm gần nhất', 'Xem bản đồ trạm', 'Hướng dẫn đường đi'],
      'help': ['Hướng dẫn sử dụng', 'Liên hệ hỗ trợ', 'Câu hỏi thường gặp'],
      'vehicle_info': ['Xem xe có sẵn', 'So sánh các loại xe', 'Đặt xe ngay'],
      'battery': ['Thời gian sạc pin', 'Phạm vi di chuyển', 'Trạm sạc gần đây'],
      'contract': ['Điều khoản hợp đồng', 'Quy trình ký hợp đồng', 'Trách nhiệm các bên'],
      'rental_history': ['Xem rental gần đây', 'Thống kê khách hàng', 'Phân tích doanh thu'],
      'kyc': ['Hướng dẫn xác thực', 'Giấy tờ cần thiết', 'Thời gian xác thực'],
      'cancellation': ['Xem booking của tôi', 'Chính sách hủy', 'Liên hệ hỗ trợ'],
      'return': ['Quy trình trả xe', 'Kiểm tra xe', 'Hoàn tất thuê xe'],
      'issue': ['Báo cáo sự cố', 'Liên hệ hỗ trợ khẩn cấp', 'Xử lý vấn đề thường gặp'],
      'gratitude': ['Đánh giá dịch vụ', 'Thuê xe lần tiếp theo', 'Khuyến mãi mới'],
      'greeting': ['Xem xe có sẵn', 'Tìm trạm gần nhất', 'Hướng dẫn thuê xe'],
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

      // Tính doanh thu năm hiện tại
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);

      const [monthlyRevenue, yearlyRevenue] = await Promise.all([
        Payment.aggregate([
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
        ]),
        Payment.aggregate([
          {
            $match: {
              status: 'completed',
              createdAt: { $gte: startOfYear, $lte: endOfYear }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$amount' }
            }
          }
        ])
      ]);

      return {
        totalStations,
        totalVehicles,
        availableVehicles,
        rentedVehicles,
        monthlyRevenue: monthlyRevenue[0]?.total || 0,
        yearlyRevenue: yearlyRevenue[0]?.total || 0
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        totalStations: 0,
        totalVehicles: 0,
        availableVehicles: 0,
        rentedVehicles: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0
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
