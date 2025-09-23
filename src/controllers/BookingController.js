
const Booking = require('../models/Booking');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const { sendEmail, getBookingConfirmationTemplate, getBookingCancellationTemplate } = require('../config/nodemailer');
const { uploadToCloudinary } = require('../config/cloudinary');
const { formatVietnamTime, nowVietnam } = require('../config/timezone');
const DepositService = require('../services/DepositService');
const QRCode = require('qrcode');

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
  
  const now = new Date();
  const bookingStart = new Date(booking.start_date);
  const timeDiff = bookingStart.getTime() - now.getTime();
  const hoursDiff = timeDiff / (1000 * 3600);
  
  // Không thể cancel trong vòng 2 giờ trước booking
  if (hoursDiff < 2) {
    return false;
  }
  
  return true;
};

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { 
      model,
      color,
      station_id, 
      start_date, 
      end_date, 
      pickup_time, 
      return_time,
      special_requests,
      notes 
    } = req.body;
    
    const user_id = req.user.id;
    
    // Validate input
    if (!model || !color || !station_id || !start_date || !end_date || !pickup_time || !return_time) {
      return res.status(400).json({ 
        message: 'Thiếu thông tin bắt buộc' 
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
    const now = new Date();
    
    if (startDate <= now) {
      return res.status(400).json({ 
        message: 'Ngày bắt đầu phải sau thời điểm hiện tại' 
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
    const maxAdvanceDate = new Date();
    maxAdvanceDate.setDate(maxAdvanceDate.getDate() + MAX_ADVANCE_DAYS);
    
    if (startDate > maxAdvanceDate) {
      return res.status(400).json({ 
        message: `Chỉ có thể đặt xe tối đa ${MAX_ADVANCE_DAYS} ngày trước` 
      });
    }
    
    // Kiểm tra xe thuộc trạm đã chọn (đã được kiểm tra ở bước tìm xe)
    
    // Kiểm tra giờ pickup/return hợp lệ
    const pickupTimeParts = pickup_time.split(':');
    const returnTimeParts = return_time.split(':');
    const pickupTimeObj = new Date();
    pickupTimeObj.setHours(parseInt(pickupTimeParts[0]), parseInt(pickupTimeParts[1]));
    const returnTimeObj = new Date();
    returnTimeObj.setHours(parseInt(returnTimeParts[0]), parseInt(returnTimeParts[1]));
    
    // Kiểm tra giờ mở/đóng cửa trạm
    const stationOpeningParts = station.opening_time.split(':');
    const stationClosingParts = station.closing_time.split(':');
    const stationOpening = new Date();
    stationOpening.setHours(parseInt(stationOpeningParts[0]), parseInt(stationOpeningParts[1]));
    const stationClosing = new Date();
    stationClosing.setHours(parseInt(stationClosingParts[0]), parseInt(stationClosingParts[1]));
    
    if (pickupTimeObj < stationOpening || pickupTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ nhận xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
      });
    }
    
    if (returnTimeObj < stationOpening || returnTimeObj > stationClosing) {
      return res.status(400).json({ 
        message: `Giờ trả xe phải trong giờ làm việc của trạm (${station.opening_time} - ${station.closing_time})` 
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
    
    // Kiểm tra trùng lịch đặt xe (cả online và walk_in)
    const existingBooking = await Booking.findOne({
      vehicle_id: { $in: vehicleIds },
      status: { $ne: 'cancelled' },
      $or: [
        // Trường hợp 1: Booking mới nằm trong khoảng thời gian booking cũ
        {
          start_date: { $lte: startDate },
          end_date: { $gte: startDate }
        },
        // Trường hợp 2: Booking cũ nằm trong khoảng thời gian booking mới
        {
          start_date: { $lte: endDate },
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
      return res.status(400).json({ 
        message: `Xe đã được ${bookingTypeText} trong khoảng thời gian này (${existingBooking.start_date.toLocaleDateString('vi-VN')} - ${existingBooking.end_date.toLocaleDateString('vi-VN')})` 
      });
    }
    
    // Chọn xe đầu tiên available và cập nhật trạng thái
    const vehicle = sameModelVehicles[0];
    
    // Calculate pricing
    const pricePerDay = vehicle.price_per_day;
    const totalPrice = calculateTotalPrice(pricePerDay, totalDays);
    const depositAmount = DepositService.calculateDeposit(pricePerDay, totalDays);
    
    // Generate booking code and QR code
    const code = await generateBookingCode();
    const qrCodeData = await generateQRCode(code); // Truyền booking code vào QR
    console.log('🔍 Generated QR Code Data:', qrCodeData); // Debug log
    const qrExpiresAt = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours after start
    
    // Xử lý lỗi khi xe đang được đặt đồng thời
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
    
    // Create booking
    const booking = await Booking.create({
      code,
      user_id,
      vehicle_id: vehicle._id,
      station_id,
      start_date: startDate,
      end_date: endDate,
      pickup_time,
      return_time,
      booking_type: 'online',
      price_per_day: pricePerDay,
      total_days: totalDays,
      total_price: totalPrice,
      deposit_amount: depositAmount,
      special_requests: special_requests || '',
      notes: notes || '',
      qr_code: qrCodeData.text,
      qr_expires_at: qrExpiresAt,
      created_by: user_id
    });
    
    // Send confirmation email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Xác nhận đặt xe điện - EV Rental',
        html: getBookingConfirmationTemplate(user.fullname, {
          bookingId: booking._id.toString(),  // MongoDB ID: "68d17520f344602a72d7b154"
          bookingCode: booking.code,          // Booking Code: "BK4D3MU8"
          carModel: vehicle.name,
          pickupTime: `${pickup_time} - ${startDate.toLocaleDateString('vi-VN')}`,
          pickupLocation: station.name,
          returnTime: `${return_time} - ${endDate.toLocaleDateString('vi-VN')}`,
          totalCost: totalPrice.toLocaleString('vi-VN') + ' VND',
          qrCode: booking.qr_code,           // QR Code: "BK4D3MU8"
          qrCodeImage: qrCodeData.imageUrl,
          qrExpiresAt: booking.qr_expires_at.toLocaleString('vi-VN')
        })
      });
      console.log('✅ Email xác nhận booking đã được gửi đến:', user.email);
    } catch (emailError) {
      console.error('❌ Lỗi khi gửi email xác nhận:', emailError.message);
      // Không throw error, chỉ log
    }
    
    // Populate booking data for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model brand')
      .populate('station_id', 'name address phone');
    
    // Format timezone for response
    const formattedBooking = {
      ...populatedBooking.toObject(),
      start_date: formatVietnamTime(populatedBooking.start_date),
      end_date: formatVietnamTime(populatedBooking.end_date),
      createdAt: formatVietnamTime(populatedBooking.createdAt),
      updatedAt: formatVietnamTime(populatedBooking.updatedAt),
      qr_expires_at: formatVietnamTime(populatedBooking.qr_expires_at)
    };
    
    res.status(201).json({
      message: 'Đặt xe thành công',
      booking: formattedBooking,
      requiresKYC: user.kycStatus !== 'approved'
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
      .populate('vehicle_id', 'name license_plate model brand images')
      .populate('station_id', 'name address phone')
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
      qr_used_at: formatVietnamTime(booking.qr_used_at)
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
      .populate('cancelled_by', 'fullname');
    
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
    const { vehicle_condition_before, staff_notes } = req.body;
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
    
    // Check if QR code has been used (check-in completed)
    if (!booking.qr_used_at) {
      return res.status(400).json({ 
        message: 'Booking chưa được check-in. Vui lòng quét QR code trước' 
      });
    }
    
    // Check KYC status if needed
    if (booking.user_id.kycStatus !== 'approved') {
      return res.status(400).json({ 
        message: 'User chưa có KYC approved, vui lòng xác thực KYC trước' 
      });
    }
    
    // Update booking status
    booking.status = 'confirmed';
    booking.confirmed_at = new Date();
    booking.confirmed_by = staff_id;
     // qr_used_at đã được set trong useQRCode, không cần set lại
    await booking.save();
    
    // Create payment (deposit)
    const payment = await Payment.create({
      code: 'PAY' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      rental_id: null, // Will be updated when rental is created
      user_id: booking.user_id._id,
      booking_id: booking._id,
      amount: booking.deposit_amount,
      payment_method: 'cash', // Default, can be updated
      payment_type: 'deposit',
      status: 'pending',
      processed_by: staff_id
    });
    
    // Upload vehicle images before handover
    let imagesBefore = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'vehicle-conditions');
        imagesBefore.push(result.url);
      }
    }

    // Create rental
    const rental = await Rental.create({
      code: 'RENT' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      booking_id: booking._id,
      user_id: booking.user_id._id,
      vehicle_id: booking.vehicle_id._id,
      station_id: booking.station_id._id,
      actual_start_time: new Date(),
      pickup_staff_id: staff_id,
      vehicle_condition_before: vehicle_condition_before || {
        mileage: 0,
        battery_level: booking.vehicle_id.current_battery,
        exterior_condition: 'good',
        interior_condition: 'good',
        notes: staff_notes || ''
      },
      images_before: imagesBefore,
      staff_notes: staff_notes || '',
      status: 'active',
      created_by: staff_id
    });
    
    // Update payment with rental_id
    payment.rental_id = rental._id;
    await payment.save();
    
    // Create contract
    const contractTemplate = await ContractTemplate.findOne({ is_active: true });
    if (contractTemplate) {
      const contract = await Contract.create({
        code: 'CON' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        rental_id: rental._id,
        user_id: booking.user_id._id,
        vehicle_id: booking.vehicle_id._id,
        station_id: booking.station_id._id,
        template_id: contractTemplate._id,
        title: contractTemplate.title,
        content: contractTemplate.content,
        terms: contractTemplate.terms,
        valid_from: booking.start_date,
        valid_until: booking.end_date,
        staff_signed_by: staff_id,
        created_by: staff_id
      });
    }
    
    // Update vehicle status
    await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
      status: 'rented'
    });
    
    // Update station stats
    const station = await Station.findById(booking.station_id._id);
    await station.syncVehicleCount();
    
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
      images_before: imagesBefore,
      actual_start_time: formatVietnamTime(rental.actual_start_time),
      createdAt: formatVietnamTime(rental.createdAt),
      updatedAt: formatVietnamTime(rental.updatedAt)
    };
    
    res.status(200).json({
      message: 'Xác nhận booking thành công',
      booking: formattedBooking,
      payment,
      rental: formattedRental
    });
    
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi xác nhận booking',
      error: error.message 
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user_id = req.user.id;
    
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
    
    // Check permission
    if (booking.user_id._id.toString() !== user_id && req.user.role === 'EV Renter') {
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
    
    // Update booking status
    booking.status = 'cancelled';
    booking.cancellation_reason = reason || 'User cancelled';
    booking.cancelled_at = new Date();
    booking.cancelled_by = user_id;
    await booking.save();
    
    // Update vehicle status back to available
    await Vehicle.findByIdAndUpdate(booking.vehicle_id._id, {
      status: 'available'
    });
    
    // Update station stats
    const station = await Station.findById(booking.station_id._id);
    await station.syncVehicleCount();
    
    // Send cancellation email
    try {
      await sendEmail({
        to: booking.user_id.email,
        subject: 'Hủy đặt xe - EV Rental',
        html: getBookingCancellationTemplate(booking.user_id.fullname, booking)
      });
      console.log('✅ Email hủy booking đã được gửi đến:', booking.user_id.email);
    } catch (emailError) {
      console.error('❌ Lỗi khi gửi email hủy:', emailError.message);
    }
    
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
      booking: formattedBooking
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
      .populate('vehicle_id', 'name license_plate model brand')
      .populate('station_id', 'name address')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    res.status(200).json({
      message: 'Lấy danh sách booking thành công',
      bookings,
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
    const { status, page = 1, limit = 10, search } = req.query;
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
    
    // Pagination
    const skip = (page - 1) * limit;
    
    const bookings = await Booking.find(query)
      .populate('user_id', 'fullname email phone kycStatus')
      .populate('vehicle_id', 'name license_plate model brand')
      .populate('station_id', 'name address')
      .populate('confirmed_by', 'fullname')
      .populate('cancelled_by', 'fullname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Booking.countDocuments(query);
    
    res.status(200).json({
      message: 'Lấy danh sách booking station thành công',
      bookings,
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
    if (booking.qr_expires_at && new Date() > booking.qr_expires_at) {
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
        qr_used_at: new Date()
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
        qr_used_at: isCheckedIn ? formatVietnamTime(new Date()) : formatVietnamTime(booking.qr_used_at),
        isCheckedIn: true
      }
    });
    
  } catch (error) {
    console.error('Lỗi khi scan QR code:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};


module.exports = {
  createBooking,
  getUserBookings,
  getBookingDetails,
  confirmBooking,
  cancelBooking,
  getAllBookings,
  getStationBookings,
  scanQRCode
};

