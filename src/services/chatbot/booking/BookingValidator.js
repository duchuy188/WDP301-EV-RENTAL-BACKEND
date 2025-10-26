const { User, Vehicle, Station, Booking } = require('../../../models');

class BookingValidator {
  /**
   * Validate toàn bộ booking info
   */
  async validate(bookingInfo) {
    const errors = [];
    
    // 1. Validate user
    const userValidation = await this.validateUser(bookingInfo.userId);
    if (!userValidation.valid) {
      errors.push(userValidation.error);
    }
    
    // 2. Validate dates
    const dateValidation = this.validateDates(bookingInfo.dates);
    if (!dateValidation.valid) {
      errors.push(dateValidation.error);
    }
    
    // 2.1. Check user không có booking trùng thời gian (giống booking bình thường)
    if (userValidation.valid && bookingInfo.dates?.startDate && bookingInfo.dates?.endDate) {
      const userAvailabilityValidation = await this.validateUserAvailability(
        bookingInfo.userId,
        bookingInfo.dates.startDate,
        bookingInfo.dates.endDate
      );
      if (!userAvailabilityValidation.valid) {
        errors.push(userAvailabilityValidation.error);
      }
    }
    
    // 3. Validate vehicle
    if (bookingInfo.vehicleId) {
      const vehicleValidation = await this.validateVehicle(bookingInfo.vehicleId);
      if (!vehicleValidation.valid) {
        errors.push(vehicleValidation.error);
      }
      
      // 3.1. Check vehicle availability (không trùng lịch)
      if (vehicleValidation.valid && bookingInfo.dates?.startDate && bookingInfo.dates?.endDate) {
        const availabilityValidation = await this.validateVehicleAvailability(
          bookingInfo.vehicleId,
          bookingInfo.dates.startDate,
          bookingInfo.dates.endDate
        );
        if (!availabilityValidation.valid) {
          errors.push(availabilityValidation.error);
        }
      }
    }
    
    // 4. Validate station
    if (bookingInfo.stationId) {
      const stationValidation = await this.validateStation(bookingInfo.stationId);
      if (!stationValidation.valid) {
        errors.push(stationValidation.error);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Validate user exists (KHÔNG check KYC - sẽ check tại quầy)
   */
  async validateUser(userId) {
    const user = await User.findById(userId);
    
    if (!user) {
      return {
        valid: false,
        error: 'User không tồn tại'
      };
    }
    
    // KHÔNG check KYC ở đây - Staff sẽ check tại quầy
    
    return { valid: true };
  }
  
  /**
   * Validate dates
   */
  validateDates(dates) {
    if (!dates.startDate || !dates.endDate) {
      return {
        valid: false,
        error: 'Vui lòng cung cấp ngày bắt đầu và kết thúc'
      };
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (dates.startDate < now) {
      return {
        valid: false,
        error: 'Ngày bắt đầu phải từ hôm nay trở đi'
      };
    }
    
    if (dates.endDate <= dates.startDate) {
      return {
        valid: false,
        error: 'Ngày kết thúc phải sau ngày bắt đầu'
      };
    }
    
    const duration = Math.ceil((dates.endDate - dates.startDate) / (1000 * 60 * 60 * 24));
    if (duration > 30) {
      return {
        valid: false,
        error: 'Thời gian thuê tối đa 30 ngày'
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate vehicle available
   */
  async validateVehicle(vehicleId) {
    const vehicle = await Vehicle.findById(vehicleId);
    
    if (!vehicle) {
      return {
        valid: false,
        error: 'Xe không tồn tại'
      };
    }
    
    if (!vehicle.is_active) {
      return {
        valid: false,
        error: 'Xe không còn hoạt động'
      };
    }
    
    if (vehicle.status !== 'available') {
      return {
        valid: false,
        error: `Xe đang ${vehicle.status}, không thể đặt`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate user không có booking trùng thời gian (giống booking bình thường)
   */
  async validateUserAvailability(userId, startDate, endDate) {
    const userConflictingBooking = await Booking.findOne({
      user_id: userId,
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

    if (userConflictingBooking) {
      const bookingTypeText = userConflictingBooking.booking_type === 'online' ? 'online' : 'tại quầy';
      return {
        valid: false,
        error: `Bạn đã có booking ${bookingTypeText} trong khoảng thời gian từ ${userConflictingBooking.start_date.toLocaleDateString('vi-VN')} đến ${userConflictingBooking.end_date.toLocaleDateString('vi-VN')}. Một người chỉ có thể đặt một xe trong cùng thời gian.`
      };
    }

    return { valid: true };
  }
  
  /**
   * Validate vehicle không bị trùng lịch
   */
  async validateVehicleAvailability(vehicleId, startDate, endDate) {
    const existingBooking = await Booking.findOne({
      vehicle_id: vehicleId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        // Trường hợp 1: Booking mới nằm trong khoảng thời gian booking cũ
        {
          start_date: { $lte: startDate },
          end_date: { $gt: startDate }
        },
        // Trường hợp 2: Booking cũ nằm trong khoảng thời gian booking mới
        {
          start_date: { $lt: endDate },
          end_date: { $gte: endDate }
        },
        // Trường hợp 3: Booking mới bao trùm booking cũ
        {
          start_date: { $gte: startDate },
          end_date: { $lte: endDate }
        }
      ]
    });

    if (existingBooking) {
      const bookingTypeText = existingBooking.booking_type === 'online' ? 'đặt online' : 'đặt tại quầy';
      return {
        valid: false,
        error: `Xe đã được ${bookingTypeText} trong khoảng thời gian từ ${existingBooking.start_date.toLocaleDateString('vi-VN')} đến ${existingBooking.end_date.toLocaleDateString('vi-VN')}`
      };
    }

    return { valid: true };
  }
  
  /**
   * Validate station capacity
   */
  async validateStation(stationId) {
    const station = await Station.findById(stationId);
    
    if (!station) {
      return {
        valid: false,
        error: 'Trạm không tồn tại'
      };
    }
    
    if (station.status !== 'active') {
      return {
        valid: false,
        error: 'Trạm không hoạt động'
      };
    }
    
    if (station.available_vehicles <= 0) {
      return {
        valid: false,
        error: 'Trạm đã hết xe'
      };
    }
    
    return { valid: true };
  }
}

module.exports = new BookingValidator();

