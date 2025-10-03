const { GoogleGenerativeAI } = require('@google/generative-ai');
const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Station = require('../models/Station');
const Vehicle = require('../models/Vehicle');
const { formatVietnamTime } = require('../config/timezone');
const ExternalAPIs = require('../config/externalAPIs');

class AIService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  // Thu thập dữ liệu lịch sử booking
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

    const matchQuery = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['confirmed', 'completed'] }
    };

    if (stationId) {
      matchQuery.station_id = stationId;
    }

    // Lấy dữ liệu booking theo giờ
    const hourlyData = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' },
            dayOfWeek: { $dayOfWeek: '$createdAt' },
            station: '$station_id'
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total_price' }
        }
      },
      { $sort: { '_id.hour': 1, '_id.dayOfWeek': 1 } }
    ]);

    // Lấy dữ liệu booking theo ngày
    const dailyData = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            station: '$station_id'
          },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total_price' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Lấy thống kê trạm
    const stationStats = await Station.aggregate([
      { $match: stationId ? { _id: stationId } : {} },
      {
        $lookup: {
          from: 'vehicles',
          localField: '_id',
          foreignField: 'station_id',
          as: 'vehicles'
        }
      },
      {
        $project: {
          name: 1,
          current_vehicles: 1,
          available_vehicles: 1,
          rented_vehicles: 1,
          utilization_rate: {
            $cond: [
              { $eq: ['$current_vehicles', 0] },
              0,
              { $multiply: [{ $divide: ['$rented_vehicles', '$current_vehicles'] }, 100] }
            ]
          }
        }
      }
    ]);

    // Thêm dữ liệu thời tiết và sự kiện
    const externalData = await ExternalAPIs.getAllExternalData();

    return {
      hourlyData,
      dailyData,
      stationStats,
      weatherData: externalData.weather,
      eventData: externalData.events,
      calendarData: externalData.calendar,
      weatherForecast: externalData.forecast,
      period,
      dateRange: { start: startDate, end: endDate }
    };
  }

  // Dự báo nhu cầu tổng quan
  async getDemandForecast(period = '7d', stationId = null) {
    try {
      const historicalData = await this.getHistoricalData('90d', stationId);
      
      const prompt = `
Bạn là chuyên gia phân tích dữ liệu cho hệ thống thuê xe điện tại Việt Nam. Hãy phân tích dữ liệu lịch sử và đưa ra dự báo nhu cầu cho ${period} tới.

Dữ liệu lịch sử (90 ngày gần nhất):
- Dữ liệu theo giờ: ${JSON.stringify(historicalData.hourlyData.slice(0, 20))}
- Dữ liệu theo ngày: ${JSON.stringify(historicalData.dailyData.slice(0, 30))}
- Thống kê trạm: ${JSON.stringify(historicalData.stationStats)}

Dữ liệu thời tiết hiện tại tại TP.HCM:
- Thời tiết: ${JSON.stringify(historicalData.weatherData)}
- Dự báo thời tiết: ${JSON.stringify(historicalData.weatherForecast.slice(0, 3))}

Sự kiện địa phương:
- Sự kiện Eventbrite: ${JSON.stringify(historicalData.eventData.slice(0, 5))}
- Sự kiện Calendar: ${JSON.stringify(historicalData.calendarData.slice(0, 5))}

Yêu cầu phân tích:
1. Xu hướng nhu cầu theo giờ trong ngày (0-23h)
2. Xu hướng nhu cầu theo ngày trong tuần (Thứ 2 - Chủ nhật)
3. Dự báo số lượng booking cho ${period} tới
4. Tác động của thời tiết TP.HCM (mưa, nắng, gió) đến nhu cầu thuê xe
5. Độ tin cậy của dự báo (%)

Lưu ý đặc biệt:
- Thời tiết mưa ở TP.HCM thường tăng nhu cầu thuê xe điện
- Giờ cao điểm thường là 7-9h sáng và 17-19h chiều
- Cuối tuần (Thứ 7, Chủ nhật) thường có nhu cầu cao hơn
- Mùa mưa (tháng 5-11) có thể ảnh hưởng đến nhu cầu

QUAN TRỌNG: Tất cả recommendations phải được viết bằng tiếng Việt.

Trả về kết quả dưới dạng JSON với cấu trúc:
{
  "hourlyTrend": [{"hour": 0-23, "demand": "low/medium/high", "forecast": number}],
  "weeklyTrend": [{"day": "Mon-Sun", "demand": "low/medium/high", "forecast": number}],
  "totalForecast": {"period": "${period}", "predictedBookings": number, "confidence": number},
  "weatherImpact": {"current": "mô tả tác động thời tiết hiện tại", "forecast": "mô tả tác động dự báo thời tiết"},
  "eventImpact": [{"event": "name", "impact": "low/medium/high", "date": "date"}],
  "factors": ["yếu tố 1", "yếu tố 2", ...],
  "recommendations": ["gợi ý 1", "gợi ý 2", ...]
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON từ response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback nếu không parse được JSON
      return {
        hourlyTrend: [],
        weeklyTrend: [],
        totalForecast: { period, predictedBookings: 0, confidence: 0 },
        weatherImpact: { current: 'Không có dữ liệu thời tiết', forecast: 'Không có dự báo' },
        eventImpact: [],
        factors: [],
        recommendations: ['Không thể phân tích dữ liệu']
      };
      
    } catch (error) {
      console.error('Error in demand forecast:', error);
      throw new Error('Lỗi khi dự báo nhu cầu: ' + error.message);
    }
  }

  // Dự báo nhu cầu theo trạm cụ thể
  async getStationDemandForecast(stationId, period = '7d') {
    try {
      const station = await Station.findById(stationId);
      if (!station) {
        throw new Error('Trạm không tồn tại');
      }

      const historicalData = await this.getHistoricalData('90d', stationId);
      
      const prompt = `
Phân tích dự báo nhu cầu cho trạm "${station.name}" (${station.address}) tại TP.HCM.

Thông tin trạm:
- Tổng xe: ${station.current_vehicles}
- Xe available: ${station.available_vehicles}
- Xe đang thuê: ${station.rented_vehicles}
- Tỷ lệ sử dụng: ${((station.rented_vehicles / station.current_vehicles) * 100).toFixed(1)}%

Dữ liệu lịch sử 90 ngày:
${JSON.stringify(historicalData.dailyData.slice(0, 30))}

Dữ liệu thời tiết TP.HCM:
- Thời tiết hiện tại: ${JSON.stringify(historicalData.weatherData)}
- Dự báo thời tiết: ${JSON.stringify(historicalData.weatherForecast.slice(0, 3))}

Hãy đưa ra:
1. Dự báo nhu cầu cho ${period} tới
2. Đánh giá khả năng đáp ứng của trạm hiện tại
3. Gợi ý số lượng xe cần thiết
4. Thời điểm peak demand
5. Chiến lược tối ưu

Lưu ý đặc biệt cho TP.HCM:
- Thời tiết mưa thường tăng nhu cầu thuê xe
- Giờ cao điểm: 7-9h sáng, 17-19h chiều
- Cuối tuần có nhu cầu cao hơn
- Mùa mưa (tháng 5-11) cần chuẩn bị thêm xe

QUAN TRỌNG: Tất cả strategies phải được viết bằng tiếng Việt.

Trả về JSON:
{
  "stationInfo": {"name": "${station.name}", "currentVehicles": ${station.current_vehicles}},
  "forecast": {"period": "${period}", "predictedBookings": number, "confidence": number},
  "capacityAnalysis": {"currentUtilization": number, "peakDemand": number, "shortage": number},
  "recommendations": {
    "vehiclesNeeded": number,
    "optimalCapacity": number,
    "timing": "immediate/1month/3months"
  },
  "peakHours": [{"hour": number, "demand": number}],
  "strategies": ["chiến lược 1", "chiến lược 2", ...]
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        stationInfo: { name: station.name, currentVehicles: station.current_vehicles },
        forecast: { period, predictedBookings: 0, confidence: 0 },
        capacityAnalysis: { currentUtilization: 0, peakDemand: 0, shortage: 0 },
        recommendations: { vehiclesNeeded: 0, optimalCapacity: 0, timing: 'immediate' },
        peakHours: [],
        strategies: ['Không thể phân tích']
      };
      
    } catch (error) {
      console.error('Error in station demand forecast:', error);
      throw new Error('Lỗi khi dự báo nhu cầu trạm: ' + error.message);
    }
  }

  // Gợi ý số lượng xe cho từng trạm
  async getVehicleRecommendations() {
    try {
      const stations = await Station.find({ status: 'active' });
      const recommendations = [];

      for (const station of stations) {
        const forecast = await this.getStationDemandForecast(station._id, '30d');
        
        // Tạo gợi ý text dựa trên dữ liệu
        const recommendationText = this.generateRecommendationText(
          station.name,
          station.current_vehicles,
          forecast.forecast.predictedBookings,
          forecast.recommendations.vehiclesNeeded,
          forecast.recommendations.optimalCapacity,
          forecast.recommendations.timing
        );

        recommendations.push({
          stationId: station._id,
          stationName: station.name,
          currentVehicles: station.current_vehicles,
          predictedDemand: forecast.forecast.predictedBookings,
          vehiclesNeeded: forecast.recommendations.vehiclesNeeded,
          optimalCapacity: forecast.recommendations.optimalCapacity,
          priority: forecast.recommendations.vehiclesNeeded > 5 ? 'high' : 
                   forecast.recommendations.vehiclesNeeded > 2 ? 'medium' : 'low',
          estimatedROI: this.calculateROI(forecast.recommendations.vehiclesNeeded, forecast.forecast.predictedBookings),
          timing: forecast.recommendations.timing,
          recommendationText: recommendationText
        });
      }

      // Sắp xếp theo priority và vehiclesNeeded
      recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.vehiclesNeeded - a.vehiclesNeeded;
      });

      // Tạo gợi ý tổng quan
      const totalVehiclesNeeded = recommendations.reduce((sum, rec) => sum + rec.vehiclesNeeded, 0);
      const estimatedInvestment = recommendations.reduce((sum, rec) => sum + (rec.vehiclesNeeded * 50000000), 0);
      const overallRecommendation = this.generateOverallRecommendation(totalVehiclesNeeded, estimatedInvestment, recommendations);

      return {
        totalStations: stations.length,
        totalVehiclesNeeded,
        estimatedInvestment,
        overallRecommendation,
        recommendations
      };
      
    } catch (error) {
      console.error('Error in vehicle recommendations:', error);
      throw new Error('Lỗi khi tạo gợi ý xe: ' + error.message);
    }
  }

  // Phân tích xu hướng
  async getTrendAnalysis(period = '90d') {
    try {
      const historicalData = await this.getHistoricalData(period);
      
      const prompt = `
Phân tích xu hướng nhu cầu thuê xe điện tại TP.HCM dựa trên dữ liệu ${period}:

Dữ liệu theo ngày: ${JSON.stringify(historicalData.dailyData)}
Dữ liệu theo giờ: ${JSON.stringify(historicalData.hourlyData.slice(0, 20))}

Dữ liệu thời tiết TP.HCM:
- Thời tiết hiện tại: ${JSON.stringify(historicalData.weatherData)}
- Dự báo thời tiết: ${JSON.stringify(historicalData.weatherForecast.slice(0, 3))}

Hãy phân tích:
1. Xu hướng tăng/giảm theo thời gian
2. Mùa vụ và chu kỳ (mùa mưa, mùa khô)
3. Yếu tố ảnh hưởng (thời tiết, sự kiện, kinh tế)
4. Dự báo ngắn hạn và dài hạn
5. Cơ hội và thách thức

Lưu ý đặc biệt cho TP.HCM:
- Mùa mưa (tháng 5-11): nhu cầu thuê xe tăng do tránh mưa
- Mùa khô (tháng 12-4): nhu cầu ổn định
- Giờ cao điểm: 7-9h sáng, 17-19h chiều
- Cuối tuần: nhu cầu giải trí cao
- Lễ hội, sự kiện: tăng nhu cầu đột biến

QUAN TRỌNG: Tất cả opportunities, challenges và recommendations phải được viết bằng tiếng Việt.

Trả về JSON:
{
  "trends": {
    "overall": "increasing/decreasing/stable",
    "growthRate": number,
    "seasonality": ["yếu tố mùa vụ 1", "yếu tố mùa vụ 2"],
    "cyclical": "mô tả chu kỳ"
  },
  "factors": {
    "weather": "mức độ ảnh hưởng",
    "events": "mức độ ảnh hưởng", 
    "economic": "mức độ ảnh hưởng"
  },
  "forecasts": {
    "shortTerm": {"period": "1month", "trend": "up/down/stable", "confidence": number},
    "longTerm": {"period": "6months", "trend": "up/down/stable", "confidence": number}
  },
  "opportunities": ["cơ hội 1", "cơ hội 2"],
  "challenges": ["thách thức 1", "thách thức 2"],
  "recommendations": ["gợi ý 1", "gợi ý 2"]
}
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        trends: { overall: 'stable', growthRate: 0, seasonality: [], cyclical: 'Không có dữ liệu' },
        factors: { weather: 'unknown', events: 'unknown', economic: 'unknown' },
        forecasts: { shortTerm: { period: '1month', trend: 'stable', confidence: 0 }, longTerm: { period: '6months', trend: 'stable', confidence: 0 } },
        opportunities: [],
        challenges: [],
        recommendations: ['Cần thêm dữ liệu để phân tích']
      };
      
    } catch (error) {
      console.error('Error in trend analysis:', error);
      throw new Error('Lỗi khi phân tích xu hướng: ' + error.message);
    }
  }

  // Tính ROI ước tính
  calculateROI(vehiclesNeeded, predictedBookings) {
    if (vehiclesNeeded === 0) return 0;
    
    const vehicleCost = 50000000; // 50M VND per vehicle
    const avgRevenuePerBooking = 200000; // 200k VND per booking
    const monthlyRevenue = predictedBookings * avgRevenuePerBooking;
    const investment = vehiclesNeeded * vehicleCost;
    
    if (investment === 0) return 0;
    
    const monthlyROI = (monthlyRevenue / investment) * 100;
    return Math.round(monthlyROI * 100) / 100;
  }

  // Tạo gợi ý text dễ hiểu
  generateRecommendationText(stationName, currentVehicles, predictedDemand, vehiclesNeeded, optimalCapacity, timing) {
    if (vehiclesNeeded === 0) {
      return `Trạm ${stationName} hiện có ${currentVehicles} xe, đủ đáp ứng nhu cầu dự báo ${predictedDemand} lượt thuê/tháng. Không cần thêm xe tại thời điểm này.`;
    }
    
    if (currentVehicles === 0) {
      return `Trạm ${stationName} chưa có xe nào. Cần thêm ${vehiclesNeeded} xe để bắt đầu hoạt động và đáp ứng nhu cầu dự báo ${predictedDemand} lượt thuê/tháng.`;
    }
    
    if (vehiclesNeeded <= 2) {
      return `Trạm ${stationName} hiện có ${currentVehicles} xe, cần thêm ${vehiclesNeeded} xe để tối ưu hóa dịch vụ. Dự báo nhu cầu ${predictedDemand} lượt thuê/tháng.`;
    }
    
    if (vehiclesNeeded <= 5) {
      return `Trạm ${stationName} cần mở rộng thêm ${vehiclesNeeded} xe để đáp ứng nhu cầu tăng cao. Hiện có ${currentVehicles} xe, dự báo cần ${predictedDemand} lượt thuê/tháng.`;
    }
    
    return `Trạm ${stationName} cần đầu tư lớn: thêm ${vehiclesNeeded} xe để đáp ứng nhu cầu ${predictedDemand} lượt thuê/tháng. Hiện chỉ có ${currentVehicles} xe, cần mở rộng gấp để không bỏ lỡ cơ hội kinh doanh.`;
  }

  // Tạo gợi ý tổng quan
  generateOverallRecommendation(totalVehiclesNeeded, estimatedInvestment, recommendations) {
    if (totalVehiclesNeeded === 0) {
      return "Hệ thống hiện tại đã tối ưu. Tất cả trạm đều có đủ xe để đáp ứng nhu cầu dự báo. Không cần đầu tư thêm xe tại thời điểm này.";
    }
    
    const highPriorityStations = recommendations.filter(r => r.priority === 'high').length;
    const mediumPriorityStations = recommendations.filter(r => r.priority === 'medium').length;
    const investmentInBillions = (estimatedInvestment / 1000000000).toFixed(1);
    
    if (highPriorityStations > 0) {
      return `Cần đầu tư khẩn cấp ${investmentInBillions} tỷ VND để thêm ${totalVehiclesNeeded} xe. Có ${highPriorityStations} trạm ưu tiên cao cần mở rộng ngay để không bỏ lỡ cơ hội kinh doanh.`;
    }
    
    if (mediumPriorityStations > 0) {
      return `Nên đầu tư ${investmentInBillions} tỷ VND để thêm ${totalVehiclesNeeded} xe. Có ${mediumPriorityStations} trạm cần mở rộng để tối ưu hóa dịch vụ và tăng doanh thu.`;
    }
    
    return `Có thể đầu tư ${investmentInBillions} tỷ VND để thêm ${totalVehiclesNeeded} xe. Đây là khoản đầu tư nhỏ để cải thiện dịch vụ và chuẩn bị cho nhu cầu tăng trưởng trong tương lai.`;
  }
}

module.exports = new AIService();
