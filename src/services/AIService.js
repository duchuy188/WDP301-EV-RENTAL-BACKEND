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

    // FIX: Booking status từ 'completed' thành chỉ 'confirmed'
    const bookingMatchQuery = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'confirmed'  // FIXED: Removed 'completed' 
    };

    if (stationId) {
      bookingMatchQuery.station_id = stationId;
    }

    // Lấy dữ liệu booking theo giờ - FIXED
    const hourlyBookingData = await Booking.aggregate([
      { $match: bookingMatchQuery },
      {
        $lookup: {
          from: 'rentals',
          localField: '_id',
          foreignField: 'booking_id',
          as: 'rentals'
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            dayOfWeek: { $dayOfWeek: '$createdAt' },
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
          localField: '_id',
          foreignField: 'booking_id',
          as: 'rentals'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
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
      rentalMatchQuery.station_id = stationId;
    }

    // Lấy actual rental data với payments
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
        $group: {
          _id: {
            hour: { $hour: '$actual_start_time' },
            dayOfWeek: { $dayOfWeek: '$actual_start_time' },
            station: '$station_id'
          },
          rentalCount: { $sum: 1 },
          totalActualRevenue: { $sum: { $add: ['$total_fees', '$total_fees'] } },
          paymentsCount: { $sum: { $size: '$payments' } },
          averageDuration: { $avg: { $subtract: ['$actual_end_time', '$actual_start_time'] } }
        }
      }
    ]);

    // Lấy thống kê trạm - FIXED
    const stationMatchQuery = stationId ? { _id: stationId } : { status: 'active' };
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
          total_vehicles: { $size: '$vehicles' },
          utilization_rate: {
            $cond: [
              { $eq: ['$current_vehicles', 0] },
              0,
              { $multiply: [{ $divide: ['$rented_vehicles', '$current_vehicles'] }, 100] }
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
        actualRevenue: actualRentalData.reduce((sum, item) => sum + item.totalActualRevenue, 0),
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

Revenue dự kiến: ${(historicalData.summary.expectedRevenue/1000000).toFixed(1)}M VND
Revenue thực tế: ${(historicalData.summary.actualRevenue/1000000).toFixed(1)}M VND

=== DỮ LIỆU CHI TIẾT ===
Bookings theo giờ (24h):
${historicalData.detailedHourlyBookings.map(item => 
  `Giờ ${item._id.hour}h: ${item.bookingsCount} bookings, ${item.completedRentals} completed`
).join('\n')}

Bookings theo ngày (7 ngày gần nhất):
${historicalData.detailedDailyBookings.slice(-7).map(item => 
  `Ngày ${item._id.date}: ${item.bookingsCount} bookings, ${item.completedRentals} completed`
).join('\n')}

=== RENTALS THỰC TẾ ===
Actual rentals với payments:
${historicalData.actualRentalData.map(item => 
  `Giờ ${item._id.hour}h: ${item.rentalCount} rentals hoàn thành, avg duration: ${Math.round(item.averageDuration/3600000)}h`
).join('\n')}

=== TRẠM ===
Thống kê trạm:
${historicalData.stationStats.map(station => 
  `Trạm ${station.name}: ${station.total_vehicles} xe, ${station.utilization_rate.toFixed(1)}% utilization, recent: ${station.recentRentals || 0} rentals`
).join('\n')}

=== THỜI TIẾT TP.HCM ===
Hiện tại: ${JSON.stringify(historicalData.weatherData)}
Dự báo 3 ngày: ${JSON.stringify(historicalData.weatherForecast.slice(0, 3))}

Hãy phân tích:
1. XU HƯỚNG THEO GIỜ: Peak hours nào có demand cao nhất?
2. XU HƯỚNG THEO NGÀY: Ngày nào trong tuần có booking nhiều nhất?
3. DỰ BÁO SỐNG LƯỢNG: Dự báo chính xác bookings và rentals cho ${period} tới
4. TÁC ĐỘNG THỜI TIẾT: Mưa/nắng ảnh hưởng đến booking như thế nào?
5. ĐỘ TIN CẬY: Confidence level của dự báo (%)

QUAN TRỌNG:
- Dùng SỐ LIỆU THỰC TẾ từ bảng trên
- Revenue = actual payments chứ KHÔNG phải booking price  
- Booking có thể bị cancel, chỉ rentals là chắc chắn
- Confidence dựa trên variance của data lịch sử

Trả về JSON bằng tiếng Việt:
{
  "hourlyTrend": [{"hour": 0-23, "demand": "thấp/trung bình/cao", "forecast": number, "confidence": number}],
  "weeklyTrend": [{"day": "Thứ 2-Chủ nhật", "demand": "thấp/trung bình/cao", "forecast": number}],
  "totalForecast": {"period": "${period}", "predictedBookings": number, "predictedRentals": number, "confidence": number},
  "revenueForecast": {"expectedRevenue": number, "actualRevenue": number},
  "weatherImpact": {"current": "text tiếng Việt", "forecast": "text tiếng Việt"},
  "factors": ["yếu tố quan trọng bằng tiếng Việt"],
  "recommendations": ["gợi ý cụ thể bằng tiếng Việt"]
}
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

    return {
      trends,
      factors,
      forecasts,
      opportunities,
      challenges,
      recommendations
    };
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
      economic: 'stable'
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

    return factors;
  }

  // Tạo insights dựa trên phân tích
  generateInsights(trends, factors, historicalData) {
    const opportunities = [];
    const challenges = [];
    const recommendations = [];

    // Opportunities
    if (trends.overall.includes('increasing')) {
      opportunities.push('Xu hướng tăng trưởng tích cực');
      recommendations.push('Xem xét mở rộng dịch vụ');
    }

    if (trends.seasonality.length > 0) {
      opportunities.push('Có patterns theo thời gian có thể tận dụng');
      recommendations.push('Tối ưu hóa pricing theo thời điểm');
    }

    if (factors.weather === 'favorable') {
      opportunities.push('Thời tiết thuận lợi cho thuê xe');
    }

    // Challenges
    if (trends.overall.includes('decreasing')) {
      challenges.push('Xu hướng giảm cần theo dõi');
      recommendations.push('Cải thiện dịch vụ và marketing');
    }

    if (factors.weather === 'adverse') {
      challenges.push('Thời tiết bất lợi ảnh hưởng đến nhu cầu');
      recommendations.push('Chuẩn bị kế hoạch dự phòng');
    }

    if (trends.cyclical.includes('Biến động cao')) {
      challenges.push('Biến động cao khó dự đoán');
      recommendations.push('Tăng cường monitoring và phân tích');
    }

    // Recommendations chung
    if (trends.growthRate === 0) {
      recommendations.push('Cần chiến lược tăng trưởng mới');
    }

    if (historicalData.summary.conversionRate < 70) {
      recommendations.push('Cải thiện tỷ lệ chuyển đổi booking thành rental');
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
        
        // Lấy số xe đang được thuê
        const rentedVehicles = vehicles.filter(v => v.status === 'rented').length;
        totalRentedVehicles += rentedVehicles;
        totalAvailableVehicles += currentVehicles;
        
        // Phân tích theo loại xe máy điện
        const vehicleTypes = {};
        vehicles.forEach(v => {
          if (!vehicleTypes[v.type]) vehicleTypes[v.type] = { total: 0, rented: 0 };
          vehicleTypes[v.type].total++;
          if (v.status === 'rented') vehicleTypes[v.type].rented++;
        });
        
        // Tính toán utilization và nhu cầu
        const currentUtil = currentVehicles > 0 ? rentedVehicles / currentVehicles : 0;
        totalUtilization += currentUtil;
        
        if (currentUtil > 0.7) stationsWithHighUtilization++;
        if (currentUtil < 0.3 && currentVehicles > 0) stationsWithLowUtilization++;
        
        const vehiclesNeeded = currentUtil >= targetUtilization ? 0 : Math.max(0, Math.ceil((rentedVehicles / targetUtilization) - currentVehicles));
        const estimatedROI = currentVehicles > 0 ? Number(((currentUtil / targetUtilization) * 100).toFixed(1)) : 0;

        // Gợi ý cụ thể cho trạm
        const stationRecommendations = [];
        
        if (vehiclesNeeded > 0) {
          stationRecommendations.push(`Cần bổ sung ${vehiclesNeeded} xe máy điện`);
        } else if (currentUtil > 0.9) {
          stationRecommendations.push('Tỷ lệ sử dụng rất cao, cần chuẩn bị thêm xe dự phòng');
        } else if (currentUtil < 0.2 && currentVehicles > 3) {
          stationRecommendations.push('Cân nhắc giảm số lượng xe tại trạm này');
        }
        
        // Gợi ý theo loại xe
        const typeRecommendations = Object.entries(vehicleTypes).map(([type, data]) => {
          const typeUtil = data.total > 0 ? data.rented / data.total : 0;
          if (typeUtil > 0.9) return `Loại xe ${type} có nhu cầu cao`;
          if (typeUtil < 0.1 && data.total > 2) return `Loại xe ${type} ít được thuê`;
          return null;
        }).filter(Boolean);
        
        if (typeRecommendations.length > 0) {
          stationRecommendations.push(...typeRecommendations);
        }

        return {
          stationId: station._id,
          stationName: station.name,
          currentVehicles,
          rentedVehicles,
          utilization: Number((currentUtil * 100).toFixed(1)),
          vehiclesNeeded,
          estimatedROI,
          priority: vehiclesNeeded > 0 ? 'cao' : 'thấp',
          timing: vehiclesNeeded > 0 ? 'ngay lập tức' : '1 tháng',
          vehicleTypes: Object.entries(vehicleTypes).map(([type, data]) => ({
            type,
            total: data.total,
            rented: data.rented,
            utilization: data.total > 0 ? Number((data.rented / data.total * 100).toFixed(1)) : 0
          })),
          recommendations: stationRecommendations
        };
      }));

      // Tính tổng số xe cần thêm
      const totalVehiclesNeeded = recommendations.reduce((sum, r) => sum + r.vehiclesNeeded, 0);
      const avgUtilization = stations.length > 0 ? totalUtilization / stations.length : 0;
      
      // Gợi ý chung cho toàn hệ thống
      const generalRecommendations = [];
      
      if (totalVehiclesNeeded > 0) {
        generalRecommendations.push(`Cần bổ sung tổng cộng ${totalVehiclesNeeded} xe máy điện cho ${stationsWithHighUtilization} trạm có nhu cầu cao`);
      } else if (totalRentedVehicles === 0 && totalAvailableVehicles > 0) {
        generalRecommendations.push('Tăng cường marketing để thu hút khách thuê xe máy điện');
      } else if (avgUtilization < 0.3 && totalAvailableVehicles > 10) {
        generalRecommendations.push('Cân nhắc giảm số lượng xe tại các trạm có tỷ lệ sử dụng thấp');
      } else if (stationsWithLowUtilization > 1) {
        generalRecommendations.push(`Có ${stationsWithLowUtilization} trạm có tỷ lệ sử dụng thấp, cân nhắc điều chuyển xe`);
      }
      
      if (stationsWithHighUtilization > 0) {
        generalRecommendations.push(`Có ${stationsWithHighUtilization} trạm có tỷ lệ sử dụng cao, cần theo dõi chặt chẽ`);
      }
      
      // Thêm gợi ý về bảo dưỡng xe máy điện
      generalRecommendations.push('Đảm bảo pin xe máy điện được sạc đầy trước khi cho thuê');
      
      if (totalAvailableVehicles > 0) {
        generalRecommendations.push('Kiểm tra định kỳ phanh và hệ thống điện của xe máy điện');
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
