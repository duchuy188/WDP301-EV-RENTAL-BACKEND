const { User, Vehicle, Station, Booking } = require('../../../models');
const { nowVietnam } = require('../../../config/timezone');

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
    
    
    if (user.role !== 'EV Renter') {
      return {
        valid: false,
        error: 'Chỉ khách hàng (EV Renter) mới có thể đặt xe qua chatbot. Admin và Staff vui lòng sử dụng hệ thống quản lý.'
      };
    }
    
    //  Check số lượng booking active (giống booking bình thường)
    const { PendingBooking } = require('../../../models');
    
    // 1. Check PendingBooking - CHỈ CHO PHÉP 1
    const activePendingBookings = await PendingBooking.countDocuments({
      user_id: userId,
      status: 'pending_payment'
    });
    
    const MAX_PENDING_BOOKINGS = 1;
    if (activePendingBookings >= MAX_PENDING_BOOKINGS) {
      return {
        valid: false,
        error: `Bạn đang có ${activePendingBookings} booking chưa thanh toán. Vui lòng thanh toán hoặc đợi hết hạn (15 phút) trước khi đặt xe khác.`
      };
    }
    
    // 2. Check Booking thật - CHỈ CHO PHÉP TỐI ĐA 2 (để dành 1 chỗ cho PendingBooking)
    const activeBookings = await Booking.countDocuments({
      user_id: userId,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    const MAX_REAL_BOOKINGS = 2;
    if (activeBookings >= MAX_REAL_BOOKINGS) {
      return {
        valid: false,
        error: `Bạn đã có ${activeBookings} booking. Vui lòng hoàn thành trước khi đặt thêm.`
      };
    }
    
    // 3. Defense in depth: Check tổng (KHÔNG BAO GIỜ XẢY RA nếu logic 1+2 đúng)
    const totalActiveBookings = activeBookings + activePendingBookings;
    const MAX_ACTIVE_BOOKINGS = 3;
    if (totalActiveBookings >= MAX_ACTIVE_BOOKINGS) {
      return {
        valid: false,
        error: `Bạn chỉ có thể có tối đa ${MAX_ACTIVE_BOOKINGS} đặt xe hoạt động cùng lúc (bao gồm cả booking chưa thanh toán)`
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
    
    const now = nowVietnam().startOf('day').toDate(); 
    
    if (dates.startDate < now) {
      return {
        valid: false,
        error: 'Ngày bắt đầu phải từ hôm nay trở đi'
      };
    }
    
    //  Check giới hạn đặt trước tối đa 30 ngày (giống booking thông thường)
    const MAX_ADVANCE_DAYS = 30;
    const maxAdvanceDate = nowVietnam().toDate();
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_DAYS);
    
    if (dates.startDate > maxAdvanceDate) {
      return {
        valid: false,
        error: `Chỉ có thể đặt xe tối đa ${MAX_ADVANCE_DAYS} ngày trước`
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
   * Validate user không có booking trùng thời gian (bao gồm cả PendingBooking)
   */
  async validateUserAvailability(userId, startDate, endDate) {
    // Check Booking thật
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

    //  Check PendingBooking (chưa thanh toán)
    const { PendingBooking } = require('../../../models');
    
    const userConflictingPending = await PendingBooking.findOne({
      user_id: userId,
      status: 'pending_payment',
      $or: [
        {
          'booking_data.start_date': { $lte: startDate },
          'booking_data.end_date': { $gt: startDate }
        },
        {
          'booking_data.start_date': { $lt: endDate },
          'booking_data.end_date': { $gte: endDate }
        },
        {
          'booking_data.start_date': { $gte: startDate },
          'booking_data.end_date': { $lte: endDate }
        }
      ]
    });

    if (userConflictingPending) {
      return {
        valid: false,
        error: `Bạn đã có booking chưa thanh toán (${userConflictingPending.temp_id}) trong khoảng thời gian từ ${new Date(userConflictingPending.booking_data.start_date).toLocaleDateString('vi-VN')} đến ${new Date(userConflictingPending.booking_data.end_date).toLocaleDateString('vi-VN')}. Vui lòng thanh toán hoặc đợi hết hạn trước khi đặt lại.`
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
  
  /**
   * Validate giờ nhận/trả xe trong giờ làm việc của trạm 
   */
  async validateStationHours(stationId, pickupTime, returnTime) {
    const station = await Station.findById(stationId);
    
    if (!station) {
      return {
        valid: false,
        error: 'Trạm không tồn tại'
      };
    }
    
    // Parse opening/closing time
    const [openHour, openMin] = station.opening_time.split(':').map(Number);
    const [closeHour, closeMin] = station.closing_time.split(':').map(Number);
    
    // Parse pickup/return time (format: "HH:MM" or "08:00")
    const [pickupHour, pickupMin] = pickupTime.split(':').map(Number);
    const [returnHour, returnMin] = returnTime.split(':').map(Number);
    
    // Convert to minutes for easy comparison
    const openingMinutes = openHour * 60 + openMin;
    const closingMinutes = closeHour * 60 + closeMin;
    const pickupMinutes = pickupHour * 60 + pickupMin;
    const returnMinutes = returnHour * 60 + returnMin;
    
    if (pickupMinutes < openingMinutes || pickupMinutes > closingMinutes) {
      return {
        valid: false,
        error: `Giờ nhận xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})`
      };
    }
    
    if (returnMinutes < openingMinutes || returnMinutes > closingMinutes) {
      return {
        valid: false,
        error: `Giờ trả xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})`
      };
    }
    
    return { valid: true };
  }
}

module.exports = new BookingValidator();

