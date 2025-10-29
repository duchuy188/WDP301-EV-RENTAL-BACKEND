const { Booking, User, Vehicle, Station, PendingBooking } = require('../../../models');
const BookingExtractor = require('./BookingExtractor');
const BookingValidator = require('./BookingValidator');
const BookingFormatter = require('./BookingFormatter');
const QRCode = require('qrcode');
const { uploadToCloudinary } = require('../../../config/cloudinary');
const VNPayService = require('../../VNPayService');
const { nowVietnam } = require('../../../config/timezone');

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
   * Confirm và tạo PendingBooking + VNPay URL (NEW FLOW với holding fee)
   */
  async confirmBooking(bookingData) {
    try {
      console.log('✅ Creating PENDING booking with HOLDING FEE:', bookingData);
      
      // 1. Get vehicle info
      const vehicle = await Vehicle.findById(bookingData.vehicleId)
        .populate('station_id', 'name address phone');
      
      if (!vehicle) {
        throw new Error('Vehicle not found');
      }
      
      // 2. Validate vehicle vẫn available
      if (vehicle.status !== 'available') {
        return {
          success: false,
          message: '❌ Xe đã được đặt bởi người khác. Vui lòng chọn xe khác.',
          suggestions: ['Tìm xe khác', 'Xem xe available'],
          actions: ['find_another', 'view_available']
        };
      }
      
      // 3. Extract pickup/return time
      const startDate = new Date(bookingData.startDate);
      const pickupTime = startDate.getHours() === 0 && startDate.getMinutes() === 0
        ? '08:00'
        : `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      const returnTime = pickupTime;
      
      // 4. Validate station hours
      const stationHoursValidation = await BookingValidator.validateStationHours(
        bookingData.stationId,
        pickupTime,
        returnTime
      );
      
      if (!stationHoursValidation.valid) {
        return {
          success: false,
          message: `❌ ${stationHoursValidation.error}`,
          suggestions: ['Chọn giờ khác', 'Liên hệ hỗ trợ'],
          actions: ['change_time', 'contact_support']
        };
      }
      
      // 5. Generate temp ID (format: PB + DDMM + 4 random chars)
      const now = nowVietnam().toDate();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const randomChars = Math.random().toString(36).substr(2, 4).toUpperCase();
      const tempId = `PB${day}${month}${randomChars}`;
      
      // 6. Calculate expiry (15 minutes)
      const expiresAt = nowVietnam().add(15, 'minutes').toDate(); 
      
      // 7.  ATOMIC: Reserve vehicle (soft lock)
      const reservedVehicle = await Vehicle.findOneAndUpdate(
        {
          _id: bookingData.vehicleId,
          status: 'available'
        },
        {
          status: 'reserved',
          reserved_for: 'holding_fee_payment',
          reserved_at: nowVietnam().toDate(),
          reserved_until: expiresAt
        },
        { new: true }
      );
      
      if (!reservedVehicle) {
        return {
          success: false,
          message: '❌ Xe đã được đặt bởi người khác. Vui lòng chọn xe khác.',
          suggestions: ['Tìm xe khác', 'Xem xe available'],
          actions: ['find_another', 'view_available']
        };
      }
      
      console.log(`🔒 Vehicle ${reservedVehicle.license_plate} RESERVED (soft lock) until ${expiresAt.toLocaleString('vi-VN')}`);
      
      // 8. Get user info for notes
      const user = await User.findById(bookingData.userId).select('fullname email');
      
      // 9. Tạo PendingBooking với rollback nếu lỗi
      let pendingBooking = null;
      let vnpayUrl = null;
      
      try {
        // 9.1. Create PendingBooking
        pendingBooking = await PendingBooking.create({
          temp_id: tempId,
        user_id: bookingData.userId,
          booking_data: {
            model: vehicle.model,
            color: vehicle.color,
            station_id: bookingData.stationId,
        vehicle_id: bookingData.vehicleId,
        start_date: bookingData.startDate,
        end_date: bookingData.endDate,
        pickup_time: pickupTime,
        return_time: returnTime,
            special_requests: '',
            notes: `Booking từ chatbot AI - Khách hàng: ${user?.fullname || 'N/A'}`,
        price_per_day: vehicle.price_per_day,
        total_days: bookingData.totalDays,
        total_price: bookingData.totalPrice,
            deposit_amount: bookingData.depositAmount
          },
          holding_fee_amount: 50000,
          expires_at: expiresAt,
          conversation_id: null,
          session_id: ''
        });
        
        console.log(`📝 PendingBooking created: ${pendingBooking.temp_id}`);
        
        // 8.2. Create VNPay payment URL for holding fee
        const vnpayService = new VNPayService();
        
        // Override return URL to holding fee callback
        const originalReturnUrl = vnpayService.config.vnp_ReturnUrl;
        vnpayService.config.vnp_ReturnUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/holding-fee/callback`;
        
        const paymentData = {
          payment_code: pendingBooking.temp_id,
          amount: 50000, // Holding fee
          payment_type: 'holding_fee'
        };
        
        const vnpayResult = vnpayService.createPaymentUrl(paymentData, '127.0.0.1');
        vnpayUrl = vnpayResult.paymentUrl;
        
        // Restore original return URL
        vnpayService.config.vnp_ReturnUrl = originalReturnUrl;
        
        // 8.3. Save VNPay URL vào PendingBooking
        pendingBooking.vnpay_url = vnpayUrl;
        await pendingBooking.save();
        
        console.log(`💳 VNPay URL created for holding fee: ${vnpayUrl}`);
        
      } catch (error) {
        // ❌ ROLLBACK: Unreserve vehicle nếu tạo PendingBooking hoặc VNPay URL lỗi
        console.error('❌ Error creating PendingBooking/VNPay URL:', error);
        
        await Vehicle.findByIdAndUpdate(bookingData.vehicleId, {
          status: 'available',
          reserved_for: '',
          reserved_at: null,
          reserved_until: null
        });
        
        if (pendingBooking) {
          await PendingBooking.findByIdAndDelete(pendingBooking._id);
        }
        
        throw error;
      }
      
      // 10. Return success message with payment URL
      return {
        success: true,
        message: `✅ **ĐẶT XE THÀNH CÔNG!**

📋 **Mã đặt chỗ:** ${tempId}
🚗 **Xe:** ${vehicle.brand} ${vehicle.model} màu ${vehicle.color} (${vehicle.license_plate})
📅 **Thời gian:** ${new Date(bookingData.startDate).toLocaleDateString('vi-VN')} - ${new Date(bookingData.endDate).toLocaleDateString('vi-VN')}
📍 **Trạm:** ${vehicle.station_id.name}
💰 **Tổng tiền:** ${bookingData.totalPrice.toLocaleString('vi-VN')} VND

🎫 **PHÍ GIỮ CHỖ: 50,000 VND** (không hoàn lại)
⏰ **Vui lòng thanh toán trong 15 phút**

💡 **Sau khi thanh toán:**
• Bạn sẽ nhận email xác nhận booking
• Phí giữ chỗ sẽ được **TRỪ VÀO TỔNG TIỀN** thuê
• Đến trạm đúng giờ để nhận xe

📱 **Link thanh toán:** ${vnpayUrl}

⚠️ **Lưu ý:**
• Nếu không thanh toán trong 15 phút, booking sẽ tự động hủy
• Phí giữ chỗ không được hoàn lại nếu bạn hủy booking
• Mang theo CCCD gốc khi đến trạm`,
        suggestions: ['Thanh toán ngay', 'Xem chi tiết', 'Hủy booking'],
        actions: ['pay_holding_fee', 'view_details', 'cancel_booking'],
        data: {
          tempId: pendingBooking.temp_id,
          paymentUrl: vnpayUrl,
          expiresAt: expiresAt.toISOString(),
          holdingFee: 50000,
          bookingDetails: {
            code: tempId,
            vehicle: {
              brand: vehicle.brand,
              model: vehicle.model,
              color: vehicle.color,
              licensePlate: vehicle.license_plate
            },
            station: {
              name: vehicle.station_id.name,
              address: vehicle.station_id.address,
              phone: vehicle.station_id.phone
            },
            dates: {
              startDate: bookingData.startDate,
              endDate: bookingData.endDate,
              totalDays: bookingData.totalDays
            },
            pricing: {
              totalPrice: bookingData.totalPrice,
              depositAmount: bookingData.depositAmount,
              holdingFee: 50000
            }
          }
        }
      };
      
    } catch (error) {
      console.error('❌ Error in confirmBooking (chatbot):', error);
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
        
        //  NẾU user đã chọn trạm cụ thể → CHỈ tìm trong trạm đó
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
        
        //  NẾU user đã chọn trạm cụ thể → CHỈ tìm trong trạm đó
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

  /**
   * Generate QR Code (giống BookingController)
   */
  async generateQRCode(bookingCode) {
    const qrText = bookingCode;
    console.log('🔍 Generating QR code for booking:', qrText);
    
    try {
      // Generate QR code as buffer
      const qrBuffer = await QRCode.toBuffer(qrText, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Upload to Cloudinary
      const cloudinaryResult = await uploadToCloudinary(qrBuffer, 'qr-codes');
      console.log('✅ QR code uploaded to Cloudinary:', cloudinaryResult.url);
      
      return {
        text: qrText,
        imageUrl: cloudinaryResult.url
      };
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      return {
        text: qrText,
        imageUrl: null
      };
    }
  }

  /**
   * Generate booking code (giống BookingController)
   */
  async generateBookingCode() {
    let code;
    let exists = true;
    
    while (exists) {
      code = 'BK' + Math.random().toString(36).substr(2, 6).toUpperCase();
      exists = await Booking.findOne({ code });
    }
    
    return code;
  }
}

module.exports = new BookingHandler();

