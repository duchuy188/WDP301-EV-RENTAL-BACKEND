const { Station, User, Vehicle, Booking, Rental } = require('../models');
const { uploadToCloudinary } = require('../config/cloudinary');
const { formatVietnamTime, nowVietnam } = require('../config/timezone');

// Helper function để tự động generate code station
const generateStationCode = async () => {
  try {
    // Tìm station có code lớn nhất
    const lastStation = await Station.findOne({}, {}, { sort: { 'code': -1 } });
    
    if (!lastStation) {
      // Nếu chưa có station nào, bắt đầu từ ST001
      return 'ST001';
    }
    
    // Lấy số từ code cuối cùng (ST001 -> 001)
    const lastCode = lastStation.code;
    const lastNumber = parseInt(lastCode.replace('ST', ''));
    
    // Tăng lên 1 và format lại
    const nextNumber = lastNumber + 1;
    const nextCode = `ST${nextNumber.toString().padStart(3, '0')}`;
    
    return nextCode;
  } catch (error) {
    console.error('Lỗi khi generate code:', error);
    throw new Error('Không thể tạo code station');
  }
};

// Thêm station mới
exports.createStation = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }

    const {
      name, address, district, city,
      phone, email,
      opening_time, closing_time, max_capacity,
      description
    } = req.body;

    // Validate required fields
    if (!name || !address || !district || !city || !phone || !email || !opening_time || !closing_time || !max_capacity) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }

    // Tự động generate code
    const code = await generateStationCode();

    // Kiểm tra code đã tồn tại chưa (để đảm bảo an toàn)
    const existingStation = await Station.findOne({ code });
    if (existingStation) {
      return res.status(400).json({ message: 'Code station đã tồn tại, vui lòng thử lại' });
    }

    // Upload images if provided
    let images = [];

    if (req.files && req.files.length > 0) {
      // req.files là array các file, không phải object
      const imageFiles = req.files;
      
      for (const file of imageFiles) {
        try {
          const result = await uploadToCloudinary(file.buffer, 'stations');
          images.push(result.url);
        } catch (uploadError) {
          console.error('Lỗi upload ảnh:', uploadError);
          // Continue with other images if one fails
        }
      }
    }

    const station = new Station({
      code, name, address, district, city,
      phone, email,
      opening_time, closing_time, max_capacity,
      description: description || '',
      images,
      status: 'active'
    });

    await station.save();

    // Format thời gian theo giờ Việt Nam
    const formattedStation = {
      ...station.toObject(),
      createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    return res.status(201).json({
      message: 'Đã tạo station thành công',
      station: formattedStation
    });
  } catch (error) {
    console.error('Lỗi khi tạo station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy danh sách station
exports.getStations = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      city, 
      district, 
      status,
      search,
      sort = 'name'
    } = req.query;

    const query = {};

    // Áp dụng các filter
    if (city) query.city = city;
    if (district) query.district = district;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    // Tính toán skip cho phân trang
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Tạo sort options
    let sortOption = {};
    if (sort === 'name') sortOption = { name: 1 };
    else if (sort === 'available') sortOption = { available_vehicles: -1 };

    // Lấy danh sách stations
    const stations = await Station.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    // Tính tổng số stations
    const total = await Station.countDocuments(query);

    // Format thời gian theo giờ Việt Nam
    const formattedStations = stations.map(station => ({
      ...station.toObject(),
      createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    }));

    return res.status(200).json({
      stations: formattedStations,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Lấy chi tiết station
exports.getStationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    // Lấy danh sách xe tại station
    const { type, status, sort = 'name' } = req.query;
    
    const vehicleQuery = { station_id: id, is_active: true };
    if (type) vehicleQuery.type = type;
    if (status) vehicleQuery.status = status;
    
    let vehicleSort = {};
    if (sort === 'name') vehicleSort = { name: 1 };
    else if (sort === 'price') vehicleSort = { price_per_day: 1 };
    
    const vehicles = await Vehicle.find(vehicleQuery)
      .sort(vehicleSort)
      .select('name model type price_per_day status current_battery main_image');
    
    // Lấy số lượng nhân viên
    const staffCount = await User.countDocuments({ 
      stationId: id, 
      role: 'Station Staff',
      status: 'active'
    });
    
    return res.status(200).json({
      station: {
        ...station._doc,
        vehicles,
        staff_count: staffCount,
        createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
        updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Cập nhật station
exports.updateStation = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { id } = req.params;
    const {
      name, address, district, city,
      phone, email,
      opening_time, closing_time, max_capacity,
      status,
      description
    } = req.body;
    
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    // Upload ảnh mới nếu có
    if (req.files && req.files.length > 0) {
      const imageFiles = req.files;
      
      for (const file of imageFiles) {
        try {
          const result = await uploadToCloudinary(file.buffer, 'stations');
          station.images.push(result.url);
        } catch (uploadError) {
          console.error('Lỗi upload ảnh:', uploadError);
          // Continue with other images if one fails
        }
      }
    }
    
    // Cập nhật thông tin
    if (name) station.name = name;
    if (address) station.address = address;
    if (district) station.district = district;
    if (city) station.city = city;
    if (phone) station.phone = phone;
    if (email) station.email = email;
    if (opening_time) station.opening_time = opening_time;
    if (closing_time) station.closing_time = closing_time;
    if (max_capacity) station.max_capacity = max_capacity;
    if (status) {
      // Kiểm tra status hợp lệ
      if (!['active', 'inactive', 'maintenance'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái station không hợp lệ' });
      }
      station.status = status;
    }
    if (description !== undefined) station.description = description;
    
    await station.save();
    
    // Format thời gian theo giờ Việt Nam
    const formattedStation = {
      ...station.toObject(),
      createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    return res.status(200).json({
      message: 'Đã cập nhật station thành công',
      station: formattedStation
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Xóa station
exports.deleteStation = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { id } = req.params;
    
    // Kiểm tra station có tồn tại không
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    // Kiểm tra có xe đang hoạt động không
    const activeVehicles = await Vehicle.countDocuments({ 
      station_id: id, 
      status: 'rented',
      is_active: true 
    });
    
    if (activeVehicles > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa station vì có xe đang được thuê',
        activeVehicles
      });
    }
    
    // Kiểm tra có booking đang active không
    const activeBookings = await Booking.countDocuments({
      station_id: id,
      status: { $in: ['confirmed', 'in_progress'] }
    });
    
    if (activeBookings > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa station vì có booking đang active',
        activeBookings
      });
    }
    
    // Kiểm tra có rental đang active không
    const activeRentals = await Rental.countDocuments({
      station_id: id,
      status: { $in: ['active', 'in_progress'] }
    });
    
    if (activeRentals > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa station vì có rental đang active',
        activeRentals
      });
    }
    
    // Kiểm tra có nhân viên không
    const staffCount = await User.countDocuments({ 
      stationId: id, 
      role: 'Station Staff',
      status: 'active'
    });
    
    if (staffCount > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa station vì có nhân viên đang làm việc',
        staffCount
      });
    }
    
    // Thay vì xóa, đánh dấu là không hoạt động
    station.status = 'inactive';
    await station.save();
    
    // Format thời gian theo giờ Việt Nam
    const formattedStation = {
      ...station.toObject(),
      createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    return res.status(200).json({
      message: 'Đã đánh dấu station không hoạt động',
      station: formattedStation
    });
  } catch (error) {
    console.error('Lỗi khi xóa station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Đồng bộ số lượng xe
exports.syncVehicleCount = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin' && req.user.role !== 'Station Staff') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { id } = req.params;
    
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    // Nếu là Station Staff, kiểm tra có thuộc station này không
    if (req.user.role === 'Station Staff' && req.user.stationId.toString() !== id) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    await station.syncVehicleCount();
    
    // Format thời gian theo giờ Việt Nam
    const formattedStation = {
      ...station.toObject(),
      createdAt: formatVietnamTime(station.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(station.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    return res.status(200).json({
      message: 'Đã đồng bộ số lượng xe thành công',
      station: formattedStation
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ số lượng xe:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Đồng bộ tất cả stations
exports.syncAllStations = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const result = await Station.syncAllVehicleCounts();
    
    return res.status(200).json({
      message: 'Đã đồng bộ tất cả stations thành công',
      result
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ tất cả stations:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Quản lý nhân viên station
exports.getStationStaff = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin' && 
        (req.user.role !== 'Station Staff' || req.user.stationId.toString() !== id)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    const staff = await User.find({ 
      stationId: id, 
      role: 'Station Staff' 
    }).select('_id fullname email phone avatar status');
    
    return res.status(200).json({
      station: {
        _id: station._id,
        code: station.code,
        name: station.name
      },
      staff,
      count: staff.length
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách nhân viên:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};



// Xóa hình ảnh station
exports.deleteStationImage = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { id } = req.params;
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'Vui lòng cung cấp URL hình ảnh' });
    }
    
    const station = await Station.findById(id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy station' });
    }
    
    // Xóa khỏi mảng images
    station.images = station.images.filter(url => url !== imageUrl);
    
    await station.save();
    
    // Xóa ảnh khỏi Cloudinary nếu cần
    // Cần lưu publicId để xóa
    
    return res.status(200).json({
      message: 'Đã xóa hình ảnh thành công',
      images: station.images
    });
  } catch (error) {
    console.error('Lỗi khi xóa hình ảnh station:', error);
    return res.status(500).json({
      message: 'Lỗi khi xử lý yêu cầu',
      error: process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : error.message
    });
  }
};

// Bỏ các hàm tính khoảng cách vì không sử dụng tọa độ GPS