const { Vehicle, Station } = require('../../../models');

class BookingExtractor {
  /**
   * Extract booking information từ user message
   */
  async extractBookingInfo(message, userId) {
    const messageLower = message.toLowerCase();
    
    // Extract dates
    const dates = this.extractDates(messageLower);
    
    // Extract vehicle info (model, color)
    const vehicleInfo = this.extractVehicleInfo(messageLower);
    
    // Extract station
    const stationInfo = await this.extractStationInfo(messageLower);
    
    return {
      userId,
      dates,
      vehicleInfo,
      stationInfo,
      rawMessage: message
    };
  }
  
  /**
   * Extract dates từ message
   * Ví dụ: "từ 20-22/11", "20/11 đến 22/11", "3 ngày"
   */
  extractDates(message) {
    const result = {
      startDate: null,
      endDate: null,
      duration: null
    };
    
   
    
    // Pattern 1: "20/11 - 22/11" hoặc "20/11 đến 22/11"
    const fromToPattern = /(\d{1,2})\/(\d{1,2})\s*(?:-|đến|tới|to)\s*(\d{1,2})\/(\d{1,2})/;
    const fromToMatch = message.match(fromToPattern);
    if (fromToMatch) {
      const [_, startDay, startMonth, endDay, endMonth] = fromToMatch;
      const year = new Date().getFullYear();
      result.startDate = new Date(year, parseInt(startMonth) - 1, parseInt(startDay));
      result.endDate = new Date(year, parseInt(endMonth) - 1, parseInt(endDay));
      
      // Extract pickup time nếu có
      const pickupTime = this.extractPickupTime(message);
      if (pickupTime) {
        result.startDate.setHours(pickupTime.hour, pickupTime.minute, 0, 0);
      }
      
      return result;
    }
    
    // Pattern 2: "từ 20-22/11" hoặc "20-22/11" (cùng tháng)
    const rangePattern = /(\d{1,2})-(\d{1,2})\/(\d{1,2})/;
    const rangeMatch = message.match(rangePattern);
    if (rangeMatch) {
      const [_, startDay, endDay, month] = rangeMatch;
      const year = new Date().getFullYear();
      result.startDate = new Date(year, parseInt(month) - 1, parseInt(startDay));
      result.endDate = new Date(year, parseInt(month) - 1, parseInt(endDay));
      
      // Extract pickup time nếu có
      const pickupTime = this.extractPickupTime(message);
      if (pickupTime) {
        result.startDate.setHours(pickupTime.hour, pickupTime.minute, 0, 0);
      }
      
      return result;
    }
    
    // Pattern 3: "3 ngày", "5 ngày" (duration only, no specific dates)
    // ⚠️ Check LAST vì "ngày 20/11" cũng có từ "ngày"
    const durationPattern = /(\d+)\s*ngày(?!\s*\d)/; // Negative lookahead: không theo sau bởi số
    const durationMatch = message.match(durationPattern);
    if (durationMatch) {
      result.duration = parseInt(durationMatch[1]);
      result.startDate = new Date();
      result.startDate.setHours(0, 0, 0, 0);
      result.endDate = new Date(result.startDate);
      result.endDate.setDate(result.endDate.getDate() + result.duration);
      
      // Extract pickup time nếu có
      const pickupTime = this.extractPickupTime(message);
      if (pickupTime) {
        result.startDate.setHours(pickupTime.hour, pickupTime.minute, 0, 0);
      }
      
      return result;
    }
    
    return result;
  }
  
  /**
   * Extract pickup time from message
   * Ví dụ: "nhận xe lúc 10h sáng", "lúc 14h", "8:30"
   */
  extractPickupTime(message) {
    // Pattern 1: "10h sáng", "2h chiều", "8h tối"
    const timeWithPeriod = message.match(/(\d{1,2})h?\s*(sáng|chiều|tối)/i);
    if (timeWithPeriod) {
      let hour = parseInt(timeWithPeriod[1]);
      const period = timeWithPeriod[2].toLowerCase();
      
      // Convert to 24h format
      if (period === 'chiều' && hour < 12) hour += 12;
      if (period === 'tối' && hour < 12) hour += 12;
      
      return { hour, minute: 0 };
    }
    
    // Pattern 2: "10:30", "14:00"
    const timePattern = message.match(/(\d{1,2}):(\d{2})/);
    if (timePattern) {
      return {
        hour: parseInt(timePattern[1]),
        minute: parseInt(timePattern[2])
      };
    }
    
    // Pattern 3: "10h", "14h"
    const hourOnly = message.match(/(\d{1,2})h/);
    if (hourOnly) {
      return {
        hour: parseInt(hourOnly[1]),
        minute: 0
      };
    }
    
    return null;
  }
  
