const { GoogleGenerativeAI } = require('@google/generative-ai');
const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Station = require('../models/Station');
const Vehicle = require('../models/Vehicle');
const Payment = require('../models/Payment');
const { formatVietnamTime } = require('../config/timezone');
const ExternalAPIs = require('../config/externalAPIs');

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  // Thu thập dữ liệu lịch sử booking và rental - FIXED
  async getHistoricalData(period = '30d', stationId = null) {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    //  Lấy TẤT CẢ bookings (vì booking status thay đổi sang 'completed' khi rental hoàn thành)
    const bookingMatchQuery = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['confirmed', 'completed'] } 
    };

    if (stationId) {
      // Convert string to ObjectId
      const mongoose = require('mongoose');
      bookingMatchQuery.station_id = new mongoose.Types.ObjectId(stationId);
    }

    // Lấy dữ liệu booking theo giờ - FIXED
    const hourlyBookingData = await Booking.aggregate([
      { $match: bookingMatchQuery },
      {
        $lookup: {
          from: 'rentals',
          let: { bookingId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$booking_id', '$$bookingId'] },
                status: { $in: ['completed', 'pending_payment'] }  
              }
            }
          ],
          as: 'rentals'
        }
      },
      {
        $addFields: {
          // Parse pickup_time để lấy giờ user muốn nhận xe
          pickup_hour: {
            $toInt: {
              $arrayElemAt: [
                { $split: ['$pickup_time', ':'] },
                0
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            hour: '$pickup_hour', // Dùng pickup_hour thay vì createdAt
            dayOfWeek: { $dayOfWeek: '$start_date' }, // Dùng start_date thay vì createdAt
            station: '$station_id'
          },
          bookingsCount: { $sum: 1 },
          completedRentals: { $sum: { $size: '$rentals' } },
          totalBookingRevenue: { $sum: '$total_price' }
        }
      },
      { $sort: { '_id.hour': 1, '_id.dayOfWeek': 1 } }
    ]);

    // Lấy dữ liệu booking theo ngày - FIXED
    const dailyBookingData = await Booking.aggregate([
      { $match: bookingMatchQuery },
      {
        $lookup: {
          from: 'rentals',
          let: { bookingId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$booking_id', '$$bookingId'] },
                status: { $in: ['completed', 'pending_payment'] }  
              }
            }
          ],
          as: 'rentals'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$start_date' } }, // Dùng start_date thay vì createdAt
            station: '$station_id'
          },
          bookingsCount: { $sum: 1 },
          completedRentals: { $sum: { $size: '$rentals' } },
          totalBookingRevenue: { $sum: '$total_price' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // FIX: Thêm Rental data để có actual revenue
    const rentalMatchQuery = {
      actual_start_time: { $gte: startDate, $lte: endDate },
      status: { $in: ['completed', 'pending_payment'] }
    };

    if (stationId) {
      // Convert string to ObjectId
      const mongoose = require('mongoose');
      rentalMatchQuery.station_id = new mongoose.Types.ObjectId(stationId);
    }

    // Lấy actual rental data với payments (BAO GỒM holding_fee forfeited, KHÔNG BAO GỒM refund)
    const actualRentalData = await Rental.aggregate([
      { $match: rentalMatchQuery },
      {
        $lookup: {
          from: 'payments',
          let: { rentalId: '$_id', bookingId: '$booking_id' },
          pipeline: [
            { $match: { 
              $expr: { 
                $or: [
                  { $eq: ['$rental_id', '$$rentalId'] },
                  { $eq: ['$booking_id', '$$bookingId'] }
                ]
              },
              status: 'completed',
              is_active: true
            }}
          ],
          as: 'payments'
        }
      },
      {
        $addFields: {
          // Tính tổng doanh thu từ payments đã filter
          totalRevenue: {
            $sum: {
              $map: {
                input: '$payments',
                as: 'payment',
                in: '$$payment.amount'
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$actual_start_time' },
            dayOfWeek: { $dayOfWeek: '$actual_start_time' },
            station: '$station_id'
          },
          rentalCount: { $sum: 1 },
          totalActualRevenue: { $sum: '$totalRevenue' },
          paymentsCount: { $sum: { $size: '$payments' } },
          averageDuration: { $avg: { $subtract: ['$actual_end_time', '$actual_start_time'] } }
        }
      }
    ]);

    // Lấy forfeited holding fees từ cancelled bookings
    const forfeitedHoldingFeeQuery = {
      payment_type: 'holding_fee',
      status: 'completed',
      is_active: true,
      forfeited: true,
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (stationId) {
      const mongoose = require('mongoose');
      forfeitedHoldingFeeQuery.station_id = new mongoose.Types.ObjectId(stationId);
    }

    const forfeitedHoldingFees = await Payment.aggregate([
      { $match: forfeitedHoldingFeeQuery },
      {
        $group: {
          _id: null,
          totalForfeitedFees: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalForfeitedFees = forfeitedHoldingFees.length > 0 
      ? forfeitedHoldingFees[0].totalForfeitedFees 
      : 0;
    
    const forfeitedCount = forfeitedHoldingFees.length > 0
      ? forfeitedHoldingFees[0].count
      : 0;

    console.log(`💰 Forfeited holding fees: ${totalForfeitedFees.toLocaleString('vi-VN')} VND (${forfeitedCount} bookings)`);

    // Lấy thống kê trạm - FIXED
    const mongoose = require('mongoose');
    const stationMatchQuery = stationId ? { _id: new mongoose.Types.ObjectId(stationId) } : { status: 'active' };
    const stationStats = await Station.aggregate([
      { $match: stationMatchQuery },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: 'station_id',
          as: 'vehicles'
        }
      },
      {
        $lookup: {
          from: 'rentals',
          let: { stationId: '$_id' },
          pipeline: [
            {             $match: {
              $expr: { 
                $and: [
                  { $eq: ['$station_id', '$$stationId'] },
                  { $in: ['$status', ['completed', 'pending_payment']] },
                  { $gte: ['$actual_start_time', { $subtract: [new Date(), 7 * 24 * 60 * 60 * 1000] }] }
                ]
              }
            }},
            { $count: "recentRentals" }
          ],
          as: 'recentRentalCount'
        }
      },
      {
        $project: {
          _id: 1,
          name: 1,
          address: 1,
          current_vehicles: 1,
          available_vehicles: 1,
          rented_vehicles: 1,
          reserved_vehicles: 1,
          total_vehicles: { $size: '$vehicles' },
          utilization_rate: {
            $cond: [
              { $eq: ['$current_vehicles', 0] },
              0,
              { $multiply: [{ $divide: [{ $add: ['$rented_vehicles', '$reserved_vehicles'] }, '$current_vehicles'] }, 100] }
            ]
          },
          recentRentals: { $arrayElemAt: ['$recentRentalCount.recentRentals', 0] },
          efficiency_score: {
            $cond: [
              { $eq: [{ $size: '$vehicles' }, 0] },
              0,
              { $multiply: [{ $divide: [{ $arrayElemAt: ['$recentRentalCount.recentRentals', 0] }, { $size: '$vehicles' }] }, 100] }
            ]
          }
        }
      }
    ]);

    // Thêm dữ liệu thời tiết và sự kiện
    let externalData = { weather: null, events: [], calendarData: [], forecast: [] };
    try {
      externalData = await ExternalAPIs.getAllExternalData();
    } catch (error) {
      console.warn('External APIs failed:', error.message);
    }

    return {
      // Legacy format để backward compatibility
      hourlyData: hourlyBookingData,  // FIXED: Removed slice
      dailyData: dailyBookingData,   // FIXED: Removed slice
      
      // New detailed data
      detailedHourlyBookings: hourlyBookingData,
      detailedDailyBookings: dailyBookingData,
      actualRentalData: actualRentalData,
      
      stationStats,
      weatherData: externalData.weather,
      eventData: externalData.events,
      calendarData: externalData.calendar,
      weatherForecast: externalData.forecast,
      period,
      dateRange: { start: startDate, end: endDate },
      
      // Summary stats
      summary: {
        totalBookings: hourlyBookingData.reduce((sum, item) => sum + item.bookingsCount, 0),
        completedRentals: hourlyBookingData.reduce((sum, item) => sum + item.completedRentals, 0),
        expectedRevenue: hourlyBookingData.reduce((sum, item) => sum + item.totalBookingRevenue, 0),
        actualRevenue: actualRentalData.reduce((sum, item) => sum + item.totalActualRevenue, 0) + totalForfeitedFees,  // ✅ BAO GỒM forfeited holding fees
        forfeitedHoldingFees: totalForfeitedFees,  // ✅ Track riêng forfeited fees
        forfeitedBookingsCount: forfeitedCount,
        conversionRate: hourlyBookingData.length > 0 ? 
          (hourlyBookingData.reduce((sum, item) => sum + item.completedRentals, 0) / 
           hourlyBookingData.reduce((sum, item) => sum + item.bookingsCount, 0)) * 100 : 0
      }
    };
  }

  // Dự báo nhu cầu tổng quan - FIXED
  async getDemandForecast(period = '7d', stationId = null) {
    try {
      const historicalData = await this.getHistoricalData('90d', stationId);
      
      // FIXED: Enhanced prompt với real data summary
      const prompt = `
Bạn là chuyên gia phân tích dữ liệu cho hệ thống thuê xe điện. Hãy phân tích dữ liệu thực tế và đưa ra dự báo chính xác cho ${period} tới.

DỮ LIỆU THỰC TẾ (90 ngày gần nhất):
=== BOOKINGS ===
Tổng bookings: ${historicalData.summary.totalBookings} lượt
Booking hoàn thành: ${historicalData.summary.completedRentals} lượt  
Tỷ lệ chuyển đổi: ${historicalData.summary.conversionRate.toFixed(1)}%

Doanh thu dự kiến: ${(historicalData.summary.expectedRevenue/1000000).toFixed(1)}M VND
Doanh thu thực tế: ${(historicalData.summary.actualRevenue/1000000).toFixed(1)}M VND

=== DỮ LIỆU CHI TIẾT ===
Bookings theo giờ (24h):
${historicalData.detailedHourlyBookings.map(item => 
  `Giờ ${item._id.hour}h: ${item.bookingsCount} lượt đặt, ${item.completedRentals} hoàn thành`
).join('\n')}

Bookings theo ngày (7 ngày gần nhất):
${historicalData.detailedDailyBookings.slice(-7).map(item => 
  `Ngày ${item._id.date}: ${item.bookingsCount} lượt đặt, ${item.completedRentals} hoàn thành`
).join('\n')}

=== THUÊ XE THỰC TẾ ===
Dữ liệu thuê xe đã hoàn thành:
${historicalData.actualRentalData.map(item => 
  `Giờ ${item._id.hour}h: ${item.rentalCount} lượt thuê, thời gian trung bình: ${Math.round(item.averageDuration/3600000)}h`
).join('\n')}

=== TRẠM ===
Thống kê trạm:
${historicalData.stationStats.map(station => 
  `Trạm ${station.name}: ${station.total_vehicles} xe, tỷ lệ sử dụng ${station.utilization_rate.toFixed(1)}%, thuê gần đây: ${station.recentRentals || 0} lượt`
).join('\n')}

=== THỜI TIẾT TP.HCM ===
Hiện tại: ${JSON.stringify(historicalData.weatherData)}
Dự báo 3 ngày: ${JSON.stringify(historicalData.weatherForecast.slice(0, 3))}

Hãy phân tích:
1. XU HƯỚNG THEO GIỜ: Giờ cao điểm nào có nhu cầu cao nhất?
2. XU HƯỚNG THEO NGÀY: Ngày nào trong tuần có booking nhiều nhất?
3. DỰ BÁO SỐ LƯỢNG: Dự báo chính xác bookings và rentals cho ${period} tới
4. TÁC ĐỘNG THỜI TIẾT: Mưa/nắng ảnh hưởng đến booking như thế nào?
5. ĐỘ TIN CẬY: Confidence level của dự báo (%)

QUAN TRỌNG:
- Dùng SỐ LIỆU THỰC TẾ từ bảng trên
- Doanh thu = thanh toán thực tế chứ KHÔNG phải giá booking
- Booking có thể bị hủy, chỉ rentals là chắc chắn
- **PHÍ GIỮ CHỖ (HOLDING FEE):** 
  • Mỗi booking online phải thanh toán 50,000 VND phí giữ chỗ trong 15 phút
  • Chính sách hoàn tiền:
    - Khách tự hủy: KHÔNG hoàn lại
    - Staff hủy (lỗi hệ thống/xe hỏng): CÓ THỂ hoàn lại 50k tiền mặt tại trạm
  • Phí được TRỪ VÀO tổng tiền thuê xe khi nhận xe
  • Booking không thanh toán phí giữ chỗ sẽ tự động hủy
  • Tất cả refund được tracking qua Payment collection (payment_type: 'refund')
- Confidence dựa trên variance của data lịch sử
- TUYỆT ĐỐI KHÔNG DÙNG TỪ TIẾNG ANH (utilization → tỷ lệ sử dụng, revenue → doanh thu, booking → đặt xe, rental → thuê xe, holding fee → phí giữ chỗ, refund → hoàn tiền)

Trả về JSON HOÀN TOÀN BẰNG TIẾNG VIỆT (không được có bất kỳ từ tiếng Anh nào):
{
  "hourlyTrend": [{"hour": 0-23, "demand": "thấp/trung bình/cao", "forecast": number, "confidence": number}],
  "weeklyTrend": [{"day": "Thứ 2-Chủ nhật", "demand": "thấp/trung bình/cao", "forecast": number}],
  "totalForecast": {"period": "${period}", "predictedBookings": number, "predictedRentals": number, "confidence": number},
  "revenueForecast": {"expectedRevenue": number, "actualRevenue": number},
  "weatherImpact": {"current": "mô tả thời tiết hiện tại bằng tiếng Việt", "forecast": "dự báo thời tiết bằng tiếng Việt"},
  "factors": ["các yếu tố tác động, chỉ dùng tiếng Việt, VD: 'Tỷ lệ sử dụng xe tại trạm X cao', 'Nhu cầu tập trung vào giờ Y'"],
  "recommendations": ["gợi ý cụ thể bằng tiếng Việt, VD: 'Tăng xe tại trạm có tỷ lệ sử dụng cao', 'Khuyến mãi tại trạm ít khách'"]
}

LƯU Ý: Tất cả text trong factors và recommendations PHẢI HOÀN TOÀN TIẾNG VIỆT!
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // FIXED: Better JSON parsing
      try {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        const jsonStr = text.substring(jsonStart, jsonEnd);
        
        // Clean and parse
        const cleanedJson = jsonStr
          .replace(/\n/g, '')
          .replace(/\s+/g, ' ')
          .trim();
          
        const parsed = JSON.parse(cleanedJson);
        return this.normalizeDemandForecast(parsed);
      } catch (parseError) {
        console.warn('JSON parse failed:', parseError.message);
        console.log('Raw text:', text);
        
        // Fallback với real data
        return this.generateFallbackForecast(historicalData, period);
      }
      
    } catch (error) {
      console.error('Error in demand forecast:', error);
      throw new Error('Lỗi khi dự báo nhu cầu: ' + error.message);
    }
  }

  // Chuẩn hoá output dự báo về đúng schema và giá trị hợp lý
  normalizeDemandForecast(raw) {
    const clamp = (v, min, max) => {
      const num = Number(v);
      if (!Number.isFinite(num)) return min;
      return Math.max(min, Math.min(max, num));
    };

    const normalizeHourly = (items = []) => {
      const seen = new Set();
      return items.map(it => {
        // Chuyển đổi demand từ tiếng Anh sang tiếng Việt nếu cần
        let demand = String(it.demand || it.demAnd || 'thấp').toLowerCase();
        if (demand === 'low') demand = 'thấp';
        if (demand === 'medium') demand = 'trung bình';
        if (demand === 'high') demand = 'cao';
        
        return {
          hour: clamp(it.hour, 0, 23),
          demand: demand,
          forecast: clamp(it.forecast, 0, 1000000),
          confidence: clamp(it.confidence, 50, 95)
        };
      }).filter(it => {
        if (seen.has(it.hour)) return false;
        seen.add(it.hour);
        return ['thấp','trung bình','cao'].includes(it.demand) || 
               ['low','medium','high'].includes(it.demand);
      }).sort((a, b) => a.hour - b.hour);
    };

    const normalizeWeekly = (items = []) => items.map(it => {
      // Chuyển đổi demand từ tiếng Anh sang tiếng Việt nếu cần
      let demand = String(it.demand || it.demAnd || 'thấp').toLowerCase();
      if (demand === 'low') demand = 'thấp';
      if (demand === 'medium') demand = 'trung bình';
      if (demand === 'high') demand = 'cao';
      
      // Chuyển đổi tên ngày sang tiếng Việt
      let day = it.day || (it._id && it._id.date) || 'Unknown';
      if (day === 'Mon') day = 'Thứ 2';
      if (day === 'Tue') day = 'Thứ 3';
      if (day === 'Wed') day = 'Thứ 4';
      if (day === 'Thu') day = 'Thứ 5';
      if (day === 'Fri') day = 'Thứ 6';
      if (day === 'Sat') day = 'Thứ 7';
      if (day === 'Sun') day = 'Chủ nhật';
      
      return {
        day: day,
        demand: demand,
        forecast: clamp(it.forecast, 0, 1000000000)
      };
    });

    const total = raw?.totalForecast || {};

    return {
      hourlyTrend: normalizeHourly(raw?.hourlyTrend || []),
      weeklyTrend: normalizeWeekly(raw?.weeklyTrend || []),
      totalForecast: {
        period: total.period || '7d',
        predictedBookings: clamp(total.predictedBookings, 0, 1000000000),
        predictedRentals: total.predictedRentals || 0,
        confidence: clamp(total.confidence, 50, 95)
      },
      factors: Array.isArray(raw?.factors) ? raw.factors : [],
      recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations : []
    };
  }

  // FIXED: Generate fallback với real data
  generateFallbackForecast(historicalData, period) {
    const avgDailyBookings = historicalData.summary.totalBookings / 90;
    const avgDailyRentals = historicalData.summary.completedRentals / 90;
    
    const forecastDays = period === '7d' ? 7 : 30;
    const predictedBookings = Math.round(avgDailyBookings * forecastDays);
    const predictedRentals = Math.round(avgDailyRentals * forecastDays);
    
    // Simple trend based on recent data  
    const recentData = historicalData.detailedDailyBookings.slice(-7);
    const recentAvg = recentData.reduce((sum, item) => sum + item.bookingsCount, 0) / 7;
    const olderAvg = historicalData.detailedDailyBookings.slice(-14, -7).reduce((sum, item) => sum + item.bookingsCount, 0) / 7;
    
    const trend = recentAvg > olderAvg ? 'increasing' : 'decreasing';
    const confidence = trend === 'increasing' ? 75 : 65;
    
    return {
      hourlyTrend: this.generateHourlyTrend(historicalData.detailedHourlyBookings),
      weeklyTrend: this.generateWeeklyTrend(historicalData.detailedDailyBookings),
      totalForecast: { 
        period, 
        predictedBookings, 
        predictedRentals, 
        confidence,
        trend 
      },
      revenueForecast: {
        expectedRevenue: Math.round(historicalData.summary.expectedRevenue * (forecastDays / 90)),
        actualRevenue: Math.round(historicalData.summary.actualRevenue * (forecastDays / 90))
      },
      weatherImpact: {
        current: historicalData.weatherData ? 'Dữ liệu thời tiết có sẵn' : 'Không có dữ liệu thời tiết',
        forecast: historicalData.weatherForecast.length > 0 ? 'Dự báo thời tiết có sẵn' : 'Không có dự báo thời tiết'
      },
      factors: [
        `Xu hướng ${trend} trong 7 ngày gần nhất`,
        `Tỷ lệ chuyển đổi: ${historicalData.summary.conversionRate.toFixed(1)}%`,
        `Revenue gap: ${((historicalData.summary.expectedRevenue - historicalData.summary.actualRevenue)/1000000).toFixed(1)}M VND`
      ],
      recommendations: [
        'Tập trung cải thiện tỷ lệ chuyển đổi booking thành rental',
        'Theo dõi actual revenue vs expected revenue',
        'Tối ưu hóa peak hours dựa trên data lịch sử'
      ]
    };
  }

  generateHourlyTrend(hourlyData) {
    const hourlyMap = {};
    for (let i = 0; i < 24; i++) {
      hourlyMap[i] = { count: 0, demand: 'low' };
    }
    
    hourlyData.forEach(item => {
      if (item.bookingsCount > 0) {
        hourlyMap[item._id.hour].count = item.bookingsCount;
        
        if (item.bookingsCount > 5) hourlyMap[item._id.hour].demand = 'high';
        else if (item.bookingsCount > 2) hourlyMap[item._id.hour].demand = 'medium';
      }
    });
    
    return Object.keys(hourlyMap).map(hour => ({
      hour: parseInt(hour),
      demand: hourlyMap[hour].demand,
      forecast: hourlyMap[hour].count,
      confidence: 70
    }));
  }

  generateWeeklyTrend(dailyData) {
    const weeklyNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklySummary = {};
    
    weeklyNames.forEach(day => weeklySummary[day] = { count: 0, demand: 'low' });
    
    dailyData.forEach(item => {
      const dayOfWeek = new Date(item._id.date).getDay();
      const dayName = weeklyNames[dayOfWeek];
      
      if (weeklySummary[dayName]) {
        weeklySummary[dayName].count += item.bookingsCount;
        
        if (weeklySummary[dayName].count > 20) weeklySummary[dayName].demand = 'high';
        else if (weeklySummary[dayName].count > 10) weeklySummary[dayName].demand = 'medium';
      }
    });
    
    return Object.keys(weeklySummary).map(day => ({
      day,
      demand: weeklySummary[day].demand,
      forecast: weeklySummary[day].count
    }));
  }

  // Phân tích xu hướng nâng cao dựa trên dữ liệu lịch sử
  async getTrendAnalysis(period = '90d') {
    const historicalData = await this.getHistoricalData(period);

    // 1. Phân tích xu hướng tổng thể
    const last7 = historicalData.detailedDailyBookings.slice(-7);
    const prev7 = historicalData.detailedDailyBookings.slice(-14, -7);
    const prev14 = historicalData.detailedDailyBookings.slice(-21, -14);

    const last7Sum = last7.reduce((sum, d) => sum + (d.bookingsCount || 0), 0);
    const prev7Sum = prev7.reduce((sum, d) => sum + (d.bookingsCount || 0), 0);
    const prev14Sum = prev14.reduce((sum, d) => sum + (d.bookingsCount || 0), 0);

    const growthRate = prev7Sum > 0 ? ((last7Sum - prev7Sum) / prev7Sum) * 100 : 0;
    const prevGrowthRate = prev14Sum > 0 ? ((prev7Sum - prev14Sum) / prev14Sum) * 100 : 0;

    // 2. Phân tích seasonality (tính mùa vụ)
    const seasonality = this.analyzeSeasonality(historicalData.detailedDailyBookings, historicalData.detailedHourlyBookings);

    // 3. Phân tích cyclical (tính chu kỳ)
    const cyclical = this.analyzeCyclical(historicalData.detailedDailyBookings);

    // 4. Xác định xu hướng tổng thể
    let overall = 'stable';
    if (Math.abs(growthRate) > 5) {
      overall = growthRate > 0 ? 'increasing' : 'decreasing';
    } else if (Math.abs(growthRate) > 2) {
      overall = growthRate > 0 ? 'slightly_increasing' : 'slightly_decreasing';
    }

    const trends = {
      overall,
      growthRate: Number(growthRate.toFixed(1)),
      previousGrowthRate: Number(prevGrowthRate.toFixed(1)),
      seasonality,
      cyclical
    };

    // 5. Dự báo với confidence dựa trên độ ổn định
    const stability = Math.abs(growthRate - prevGrowthRate);
    const confidence = Math.max(50, Math.min(95, 85 - stability));

    const forecasts = {
      shortTerm: {
        period: '1month',
        trend: overall.includes('increasing') ? 'tăng' : overall.includes('decreasing') ? 'giảm' : 'ổn định',
        confidence: Math.round(confidence)
      },
      longTerm: {
        period: '6months',
        trend: overall.includes('increasing') ? 'tăng' : overall.includes('decreasing') ? 'giảm' : 'ổn định',
        confidence: Math.round(confidence * 0.8)
      }
    };

    // 6. Phân tích yếu tố tác động
    const factors = this.analyzeFactors(historicalData);

    // 7. Tạo opportunities và challenges
    const { opportunities, challenges, recommendations } = this.generateInsights(trends, factors, historicalData);

    // Translate factors sang tiếng Việt cho frontend
    const factorsTranslated = {
      weather: this.translateFactor('weather', factors.weather),
      events: this.translateFactor('events', factors.events),
      economic: this.translateFactor('economic', factors.economic),
      customerSatisfaction: this.translateFactor('customerSatisfaction', factors.customerSatisfaction),
      pricing: this.translateFactor('pricing', factors.pricing)
    };

    return {
      trends,
      factors: factorsTranslated,
      factorsRaw: factors, // Giữ lại raw data nếu cần
      forecasts,
      opportunities,
      challenges,
      recommendations
    };
  }

  // Helper để translate factors
  translateFactor(type, value) {
    const translations = {
      weather: {
        adverse: 'Thời tiết bất lợi',
        moderate: 'Thời tiết bình thường',
        favorable: 'Thời tiết thuận lợi'
      },
      events: {
        normal: 'Không có sự kiện đặc biệt',
        high: 'Có nhiều sự kiện'
      },
      economic: {
        stable: 'Kinh tế ổn định',
        growing: 'Kinh tế tăng trưởng',
        declining: 'Kinh tế suy giảm'
      },
      customerSatisfaction: {
        unknown: 'Chưa đánh giá',
        poor: 'Kém (< 40%)',
        fair: 'Trung bình (40-60%)',
        good: 'Tốt (60-80%)',
        excellent: 'Xuất sắc (> 80%)'
      },
      pricing: {
        competitive: 'Cạnh tranh tốt',
        underperforming: 'Chưa tối ưu',
        needs_revision: 'Cần điều chỉnh'
      }
    };

    return translations[type]?.[value] || value;
  }

  // Phân tích seasonality
  analyzeSeasonality(dailyData, hourlyData) {
    const seasonality = [];

    // Phân tích theo ngày trong tuần
    const weeklyPattern = {};
    dailyData.forEach(day => {
      const dayOfWeek = new Date(day._id.date).getDay();
      const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      const dayName = dayNames[dayOfWeek];
      
      if (!weeklyPattern[dayName]) {
        weeklyPattern[dayName] = { count: 0, days: 0 };
      }
      weeklyPattern[dayName].count += day.bookingsCount || 0;
      weeklyPattern[dayName].days += 1;
    });

    // Tìm ngày có booking cao nhất và thấp nhất
    const weeklyAverages = Object.entries(weeklyPattern).map(([day, data]) => ({
      day,
      average: data.count / data.days
    })).sort((a, b) => b.average - a.average);

    if (weeklyAverages.length > 0) {
      const highest = weeklyAverages[0];
      const lowest = weeklyAverages[weeklyAverages.length - 1];
      
      if (highest.average > lowest.average * 1.5) {
        seasonality.push(`${highest.day} có booking cao nhất`);
      }
    }

    // Phân tích theo giờ
    const hourlyPattern = {};
    hourlyData.forEach(hour => {
      const hourKey = hour._id.hour;
      if (!hourlyPattern[hourKey]) {
        hourlyPattern[hourKey] = { count: 0, days: 0 };
      }
      hourlyPattern[hourKey].count += hour.bookingsCount || 0;
      hourlyPattern[hourKey].days += 1;
    });

    const hourlyAverages = Object.entries(hourlyPattern).map(([hour, data]) => ({
      hour: parseInt(hour),
      average: data.count / data.days
    })).sort((a, b) => b.average - a.average);

    if (hourlyAverages.length > 0) {
      const peakHours = hourlyAverages.slice(0, 3);
      if (peakHours[0].average > 0) {
        seasonality.push(`Giờ cao điểm: ${peakHours.map(h => h.hour + 'h').join(', ')}`);
      }
    }

    return seasonality;
  }

  // Phân tích cyclical
  analyzeCyclical(dailyData) {
    if (dailyData.length < 30) return 'Cần thêm dữ liệu (ít nhất 30 ngày)';

    // Phân tích xu hướng theo tuần
    const weeklyTrends = [];
    for (let i = 0; i < dailyData.length - 6; i += 7) {
      const weekData = dailyData.slice(i, i + 7);
      const weekSum = weekData.reduce((sum, day) => sum + (day.bookingsCount || 0), 0);
      weeklyTrends.push(weekSum);
    }

    if (weeklyTrends.length < 4) return 'Cần thêm dữ liệu (ít nhất 4 tuần)';

    // Tính độ biến thiên
    const avg = weeklyTrends.reduce((sum, val) => sum + val, 0) / weeklyTrends.length;
    const variance = weeklyTrends.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / weeklyTrends.length;
    const coefficient = Math.sqrt(variance) / avg;

    if (coefficient > 0.3) return 'Biến động cao - có thể do sự kiện đặc biệt';
    if (coefficient > 0.15) return 'Biến động vừa phải';
    return 'Ổn định - ít biến động';
  }

  // Phân tích yếu tố tác động
  analyzeFactors(historicalData) {
    const factors = {
      weather: 'moderate',
      events: 'normal',
      economic: 'stable',
      customerSatisfaction: 'unknown',
      pricing: 'competitive'
    };

    // Phân tích thời tiết
    if (historicalData.weatherData) {
      const weather = historicalData.weatherData;
      if (weather.weather === 'Rain' || weather.weather === 'Thunderstorm') {
        factors.weather = 'adverse';
      } else if (weather.weather === 'Clear' || weather.weather === 'Sunny') {
        factors.weather = 'favorable';
      }
    }

    // Phân tích sự kiện
    if (historicalData.eventData && historicalData.eventData.length > 0) {
      factors.events = 'high';
    }

    // Phân tích customer satisfaction (dựa trên conversion rate)
    if (historicalData?.summary?.conversionRate !== undefined) {
      const conversionRate = historicalData.summary.conversionRate;
      if (conversionRate >= 80) {
        factors.customerSatisfaction = 'excellent';
      } else if (conversionRate >= 60) {
        factors.customerSatisfaction = 'good';
      } else if (conversionRate >= 40) {
        factors.customerSatisfaction = 'fair';
      } else {
        factors.customerSatisfaction = 'poor';
      }
    }

    // Phân tích pricing (dựa trên revenue gap)
    if (historicalData?.summary?.expectedRevenue && historicalData?.summary?.actualRevenue) {
      const expectedRev = historicalData.summary.expectedRevenue;
      const actualRev = historicalData.summary.actualRevenue;
      const gap = expectedRev > 0 ? (actualRev / expectedRev) : 0;
      
      if (gap >= 0.9) {
        factors.pricing = 'competitive';
      } else if (gap >= 0.7) {
        factors.pricing = 'underperforming';
      } else {
        factors.pricing = 'needs_revision';
      }
    }

    return factors;
  }

  // Tạo insights dựa trên phân tích
  generateInsights(trends, factors, historicalData) {
    const opportunities = [];
    const challenges = [];
    const recommendations = [];

    // Opportunities với recommendations cụ thể
    if (trends.overall.includes('increasing')) {
      opportunities.push(`Xu hướng tăng trưởng tích cực: +${trends.growthRate}%`);
      
      // Cụ thể hóa theo mức tăng trưởng
      if (trends.growthRate > 20) {
        recommendations.push(`🚀 Tăng trưởng mạnh (${trends.growthRate}%): Ưu tiên mở rộng số lượng xe và trạm mới`);
      } else if (trends.growthRate > 10) {
        recommendations.push(`📈 Tăng trưởng tốt (${trends.growthRate}%): Xem xét thêm xe tại các trạm hiện tại`);
      } else {
        recommendations.push(`✅ Tăng trưởng ổn định (${trends.growthRate}%): Duy trì và cải thiện chất lượng dịch vụ`);
      }
    }

    if (trends.seasonality && trends.seasonality.length > 0) {
      opportunities.push('Có patterns theo thời gian rõ ràng');
      
      trends.seasonality.forEach(pattern => {
        if (pattern.includes('Giờ cao điểm')) {
          recommendations.push(`⏰ ${pattern} - Áp dụng surge pricing để tối đa revenue`);
        }
        if (pattern.includes('có booking cao nhất')) {
          recommendations.push(`📅 ${pattern} - Tăng cường marketing vào các ngày khác`);
        }
      });
    }

    if (factors.weather === 'favorable') {
      opportunities.push('Thời tiết thuận lợi cho thuê xe điện');
    }

    // Customer satisfaction insights
    if (factors.customerSatisfaction === 'excellent') {
      opportunities.push('Độ hài lòng khách hàng xuất sắc (>80% conversion)');
      recommendations.push('💎 Tận dụng khách hàng hài lòng để chạy referral program');
    } else if (factors.customerSatisfaction === 'good') {
      opportunities.push('Độ hài lòng khách hàng tốt (60-80% conversion)');
    }

    // Pricing insights
    if (factors.pricing === 'competitive') {
      opportunities.push('Giá cả cạnh tranh tốt (revenue gap <10%)');
    }

    // Challenges với giải pháp cụ thể
    if (trends.overall.includes('decreasing')) {
      challenges.push(`⚠️ Xu hướng giảm ${Math.abs(trends.growthRate)}% cần xử lý ngay`);
      
      if (historicalData?.summary?.conversionRate < 50) {
        challenges.push('🚨 Conversion rate < 50% - Nghiêm trọng');
        recommendations.push('KHẨN CẤP: Kiểm tra UX app, quy trình đặt xe và chất lượng xe');
      } else if (historicalData?.summary?.conversionRate < 70) {
        recommendations.push('⚡ Cải thiện conversion rate: Review UI/UX và thời gian phản hồi booking');
      }
      
      const expectedRev = historicalData?.summary?.expectedRevenue || 0;
      const actualRev = historicalData?.summary?.actualRevenue || 0;
      const revenueGap = expectedRev - actualRev;
      
      if (revenueGap > actualRev * 0.3) {
        challenges.push(`💰 Revenue gap lớn: ${(revenueGap/1000000).toFixed(1)}M VND`);
        recommendations.push('💡 Review pricing và chính sách hủy - nhiều booking bị cancel/không hoàn thành');
      }
      
      recommendations.push('🎁 Chạy khuyến mãi hoặc loyalty program để kích cầu');
    }
    
    // Challenges khi growth = 0 (stable nhưng không tăng trưởng)
    if (trends.growthRate === 0 && trends.previousGrowthRate === 0) {
      challenges.push('📊 Tăng trưởng dừng lại - Hệ thống đang trì trệ');
      if (!recommendations.some(r => r.includes('chiến lược đột phá'))) {
        // Đã có recommendation rồi, không cần thêm
      }
    }

    if (factors.weather === 'adverse') {
      challenges.push('🌧️ Thời tiết bất lợi ảnh hưởng đến nhu cầu');
      recommendations.push('☔ Chuẩn bị kế hoạch dự phòng: Khuyến mãi ngày mưa, tăng cường bảo dưỡng xe');
    }

    if (trends.cyclical && trends.cyclical.includes('Biến động cao')) {
      challenges.push('📊 Biến động cao khó dự đoán');
      recommendations.push('🔍 Tăng cường monitoring real-time và phân tích nguyên nhân biến động');
    }

    // Customer satisfaction challenges
    if (factors.customerSatisfaction === 'poor') {
      challenges.push('😞 Độ hài lòng khách hàng thấp (<40% conversion)');
      recommendations.push('🆘 KHẨN: Khảo sát khách hàng để tìm nguyên nhân và cải thiện dịch vụ');
    } else if (factors.customerSatisfaction === 'fair') {
      challenges.push('😐 Độ hài lòng khách hàng trung bình (40-60%)');
      recommendations.push('📞 Liên hệ khách hàng để thu thập feedback và cải thiện');
    }

    // Pricing challenges
    if (factors.pricing === 'needs_revision') {
      challenges.push('💸 Pricing cần điều chỉnh (revenue gap >30%)');
      recommendations.push('💰 Review toàn bộ bảng giá - có thể giá quá cao hoặc chính sách không hợp lý');
    } else if (factors.pricing === 'underperforming') {
      challenges.push('📉 Pricing chưa tối ưu (revenue gap 10-30%)');
      recommendations.push('🔧 Điều chỉnh nhỏ về giá hoặc giảm tỷ lệ hủy booking');
    }

    // Recommendations chung
    if (trends.growthRate === 0) {
      recommendations.push('🎯 Tăng trưởng dừng lại - Cần chiến lược đột phá: thử nghiệm model mới hoặc mở rộng thị trường');
    }

    if (!historicalData?.summary?.conversionRate || historicalData.summary.conversionRate < 70) {
      recommendations.push('📊 Tỷ lệ chuyển đổi cần cải thiện - Target: >70%');
    }

    return { opportunities, challenges, recommendations };
  }

  // Dự báo theo trạm: tái sử dụng getDemandForecast với stationId
  async getStationDemandForecast(stationId, period = '7d') {
    return this.getDemandForecast(period, stationId);
  }

  // Gợi ý số lượng xe máy điện theo mức sử dụng hiện tại và mục tiêu
  async getVehicleRecommendations() {
    try {
      // Lấy dữ liệu trực tiếp từ Station và Vehicle thay vì qua getHistoricalData
      const stations = await Station.find({ status: 'active' });
      
      if (!stations || stations.length === 0) {
        console.log('No active stations found');
        return {
          totalStations: 0,
          totalVehiclesNeeded: 0,
          estimatedInvestment: 0,
          recommendations: [],
          generalRecommendations: ['Cần thêm trạm cho thuê xe máy điện']
        };
      }

      const targetUtilization = 0.8; // mục tiêu 80%
      let totalRentedVehicles = 0;
      let totalAvailableVehicles = 0;
      let totalUtilization = 0;
      let stationsWithLowUtilization = 0;
      let stationsWithHighUtilization = 0;

      const recommendations = await Promise.all(stations.map(async (station) => {
        // Lấy số xe hiện tại trong trạm
        const vehicles = await Vehicle.find({ station_id: station._id });
        const currentVehicles = vehicles.length;
        
        // Lấy số xe đang được thuê và đã đặt
        const rentedVehicles = vehicles.filter(v => v.status === 'rented').length;
        const reservedVehicles = vehicles.filter(v => v.status === 'reserved').length;
        const inUseVehicles = rentedVehicles + reservedVehicles;
        totalRentedVehicles += rentedVehicles;
        totalAvailableVehicles += currentVehicles;
        
        // Phân tích theo loại xe máy điện
        const vehicleTypes = {};
        vehicles.forEach(v => {
          if (!vehicleTypes[v.type]) vehicleTypes[v.type] = { total: 0, rented: 0, reserved: 0, inUse: 0 };
          vehicleTypes[v.type].total++;
          if (v.status === 'rented') vehicleTypes[v.type].rented++;
          if (v.status === 'reserved') vehicleTypes[v.type].reserved++;
          if (v.status === 'rented' || v.status === 'reserved') vehicleTypes[v.type].inUse++;
        });
        
        // Tính toán utilization và nhu cầu (bao gồm cả rented và reserved)
        const currentUtil = currentVehicles > 0 ? inUseVehicles / currentVehicles : 0;
        totalUtilization += currentUtil;
        
        if (currentUtil > 0.7) stationsWithHighUtilization++;
        if (currentUtil < 0.3 && currentVehicles > 0) stationsWithLowUtilization++;
        
        const vehiclesNeeded = currentUtil >= targetUtilization ? 0 : Math.max(0, Math.ceil((inUseVehicles / targetUtilization) - currentVehicles));
        const estimatedROI = currentVehicles > 0 ? Number(((currentUtil / targetUtilization) * 100).toFixed(1)) : 0;

        // Gợi ý cụ thể cho trạm
        const stationRecommendations = [];
        
        // Phân tích theo utilization
        if (vehiclesNeeded > 0) {
          stationRecommendations.push(`⚡ Cần bổ sung ${vehiclesNeeded} xe máy điện ngay`);
        } else if (currentUtil > 0.9) {
          stationRecommendations.push('🚨 Tỷ lệ sử dụng rất cao (>90%), cần chuẩn bị thêm xe dự phòng');
        } else if (currentUtil >= 0.7 && currentUtil <= 0.9) {
          stationRecommendations.push(`✅ Tỷ lệ sử dụng tốt (${(currentUtil*100).toFixed(0)}%), tiếp tục duy trì`);
        } else if (currentUtil >= 0.4 && currentUtil < 0.7) {
          stationRecommendations.push(`📊 Tỷ lệ sử dụng trung bình (${(currentUtil*100).toFixed(0)}%), cần tăng cường marketing`);
        } else if (currentUtil > 0 && currentUtil < 0.4 && currentVehicles > 5) {
          stationRecommendations.push(`⚠️ Tỷ lệ sử dụng thấp (${(currentUtil*100).toFixed(0)}%), cân nhắc giảm số lượng xe`);
        } else if (currentUtil === 0 && currentVehicles > 3) {
          stationRecommendations.push(`❌ Không có xe nào được thuê, cần review vị trí hoặc điều chuyển xe`);
        } else if (currentUtil === 0 && currentVehicles > 0 && currentVehicles <= 3) {
          stationRecommendations.push(`💡 Trạm nhỏ chưa có lượt thuê, cần chạy khuyến mãi khai trương`);
        }
        
        // Trường hợp đặc biệt: Trạm không có xe
        if (currentVehicles === 0) {
          stationRecommendations.push('🏗️ Trạm mới chưa có xe, cần bổ sung ít nhất 5-10 xe để vận hành');
        }
        
        // Gợi ý theo loại xe (chi tiết hơn)
        const typeRecommendations = Object.entries(vehicleTypes).map(([type, data]) => {
          const typeUtil = data.total > 0 ? data.inUse / data.total : 0;
          const typeName = type === 'scooter' ? 'xe ga' : type === 'motorcycle' ? 'xe số' : type;
          
          if (typeUtil > 0.9) {
            return `🔥 Loại ${typeName} có nhu cầu rất cao (${data.inUse}/${data.total}), xem xét thêm xe`;
          } else if (typeUtil >= 0.6 && typeUtil <= 0.9) {
            return `✅ Loại ${typeName} hoạt động tốt (${data.inUse}/${data.total})`;
          } else if (typeUtil < 0.1 && data.total > 2) {
            return `📉 Loại ${typeName} ít được thuê (${data.inUse}/${data.total}), cân nhắc điều chuyển`;
          }
          return null;
        }).filter(Boolean);
        
        if (typeRecommendations.length > 0) {
          stationRecommendations.push(...typeRecommendations);
        }
        
        // Gợi ý về số lượng xe cụ thể
        if (inUseVehicles > 0 && currentVehicles > 0) {
          const availableVehicles = currentVehicles - inUseVehicles;
          if (availableVehicles < 2 && currentUtil > 0.8) {
            stationRecommendations.push(`⚠️ Chỉ còn ${availableVehicles} xe khả dụng, nguy cơ hết xe trong giờ cao điểm`);
          }
        }

        return {
          stationId: station._id,
          stationName: station.name,
          currentVehicles,
          rentedVehicles,
          reservedVehicles,
          inUseVehicles,
          utilization: Number((currentUtil * 100).toFixed(1)),
          vehiclesNeeded,
          estimatedROI,
          priority: vehiclesNeeded > 0 ? 'cao' : 'thấp',
          timing: vehiclesNeeded > 0 ? 'ngay lập tức' : '1 tháng',
          vehicleTypes: Object.entries(vehicleTypes).map(([type, data]) => ({
            type,
            total: data.total,
            rented: data.rented,
            reserved: data.reserved,
            inUse: data.inUse,
            utilization: data.total > 0 ? Number((data.inUse / data.total * 100).toFixed(1)) : 0
          })),
          recommendations: stationRecommendations
        };
      }));

      // Tính tổng số xe cần thêm
      const totalVehiclesNeeded = recommendations.reduce((sum, r) => sum + r.vehiclesNeeded, 0);
      const avgUtilization = stations.length > 0 ? totalUtilization / stations.length : 0;
      
      // Phân loại trạm theo utilization
      const stationsEmpty = recommendations.filter(r => r.currentVehicles === 0);
      const stationsNoRentals = recommendations.filter(r => r.currentVehicles > 0 && r.utilization === 0);
      const stationsOptimal = recommendations.filter(r => r.utilization >= 60 && r.utilization <= 80);
      
      // Gợi ý chung cho toàn hệ thống (chi tiết và actionable)
      const generalRecommendations = [];
      
      // 1. Tổng quan hệ thống
      generalRecommendations.push(`📊 Tổng quan: ${stations.length} trạm với ${totalAvailableVehicles} xe, tỷ lệ sử dụng trung bình ${(avgUtilization*100).toFixed(1)}%`);
      
      // 2. Phân tích theo urgency
      if (totalVehiclesNeeded > 0) {
        generalRecommendations.push(`🚨 KHẨN CẤP: Cần bổ sung ${totalVehiclesNeeded} xe cho ${stationsWithHighUtilization} trạm có nhu cầu cao`);
      }
      
      if (stationsEmpty.length > 0) {
        generalRecommendations.push(`🏗️ Có ${stationsEmpty.length} trạm mới chưa có xe (${stationsEmpty.map(s => s.stationName).join(', ')})`);
      }
      
      if (stationsNoRentals.length > 0) {
        generalRecommendations.push(`❌ CẢNH BÁO: ${stationsNoRentals.length} trạm có xe nhưng không có lượt thuê nào, cần kiểm tra ngay`);
      }
      
      // 3. Cơ hội tối ưu
      if (stationsOptimal.length > 0) {
        generalRecommendations.push(`✅ ${stationsOptimal.length} trạm đang hoạt động tốt (60-80% utilization), tiếp tục duy trì`);
      }
      
      if (stationsWithHighUtilization > 0 && totalVehiclesNeeded === 0) {
        generalRecommendations.push(`⚡ ${stationsWithHighUtilization} trạm có tỷ lệ sử dụng cao, theo dõi sát để bổ sung xe kịp thời`);
      }
      
      // 4. Vấn đề về hiệu suất
      if (avgUtilization < 0.2 && totalAvailableVehicles > 10) {
        generalRecommendations.push(`📉 Tỷ lệ sử dụng hệ thống thấp (${(avgUtilization*100).toFixed(1)}%), cần chiến lược marketing mạnh mẽ`);
      } else if (avgUtilization < 0.4 && totalAvailableVehicles > 10) {
        generalRecommendations.push(`⚠️ Tỷ lệ sử dụng dưới mức tối ưu (${(avgUtilization*100).toFixed(1)}%), cần tăng cường quảng bá`);
      }
      
      if (stationsWithLowUtilization > 2) {
        generalRecommendations.push(`🔄 ${stationsWithLowUtilization} trạm có tỷ lệ sử dụng thấp, đề xuất điều chuyển xe sang trạm có nhu cầu cao hơn`);
      }
      
      // 5. Gợi ý vận hành
      if (totalAvailableVehicles > 0) {
        const totalInUse = totalRentedVehicles + recommendations.reduce((sum, r) => sum + r.reservedVehicles, 0);
        const idleVehicles = totalAvailableVehicles - totalInUse;
        
        if (idleVehicles > totalAvailableVehicles * 0.7) {
          generalRecommendations.push(`💡 ${idleVehicles}/${totalAvailableVehicles} xe đang không sử dụng (${((idleVehicles/totalAvailableVehicles)*100).toFixed(0)}%), cơ hội để chạy khuyến mãi`);
        }
      }
      
      // 6. Bảo dưỡng và chất lượng
      generalRecommendations.push('🔋 Đảm bảo tất cả xe có pin ≥80% trước khi cho thuê');
      generalRecommendations.push('🔧 Kiểm tra định kỳ phanh, đèn, và hệ thống điện mỗi tuần');
      
      // 7. Chiến lược dài hạn
      if (avgUtilization > 0.6) {
        generalRecommendations.push('📈 Hệ thống hoạt động hiệu quả, xem xét mở rộng thêm trạm mới');
      } else if (avgUtilization < 0.3) {
        generalRecommendations.push('🎯 Tập trung cải thiện chất lượng dịch vụ và trải nghiệm khách hàng');
      }

      return {
        totalStations: recommendations.length,
        totalVehiclesNeeded,
        estimatedInvestment: totalVehiclesNeeded * 30000000, // Giá trung bình xe máy điện
        recommendations,
        generalRecommendations,
        overallUtilization: Number((avgUtilization * 100).toFixed(1))
      };
    } catch (error) {
      console.error('Error in getVehicleRecommendations:', error);
      return {
        totalStations: 0,
        totalVehiclesNeeded: 0,
        estimatedInvestment: 0,
        recommendations: [],
        generalRecommendations: ['Không thể phân tích dữ liệu xe máy điện']
      };
    }
  }

  calculateROI(vehiclesNeeded, predictedBookings) {
    // Implementation giữ nguyên
    return 0;
  }
}

module.exports = new AIService();
