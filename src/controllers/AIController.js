const AIService = require('../services/AIService');

class AIController {
  // Hàm tiện ích để dịch trend từ tiếng Anh sang tiếng Việt
  static translateTrend(trend) {
    const translations = {
      'increasing': 'tăng',
      'slightly_increasing': 'tăng nhẹ',
      'stable': 'ổn định',
      'slightly_decreasing': 'giảm nhẹ',
      'decreasing': 'giảm'
    };
    
    return translations[trend] || trend;
  }
  // Dự báo nhu cầu tổng quan
  static async getDemandForecast(req, res) {
    try {
      const { period = '7d', station_id } = req.query;
      
      // Validate period
      const validPeriods = ['7d', '30d', '90d', '1y'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Kỳ dự báo không hợp lệ. Chọn: 7d, 30d, 90d, 1y'
        });
      }

      const forecast = await AIService.getDemandForecast(period, station_id);
      
      res.json({
        success: true,
        message: 'Dự báo nhu cầu thành công',
        data: {
          ...forecast,
          generatedAt: new Date(),
          period,
          stationId: station_id || 'all'
        }
      });
      
    } catch (error) {
      console.error('Error in getDemandForecast:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi dự báo nhu cầu',
        error: error.message
      });
    }
  }

  // Dự báo nhu cầu theo trạm
  static async getStationDemandForecast(req, res) {
    try {
      const { id } = req.params;
      const { period = '7d' } = req.query;
      
      // Validate period
      const validPeriods = ['7d', '30d', '90d'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Kỳ dự báo không hợp lệ. Chọn: 7d, 30d, 90d'
        });
      }

      const forecast = await AIService.getStationDemandForecast(id, period);
      
      res.json({
        success: true,
        message: 'Dự báo nhu cầu trạm thành công',
        data: {
          ...forecast,
          generatedAt: new Date(),
          period
        }
      });
      
    } catch (error) {
      console.error('Error in getStationDemandForecast:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi dự báo nhu cầu trạm',
        error: error.message
      });
    }
  }

  // Gợi ý số lượng xe
  static async getVehicleRecommendations(req, res) {
    try {
      const recommendations = await AIService.getVehicleRecommendations();
      
      res.json({
        success: true,
        message: 'Gợi ý xe máy điện thành công',
        data: {
          totalStations: recommendations?.totalStations || 0,
          totalVehiclesNeeded: recommendations?.totalVehiclesNeeded || 0,
          estimatedInvestment: recommendations?.estimatedInvestment || 0,
          recommendations: Array.isArray(recommendations?.recommendations) ? recommendations.recommendations : [],
          generalRecommendations: Array.isArray(recommendations?.generalRecommendations) ? recommendations.generalRecommendations : [],
          overallUtilization: recommendations?.overallUtilization || 0,
          generatedAt: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error in getVehicleRecommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tạo gợi ý xe',
        error: error.message
      });
    }
  }

  // Phân tích xu hướng
  static async getTrendAnalysis(req, res) {
    try {
      const { period = '90d' } = req.query;
      
      // Validate period
      const validPeriods = ['30d', '90d', '1y'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({
          success: false,
          message: 'Kỳ phân tích không hợp lệ. Chọn: 30d, 90d, 1y'
        });
      }

      const analysis = await AIService.getTrendAnalysis(period);
      
      res.json({
        success: true,
        message: 'Phân tích xu hướng thành công',
        data: {
          ...analysis,
          generatedAt: new Date(),
          period
        }
      });
      
    } catch (error) {
      console.error('Error in getTrendAnalysis:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi phân tích xu hướng',
        error: error.message
      });
    }
  }

  // Dashboard AI tổng hợp
  static async getAIDashboard(req, res) {
    try {
      const { period = '30d' } = req.query;
      
      // Chạy song song các phân tích
      const [demandForecast, trendAnalysis, vehicleRecommendations] = await Promise.all([
        AIService.getDemandForecast('7d'),
        AIService.getTrendAnalysis(period),
        AIService.getVehicleRecommendations()
      ]);
      
      // Tổng hợp kết quả
      const dashboard = {
        overview: {
          totalStations: vehicleRecommendations.totalStations,
          totalVehicles: vehicleRecommendations.recommendations.reduce((sum, rec) => sum + rec.currentVehicles, 0),
          vehiclesNeeded: vehicleRecommendations.totalVehiclesNeeded,
          estimatedInvestment: vehicleRecommendations.estimatedInvestment,
          predictedBookings: demandForecast.totalForecast.predictedBookings,
          confidence: demandForecast.totalForecast.confidence
        },
        demandForecast: {
          period: demandForecast.totalForecast.period,
          predictedBookings: demandForecast.totalForecast.predictedBookings,
          confidence: demandForecast.totalForecast.confidence,
          hourlyTrend: demandForecast.hourlyTrend,
          weeklyTrend: demandForecast.weeklyTrend
        },
        trendAnalysis: {
          overall: AIController.translateTrend(trendAnalysis.trends.overall),
          growthRate: trendAnalysis.trends.growthRate,
          previousGrowthRate: trendAnalysis.trends.previousGrowthRate || 0,
          seasonality: trendAnalysis.trends.seasonality || [],
          cyclical: trendAnalysis.trends.cyclical || 'N/A',
          shortTermForecast: trendAnalysis.forecasts.shortTerm,
          longTermForecast: trendAnalysis.forecasts.longTerm
        },
        vehicleRecommendations: {
          totalNeeded: vehicleRecommendations.totalVehiclesNeeded,
          topPriorities: vehicleRecommendations.recommendations.slice(0, 5),
          estimatedROI: vehicleRecommendations.recommendations.length > 0 
            ? vehicleRecommendations.recommendations.reduce((sum, rec) => sum + rec.estimatedROI, 0) / vehicleRecommendations.recommendations.length
            : 0
        },
        insights: [
          `Xu hướng tổng thể: ${AIController.translateTrend(trendAnalysis.trends.overall)}`,
          `Tăng trưởng: ${trendAnalysis.trends.growthRate}%`,
          `Cần thêm ${vehicleRecommendations.totalVehiclesNeeded} xe`,
          `Độ tin cậy dự báo: ${demandForecast.totalForecast.confidence}%`
        ],
        opportunities: trendAnalysis.opportunities || [],
        challenges: trendAnalysis.challenges || [],
        recommendations: trendAnalysis.recommendations || [],
        factors: demandForecast.factors || [],
        generatedAt: new Date(),
        period
      };
      
      res.json({
        success: true,
        message: 'Dashboard AI thành công',
        data: dashboard
      });
      
    } catch (error) {
      console.error('Error in getAIDashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tạo dashboard AI',
        error: error.message
      });
    }
  }

  // Health check cho AI service
  static async healthCheck(req, res) {
    try {
      if (!AIService.model) {
        return res.json({
          success: true,
          message: 'AI Service is healthy (fallback mode)',
          data: {
            status: 'operational',
            testResponse: 'AI Service is working (fallback without GEMINI_API_KEY)',
            timestamp: new Date(),
            geminiModel: 'fallback'
          }
        });
      }

      // Test basic AI functionality
      const testPrompt = "Hello, this is a test. Please respond with 'AI Service is working'";
      const result = await AIService.model.generateContent(testPrompt);
      const response = await result.response;
      const text = response.text();
      
      res.json({
        success: true,
        message: 'AI Service is healthy',
        data: {
          status: 'operational',
          testResponse: text.trim(),
          timestamp: new Date(),
          geminiModel: 'gemini-2.0-flash'
        }
      });
      
    } catch (error) {
      console.error('Error in AI health check:', error);
      res.status(500).json({
        success: false,
        message: 'AI Service is not responding',
        error: error.message
      });
    }
  }
}

module.exports = AIController;
