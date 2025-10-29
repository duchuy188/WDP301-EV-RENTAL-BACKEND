const { Vehicle, Station } = require('../../../models');
const { nowVietnam } = require('../../../config/timezone');

class BookingExtractor {
  /**
   * Normalize text - Bỏ dấu tiếng Việt để dễ so sánh
   */
  normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }
  
  /**
   * Extract booking information từ user message
   */
  async extractBookingInfo(message, userId) {
    const messageLower = message.toLowerCase();
    
    // Extract dates
    const dates = this.extractDates(messageLower);
    
   
    const vehicleInfo = await this.extractVehicleInfo(messageLower);
    
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
      const year = nowVietnam().year(); 
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
      const year = nowVietnam().year(); //  Năm theo timezone VN
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
      result.startDate = nowVietnam().startOf('day').toDate(); 
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
   * Hỗ trợ cả có dấu và không dấu
   * ⚠️ TỰ ĐỘNG LẤY MODEL TỪ DB - Hỗ trợ model mới mà không cần sửa code
   */
  async extractVehicleInfo(message) {
    const result = {
      model: null,
      color: null,
      type: null
    };
    
    const normalized = this.normalizeText(message);
    
    // Extract model - LẤY TỪ DB thay vì hardcode
    try {
      // Lấy tất cả model duy nhất từ DB
      const modelsFromDB = await Vehicle.distinct('model');
      
      // Tìm model trong message
      for (const modelFromDB of modelsFromDB) {
        // Normalize model từ DB để so sánh (bỏ dấu, lowercase)
        // ⚠️ CHỈ BỎ " S" (có khoảng trắng), KHÔNG BỎ "s" cuối (ví dụ: "Impes")
        const modelNormalized = this.normalizeText(modelFromDB).replace(/\s+s$/i, ''); // Bỏ " S" (có space) cuối nếu có
        
        if (normalized.includes(modelNormalized)) {
          // Lấy phần tên gốc (bỏ " S" có space nếu có) để RegExp match linh hoạt
          result.model = modelFromDB.replace(/\s+S$/i, '').trim();
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching models from DB:', error);
      // Fallback về hardcode nếu DB lỗi
      const modelsFallback = ['klara', 'feliz', 'impes', 'theon', 'vento'];
      for (const model of modelsFallback) {
        if (normalized.includes(model)) {
          result.model = model.charAt(0).toUpperCase() + model.slice(1);
          break;
        }
      }
    }
    
    // Extract color - LẤY TỪ DB để tự động hỗ trợ màu mới
    try {
      // Lấy tất cả màu duy nhất từ DB
      const colorsFromDB = await Vehicle.distinct('color');
      
      // Tìm color trong message (có dấu trước)
      for (const colorFromDB of colorsFromDB) {
        if (!colorFromDB) continue;
        
        const colorLower = colorFromDB.toLowerCase();
        const colorNormalized = this.normalizeText(colorFromDB);
        
        // Match với message gốc (có dấu) hoặc normalized (không dấu)
        if (message.includes(colorLower) || normalized.includes(colorNormalized)) {
          result.color = colorFromDB; // Giữ nguyên format từ DB
          break;
        }
      }
    } catch (error) {
      console.error('Error fetching colors from DB:', error);
      // Fallback về colorMap hardcode nếu DB lỗi
      const colorMapFallback = {
        'đỏ': 'Đỏ', 'trắng': 'Trắng', 'xanh dương': 'Xanh Dương',
        'xanh lá': 'Xanh Lá', 'xanh': 'Xanh', 'đen': 'Đen',
        'vàng': 'Vàng', 'hồng': 'Hồng', 'xám': 'Xám', 'cam': 'Cam',
        'do': 'Đỏ', 'trang': 'Trắng', 'xanh duong': 'Xanh Dương',
        'xanh la': 'Xanh Lá', 'den': 'Đen', 'vang': 'Vàng',
        'hong': 'Hồng', 'xam': 'Xám'
      };
      
      for (const [key, value] of Object.entries(colorMapFallback)) {
        if (message.includes(key) || normalized.includes(key)) {
          result.color = value;
          break;
        }
      }
    }
    
    // Extract type
    if (normalized.includes('scooter') || normalized.includes('xe ga')) {
      result.type = 'scooter';
    } else if (normalized.includes('motorcycle') || normalized.includes('xe so')) {
      result.type = 'motorcycle';
    }
    
    return result;
  }
  
  /**
   * Extract station info
   * Hỗ trợ tìm theo tên trạm, địa chỉ, quận (cả có dấu và không dấu)
   */
  async extractStationInfo(message) {
    try {
      const normalized = this.normalizeText(message);
      
      // Lấy danh sách trạm
      const stations = await Station.find({ status: 'active' })
        .select('name address code');
      
      // 1. Tìm theo tên trạm (có dấu hoặc không dấu)
      for (const station of stations) {
        const stationNameLower = station.name.toLowerCase();
        const stationNameNormalized = this.normalizeText(station.name);
        
        if (message.includes(stationNameLower) || normalized.includes(stationNameNormalized)) {
          return {
            stationId: station._id,
            stationName: station.name,
            stationAddress: station.address
          };
        }
      }
      
      // 2. Tìm theo địa chỉ/quận (có dấu và không dấu)
      const locationPatterns = [
        // Có dấu
        { pattern: 'quận 1', normalized: 'quan 1' },
        { pattern: 'quận 2', normalized: 'quan 2' },
        { pattern: 'quận 3', normalized: 'quan 3' },
        { pattern: 'quận 4', normalized: 'quan 4' },
        { pattern: 'quận 5', normalized: 'quan 5' },
        { pattern: 'quận 6', normalized: 'quan 6' },
        { pattern: 'quận 7', normalized: 'quan 7' },
        { pattern: 'quận 8', normalized: 'quan 8' },
        { pattern: 'quận 9', normalized: 'quan 9' },
        { pattern: 'quận 10', normalized: 'quan 10' },
        { pattern: 'quận 11', normalized: 'quan 11' },
        { pattern: 'quận 12', normalized: 'quan 12' },
        { pattern: 'thủ đức', normalized: 'thu duc' },
        { pattern: 'bình thạnh', normalized: 'binh thanh' },
        { pattern: 'tân bình', normalized: 'tan binh' },
        { pattern: 'phú nhuận', normalized: 'phu nhuan' },
        { pattern: 'gò vấp', normalized: 'go vap' },
        { pattern: 'bình tân', normalized: 'binh tan' },
        { pattern: 'tân phú', normalized: 'tan phu' },
        { pattern: 'bình dương', normalized: 'binh duong' }
      ];
      
      for (const station of stations) {
        const addressLower = (station.address || '').toLowerCase();
        const addressNormalized = this.normalizeText(station.address || '');
        
        for (const { pattern, normalized: normalizedPattern } of locationPatterns) {
          // Check với message có dấu
          const hasPatternInMessage = message.includes(pattern);
          // Check với message không dấu
          const hasNormalizedPattern = normalized.includes(normalizedPattern);
          
          // Check với địa chỉ trạm
          const hasPatternInAddress = addressLower.includes(pattern) || addressNormalized.includes(normalizedPattern);
          
          if ((hasPatternInMessage || hasNormalizedPattern) && hasPatternInAddress) {
            return {
              stationId: station._id,
              stationName: station.name,
              stationAddress: station.address
            };
          }
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
    console.log('🔍 ===== FINDING MATCHING VEHICLES =====');
    console.log('📝 Input vehicleInfo:', vehicleInfo);
    console.log('🏢 StationId:', stationId);
    
    const query = {
      status: 'available',
      is_active: true
    };
    
    if (stationId) {
      query.station_id = stationId;
    }
    
    if (vehicleInfo.model) {
      console.log('✅ Creating RegExp for model:', vehicleInfo.model);
      // RegExp linh hoạt: "Klara" match cả "Klara" và "Klara S"
      // Ví dụ: /^Klara( S)?$/i → match "Klara" hoặc "Klara S"
      query.model = new RegExp(`^${vehicleInfo.model}( S)?$`, 'i');
      console.log('📋 RegExp created:', query.model);
    }
    
    if (vehicleInfo.color) {
      console.log('✅ Creating RegExp for color:', vehicleInfo.color);
      query.color = new RegExp(vehicleInfo.color, 'i');
      console.log('📋 RegExp created:', query.color);
    }
    
    if (vehicleInfo.type) {
      query.type = vehicleInfo.type;
    }
    
    console.log('🔎 ===== FINAL QUERY =====');
    console.log('📝 Query:', {
      ...query,
      model: query.model instanceof RegExp ? query.model.source : query.model,
      color: query.color instanceof RegExp ? query.color.source : query.color
    });
    console.log('📅 Date range:', startDate, 'to', endDate);
    
    // Query thật với RegExp
    let vehicles = await Vehicle.find(query)
      .populate('station_id', 'name address');
    
    console.log(`📦 Found ${vehicles.length} vehicles BEFORE conflict check:`, 
      vehicles.map(v => ({ 
        id: v._id, 
        name: v.name, 
        model: v.model, 
        color: v.color,
        station: v.station_id?.name
      })));
    
    // Nếu có thời gian, filter ra xe bị conflict
    if (startDate && endDate && vehicles.length > 0) {
      const { Booking } = require('../../../models');
      const vehicleIds = vehicles.map(v => v._id);
      
      console.log('🔍 Checking conflicts for vehicles:', vehicleIds.map(id => id.toString()));
      
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
      
      console.log(`❌ Found ${conflictingBookings.length} conflicting bookings:`, 
        conflictingBookings.map(b => ({
          vehicle_id: b.vehicle_id,
          code: b.code,
          status: b.status,
          start: b.start_date,
          end: b.end_date
        })));
      
      const conflictingVehicleIds = conflictingBookings.map(b => b.vehicle_id.toString());
      
      console.log('🚫 Conflicting vehicle IDs:', conflictingVehicleIds);
      
      // Filter ra xe không bị conflict
      vehicles = vehicles.filter(v => !conflictingVehicleIds.includes(v._id.toString()));
      
      console.log(`✅ After conflict filter: ${vehicles.length} vehicles remaining:`,
        vehicles.map(v => ({ name: v.name, model: v.model, color: v.color })));
    }
    
    console.log('🏁 ===== FINAL RESULT =====');
    console.log(`✅ Returning ${vehicles.length} vehicles`);
    
    return vehicles;
  }
}

module.exports = new BookingExtractor();

