const Booking = require('../models/Booking');
const PendingBooking = require('../models/PendingBooking');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const { sendEmail, getBookingConfirmationTemplate, getBookingCancellationTemplate, getWalkInCustomerEmailTemplate, getBookingUpdateTemplate } = require('../config/nodemailer');
const { uploadToCloudinary } = require('../config/cloudinary');
const { formatVietnamTime, nowVietnam } = require('../config/timezone');
const DepositService = require('../services/DepositService');
const VNPayService = require('../services/VNPayService');
const QRCode = require('qrcode');
const moment = require('moment');

// Helper function to generate booking code
const generateBookingCode = async () => {
  let code;
  let exists = true;
  
  while (exists) {
    code = 'BK' + Math.random().toString(36).substr(2, 6).toUpperCase();
    exists = await Booking.findOne({ code });
  }
  
  return code;
};

// Helper function to generate QR code
const generateQRCode = async (bookingCode) => {
  const qrText = bookingCode; // Sử dụng booking code thay vì random string
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
};

// Helper function to calculate total price
const calculateTotalPrice = (pricePerDay, totalDays) => {
  return pricePerDay * totalDays;
};


// Helper function to check if user can cancel booking
const canCancelBooking = (booking) => {
  if (booking.status !== 'pending') {
    return false;
  }
  
  const now = nowVietnam().toDate();
  const bookingStart = new Date(booking.start_date);
  const timeDiff = bookingStart.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  // Không thể cancel trong vòng 2 giờ trước booking
  if (hoursDiff < 2) {
    return false;
  }
  
  return true;
};

