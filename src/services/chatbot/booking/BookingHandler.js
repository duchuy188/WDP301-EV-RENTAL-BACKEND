const { Booking, User, Vehicle, Station } = require('../../../models');
const BookingExtractor = require('./BookingExtractor');
const BookingValidator = require('./BookingValidator');
const BookingFormatter = require('./BookingFormatter');

class BookingHandler {
  /**
   * Handle booking request từ chatbot
   */
  async handle(message, userId, conversationHistory) {
    try {
      console.log('🎯 BookingHandler: Processing booking request');
      console.log('Message:', message);
      console.log('UserId:', userId);
      
      // 1. Extract thông tin từ message
      const extracted = await BookingExtractor.extractBookingInfo(message, userId);
      console.log('Extracted info:', JSON.stringify(extracted, null, 2));
      
      
      // 2. Check xem có đủ thông tin chưa
      if (!this.hasRequiredInfo(extracted)) {
        const missing = this.getMissingInfo(extracted);
        return {
          success: false,
          message: BookingFormatter.formatMissingInfo(missing),
          suggestions: ['Xem xe available', 'Hướng dẫn đặt xe', 'Liên hệ hỗ trợ'],
          actions: ['view_vehicles', 'booking_guide', 'contact_support']
        };
      }
      
      // 3. Tìm xe phù hợp (filter ra xe bị trùng lịch)
      const vehicles = await BookingExtractor.findMatchingVehicles(
        extracted.vehicleInfo,
        extracted.stationInfo?.stationId,
        extracted.dates?.startDate,
        extracted.dates?.endDate
      );
      
      console.log(`Found ${vehicles.length} matching vehicles`);
      
      if (vehicles.length === 0) {
        
        const alternatives = await this.findAlternativeVehicles(
          extracted.vehicleInfo,
          extracted.stationInfo?.stationId,
          extracted.dates?.startDate,
          extracted.dates?.endDate
        );
        
        // NẾU user ĐÃ chọn trạm cụ thể
        if (extracted.stationInfo?.stationId) {
          // CHỈ show xe alternatives TRONG CÙNG TRẠM ĐÓ, KHÔNG cho phép đặt xe ở trạm khác
          if (alternatives.sameModel.length > 0 || alternatives.sameColor.length > 0) {
            return {
              success: false,
              message: BookingFormatter.formatNoVehicleWithAlternatives(extracted, alternatives),
              suggestions: this.generateAlternativeSuggestions(alternatives),
              actions: ['view_alternatives', 'change_criteria', 'contact_support'],
              context: {
                alternatives: alternatives,
                originalRequest: extracted
              }
            };
          } else {
            // Không có xe nào trong trạm user chọn
            const vehicleDesc = [
              extracted.vehicleInfo.model,
              extracted.vehicleInfo.color ? `màu ${extracted.vehicleInfo.color}` : null
            ].filter(Boolean).join(' ');
            
            return {
              success: false,
              message: `❌ **RẤT TIẾC**\n\nTrạm **${extracted.stationInfo.stationName}** không có xe ${vehicleDesc || 'phù hợp'} trong thời gian bạn chọn.\n\n💡 **Bạn có thể:**\n• Chọn xe khác màu/model tại trạm này\n• Chọn trạm khác gần bạn\n• Thay đổi thời gian thuê\n• Liên hệ hỗ trợ để tư vấn`,
              suggestions: ['Xem xe khác tại trạm này', 'Chọn trạm khác', 'Liên hệ hỗ trợ'],
              actions: ['view_station_vehicles', 'change_station', 'contact_support']
            };
          }
        }
        
        // NẾU user CHƯA chọn trạm cụ thể → có thể gợi ý xe ở bất kỳ trạm nào
        if (alternatives && (alternatives.sameModel.length > 0 || alternatives.sameColor.length > 0 || alternatives.nearby.length > 0)) {
          return {
            success: false,
            message: BookingFormatter.formatNoVehicleWithAlternatives(extracted, alternatives),
            suggestions: this.generateAlternativeSuggestions(alternatives),
            actions: ['view_alternatives', 'change_criteria', 'contact_support'],
            context: {
              alternatives: alternatives,
              originalRequest: extracted
            }
          };
        }
        
        // Không có xe nào
        return {
          success: false,
          message: BookingFormatter.formatError(['Không tìm thấy xe phù hợp với yêu cầu của bạn']),
          suggestions: ['Thử xe khác', 'Thử trạm khác', 'Xem tất cả xe available'],
          actions: ['try_other_vehicle', 'try_other_station', 'view_all_vehicles']
        };
      }
      
      // 4. Tự động chọn 1 xe (giống booking bình thường)
      // Ưu tiên: Pin cao nhất, mới nhất
      const selectedVehicle = vehicles.sort((a, b) => {
        // Sort by battery level (cao → thấp)
        if (b.current_battery !== a.current_battery) {
          return b.current_battery - a.current_battery;
        }
        // Nếu pin bằng nhau, sort by createdAt (mới → cũ)
        return new Date(b.createdAt) - new Date(a.createdAt);
      })[0];
      
      console.log(`Auto-selected vehicle: ${selectedVehicle.name} (${selectedVehicle.license_plate})`);
      
      // 6. Tính giá
      const pricing = this.calculatePricing(extracted.dates, selectedVehicle);
      
      // 7. Validate
      const validation = await BookingValidator.validate({
        userId,
        dates: extracted.dates,
        vehicleId: selectedVehicle._id,
        stationId: extracted.stationInfo?.stationId || selectedVehicle.station_id._id
      });
      
      if (!validation.valid) {
        return {
          success: false,
          message: BookingFormatter.formatError(validation.errors),
          suggestions: ['Thử lại', 'Chọn xe khác', 'Liên hệ hỗ trợ'],
          actions: ['retry', 'choose_other', 'contact_support']
        };
      }
      
      // 8. Trả về confirmation
      return {
        success: true,
        message: BookingFormatter.formatConfirmation(extracted, selectedVehicle, pricing),
        suggestions: ['Xác nhận đặt xe', 'Thay đổi thông tin', 'Hủy'],
        actions: ['confirm_booking', 'edit_booking', 'cancel'],
        context: {
          step: 'confirmation',
          bookingData: {
            userId,
            vehicleId: selectedVehicle._id,
            stationId: extracted.stationInfo?.stationId || selectedVehicle.station_id._id,
            startDate: extracted.dates.startDate,
            endDate: extracted.dates.endDate,
            totalPrice: pricing.totalPrice,
            depositAmount: pricing.depositAmount,
            totalDays: pricing.duration
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Error in BookingHandler:', error);
      return {
        success: false,
        message: 'Xin lỗi, có lỗi xảy ra khi xử lý đặt xe. Vui lòng thử lại sau.',
        suggestions: ['Thử lại', 'Liên hệ hỗ trợ'],
        actions: ['retry', 'contact_support']
      };
    }
  }
  
  /**
   * Confirm và tạo booking
   */
  async confirmBooking(bookingData) {
    try {
      console.log('✅ Creating booking with data:', bookingData);
      
      // Tạo booking code
      const bookingCode = 'BK' + Date.now().toString(36).toUpperCase();
      
      // Get vehicle info để lấy price_per_day
      const { Vehicle } = require('../../../models');
      const vehicle = await Vehicle.findById(bookingData.vehicleId);
      
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }
      
      // Extract time từ dates hoặc dùng default
      const startDate = new Date(bookingData.startDate);
      
      // Format time từ Date object (HH:MM)
      const pickupTime = startDate.getHours() === 0 && startDate.getMinutes() === 0
        ? '08:00' // Default nếu user chỉ nói ngày
        : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      
      // ✅ Return time = pickup time (cùng giờ với pickup)
      const returnTime = pickupTime;
      
      // ✅ Validate giờ làm việc của trạm (giống booking thông thường)
      const stationHoursValidation = await BookingValidator.validateStationHours(
        bookingData.stationId,
        pickupTime,
        returnTime
      );
      
      if (!stationHoursValidation.valid) {
        return {
          success: false,
          message: `❌ ${stationHoursValidation.error}`,
          suggestions: ['Chọn giờ khác trong giờ làm việc', 'Liên hệ hỗ trợ'],
          actions: ['change_time', 'contact_support']
        };
      }
      
      // Lấy thông tin user để ghi vào notes
      const user = await User.findById(bookingData.userId).select('fullname email');
      const customerName = user ? (user.fullname || user.email) : 'Khách hàng';
      
      // ✅ Generate QR Code (giống booking thông thường)
      const { generateQRCode } = require('../../../utils/qrCodeGenerator');
      const qrCodeData = await generateQRCode(bookingCode);
      const qrExpiresAt = new Date(bookingData.startDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours after start
      
      // ✅ Update vehicle status sang 'reserved' (giống booking bình thường)
      const updatedVehicle = await Vehicle.findOneAndUpdate(
        { _id: bookingData.vehicleId, status: 'available' },
        { status: 'reserved' },
        { new: true }
      );
      
      if (!updatedVehicle || updatedVehicle.status !== 'reserved') {
        return {
          success: false,
          message: '❌ Xe đã được đặt bởi người khác. Vui lòng chọn xe khác.',
          suggestions: ['Tìm xe khác', 'Xem xe available'],
          actions: ['find_another', 'view_available']
        };
      }
      
      // Tạo booking với đầy đủ required fields
      const booking = await Booking.create({
        code: bookingCode,
        user_id: bookingData.userId,
        vehicle_id: bookingData.vehicleId,
        station_id: bookingData.stationId,
        start_date: bookingData.startDate,
        end_date: bookingData.endDate,
        pickup_time: pickupTime,
        return_time: returnTime,
        price_per_day: vehicle.price_per_day,
        total_days: bookingData.totalDays,
        total_price: bookingData.totalPrice,
        deposit_amount: bookingData.depositAmount,
        booking_type: 'online',
        status: 'pending', // Pending chờ staff confirm
        created_by: bookingData.userId,
        qr_code: qrCodeData,          // ✅ QR code để nhận xe
        qr_expires_at: qrExpiresAt,   // ✅ QR hết hạn sau 24h
        notes: `Booking từ chatbot AI - Khách hàng: ${customerName}`
      });
      
      // Populate để lấy thông tin đầy đủ
      await booking.populate([
        { path: 'vehicle_id', select: 'name brand model color license_plate' },
        { path: 'station_id', select: 'name address phone' }
      ]);
      
      // ✅ Update station stats (giống booking bình thường)
      try {
        const station = await Station.findById(bookingData.stationId);
        if (station) {
          await station.syncVehicleCount();
        }
      } catch (stationError) {
        console.log('Station sync failed:', stationError.message);
        // Không fail booking vì station sync lỗi
      }
      
      // ✅ Gửi email xác nhận booking (giống booking thông thường)
      try {
        const { sendEmail, getBookingConfirmationTemplate } = require('../../../config/nodemailer');
        
        if (!user.fullname) {
          console.error('❌ user.fullname is undefined');
          throw new Error('user.fullname is required for email');
        }
        
        await sendEmail({
          to: user.email,
          subject: 'Xác nhận đặt xe điện - EV Rental (Chatbot)',
          html: getBookingConfirmationTemplate(user.fullname, {
            bookingId: booking._id.toString(),
            bookingCode: booking.code,
            carModel: booking.vehicle_id.name,
            carColor: booking.vehicle_id.color,
            carPlate: booking.vehicle_id.license_plate,
            stationName: booking.station_id.name,
            stationAddress: booking.station_id.address,
            pickupDate: booking.start_date.toLocaleDateString('vi-VN'),
            returnDate: booking.end_date.toLocaleDateString('vi-VN'),
            pickupTime: booking.pickup_time,
            totalPrice: booking.total_price.toLocaleString('vi-VN'),
            depositAmount: booking.deposit_amount.toLocaleString('vi-VN'),
            qrExpiresAt: booking.qr_expires_at.toLocaleString('vi-VN')
          })
        });
        console.log('✅ Email xác nhận booking (chatbot) đã được gửi đến:', user.email);
      } catch (emailError) {
        console.error('❌ Lỗi khi gửi email xác nhận:', emailError.message);
        // Không throw error, chỉ log để không làm fail booking
      }
      
      console.log('✅ Booking created successfully:', booking.code);
      
      return {
        success: true,
        message: BookingFormatter.formatSuccess(booking),
        suggestions: ['Xem chi tiết', 'Đặt xe khác', 'Liên hệ trạm'],
        actions: ['view_booking', 'book_another', 'contact_station'],
        booking: {
          id: booking._id,
          code: booking.code,
          status: booking.status
        }
      };
      
    } catch (error) {
      console.error('❌ Error creating booking:', error);
      return {
        success: false,
        message: 'Không thể tạo booking. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.',
        suggestions: ['Thử lại', 'Liên hệ hỗ trợ'],
        actions: ['retry', 'contact_support']
      };
    }
  }
  
  /**
   * Check xem có đủ thông tin required chưa
   */
  hasRequiredInfo(extracted) {
    const hasDates = extracted.dates.startDate && extracted.dates.endDate;
    const hasVehicleInfo = extracted.vehicleInfo.model || extracted.vehicleInfo.color;
    
    return hasDates && hasVehicleInfo;
  }
  
  /**
   * Get missing info
   */
  getMissingInfo(extracted) {
    const missing = [];
    
    if (!extracted.dates.startDate || !extracted.dates.endDate) {
      missing.push('thời gian thuê (ngày bắt đầu và kết thúc)');
    }
    
    if (!extracted.vehicleInfo.model && !extracted.vehicleInfo.color) {
      missing.push('loại xe hoặc màu xe');
    }
    
    return missing;
  }
  
  /**
   * Calculate pricing
   */
  calculatePricing(dates, vehicle) {
    const duration = Math.ceil((dates.endDate - dates.startDate) / (1000 * 60 * 60 * 24));
    const totalPrice = duration * vehicle.price_per_day;
    
    // Nếu thuê >= 3 ngày: cọc theo deposit_percentage
    // Nếu thuê < 3 ngày: thanh toán full ngay
    const depositAmount = duration >= 3 
      ? Math.round(totalPrice * (vehicle.deposit_percentage / 100))
      : totalPrice;
    
    return {
      duration,
      pricePerDay: vehicle.price_per_day,
      totalPrice,
      depositAmount
    };
  }
  
  /**
   * Tìm xe alternatives khi không có xe đúng yêu cầu
   * ⚠️ QUAN TRỌNG: Nếu user đã chọn trạm cụ thể (stationId có giá trị),
   * sameModel và sameColor CHỈ tìm trong trạm đó, KHÔNG tìm ở trạm khác
   */
  async findAlternativeVehicles(vehicleInfo, stationId, startDate, endDate) {
    const alternatives = {
      sameModel: [],  // Cùng model khác màu (CHỈ trong trạm user chọn nếu có stationId)
      sameColor: [],  // Cùng màu khác model (CHỈ trong trạm user chọn nếu có stationId)
      nearby: []      // Xe tương tự ở trạm gần (CHỈ để gợi ý, KHÔNG tự động đặt)
    };
    
    try {
      // 1. Tìm xe cùng model khác màu
      if (vehicleInfo.model) {
        const sameModelQuery = {
          model: new RegExp(vehicleInfo.model, 'i'),
          status: 'available',
          is_active: true
        };
        
        // ✅ NẾU user đã chọn trạm cụ thể → CHỈ tìm trong trạm đó
        if (stationId) {
          sameModelQuery.station_id = stationId;
        }
        
        // Nếu có màu, tìm xe cùng model nhưng KHÁC màu
        if (vehicleInfo.color) {
          sameModelQuery.color = { $not: new RegExp(vehicleInfo.color, 'i') };
        }
        
        let sameModelVehicles = await Vehicle.find(sameModelQuery)
          .populate('station_id', 'name address')
          .limit(5);
        
        // Filter xe không bị conflict
        if (startDate && endDate && sameModelVehicles.length > 0) {
          sameModelVehicles = await this.filterConflictingVehicles(sameModelVehicles, startDate, endDate);
        }
        
        alternatives.sameModel = sameModelVehicles;
      }
      
      // 2. Tìm xe cùng màu khác model
      if (vehicleInfo.color) {
        const sameColorQuery = {
          color: new RegExp(vehicleInfo.color, 'i'),
          status: 'available',
          is_active: true
        };
        
        // ✅ NẾU user đã chọn trạm cụ thể → CHỈ tìm trong trạm đó
        if (stationId) {
          sameColorQuery.station_id = stationId;
        }
        
        // Nếu có model, tìm xe cùng màu nhưng KHÁC model
        if (vehicleInfo.model) {
          sameColorQuery.model = { $not: new RegExp(vehicleInfo.model, 'i') };
        }
        
        let sameColorVehicles = await Vehicle.find(sameColorQuery)
          .populate('station_id', 'name address')
          .limit(5);
        
        // Filter xe không bị conflict
        if (startDate && endDate && sameColorVehicles.length > 0) {
          sameColorVehicles = await this.filterConflictingVehicles(sameColorVehicles, startDate, endDate);
        }
        
        alternatives.sameColor = sameColorVehicles;
      }
      
      // 3. Tìm xe tương tự ở trạm gần (CHỈ để GỢI Ý, KHÔNG tự động đặt)
      // ⚠️ Nearby chỉ được dùng khi user ĐÃ chọn trạm cụ thể
      if (stationId && (vehicleInfo.model || vehicleInfo.color)) {
        // Lấy thông tin trạm hiện tại
        const currentStation = await Station.findById(stationId).select('name address');
        
        if (currentStation) {
          // Tìm tất cả trạm active khác
          const otherStations = await Station.find({
            _id: { $ne: stationId },
            status: 'active',
            available_vehicles: { $gt: 0 }
          }).limit(3);
          
          // Tìm xe tương tự ở các trạm đó
          for (const station of otherStations) {
            const nearbyQuery = {
              station_id: station._id,
              status: 'available',
              is_active: true
            };
            
            // Ưu tiên cùng model hoặc cùng màu
            if (vehicleInfo.model) {
              nearbyQuery.model = new RegExp(vehicleInfo.model, 'i');
            } else if (vehicleInfo.color) {
              nearbyQuery.color = new RegExp(vehicleInfo.color, 'i');
            }
            
            let nearbyVehicles = await Vehicle.find(nearbyQuery)
              .populate('station_id', 'name address')
              .limit(2);
            
            // Filter xe không bị conflict
            if (startDate && endDate && nearbyVehicles.length > 0) {
              nearbyVehicles = await this.filterConflictingVehicles(nearbyVehicles, startDate, endDate);
            }
            
            alternatives.nearby.push(...nearbyVehicles);
          }
          
          // Giới hạn tối đa 5 xe nearby
          alternatives.nearby = alternatives.nearby.slice(0, 5);
        }
      }
      
      return alternatives;
      
    } catch (error) {
      console.error('Error finding alternative vehicles:', error);
      return alternatives;
    }
  }
  
  /**
   * Filter ra xe bị conflict với thời gian đặt
   */
  async filterConflictingVehicles(vehicles, startDate, endDate) {
    const vehicleIds = vehicles.map(v => v._id);
    
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
    
    return vehicles.filter(v => !conflictingVehicleIds.includes(v._id.toString()));
  }
  
  /**
   * Generate suggestions từ alternatives
   */
  generateAlternativeSuggestions(alternatives) {
    const suggestions = [];
    
    if (alternatives.sameModel.length > 0) {
      const firstAlt = alternatives.sameModel[0];
      suggestions.push(`Xem ${firstAlt.model} màu ${firstAlt.color}`);
    }
    
    if (alternatives.sameColor.length > 0) {
      const firstAlt = alternatives.sameColor[0];
      suggestions.push(`Xem ${firstAlt.model} màu ${firstAlt.color}`);
    }
    
    if (alternatives.nearby.length > 0) {
      const firstAlt = alternatives.nearby[0];
      suggestions.push(`Xem xe tại ${firstAlt.station_id?.name}`);
    }
    
    suggestions.push('Thay đổi yêu cầu');
    
    return suggestions.slice(0, 3);
  }
}

module.exports = new BookingHandler();