  /**
   * Extract vehicle info (model, color)
   */
  extractVehicleInfo(message) {
    const result = {
      model: null,
      color: null,
      type: null
    };
    
    // Extract model
    const models = ['klara', 'feliz', 'impes', 'theon', 'vento'];
    for (const model of models) {
      if (message.includes(model)) {
        result.model = model.charAt(0).toUpperCase() + model.slice(1) + ' S';
        break;
      }
    }
    
    // Extract color
    const colorMap = {
      'đỏ': 'Đỏ',
      'do': 'Đỏ',
      'trắng': 'Trắng',
      'trang': 'Trắng',
      'xanh': 'Xanh',
      'đen': 'Đen',
      'den': 'Đen',
      'vàng': 'Vàng',
      'vang': 'Vàng',
      'hồng': 'Hồng',
      'hong': 'Hồng',
      'xám': 'Xám',
      'xam': 'Xám',
      'cam': 'Cam'
    };
    
    for (const [key, value] of Object.entries(colorMap)) {
      if (message.includes(key)) {
        result.color = value;
        break;
      }
    }
    
    // Extract type
    if (message.includes('scooter') || message.includes('xe ga')) {
      result.type = 'scooter';
    } else if (message.includes('motorcycle') || message.includes('xe số')) {
      result.type = 'motorcycle';
    }
    
    return result;
  }
  
  /**
   * Extract station info
   */
  async extractStationInfo(message) {
    // Tìm tên trạm trong message
    try {
      // Lấy danh sách trạm
      const stations = await Station.find({ status: 'active' })
        .select('name address code');
      
      // Tìm trạm match với message
      for (const station of stations) {
        const stationNameLower = station.name.toLowerCase();
        if (message.includes(stationNameLower)) {
          return {
            stationId: station._id,
            stationName: station.name,
            stationAddress: station.address
          };
        }
      }
    } catch (error) {
      console.error('Error extracting station info:', error);
    }
    
    return null;
  }
  
  /**
   * Find matching vehicles dựa trên extracted info
   * Lọc bỏ xe bị trùng lịch nếu có startDate và endDate
   */
  async findMatchingVehicles(vehicleInfo, stationId, startDate = null, endDate = null) {
    const query = {
      status: 'available',
      is_active: true
    };
    
    if (stationId) {
      query.station_id = stationId;
    }
    
    if (vehicleInfo.model) {
      query.model = new RegExp(vehicleInfo.model, 'i');
    }
    
    if (vehicleInfo.color) {
      query.color = new RegExp(vehicleInfo.color, 'i');
    }
    
    if (vehicleInfo.type) {
      query.type = vehicleInfo.type;
    }
    
    let vehicles = await Vehicle.find(query)
      .populate('station_id', 'name address');
    
    // Nếu có thời gian, filter ra xe bị conflict
    if (startDate && endDate && vehicles.length > 0) {
      const { Booking } = require('../../../models');
      const vehicleIds = vehicles.map(v => v._id);
      
      // Tìm booking bị conflict
      const conflictingBookings = await Booking.find({
        vehicle_id: { $in: vehicleIds },
        status: { $in: ['pending', 'confirmed'] },
        $or: [
          {
            start_date: { $lte: startDate },
            end_date: { $gt: startDate }
          },
          {
            start_date: { $lt: endDate },
            end_date: { $gte: endDate }
          },
          {
            start_date: { $gte: startDate },
            end_date: { $lte: endDate }
          }
        ]
      });
      
      const conflictingVehicleIds = conflictingBookings.map(b => b.vehicle_id.toString());
      
      // Filter ra xe không bị conflict
      vehicles = vehicles.filter(v => !conflictingVehicleIds.includes(v._id.toString()));
    }
    
    return vehicles;
  }
}

module.exports = new BookingExtractor();