// Create new booking - NEW FLOW WITH HOLDING FEE
const createBooking = async (req, res) => {
  try {
    const { 
      model,
      color,
      station_id, 
      start_date, 
      end_date, 
      pickup_time, 
      special_requests,
      notes 
    } = req.body;
    
    const user_id = req.user.id;
    
    // Validate input
    if (!model || !color || !station_id || !start_date || !end_date || !pickup_time) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin bắt buộc' 
      });
    }
    
    console.log('\n🚀 ========== ONLINE BOOKING WITH HOLDING FEE ==========');
    console.log(`📝 User: ${user_id}`);
    console.log(`🚗 Vehicle: ${model} ${color}`);
    console.log(`📅 Dates: ${start_date} → ${end_date}`);
    
 
    const pickupTimeParts = pickup_time.split(':');
    const pickupHour = parseInt(pickupTimeParts[0]);
    const pickupMinute = parseInt(pickupTimeParts[1]);
    
    if (isNaN(pickupHour) || isNaN(pickupMinute) || pickupHour < 0 || pickupHour > 23 || pickupMinute < 0 || pickupMinute > 59) {
      return res.status(400).json({ 
        message: 'Giờ nhận xe không hợp lệ. Vui lòng nhập theo định dạng HH:MM (ví dụ: 08:30)' 
      });
    }
    
    // Check user exists and is active
    const user = await User.findById(user_id);
    if (!user || user.status !== 'active') {
      return res.status(400).json({ 
        message: 'Tài khoản không hợp lệ hoặc đã bị khóa' 
      });
    }
    
    // Find available vehicle by model and color at the station
    // Tìm tất cả xe cùng model + color tại trạm
    const sameModelVehicles = await Vehicle.find({
      model,
      color,
      station_id,
      status: 'available',
      is_active: true
    });
    
    if (sameModelVehicles.length === 0) {
      return res.status(400).json({ 
        message: `Không có xe ${model} màu ${color} available tại trạm này` 
      });
    }
    
    // Lấy danh sách vehicle IDs để kiểm tra trùng lịch
    const vehicleIds = sameModelVehicles.map(v => v._id);
    
    // Check station exists and is active
    const station = await Station.findById(station_id);
    if (!station) {
      return res.status(404).json({ 
        message: 'Trạm không tồn tại' 
      });
    }
    
    if (station.status !== 'active') {
      return res.status(400).json({ 
        message: 'Trạm không hoạt động' 
      });
    }
    
    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
  
    const today = nowVietnam().startOf('day').toDate(); // 00:00:00 hôm nay theo giờ VN
    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0); // 00:00:00 của ngày booking
    
    if (startDateOnly < today) {
      return res.status(400).json({ 
        message: 'Ngày bắt đầu không thể là ngày trong quá khứ' 
      });
    }
    
    if (endDate <= startDate) {
      return res.status(400).json({ 
        message: 'Ngày kết thúc phải sau ngày bắt đầu' 
      });
    }
    
    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (totalDays < 1) {
      return res.status(400).json({ 
        message: 'Thời gian thuê tối thiểu 1 ngày' 
      });
    }
    
    // Kiểm tra thời gian thuê tối đa
    const MAX_RENTAL_DAYS = 30;
    if (totalDays > MAX_RENTAL_DAYS) {
      return res.status(400).json({ 
        message: `Thời gian thuê tối đa là ${MAX_RENTAL_DAYS} ngày` 
      });
    }
    
    // Kiểm tra giới hạn thời gian đặt trước
    const MAX_ADVANCE_DAYS = 30;
    const maxAdvanceDate = nowVietnam().toDate();
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_DAYS);
    
    if (startDate > maxAdvanceDate) {
      return res.status(400).json({ 
        message: `Chỉ có thể đặt xe tối đa ${MAX_ADVANCE_DAYS} ngày trước` 
      });
    }
    
    // Kiểm tra xe thuộc trạm đã chọn (đã được kiểm tra ở bước tìm xe)
  
    // Tạo return_time cùng giờ với pickup_time
    const calculatedReturnTime = `${pickupHour.toString().padStart(2, '0')}:${pickupMinute.toString().padStart(2, '0')}`;
    
    // Kiểm tra giờ pickup/return hợp lệ
    const pickupTimeObj = nowVietnam().toDate();
    pickupTimeObj.setHours(pickupHour, pickupMinute);
    const returnTimeObj = nowVietnam().toDate();
    returnTimeObj.setHours(pickupHour, pickupMinute);
    
    // Kiểm tra giờ mở/đóng cửa trạm
    const stationOpeningParts = station.opening_time.split(':');
    const stationClosingParts = station.closing_time.split(':');
    const stationOpening = nowVietnam().toDate();
    stationOpening.setHours(parseInt(stationOpeningParts[0]), parseInt(stationOpeningParts[1]));
    const stationClosing = nowVietnam().toDate();
    stationClosing.setHours(parseInt(stationClosingParts[0]), parseInt(stationClosingParts[1]));
    
    if (pickupTimeObj < stationOpening || pickupTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ nhận xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
      });
    }
    
    if (returnTimeObj < stationOpening || returnTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ trả xe (${calculatedReturnTime}) phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
      });
    }
    
    // Kiểm tra user đã có booking active
    const activeBookings = await Booking.countDocuments({
      user_id,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    const MAX_ACTIVE_BOOKINGS = 3;
    if (activeBookings >= MAX_ACTIVE_BOOKINGS) {
      return res.status(400).json({ 
        message: `Bạn chỉ có thể có tối đa ${MAX_ACTIVE_BOOKINGS} đặt xe hoạt động cùng lúc` 
      });
    }

    // : Kiểm tra user có booking trùng thời gian không
    const userConflictingBooking = await Booking.findOne({
      user_id,
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
      return res.status(400).json({ 
        message: `Bạn đã có booking ${userConflictingBooking.booking_type === 'online' ? 'online' : 'tại quầy'} trong khoảng thời gian này (${userConflictingBooking.start_date.toLocaleDateString('vi-VN')} - ${userConflictingBooking.end_date.toLocaleDateString('vi-VN')})` 
      });
    }
    
    // Kiểm tra trùng lịch đặt xe (cả online và walk_in)
    const conflictingBookings = await Booking.find({
      vehicle_id: { $in: vehicleIds },
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

    // Lấy danh sách vehicle IDs bị conflict
    const conflictingVehicleIds = conflictingBookings.map(b => b.vehicle_id.toString());

    // Filter ra những xe KHÔNG bị conflict
    const availableVehicles = sameModelVehicles.filter(v => 
      !conflictingVehicleIds.includes(v._id.toString())
    );

    if (availableVehicles.length === 0) {
      return res.status(400).json({ 
        message: `Không có xe ${model} màu ${color} available trong khoảng thời gian này. Vui lòng chọn thời gian khác hoặc xe khác.` 
      });
    }
    
    // Chọn xe có battery cao nhất trong danh sách available
    const vehicle = availableVehicles.sort((a, b) => b.battery_level - a.battery_level)[0];
    console.log(`🚗 Auto-selected vehicle: ${vehicle.name} (${vehicle.license_plate}) - Battery: ${vehicle.battery_level}%`);
    
    // Calculate pricing
    const pricePerDay = vehicle.price_per_day;
    const totalPrice = calculateTotalPrice(pricePerDay, totalDays);
    const depositAmount = DepositService.calculateDeposit(pricePerDay, totalDays);
    
    console.log(`💰 Pricing: ${pricePerDay.toLocaleString()}đ/day × ${totalDays} days = ${totalPrice.toLocaleString()}đ`);
    console.log(`💵 Deposit: ${depositAmount.toLocaleString()}đ`);
    
    // ========== NEW FLOW: RESERVE VEHICLE + CREATE PENDING BOOKING ==========
    
    
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const randomChars = Math.random().toString(36).substr(2, 4).toUpperCase();
    const tempId = `PB${day}${month}${randomChars}`;
    console.log(`🔑 Temp ID: ${tempId}`);
    
    // 2. Expires in 15 minutes
    const expiresAt = moment().add(15, 'minutes').toDate();
    
    // 3. ✅ RESERVE VEHICLE IMMEDIATELY (Soft lock - holding fee payment)
    const reservedVehicle = await Vehicle.findOneAndUpdate(
      {
        _id: vehicle._id,
        status: 'available'  // Double check still available (atomic operation)
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
      // Race condition: Vehicle was just booked by another request
      console.error(`❌ Race condition: Vehicle ${vehicle._id} was just reserved by another user`);
      return res.status(409).json({
        success: false,
        message: 'Xe vừa được đặt bởi người khác. Vui lòng thử lại.',
        code: 'VEHICLE_RACE_CONDITION'
      });
    }
    
    console.log(`🔒 Vehicle ${vehicle.license_plate} RESERVED (soft lock) until ${moment(expiresAt).format('HH:mm:ss DD/MM/YYYY')}`);
    
   
    let pendingBooking = null;
    let vnpayResult = null;
    
    try {
      // 4. Create pending booking
      pendingBooking = await PendingBooking.create({
        temp_id: tempId,
      user_id,
        booking_data: {
          model,
          color,
      station_id,
          vehicle_id: vehicle._id,
      start_date: startDate,
      end_date: endDate,
      pickup_time,
      return_time: calculatedReturnTime,
          special_requests: special_requests || '',
          notes: notes || '',
      price_per_day: pricePerDay,
      total_days: totalDays,
      total_price: totalPrice,
          deposit_amount: depositAmount
        },
        holding_fee_amount: 50000, // Fixed 50k
        status: 'pending_payment',
        expires_at: expiresAt
      });
      
      console.log(`✅ Created pending booking: ${pendingBooking._id}`);
      
      // 5. Create VNPay payment URL for holding fee
      // IMPORTANT: Override VNPay return URL to holding fee callback
      const vnpayService = new VNPayService();
      
      // Temporarily override return URL for this specific payment
      const originalReturnUrl = vnpayService.config.vnp_ReturnUrl;
      vnpayService.config.vnp_ReturnUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/holding-fee/callback`;
      
      const paymentData = {
        payment_code: tempId,
        amount: 50000, // Holding fee 50k
        payment_type: 'holding_fee'
      };
      
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
      vnpayResult = vnpayService.createPaymentUrl(paymentData, clientIP);
      
      // Restore original return URL
      vnpayService.config.vnp_ReturnUrl = originalReturnUrl;
      
      // Update pending booking với VNPay URL
      pendingBooking.vnpay_url = vnpayResult.paymentUrl;
      await pendingBooking.save();
      
      console.log(`💳 VNPay URL created: ${vnpayResult.paymentUrl.substring(0, 80)}...`);
      console.log(`⏰ Payment expires at: ${moment(expiresAt).format('HH:mm:ss DD/MM/YYYY')}`);
      
    } catch (createError) {
      // ❌ ROLLBACK: Unreserve vehicle if pending booking or VNPay creation fails
      console.error('❌ ERROR creating pending booking/VNPay URL:', createError);
      console.log('🔄 ROLLBACK: Unreserving vehicle...');
      
      await Vehicle.findByIdAndUpdate(vehicle._id, {
        status: 'available',
        reserved_for: '',
        reserved_at: null,
        reserved_until: null
      });
      
      // Delete partial pending booking if created
      if (pendingBooking) {
        await PendingBooking.findByIdAndDelete(pendingBooking._id);
        console.log('🗑️ Partial pending booking deleted');
      }
      
      console.log('✅ Vehicle unreserved successfully');
      
      return res.status(500).json({
        success: false,
        message: 'Không thể tạo booking. Vui lòng thử lại.',
        error: createError.message
      });
    }
    
    console.log('🔚 ========== END ONLINE BOOKING FLOW ==========\n');
    
    // 6. Return response with payment URL
    res.status(200).json({
      success: true,
      message: 'Vui lòng thanh toán phí giữ chỗ để hoàn tất đặt xe',
      requiresPayment: true,
      data: {
        pending_booking_id: pendingBooking._id,
        temp_id: tempId,
        
        // Vehicle info
        vehicle: {
          name: vehicle.name,
          model: vehicle.model,
          color: vehicle.color,
          license_plate: vehicle.license_plate,
          price_per_day: pricePerDay
        },
        
        // Station info
        station: {
          name: station.name,
          address: station.address
        },
        
        // Booking details
        booking_details: {
          start_date: formatVietnamTime(startDate),
          end_date: formatVietnamTime(endDate),
          pickup_time,
          return_time: calculatedReturnTime,
          total_days: totalDays,
          total_price: totalPrice,
          deposit_amount: depositAmount
        },
        
        // Payment info
        holding_fee: {
          amount: 50000,
          status: 'unpaid',
          payment_url: vnpayResult.paymentUrl,
          expires_at: formatVietnamTime(expiresAt),
          expires_in_minutes: 15
        },
        
        // Instructions
        next_steps: [
          '1. Click vào payment_url để thanh toán phí giữ chỗ 50,000đ',
          '2. Link thanh toán có hiệu lực trong 15 phút',
          '3. Sau khi thanh toán thành công, booking sẽ được tạo tự động',
          '4. Bạn sẽ nhận email xác nhận booking',
          '5. Xe sẽ được giữ chỗ cho bạn'
        ]
      }
    });
    
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi tạo booking',
      error: error.message 
    });
  }
};

// Get user's bookings
const getUserBookings = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = { user_id };
    if (status) {
      query.status = status;
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find(query)
      .populate('vehicle_id', 'name license_plate model brand year color images price_per_day deposit_amount')
      .populate('station_id', 'name address phone email opening_time closing_time')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .populate('holding_fee.payment_id', 'code amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code createdAt') 
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    // Format timezone for bookings
    const formattedBookings = bookings.map(booking => ({
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      confirmed_at: formatVietnamTime(booking.confirmed_at),
      cancelled_at: formatVietnamTime(booking.cancelled_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at),
      qr_used_at: formatVietnamTime(booking.qr_used_at),
      edit_history: booking.edit_history?.map(h => ({
        _id: h._id,
        edited_at: formatVietnamTime(h.edited_at),
        edited_by: h.edited_by,
        changes: h.changes,
        reason: h.reason
      })) || []
    }));
    
    res.status(200).json({
      message: 'Lấy danh sách booking thành công',
      bookings: formattedBookings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: bookings.length,
        totalRecords: total
      }
    });
    
  } catch (error) {
    console.error('Error getting user bookings:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy danh sách booking',
      error: error.message 
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    
    const booking = await Booking.findById(id)
      .populate('user_id', 'fullname email phone kycStatus')
      .populate('vehicle_id', 'name license_plate model brand year color images price_per_day deposit_amount')
      .populate('station_id', 'name address phone email opening_time closing_time')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .populate('holding_fee.payment_id', 'code amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code createdAt'); // ← NEW: Populate holding fee payment
    
    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking không tồn tại' 
      });
    }
    
    // Check permission (user can only see their own bookings, staff/admin can see all)
    if (booking.user_id._id.toString() !== user_id && req.user.role === 'EV Renter') {
      return res.status(403).json({ 
        message: 'Không có quyền xem booking này' 
      });
    }
    
    // Add cancellation info
    const canCancel = canCancelBooking(booking);
    
    // Format timezone for booking details
    const formattedBooking = {
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      confirmed_at: formatVietnamTime(booking.confirmed_at),
      cancelled_at: formatVietnamTime(booking.cancelled_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at),
      qr_used_at: formatVietnamTime(booking.qr_used_at)
    };
    
    res.status(200).json({
      message: 'Lấy chi tiết booking thành công',
      booking: formattedBooking,
      canCancel
    });
    
  } catch (error) {
    console.error('Error getting booking details:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy chi tiết booking',
      error: error.message 
    });
  }
};

// Confirm booking (Staff only)
const confirmBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_condition_before, staff_notes, payment_method = 'cash' } = req.body || {};
    const staff_id = req.user.id;
    
    // Check if user is staff
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể xác nhận booking' 
      });
    }
    
    // Find booking
    const booking = await Booking.findById(id)
      .populate('user_id', 'fullname email kycStatus')
      .populate('vehicle_id', 'name license_plate current_battery')
      .populate('station_id', 'name');
    
    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking không tồn tại' 
      });
    }
    
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Booking không ở trạng thái pending' 
      });
    }

    // Chặn confirm nếu quá 2 giờ sau thời điểm nhận xe
    const now = nowVietnam().toDate();
    const PICKUP_GRACE_MS = 2 * 60 * 60 * 1000; // 2 giờ

    if (now > new Date(booking.start_date.getTime() + PICKUP_GRACE_MS)) {
      return res.status(400).json({
        message: 'Booking đã quá thời gian nhận xe (quá 2 giờ). Không thể xác nhận.'
      });
    }

    // Tùy chọn: chặn luôn nếu đã bị hủy bởi cron trước đó (phòng race condition)
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        message: 'Booking đã bị hủy. Không thể xác nhận.'
      });
    }
    
    // ========== HOLDING FEE VERIFICATION (DEFENSIVE CHECK) ==========
    // NOTE: Về lý thuyết check này REDUNDANT vì:
    // - Online booking chỉ được tạo SAU KHI VNPay callback thành công
    // - PendingBooking tự động expire sau 15 phút nếu không thanh toán
    // - Nếu user không thanh toán → Không có booking nào được tạo
    // NHƯNG vẫn check để:
    // - Defense in depth: Phòng data corruption/manual edits/bugs
    // - Explicit validation: Code rõ ràng hơn
    // - Future-proof: An toàn nếu có thay đổi logic sau này
    
    if (booking.booking_type === 'online') {
      // Online booking MUST have paid holding fee
      if (!booking.holding_fee || booking.holding_fee.status !== 'paid') {
        console.error(`⚠️ UNEXPECTED: Online booking ${booking.code} without paid holding fee`);
        return res.status(400).json({
          message: 'Booking online chưa thanh toán phí giữ chỗ. Không thể xác nhận.',
          holding_fee_status: booking.holding_fee?.status || 'unpaid',
          required_action: 'User phải thanh toán phí giữ chỗ 50,000đ trước khi confirm',
          note: 'This should not happen - Contact support if you see this error'
        });
      }
      console.log(`✅ Holding fee verified: ${booking.holding_fee.amount}đ paid at ${booking.holding_fee.paid_at}`);
    } else {
      // Walk-in booking không cần holding fee
      console.log('✅ Walk-in booking - No holding fee required');
    }
    
    // Auto check-in when confirming booking
    if (!booking.qr_used_at) {
      booking.qr_used_at = nowVietnam().toDate();
      await booking.save();
    }
    
    // Check KYC status if needed
    if (booking.user_id.kycStatus !== 'approved') {
      return res.status(400).json({ 
        message: 'User chưa có KYC approved, vui lòng xác thực KYC trước' 
      });
    }
    
    // Xử lý ảnh đã upload
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      uploadedImages = req.files.map(file => file.path); 
   
    }
    
    let rental = null;
    let payment = null;
    let contract = null;
    let vehicleUpdated = false;
    let bookingUpdated = false;
    let paymentType = 'deposit'; // Thêm giá trị mặc định
    let paymentAmount = 0;       // Thêm giá trị mặc định

    try {
      // 1. Tạo rental
      rental = await Rental.create({
        code: 'RENT' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        booking_id: booking._id,
        user_id: booking.user_id._id,
        vehicle_id: booking.vehicle_id._id,
        station_id: booking.station_id._id,
        actual_start_time: nowVietnam().toDate(),
        pickup_staff_id: staff_id,
        vehicle_condition_before: {
          mileage: vehicle_condition_before?.mileage || 0,
          battery_level: vehicle_condition_before?.battery_level || booking.vehicle_id.current_battery || 100,
          exterior_condition: vehicle_condition_before?.exterior_condition || 'good',
          interior_condition: vehicle_condition_before?.interior_condition || 'good',
          notes: vehicle_condition_before?.notes || staff_notes || ''
        },
        images_before: uploadedImages, // Sử dụng ảnh đã upload
        staff_notes: staff_notes || '',
        status: 'pending_deposit',
        created_by: staff_id
      });
      
      // Cập nhật current_mileage của xe khi bắt đầu rental
      if (vehicle_condition_before?.mileage) {
        await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
          current_mileage: vehicle_condition_before.mileage
        });
        console.log(`✅ Vehicle ${booking.vehicle_id._id} mileage updated to ${vehicle_condition_before.mileage} km`);
      }
      
      // 2. Chuẩn bị thông tin payment
      // ✅ TRỪ holding fee nếu là online booking
      const holdingFeePaid = (booking.booking_type === 'online' && booking.holding_fee?.status === 'paid') 
        ? booking.holding_fee.amount 
        : 0;
      
      if (booking.total_days < 3) {
        // Thuê < 3 ngày, thanh toán ngay toàn bộ (trừ holding fee đã TT)
        paymentType = 'rental_fee';
        paymentAmount = booking.total_price - holdingFeePaid;
      } else {
        // Thuê >= 3 ngày, cọc trước (trừ holding fee đã TT)
        paymentType = 'deposit';
        paymentAmount = booking.deposit_amount - holdingFeePaid;
      }

      console.log(`💰 Payment calculation:
        - Type: ${paymentType}
        - Original amount: ${paymentType === 'deposit' ? booking.deposit_amount : booking.total_price}đ
        - Holding fee paid: ${holdingFeePaid}đ
        - Final amount to pay: ${paymentAmount}đ`);

      // 3. Tạo payment tự động với phương thức thanh toán được chọn
      payment = await Payment.create({
        code: 'PAY' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        rental_id: rental._id,
        booking_id: booking._id,
        user_id: booking.user_id._id,
        amount: paymentAmount,
        payment_type: paymentType,
        payment_method: payment_method, // Sử dụng phương thức thanh toán từ request
        status: 'pending',
        notes: holdingFeePaid > 0 
          ? `${paymentType === 'deposit' ? 'Tiền cọc' : 'Phí thuê xe'} (đã trừ holding fee ${holdingFeePaid.toLocaleString('vi-VN')}đ)`
          : (paymentType === 'deposit' ? 'Tiền cọc thuê xe' : 'Phí thuê xe'),
        is_penalty_fee: false, //  Confirm booking, không phải phí phạt
        processed_by: staff_id
      });
      
      
     
      
      // 4. Giữ nguyên vehicle status là 'reserved' (chưa chuyển sang 'rented' vì chưa thanh toán cọc)
      // Vehicle sẽ chuyển sang 'rented' khi payment completed
      
      // 5. Update booking status
      booking.status = 'confirmed';
      booking.confirmed_at = nowVietnam().toDate();
      booking.confirmed_by = staff_id;
      await booking.save();
      bookingUpdated = true;
      
      // 6. Update station stats (có thể lỗi, nhưng không quan trọng)
      try {
        const station = await Station.findById(booking.station_id._id);
        await station.syncVehicleCount();
      } catch (stationError) {
        // Chỉ log trong development, không log warning
        if (process.env.NODE_ENV === 'development') {
          console.log('Station sync failed:', stationError.message);
        }
        // Không throw error, chỉ warning
      }
      
    } catch (error) {
      // Rollback đầy đủ
      if (rental) await Rental.findByIdAndDelete(rental._id);
      // Không cần cleanup payment vì không tạo tự động
      if (contract) await Contract.findByIdAndDelete(contract._id);
      
      if (vehicleUpdated) {
        await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
          status: 'reserved'
        });
      }
      
      if (bookingUpdated) {
        booking.status = 'pending';
        booking.confirmed_at = null;
        booking.confirmed_by = null;
        await booking.save();
      }
      
      throw error;
    }
    
    // Format timezone for response
    const formattedBooking = {
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      confirmed_at: formatVietnamTime(booking.confirmed_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at),
      qr_used_at: formatVietnamTime(booking.qr_used_at)
    };
    
    const formattedRental = {
      ...rental.toObject(),
      images_before: uploadedImages, // Trả về ảnh đã upload
      actual_start_time: formatVietnamTime(rental.actual_start_time),
      createdAt: formatVietnamTime(rental.createdAt),
      updatedAt: formatVietnamTime(rental.updatedAt)
    };
    
    res.status(200).json({
      message: 'Xác nhận booking thành công',
      booking: formattedBooking,
      rental: formattedRental,
      payment_info: {
        type: paymentType,
        amount: paymentAmount,
        rental_id: rental._id,
        booking_id: booking._id,
        user_id: booking.user_id._id,
        message: 'Sử dụng thông tin này để tạo payment riêng'
      }
    });
    
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi xác nhận booking',
      error: error.message 
    });
  }
};

// Cancel booking - WITH HOLDING FEE POLICY
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refund_to_customer = false } = req.body; // ← THÊM refund_to_customer
    const user_id = req.user.id;
    
    console.log('\n🚫 ========== CANCEL BOOKING REQUEST ==========');
    console.log(`📝 Booking ID: ${id}`);
    console.log(`👤 User ID: ${user_id}`);
    console.log(`🔑 User Role: ${req.user.role}`);
    console.log(`💰 Refund to customer: ${refund_to_customer}`);
    
    // Find booking
    const booking = await Booking.findById(id)
      .populate('user_id', 'fullname email')
      .populate('vehicle_id', 'name license_plate')
      .populate('station_id', 'name');
    
    if (!booking) {
      return res.status(404).json({ 
        message: 'Booking không tồn tại' 
      });
    }
    
    console.log(`🔍 Booking: ${booking.code} (${booking.booking_type})`);
    console.log(`💰 Holding fee status: ${booking.holding_fee?.status || 'N/A'}`);
    
    // Check permission - cho phép Staff cancel booking của user
    if (booking.user_id._id.toString() !== user_id && req.user.role !== 'Station Staff') {
      return res.status(403).json({ 
        message: 'Không có quyền hủy booking này' 
      });
    }
    
    // Check if can cancel
    if (!canCancelBooking(booking)) {
      return res.status(400).json({ 
        message: 'Không thể hủy booking này. Booking đã được xác nhận hoặc quá gần thời gian bắt đầu' 
      });
    }
    
    // ========== HOLDING FEE REFUND POLICY ==========
    // Staff cancel: Có option refund (tùy trường hợp)
    // User cancel: KHÔNG được hoàn lại
    // Walk-in bookings: Không có holding fee
    
    let refundInfo = null;
    const isStaffCancel = (req.user.role === 'Station Staff' || req.user.role === 'Admin');
    
    if (booking.booking_type === 'online' && booking.holding_fee?.status === 'paid') {
      
      // ========== STAFF CANCEL + REFUND OPTION ==========
      if (isStaffCancel && refund_to_customer) {
        // ✅ STAFF CHỌN REFUND - Tạo payment refund
        console.log('✅ STAFF REFUND - Phí giữ chỗ sẽ được hoàn lại bằng tiền mặt');
        
        const Payment = require('../models/Payment');
        
        try {
          const refundPayment = await Payment.create({
            code: `REF${Date.now()}`,
            user_id: booking.user_id._id,
            booking_id: booking._id,
            rental_id: booking.rental_id || null,
            
            amount: booking.holding_fee.amount,
            payment_method: 'cash',
            payment_type: 'refund',
            status: 'completed',
            
            reason: `Hoàn phí giữ chỗ - ${reason || 'Nhân viên hủy booking'}`,
            related_payment_id: booking.holding_fee.payment_id,
            processed_by: user_id,
            completed_at: nowVietnam().toDate(),
            completed_by: user_id,
            
            notes: `Đã hoàn tiền mặt tại trạm bởi ${req.user.fullname || 'Nhân viên'}`
          });
          
          console.log(`💵 Refund payment created: ${refundPayment.code}`);
          
          refundInfo = {
            holding_fee_paid: booking.holding_fee.amount,
            holding_fee_refundable: booking.holding_fee.amount,
            refund_payment_id: refundPayment._id,
            refund_payment_code: refundPayment.code,
            policy: 'REFUNDABLE - Staff cancelled with refund option',
            message: `✅ Đã hoàn ${booking.holding_fee.amount.toLocaleString('vi-VN')}đ tiền mặt cho khách tại quầy`
          };
          
        } catch (paymentError) {
          console.error('❌ Error creating refund payment:', paymentError);
          refundInfo = {
            holding_fee_paid: booking.holding_fee.amount,
            holding_fee_refundable: 0,
            policy: 'ERROR - Failed to create refund payment',
            message: '❌ Lỗi khi tạo phiếu hoàn tiền. Vui lòng thử lại.'
          };
        }
        
      } else {
        // ❌ USER CANCEL hoặc STAFF KHÔNG CHỌN REFUND
        console.log('⚠️ HOLDING FEE FORFEITED - Phí giữ chỗ KHÔNG được hoàn lại');
        
        refundInfo = {
          holding_fee_paid: booking.holding_fee.amount,
          holding_fee_refundable: 0,
          policy: isStaffCancel 
            ? 'NON-REFUNDABLE - Staff cancelled without refund (customer violation)'
            : 'NON-REFUNDABLE - User cancelled',
          message: `❌ Phí giữ chỗ ${booking.holding_fee.amount.toLocaleString('vi-VN')}đ KHÔNG được hoàn lại`
        };
      }
      
    } else if (booking.booking_type === 'walk_in') {
      console.log('✅ Walk-in booking - No holding fee');
      refundInfo = {
        holding_fee_paid: 0,
        holding_fee_refundable: 0,
        policy: 'Walk-in booking không có phí giữ chỗ',
        message: 'Không có phí giữ chỗ'
      };
    } else {
      console.log('ℹ️ No holding fee paid yet');
      refundInfo = {
        holding_fee_paid: 0,
        holding_fee_refundable: 0,
        policy: 'Chưa thanh toán phí giữ chỗ',
        message: 'Không có phí giữ chỗ cần hoàn lại'
      };
    }
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancellation_reason = reason || 'User cancelled';
    booking.cancelled_at = nowVietnam().toDate();
    booking.cancelled_by = user_id;
    await booking.save();
    
    console.log(`✅ Booking ${booking.code} cancelled`);
    
    // Update vehicle status back to available + unreserve all fields
    await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
      status: 'available',
      reserved_for: '',
      reserved_at: null,
      reserved_until: null
    });
    
    console.log(`🚗 Vehicle ${booking.vehicle_id.license_plate} → available (unreserved)`);
    
    // Update station stats
    const station = await Station.findById(booking.station_id._id);
    await station.syncVehicleCount();
    
    // Send cancellation email
    try {
      await sendEmail({
        to: booking.user_id.email,
        subject: 'Hủy đặt xe - EV Rental',
        html: getBookingCancellationTemplate(booking.user_id.fullname, booking, refundInfo)
      });
      console.log('✅ Email hủy booking đã được gửi đến:', booking.user_id.email);
    } catch (emailError) {
      console.error('❌ Lỗi khi gửi email hủy:', emailError.message);
    }
    
    console.log('🔚 ========== END CANCEL BOOKING ==========\n');
    
    // Format timezone for response
    const formattedBooking = {
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      cancelled_at: formatVietnamTime(booking.cancelled_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at)
    };
    
    res.status(200).json({
      message: 'Hủy booking thành công',
      booking: formattedBooking,
      refund_info: refundInfo // NEW: Thông tin về refund policy
    });
    
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi hủy booking',
      error: error.message 
    });
  }
};

// Get all bookings (Admin/Staff)
const getAllBookings = async (req, res) => {
  try {
    const { status, station_id, page = 1, limit = 10, search } = req.query;
    
    // Check permission
    if (req.user.role === 'EV Renter') {
      return res.status(403).json({ 
        message: 'Không có quyền truy cập' 
      });
    }
    
    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (station_id) {
      query.station_id = station_id;
    }
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { 'user_id.fullname': { $regex: search, $options: 'i' } },
        { 'user_id.email': { $regex: search, $options: 'i' } },
        { 'user_id.phone': { $regex: search, $options: 'i' } },
        { 'vehicle_id.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find(query)
      .populate('user_id', 'fullname email phone kycStatus')
      .populate('vehicle_id', 'name license_plate model brand year color images price_per_day deposit_amount')
      .populate('station_id', 'name address phone email opening_time closing_time')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .populate('holding_fee.payment_id', 'code amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code createdAt') // ← NEW: Populate holding fee payment
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    // Format timezone for all bookings
    const formattedBookings = bookings.map(booking => ({
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      confirmed_at: formatVietnamTime(booking.confirmed_at),
      cancelled_at: formatVietnamTime(booking.cancelled_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at),
      qr_used_at: formatVietnamTime(booking.qr_used_at),
      edit_history: booking.edit_history?.map(h => ({
        _id: h._id,
        edited_at: formatVietnamTime(h.edited_at),
        edited_by: h.edited_by,
        changes: h.changes,
        reason: h.reason
      })) || []
    }));
    
    res.status(200).json({
      message: 'Lấy danh sách booking thành công',
      bookings: formattedBookings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: bookings.length,
        totalRecords: total
      }
    });
    
  } catch (error) {
    console.error('Error getting all bookings:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy danh sách booking',
      error: error.message 
    });
  }
};

// Get station bookings (Staff)
const getStationBookings = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10, 
      search,
      startDate,
      endDate,
      dateType = 'booking' // 'booking' (ngày tạo), 'pickup' (ngày lấy xe), 'return' (ngày trả xe)
    } = req.query;
    const staff_id = req.user.id;
    
    // Check if user is staff
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể xem booking của station' 
      });
    }
    
    // Get staff's station
    const staff = await User.findById(staff_id);
    if (!staff.stationId) {
      return res.status(400).json({ 
        message: 'Nhân viên chưa được gán station' 
      });
    }
    
    // Build query
    const query = { station_id: staff.stationId };
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { 'user_id.fullname': { $regex: search, $options: 'i' } },
        { 'user_id.email': { $regex: search, $options: 'i' } },
        { 'user_id.phone': { $regex: search, $options: 'i' } },
        { 'vehicle_id.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date filters
    if (startDate || endDate) {
      const dateQuery = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        dateQuery.$gte = start;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        dateQuery.$lte = end;
      }
      
      // Apply date filter based on dateType
      switch (dateType) {
        case 'pickup':
          // Combine start_date + pickup_time
          query.start_date = dateQuery;
          query.pickup_time = { $exists: true };
          break;
        case 'return':
          query.end_date = dateQuery;
          break;
        case 'booking':
        default:
          query.createdAt = dateQuery;
          break;
      }
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find(query)
      .populate('user_id', 'fullname email phone kycStatus')
      .populate('vehicle_id', 'name license_plate model brand year color images price_per_day deposit_amount')
      .populate('station_id', 'name address phone email opening_time closing_time')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .populate('holding_fee.payment_id', 'code amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code createdAt') // ← NEW: Populate holding fee payment
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    // Format timezone for all bookings
    const formattedBookings = bookings.map(booking => ({
      ...booking.toObject(),
      start_date: formatVietnamTime(booking.start_date),
      end_date: formatVietnamTime(booking.end_date),
      createdAt: formatVietnamTime(booking.createdAt),
      updatedAt: formatVietnamTime(booking.updatedAt),
      confirmed_at: formatVietnamTime(booking.confirmed_at),
      cancelled_at: formatVietnamTime(booking.cancelled_at),
      qr_expires_at: formatVietnamTime(booking.qr_expires_at),
      qr_used_at: formatVietnamTime(booking.qr_used_at),
      edit_history: booking.edit_history?.map(h => ({
        _id: h._id,
        edited_at: formatVietnamTime(h.edited_at),
        edited_by: h.edited_by,
        changes: h.changes,
        reason: h.reason
      })) || []
    }));
    
    res.status(200).json({
      message: 'Lấy danh sách booking station thành công',
      bookings: formattedBookings,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: bookings.length,
        totalRecords: total
      }
    });
    
  } catch (error) {
    console.error('Error getting station bookings:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy danh sách booking station',
      error: error.message 
    });
  }
};

// Scan QR code to get booking details and auto check-in
const scanQRCode = async (req, res) => {
  try {
    const { qr_code } = req.body;
    const staff_id = req.user.id;
    
    if (!qr_code) {
      return res.status(400).json({ 
        message: 'Vui lòng cung cấp QR code' 
      });
    }
    
    // Check if staff belongs to a station
    const staff = await User.findById(staff_id);
    
    if (!staff.stationId) {
      return res.status(400).json({ 
        message: 'Nhân viên chưa được gán station' 
      });
    }
    
    // Find booking by QR code
    const booking = await Booking.findOne({ 
      qr_code
    })
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model brand color')
      .populate('station_id', 'name address phone');
    
    if (!booking) {
      return res.status(404).json({ 
        message: 'QR code không hợp lệ hoặc đã hết hạn' 
      });
    }
    
    // Check if booking is cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Booking đã bị hủy',
        booking: {
          code: booking.code,
          status: booking.status,
          cancelled_at: booking.cancelled_at,
          cancellation_reason: booking.cancellation_reason
        }
      });
    }
    
    // Check if booking status is valid for scanning
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ 
        message: 'Booking không ở trạng thái có thể quét QR code' 
      });
    }
    
    // Check if QR code is expired
    if (booking.qr_expires_at && nowVietnam().toDate() > booking.qr_expires_at) {
      return res.status(400).json({ 
        message: 'QR code đã hết hạn' 
      });
    }
    
    // Check if staff belongs to the same station as the booking
    if (staff.stationId.toString() !== booking.station_id._id.toString()) {
      return res.status(403).json({ 
        message: 'Bạn chỉ có thể quét QR code của booking thuộc station của mình' 
      });
    }
    
    // Auto check-in if not already used
    let isCheckedIn = false;
    if (!booking.qr_used_at) {
      // Update booking to mark as checked-in
      await Booking.findByIdAndUpdate(booking._id, {
        qr_used_at: nowVietnam().toDate()
      });
      isCheckedIn = true;
    }
    
    res.status(200).json({
      message: isCheckedIn ? 'QR code hợp lệ - Đã check-in thành công' : 'QR code hợp lệ - Đã được check-in trước đó',
      booking: {
        _id: booking._id,
        code: booking.code,
        user: booking.user_id,
        vehicle: booking.vehicle_id,
        station: booking.station_id,
        start_date: formatVietnamTime(booking.start_date),
        end_date: formatVietnamTime(booking.end_date),
        pickup_time: booking.pickup_time,
        return_time: booking.return_time,
        status: booking.status,
        qr_expires_at: formatVietnamTime(booking.qr_expires_at),
        qr_used_at: isCheckedIn ? formatVietnamTime(nowVietnam().toDate()) : formatVietnamTime(booking.qr_used_at),
        isCheckedIn: true
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi scan QR code:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};


// Create walk-in booking (Staff only)
const createWalkInBooking = async (req, res) => {
  try {
    // Chỉ Staff mới được tạo walk-in booking
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể tạo booking walk-in' 
      });
    }

    const {
      // Thông tin khách hàng
      customer_name,
      customer_phone,
      customer_email,
      customer_cmnd,
      
      // Thông tin đặt xe
      model,
      color,
      start_date,
      end_date,
      pickup_time,
      return_time,
      special_requests,
      notes
    } = req.body;

  
    if (!customer_name || !customer_phone) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin khách hàng bắt buộc (tên, số điện thoại)' 
      });
    }
    
    // Validate phone number format (Vietnamese phone number)
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(customer_phone)) {
      return res.status(400).json({ 
        message: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (ví dụ: 0123456789 hoặc +84123456789)' 
      });
    }
    
    // Validate email format if provided
    if (customer_email && customer_email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customer_email)) {
        return res.status(400).json({ 
          message: 'Email không hợp lệ. Vui lòng nhập email đúng định dạng (ví dụ: user@example.com)' 
        });
      }
    }

    // Validate thông tin đặt xe
    if (!model || !color || !start_date || !end_date || !pickup_time) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin đặt xe bắt buộc' 
      });
    }

    // Tự động lấy station_id từ Staff đang đăng nhập
    const station_id = req.user.stationId;
    
    if (!station_id) {
      return res.status(400).json({ 
        message: 'Staff chưa được gán trạm. Vui lòng liên hệ Admin để được gán trạm.' 
      });
    }

    // Tìm xe available TRƯỚC
    const sameModelVehicles = await Vehicle.find({
      model,
      color,
      station_id,
      status: 'available',
      is_active: true
    });
    
    console.log(`🔍 Tìm xe ${model} màu ${color} tại trạm ${station_id}:`, sameModelVehicles.length, 'xe');
    
    if (sameModelVehicles.length === 0) {
      return res.status(400).json({ 
        message: `Không có xe ${model} màu ${color} available tại trạm này` 
      });
    }

    // Kiểm tra trùng lịch TRƯỚC
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const vehicleIds = sameModelVehicles.map(v => v._id);
    
  
    // Kiểm tra ngày trong quá khứ
    const today = nowVietnam().startOf('day').toDate(); // 00:00:00 hôm nay theo giờ VN
    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0); // 00:00:00 của ngày booking
    
    if (startDateOnly < today) {
      return res.status(400).json({ 
        message: 'Ngày bắt đầu không thể là ngày trong quá khứ' 
      });
    }
    
    if (startDate >= endDate) {
      return res.status(400).json({ 
        message: 'Ngày bắt đầu phải nhỏ hơn ngày kết thúc',
        details: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }
      });
    }
    
    // Calculate total days
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    if (totalDays < 1) {
      return res.status(400).json({ 
        message: 'Thời gian thuê tối thiểu 1 ngày' 
      });
    }
    
    // Kiểm tra thời gian thuê tối đa
    const MAX_RENTAL_DAYS = 30;
    if (totalDays > MAX_RENTAL_DAYS) {
      return res.status(400).json({ 
        message: `Thời gian thuê tối đa là ${MAX_RENTAL_DAYS} ngày` 
      });
    }
    
    // Kiểm tra giới hạn thời gian đặt trước
    const MAX_ADVANCE_DAYS = 30;
    const maxAdvanceDate = nowVietnam().toDate();
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_DAYS);
    
    if (startDate > maxAdvanceDate) {
      return res.status(400).json({ 
        message: `Chỉ có thể đặt xe tối đa ${MAX_ADVANCE_DAYS} ngày trước` 
      });
    }
    
    console.log(`📅 Kiểm tra trùng lịch từ ${startDate.toISOString()} đến ${endDate.toISOString()}`);
    console.log(`🚗 Vehicle IDs:`, vehicleIds);
    
    const conflictingBookings = await Booking.find({
      vehicle_id: { $in: vehicleIds },
      status: { $in: ['pending', 'confirmed'] }, // Chỉ kiểm tra booking đang pending hoặc confirmed
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

    // Lấy danh sách vehicle IDs bị conflict
    const conflictingVehicleIds = conflictingBookings.map(b => b.vehicle_id.toString());

    // Filter ra những xe KHÔNG bị conflict
    const availableVehicles = sameModelVehicles.filter(v => 
      !conflictingVehicleIds.includes(v._id.toString())
    );

    if (availableVehicles.length === 0) {
      console.log(`❌ Không có xe ${model} màu ${color} available trong khoảng thời gian này`);
      return res.status(400).json({ 
        message: `Không có xe ${model} màu ${color} available trong khoảng thời gian này. Vui lòng chọn thời gian khác hoặc xe khác.`
      });
    }
    
    console.log(`✅ Tìm thấy ${availableVehicles.length} xe available`);


    const pickupTimeParts = pickup_time.split(':');
    const pickupHour = parseInt(pickupTimeParts[0]);
    const pickupMinute = parseInt(pickupTimeParts[1]);
    
    // Validate time format
    if (isNaN(pickupHour) || isNaN(pickupMinute) || pickupHour < 0 || pickupHour > 23 || pickupMinute < 0 || pickupMinute > 59) {
      return res.status(400).json({ 
        message: 'Giờ nhận xe không hợp lệ. Vui lòng nhập theo định dạng HH:MM (ví dụ: 08:30)' 
      });
    }
    
    const calculatedReturnTime = `${pickupHour.toString().padStart(2, '0')}:${pickupMinute.toString().padStart(2, '0')}`;
    
    // Kiểm tra giờ mở/đóng cửa trạm
    const station = await Station.findById(station_id);
    if (!station) {
      return res.status(404).json({ 
        message: 'Trạm không tồn tại' 
      });
    }
    
    if (station.status !== 'active') {
      return res.status(400).json({ 
        message: 'Trạm không hoạt động' 
      });
    }
    
    // Kiểm tra giờ pickup/return hợp lệ
    const pickupTimeObj = nowVietnam().toDate();
    pickupTimeObj.setHours(pickupHour, pickupMinute);
    const returnTimeObj = nowVietnam().toDate();
    returnTimeObj.setHours(pickupHour, pickupMinute);
    
    // Kiểm tra giờ mở/đóng cửa trạm
    const stationOpeningParts = station.opening_time.split(':');
    const stationClosingParts = station.closing_time.split(':');
    const stationOpening = nowVietnam().toDate();
    stationOpening.setHours(parseInt(stationOpeningParts[0]), parseInt(stationOpeningParts[1]));
    const stationClosing = nowVietnam().toDate();
    stationClosing.setHours(parseInt(stationClosingParts[0]), parseInt(stationClosingParts[1]));
    
    if (pickupTimeObj < stationOpening || pickupTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ nhận xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
      });
    }
    
    if (returnTimeObj < stationOpening || returnTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ trả xe (${calculatedReturnTime}) phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
      });
    }

    // Tìm hoặc tạo user cho walk-in customer SAU KHI đã validate
    let customer = await User.findOne({ 
      $or: [
        { phone: customer_phone },
        { email: customer_email }
      ]
    });

    if (customer) {
      //  Kiểm tra số lượng booking active của user
      const activeBookings = await Booking.countDocuments({
        user_id: customer._id,
        status: { $in: ['pending', 'confirmed'] }
      });
      
      const MAX_ACTIVE_BOOKINGS = 3;
      if (activeBookings >= MAX_ACTIVE_BOOKINGS) {
        return res.status(400).json({ 
          message: `Khách hàng chỉ có thể có tối đa ${MAX_ACTIVE_BOOKINGS} đặt xe hoạt động cùng lúc` 
        });
      }

     
      const userConflictingBooking = await Booking.findOne({
        user_id: customer._id,
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
        return res.status(400).json({ 
          message: `Khách hàng đã có booking ${userConflictingBooking.booking_type === 'online' ? 'online' : 'tại quầy'} trong khoảng thời gian này (${userConflictingBooking.start_date.toLocaleDateString('vi-VN')} - ${userConflictingBooking.end_date.toLocaleDateString('vi-VN')})` 
        });
      }
    } else {
      // Tạo password random
      const crypto = require('crypto');
      const randomPassword = crypto.randomBytes(8).toString('hex');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Tạo user mới
      customer = await User.create({
        fullname: customer_name,
        phone: customer_phone,
        email: customer_email || '',
        passwordHash: hashedPassword,
        role: 'EV Renter',
        status: 'active',
        kycStatus: 'not_submitted'
      });

      // Gửi email thông tin đăng nhập
      try {
        const emailHtml = getWalkInCustomerEmailTemplate(customer_name, customer_email || customer_phone + '@walkin.evrental.com', randomPassword);
        await sendEmail({
          to: customer_email || customer_phone + '@walkin.evrental.com',
          subject: 'Tài khoản EV Rental - Thông tin đăng nhập',
          html: emailHtml
        });
        console.log(`Email đã gửi thành công cho walk-in customer: ${customer_email || customer_phone}`);
      } catch (emailError) {
        console.error('Lỗi gửi email:', emailError);
        // Không throw error, chỉ log để không ảnh hưởng đến việc tạo booking
      }
    }

    // Chọn xe có battery cao nhất trong danh sách available
    const vehicle = availableVehicles.sort((a, b) => b.battery_level - a.battery_level)[0];
    console.log(`🚗 Auto-selected vehicle: ${vehicle.name} (${vehicle.license_plate}) - Battery: ${vehicle.battery_level}%`);
    
    // Calculate pricing
    const pricePerDay = vehicle.price_per_day;
    const rentalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const totalPrice = calculateTotalPrice(pricePerDay, rentalDays);
    const depositAmount = DepositService.calculateDeposit(pricePerDay, rentalDays);
    
    // Generate booking code and QR code
    const code = await generateBookingCode();
    const qrCodeData = await generateQRCode(code);
    const qrExpiresAt = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    
    // Cập nhật trạng thái xe
    const updatedVehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicle._id, status: 'available' },
      { status: 'reserved' },
      { new: true }
    );
    
    if (!updatedVehicle || updatedVehicle.status !== 'reserved') {
      return res.status(400).json({ 
        message: 'Xe đã được đặt bởi người khác' 
      });
    }
    
    // Tạo booking
    const booking = await Booking.create({
      code,
      user_id: customer._id,
      vehicle_id: vehicle._id,
      station_id,
      start_date: startDate,
      end_date: endDate,
      pickup_time,
      return_time: calculatedReturnTime,
      booking_type: 'walk_in',
      price_per_day: pricePerDay,
      total_days: rentalDays,
      total_price: totalPrice,
      deposit_amount: depositAmount,
      special_requests: special_requests || '',
      notes: notes || '',
      qr_code: qrCodeData.text,
      qr_expires_at: qrExpiresAt,
      status: 'pending',
      created_by: req.user._id
    });

    // Gửi email xác nhận booking cho walk-in customer
    try {
  
      if (!customer_name) {
        console.error('❌ customer_name is undefined or null');
        throw new Error('customer_name is required for email');
      }
      
      const station = await Station.findById(station_id);
      const emailHtml = getBookingConfirmationTemplate(customer_name, {
        bookingId: booking._id.toString(),
        bookingCode: booking.code,
        carModel: vehicle.name,
        pickupTime: `${pickup_time} - ${startDate.toLocaleDateString('vi-VN')}`,
        pickupLocation: station.name,
        returnTime: `${calculatedReturnTime} - ${endDate.toLocaleDateString('vi-VN')}`,
        totalCost: totalPrice.toLocaleString('vi-VN') + ' VND',
        qrCode: booking.qr_code,
        qrCodeImage: qrCodeData.imageUrl,
        qrExpiresAt: booking.qr_expires_at.toLocaleString('vi-VN')
      });
      
      await sendEmail({
        to: customer_email || customer_phone + '@walkin.evrental.com',
        subject: 'Xác nhận đặt xe điện - EV Rental (Walk-in)',
        html: emailHtml
      });
      console.log(`✅ Email xác nhận booking đã được gửi cho walk-in customer: ${customer_email || customer_phone}`);
    } catch (emailError) {
      console.error('❌ Lỗi khi gửi email xác nhận booking:', emailError.message);
      // Không throw error, chỉ log
    }

    // Populate thông tin
    await booking.populate([
      { path: 'user_id', select: 'fullname email phone' },
      { path: 'vehicle_id', select: 'name model color license_plate' },
      { path: 'station_id', select: 'name address' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Tạo booking walk-in thành công',
      data: {
        booking: {
          id: booking._id,
          code: booking.code,
          customer: {
            name: customer.fullname,
            phone: customer.phone,
            email: customer.email
          },
          vehicle: {
            name: vehicle.name,
            model: vehicle.model,
            color: vehicle.color,
            license_plate: vehicle.license_plate
          },
          station: booking.station_id.name,
          start_date: booking.start_date,
          end_date: booking.end_date,
          total_price: booking.total_price,
          deposit_amount: booking.deposit_amount,
          qr_code: booking.qr_code,
          qr_expires_at: booking.qr_expires_at
        },
        next_steps: [
          'Upload KYC cho khách hàng',
          'Xác thực KYC',
          'Confirm booking để tạo rental'
        ]
      }
    });

  } catch (error) {
    console.error('Lỗi khi tạo booking walk-in:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi tạo booking walk-in',
      error: error.message 
    });
  }
};

// Update booking (User only - before 24h)
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, station_id, model, color, reason } = req.body; 
    const user_id = req.user.id;
    
    // 1. Find booking
    const booking = await Booking.findById(id)
      .populate('user_id', 'fullname email')
      .populate('vehicle_id', 'name license_plate model brand color') // model & color are strings!
      .populate('station_id', 'name address');
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking không tồn tại' 
      });
    }
    
    // 2. Check ownership
    if (booking.user_id._id.toString() !== user_id) {
      return res.status(403).json({ 
        success: false,
        message: 'Bạn không có quyền chỉnh sửa booking này' 
      });
    }
    
    // 3. Only allow editing online bookings
    if (booking.booking_type !== 'online') {
      return res.status(400).json({ 
        success: false,
        message: 'Chỉ cho phép chỉnh sửa booking online',
        current_type: booking.booking_type
      });
    }
    
    // 4. Only allow editing pending bookings
    if (booking.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: `Không thể chỉnh sửa booking đã ${booking.status}`,
        current_status: booking.status,
        allowed_status: 'pending'
      });
    }
    
    // 5. Must have paid holding fee
    if (booking.holding_fee?.status !== 'paid') {
      return res.status(400).json({ 
        success: false,
        message: 'Booking chưa thanh toán phí giữ chỗ',
        holding_fee_status: booking.holding_fee?.status || 'unpaid'
      });
    }
    
    // 6. ✋ CHECK EDIT COUNT - Only allow 1 edit
    const currentEditCount = booking.edit_count || 0;
    
    if (currentEditCount >= 1) {
      return res.status(400).json({ 
        success: false,
        message: '❌ Bạn đã chỉnh sửa booking này 1 lần rồi. Không thể chỉnh sửa thêm!',
        edit_count: currentEditCount,
        max_edits_allowed: 1,
        last_edited: formatVietnamTime(booking.updatedAt), // Using updatedAt from timestamps
        edit_reason: booking.edit_reason || '',
        suggestion: 'Vui lòng hủy booking này (mất phí giữ chỗ 50k) và đặt lại booking mới nếu cần thay đổi'
      });
    }
    
    // 7. ⏰ CHECK TIME - Must edit at least 24h before pickup
    const now = nowVietnam().toDate();
    const pickupTime = new Date(booking.start_date);
    const MINIMUM_EDIT_TIME = 24 * 60 * 60 * 1000; // 24 hours
    const timeUntilPickup = pickupTime - now;
    
    if (timeUntilPickup < MINIMUM_EDIT_TIME) {
      const hoursRemaining = Math.floor(timeUntilPickup / (60 * 60 * 1000));
      
      return res.status(400).json({ 
        success: false,
        message: 'Không thể chỉnh sửa booking trong vòng 24 giờ trước khi nhận xe',
        details: {
          pickup_time: formatVietnamTime(booking.start_date),
          hours_remaining: hoursRemaining,
          minimum_required: 24,
          policy: 'Booking phải được chỉnh sửa trước thời gian nhận xe ít nhất 24 giờ'
        },
        alternatives: [
          {
            action: 'cancel',
            description: 'Hủy booking này và tạo booking mới',
            note: 'Phí giữ chỗ 50,000đ sẽ KHÔNG được hoàn lại'
          },
          {
            action: 'contact_support',
            description: 'Liên hệ trạm để được hỗ trợ đặc biệt',
            phone: booking.station_id.phone
          }
        ]
      });
    }
    
    // ========== PROCESS UPDATE ==========
    
    // 7. Parse dates
    const newStartDate = start_date ? new Date(start_date) : booking.start_date;
    const newEndDate = end_date ? new Date(end_date) : booking.end_date;
    
    // Validate new dates
    if (newStartDate <= now) {
      return res.status(400).json({ 
        success: false,
        message: 'Ngày nhận xe mới phải sau thời điểm hiện tại' 
      });
    }
    
    if (newEndDate <= newStartDate) {
      return res.status(400).json({ 
        success: false,
        message: 'Ngày trả xe phải sau ngày nhận xe' 
      });
    }
    
    const totalDays = Math.ceil((newEndDate - newStartDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // 8. Get new station (or keep old)
    const newStationId = station_id || booking.station_id._id.toString();
    
    const newStation = await Station.findById(newStationId);
    
    if (!newStation || newStation.status !== 'active') {
      return res.status(400).json({ 
        success: false,
        message: 'Trạm không tồn tại hoặc không hoạt động',
        station_id: newStationId,
        station_status: newStation?.status || 'not_found'
      });
    }
    
    const searchModel = model || booking.vehicle_id.model;   // Use new or keep old
    const searchColor = color || booking.vehicle_id.color;   
    
    // 10. Find available vehicles at new station for new dates (same as createBooking)
    const availableVehicles = await Vehicle.find({
      model: searchModel,      // ← String, not ObjectID
      color: searchColor,      // ← String
      station_id: newStationId,
      status: 'available',
      is_active: true
    }).select('name license_plate model color brand price_per_day');
    
    // Check if any vehicle is actually available for the date range
    let selectedVehicle = null;
    
    for (const vehicle of availableVehicles) {
      const conflictingBookings = await Booking.find({
        vehicle_id: vehicle._id,
        status: { $in: ['pending', 'confirmed'] },
        _id: { $ne: booking._id }, // Exclude current booking
        $or: [
          {
            start_date: { $lte: newEndDate },
            end_date: { $gte: newStartDate }
          }
        ]
      });
      
      if (conflictingBookings.length === 0) {
        selectedVehicle = vehicle;
        break;
      }
    }
    
    if (!selectedVehicle) {
      // Find alternative models at the station
      // Get unique combinations of model + color
      const allVehiclesAtStation = await Vehicle.find({
        station_id: newStationId,
        status: 'available',
        is_active: true
      }).select('model color brand price_per_day');
      
      // Group by model + color
      const modelColorMap = new Map();
      for (const v of allVehiclesAtStation) {
        const key = `${v.model}|${v.color}`;
        if (!modelColorMap.has(key)) {
          modelColorMap.set(key, {
            model: v.model,
            color: v.color,
            brand: v.brand,
            price_per_day: v.price_per_day,
            vehicles: []
          });
        }
        modelColorMap.get(key).vehicles.push(v);
      }
      
      const alternatives = [];
      
      for (const [key, data] of modelColorMap) {
        let availableCount = 0;
        for (const v of data.vehicles) {
          const conflicts = await Booking.find({
            vehicle_id: v._id,
            status: { $in: ['pending', 'confirmed'] },
            _id: { $ne: booking._id }, // Exclude current booking
            $or: [
              {
                start_date: { $lte: newEndDate },
                end_date: { $gte: newStartDate }
              }
            ]
          });
          
          if (conflicts.length === 0) availableCount++;
        }
        
        if (availableCount > 0) {
          alternatives.push({
            model: data.model,
            color: data.color,
            brand: data.brand,
            available_count: availableCount,
            price_per_day: data.price_per_day,
            estimated_total: data.price_per_day * totalDays
          });
        }
      }
      
      return res.status(400).json({
        success: false,
        message: 'Model đã chọn không còn xe available cho ngày này',
        station_name: newStation.name,
        dates: `${start_date} → ${end_date}`,
        available_alternatives: alternatives.length > 0 ? alternatives : null,
        suggestion: alternatives.length > 0 
          ? 'Chọn một trong các model trên và thử lại'
          : 'Vui lòng chọn ngày khác hoặc trạm khác'
      });
    }
    
    console.log(`✅ Selected vehicle: ${selectedVehicle.name} (${selectedVehicle.license_plate})`);
    
    // 11. Calculate new pricing (selectedVehicle already has price_per_day)
    const pricePerDay = selectedVehicle.price_per_day;
    const totalPrice = calculateTotalPrice(pricePerDay, totalDays);
    const depositAmount = DepositService.calculateDeposit(pricePerDay, totalDays);
    
    console.log(`💰 New pricing: ${pricePerDay.toLocaleString()}đ/day × ${totalDays} days = ${totalPrice.toLocaleString()}đ`);
    console.log(`💵 New deposit: ${depositAmount.toLocaleString()}đ`);
    
    // 12. Unreserve old vehicle
    const oldVehicleId = booking.vehicle_id._id;
    if (oldVehicleId.toString() !== selectedVehicle._id.toString()) {
      await Vehicle.findByIdAndUpdate(oldVehicleId, {
        status: 'available'
      });
      console.log(`🔓 Unreserved old vehicle: ${booking.vehicle_id.license_plate}`);
    }
    
    // 13. Reserve new vehicle
    await Vehicle.findByIdAndUpdate(selectedVehicle._id, {
      status: 'reserved'
    });
    console.log(`🔒 Reserved new vehicle: ${selectedVehicle.license_plate}`);
    
    // 14. Update booking
    const oldData = {
      start_date: booking.start_date,
      end_date: booking.end_date,
      vehicle: `${booking.vehicle_id.name} - ${booking.vehicle_id.license_plate}`,
      station: booking.station_id.name,
      total_price: booking.total_price,
      deposit_amount: booking.deposit_amount
    };
    
    const changes = {};
    if (start_date) changes.start_date = { old: formatVietnamTime(booking.start_date), new: start_date };
    if (end_date) changes.end_date = { old: formatVietnamTime(booking.end_date), new: end_date };
    if (station_id && station_id !== booking.station_id._id.toString()) {
      changes.station = { old: booking.station_id.name, new: newStation.name };
    }
    if (selectedVehicle._id.toString() !== booking.vehicle_id._id.toString()) {
      changes.vehicle = { 
        old: `${booking.vehicle_id.name} (${booking.vehicle_id.license_plate})`,
        new: `${selectedVehicle.name} (${selectedVehicle.license_plate})`
      };
    }
    if (model || color) {
      changes.model_color = {
        old: `${booking.vehicle_id.model} ${booking.vehicle_id.color}`,
        new: `${searchModel} ${searchColor}`
      };
    }
    
    // Update booking fields
    booking.start_date = newStartDate;
    booking.end_date = newEndDate;
    booking.vehicle_id = selectedVehicle._id;
    booking.station_id = newStationId;
    booking.total_days = totalDays;
    booking.price_per_day = pricePerDay;
    booking.total_price = totalPrice;
    booking.deposit_amount = depositAmount;
    
    
    booking.edit_count = (booking.edit_count || 0) + 1;
    booking.edit_reason = reason || 'User requested booking modification';
    // last_edited_at removed - using timestamps.updatedAt instead
    
    console.log(`📝 Setting edit_count to: ${booking.edit_count}`);
    console.log(`📝 Edit reason: ${booking.edit_reason}`);
    
    await booking.save();
    
    console.log(`✅ Updated booking: ${booking.code}`);
    console.log(`✅ SAVED edit_count: ${booking.edit_count}`);
    
    // 15. Send email notification using template
    try {
      const emailHtml = getBookingUpdateTemplate(
        booking.user_id.fullname,
        booking.code,
        {
          start_date: formatVietnamTime(oldData.start_date),
          end_date: formatVietnamTime(oldData.end_date),
          vehicle: oldData.vehicle,
          station: oldData.station,
          total_price: oldData.total_price,
          deposit_amount: oldData.deposit_amount
        },
        {
          start_date: formatVietnamTime(newStartDate),
          end_date: formatVietnamTime(newEndDate),
          vehicle: `${selectedVehicle.name} - ${selectedVehicle.license_plate}`,
          station: newStation.name,
          total_price: totalPrice,
          deposit_amount: depositAmount
        },
        reason || null
      );
      
      await sendEmail({
        to: booking.user_id.email,
        subject: `✅ Booking ${booking.code} đã được cập nhật - EV Rental`,
        html: emailHtml
      });
      console.log(`📧 Email notification sent to ${booking.user_id.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send email:', emailError.message);
      // Don't fail the request if email fails
    }
    
    // 16. Populate and return (same as getBookingDetails)
    const updatedBooking = await Booking.findById(booking._id)
      .populate('user_id', 'fullname email phone kycStatus')
      .populate('vehicle_id', 'name license_plate model brand year color images price_per_day deposit_amount')
      .populate('station_id', 'name address phone email opening_time closing_time')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .populate('holding_fee.payment_id', 'code amount payment_method status transaction_id vnpay_transaction_no vnpay_bank_code createdAt'); // ← NEW: Populate holding fee payment
    
    console.log(`🔚 ========== END UPDATE BOOKING ==========\n`);
    
    
    const formattedBooking = {
      ...updatedBooking.toObject(),
      start_date: formatVietnamTime(updatedBooking.start_date),
      end_date: formatVietnamTime(updatedBooking.end_date),
      createdAt: formatVietnamTime(updatedBooking.createdAt),
      updatedAt: formatVietnamTime(updatedBooking.updatedAt), // This shows last edit time
      confirmed_at: formatVietnamTime(updatedBooking.confirmed_at),
      cancelled_at: formatVietnamTime(updatedBooking.cancelled_at),
      qr_expires_at: formatVietnamTime(updatedBooking.qr_expires_at),
      qr_used_at: formatVietnamTime(updatedBooking.qr_used_at),
      edit_history: updatedBooking.edit_history?.map(h => ({
        _id: h._id,
        edited_at: formatVietnamTime(h.edited_at),
        edited_by: h.edited_by,
        changes: h.changes,
        reason: h.reason
      })) || []
    };
    
    res.status(200).json({
      success: true,
      message: '✅ Cập nhật booking thành công',
      booking: formattedBooking,
      changes: {
        old: oldData,
        new: {
          start_date: formatVietnamTime(newStartDate),
          end_date: formatVietnamTime(newEndDate),
          vehicle: `${selectedVehicle.name} - ${selectedVehicle.license_plate}`,
          station: newStation.name,
          total_price: totalPrice,
          deposit_amount: depositAmount
        },
        price_difference: totalPrice - oldData.total_price,
        note: totalPrice > oldData.total_price 
          ? `Giá tăng ${(totalPrice - oldData.total_price).toLocaleString()}đ - Bạn sẽ thanh toán thêm khi confirm`
          : totalPrice < oldData.total_price
          ? `Giá giảm ${(oldData.total_price - totalPrice).toLocaleString()}đ`
          : 'Giá không đổi'
      },
      edit_info: {
        edit_count: booking.edit_count,
        max_edits: 1,
        remaining_edits: 1 - booking.edit_count,
        warning: booking.edit_count >= 1 ? '⚠️ Bạn đã sử dụng hết lượt chỉnh sửa. Không thể edit thêm!' : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating booking:', error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server khi cập nhật booking',
      error: error.message 
    });
  }
};

module.exports = {
  createBooking,
  createWalkInBooking,
  getUserBookings,
  getBookingDetails,
  confirmBooking,
  cancelBooking,
  updateBooking, // ← NEW
  getAllBookings,
  getStationBookings,
  scanQRCode
};

