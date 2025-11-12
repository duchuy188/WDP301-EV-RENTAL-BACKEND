const { Vehicle, Station, User, Maintenance, Rental } = require('../models');
const { uploadToCloudinary } = require('../config/cloudinary');
const ExcelService = require('../services/ExcelService');
const DepositService = require('../services/DepositService');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
// Import timezone utils
const { formatVietnamTime, nowVietnam } = require('../config/timezone');

// Helper function để tạo vehicle ID
const generateVehicleId = async () => {
  try {
  
    const lastVehicle = await Vehicle.findOne({}, {}, { sort: { 'name': -1 } })
      .where('name').regex(/^VH\d+/);
    
    if (!lastVehicle || !lastVehicle.name.startsWith('VH')) {
     
      return 'VH001';
    }
    
    // Tìm số trong tên xe (VH001 -> 001)
    const match = lastVehicle.name.match(/VH(\d+)/);
    if (!match) return 'VH001';
    
    const lastNumber = parseInt(match[1]);
    const nextNumber = lastNumber + 1;
    const nextId = `VH${nextNumber.toString().padStart(3, '0')}`;
    
    return nextId;
  } catch (error) {
    console.error('Lỗi khi generate vehicle ID:', error);
    throw new Error('Không thể tạo ID xe');
  }
};

// Lấy danh sách xe
exports.getVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      color,
      type,
      station_id,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;
    
    // Xây dựng query
    const query = { is_active: true };
    if (status) query.status = status;
    if (color) query.color = color;
    if (type) query.type = type;
    if (station_id) query.station_id = station_id;
    
    // Tính số lượng bản ghi bỏ qua
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Xây dựng sort options
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;
    
    // Thực hiện query
    const vehicles = await Vehicle.find(query)
      .populate('station_id', 'code name')
      .populate('created_by', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Đếm tổng số bản ghi
    const total = await Vehicle.countDocuments(query);
    
    return res.status(200).json({
      vehicles,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy chi tiết xe
exports.getVehicleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const vehicle = await Vehicle.findById(id)
      .populate('station_id', 'code name address')
      .populate('created_by', 'fullname email');
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
    return res.status(200).json(vehicle);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Tạo xe hàng loạt và xuất Excel template
exports.bulkCreateVehicles = async (req, res) => {
  try {
    //  QUAN TRỌNG: Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const {
      name,
      model,
      year,
      color,
      type,
      battery_capacity,
      max_range,
      current_battery = 100,
      price_per_day,
      deposit_percentage = 50,
      quantity = 1,
      export_excel = true
    } = req.body;

    
    const yearNum = parseInt(year);
    const priceNum = parseFloat(price_per_day);
    const batteryNum = parseFloat(current_battery);
    
    // Validate required fields
    if (!model || !year || !color || !type || !battery_capacity || !max_range || !price_per_day) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }
    
    //   Validate quantity
    if (quantity <= 0 || quantity > 100) {
      return res.status(400).json({ message: 'Số lượng xe phải từ 1 đến 100' });
    }
    
    //Validate data type để tránh crash
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > nowVietnam().toDate().getFullYear() + 1) {
      return res.status(400).json({ 
        message: `Năm sản xuất phải là số từ 2020 đến ${nowVietnam().toDate().getFullYear() + 1}` 
      });
    }

    if (isNaN(batteryNum) || batteryNum < 0 || batteryNum > 100) {
      return res.status(400).json({ 
        message: 'Pin hiện tại phải là số từ 0% đến 100%' 
      });
    }

    if (isNaN(priceNum) || priceNum < 50000 || priceNum > 500000) {
      return res.status(400).json({ 
        message: 'Giá thuê phải là số từ 50,000 đến 500,000 VND/ngày' 
      });
    }
    
    // Lấy URLs từ Cloudinary (file đã được upload bởi middleware)
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => file.path); // file.path chứa secure_url từ Cloudinary
    }
    
    // Tạo danh sách xe
    const vehicles = [];
    let lastId = await generateVehicleId();
    
    for (let i = 0; i < quantity; i++) {
      // Tạo ID cho xe tiếp theo
      if (i > 0) {
        const match = lastId.match(/VH(\d+)/);
        if (match) {
          const lastNumber = parseInt(match[1]);
          const nextNumber = lastNumber + 1;
          lastId = `VH${nextNumber.toString().padStart(3, '0')}`;
        }
      }
      
      vehicles.push({
        name: lastId,
        brand: 'VinFast',
        model,
        year,
        color,
        type,
        battery_capacity,
        max_range,
        current_battery,
        price_per_day,
        deposit_percentage,
        status: 'draft',
        technical_status: 'good',
        license_plate: `TEMP_${Date.now()}_${lastId}_${i}`, // Temporary license_plate - unique with vehicle ID
        images: imageUrls,
        created_by: req.user._id
      });
    }
    
    // Lưu vào database
    const createdVehicles = [];
    const failedVehicles = [];
    
    for (const vehicle of vehicles) {
      try {
        const createdVehicle = await Vehicle.create(vehicle);
        createdVehicles.push(createdVehicle);
      } catch (error) {
        console.error(`Lỗi khi tạo xe ${vehicle.name}:`, error.message);
        failedVehicles.push({
          name: vehicle.name,
          error: error.message
        });
      }
    }
    
    // Kiểm tra kết quả
    if (createdVehicles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo xe nào. Vui lòng kiểm tra dữ liệu đầu vào.',
        errors: failedVehicles
      });
    }
    
    // Nếu có lỗi nhưng vẫn tạo được một số xe
    if (failedVehicles.length > 0) {
      console.warn(`⚠️ Tạo thành công ${createdVehicles.length} xe, thất bại ${failedVehicles.length} xe`);
    }
    
    // Nếu không cần xuất Excel, trả về JSON response
    if (!export_excel) {
      return res.status(201).json({
        success: true,
        message: `Đã tạo ${createdVehicles.length} xe thành công${failedVehicles.length > 0 ? `, ${failedVehicles.length} xe thất bại` : ''}`,
        vehicles: createdVehicles,
        ...(failedVehicles.length > 0 && { failed_vehicles: failedVehicles })
      });
    }
    
    // Tạo Excel template từ các xe vừa tạo
    try {
      const result = await ExcelService.createVehicleTemplate(createdVehicles, color);
      
      // Trả về file Excel
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
      
      const fileStream = fs.createReadStream(result.filePath);
      fileStream.pipe(res);
      
      // Xóa file sau khi đã gửi
      fileStream.on('end', () => {
        fs.unlinkSync(result.filePath);
      });
      
      // Nếu có lỗi khi tạo xe, thêm thông tin vào response headers
      if (failedVehicles.length > 0) {
        res.setHeader('X-Warning', `${failedVehicles.length} vehicles failed to create`);
      }
      
    } catch (excelError) {
      console.error('Lỗi khi tạo Excel template:', excelError);
      return res.status(500).json({
        success: false,
        message: 'Đã tạo xe thành công nhưng không thể tạo file Excel',
        vehicles: createdVehicles,
        ...(failedVehicles.length > 0 && { failed_vehicles: failedVehicles })
      });
    }
    
  } catch (error) {
    // Xử lý Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Dữ liệu không hợp lệ', 
        errors: messages 
      });
    }
    
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Export template Excel
exports.exportVehicleTemplate = async (req, res) => {
  try {
    const { color, status = 'draft' } = req.query;
    
    // Tìm các xe phù hợp với điều kiện
    const query = { status };
    if (color) query.color = color;
    
    const vehicles = await Vehicle.find(query);
    
    if (vehicles.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy xe phù hợp để export' });
    }
    
    // Tạo file Excel
    const result = await ExcelService.createVehicleTemplate(vehicles, color);
    
    //  Tên file cố định không có ký tự đặc biệt
    const fileName = `vehicle_template_${Date.now()}.xlsx`;
    
    // Trả về file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);
    
    // Xóa file sau khi đã gửi
    fileStream.on('end', () => {
      fs.unlinkSync(result.filePath);
    });
  } catch (error) {
    console.error('Lỗi khi export template:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Import biển số từ Excel
exports.importLicensePlates = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    }
    
    //  Validate file type
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(fileExt)) {
      return res.status(400).json({ 
        message: 'Chỉ chấp nhận file Excel (.xlsx, .xls)' 
      });
    }
    
    // Xử lý file Excel
    const result = await ExcelService.processLicensePlateImport(req.file.path);
    
    // Nếu có lỗi, trả về danh sách lỗi
    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        message: 'Có lỗi trong file Excel. Vui lòng sửa và thử lại.'
      });
    }
    
    
    const updateResults = [];

    for (const { vehicle_code, license_plate } of result.data) {
      // Kiểm tra xe tồn tại và đang ở trạng thái draft
      const vehicle = await Vehicle.findOne({ name: vehicle_code });
      if (!vehicle) {
        updateResults.push({
          success: false,
          vehicle_code,
          message: 'Không tìm thấy xe'
        });
        continue;
      }

     
      if (vehicle.status !== 'draft') {
        updateResults.push({
          success: false,
          vehicle_code,
          message: `Xe ${vehicle.name} không ở trạng thái draft, không thể cập nhật biển số`
        });
        continue;
      }

     
      // Chỉ kiểm tra nếu xe đã có biển số thật (không phải biển số tạm thời)
      if (vehicle.license_plate && !vehicle.license_plate.startsWith('TEMP_')) {
        updateResults.push({
          success: false,
          vehicle_code,
          message: `Xe ${vehicle.name} đã có biển số ${vehicle.license_plate}, không thể cập nhật`
        });
        continue;
      }

      //  Kiểm tra biển số đã tồn tại trong database (không chỉ xe hiện tại)
      const existingVehicle = await Vehicle.findOne({ 
        license_plate,
        _id: { $ne: vehicle._id }
      });
      
      if (existingVehicle) {
        updateResults.push({
          success: false,
          vehicle_code,
          message: `Biển số ${license_plate} đã được sử dụng bởi xe ${existingVehicle.name}`
        });
        continue;
      }
      
      // Cập nhật biển số
      const updated = await Vehicle.findByIdAndUpdate(
        vehicle._id,
        { license_plate },
        { new: true }
      );
      
      updateResults.push({
        success: !!updated,
        vehicle_code,
        license_plate,
        name: updated.name
      });
    }
    
    // Phân loại kết quả
    const successes = updateResults.filter(r => r.success);
    const failures = updateResults.filter(r => !r.success);

    // Trả về kết quả chi tiết
    return res.status(200).json({
      success: true,
      updated: successes.length,
      failed: failures.length,
      message: `Đã cập nhật ${successes.length} biển số thành công${failures.length > 0 ? `, ${failures.length} thất bại` : ''}`,
      details: {
        successes,
        failures
      }
    });

  } catch (error) {
    console.error('Lỗi khi import biển số:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    // Đảm bảo xóa file tạm
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
};

// Phân bổ xe theo số lượng
exports.assignVehiclesByQuantity = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { color, model, status = 'draft', quantity, station_id } = req.body;
    
    if (!quantity || !station_id) {
      return res.status(400).json({ message: 'Vui lòng cung cấp số lượng và ID trạm' });
    }
    
    // Kiểm tra trạm tồn tại
    const station = await Station.findById(station_id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy trạm' });
    }
    
    // Kiểm tra sức chứa trạm
    const currentVehicles = station.current_vehicles || 0;
    if (currentVehicles + parseInt(quantity) > station.max_capacity) {
      return res.status(400).json({
        message: `Trạm không đủ sức chứa. Còn trống ${station.max_capacity - currentVehicles} chỗ`
      });
    }
    
    // Tìm xe phù hợp để phân bổ
    const query = { status };
    if (color) query.color = color;
    if (model) query.model = model;
    if (status === 'draft') {
      query.license_plate = { 
        $nin: [null, ''],  
        $not: /^TEMP_/  
      };
    }
    query.station_id = null; // Chỉ lấy xe chưa được phân bổ
    
    const vehicles = await Vehicle.find(query).limit(parseInt(quantity));
    
    if (vehicles.length < parseInt(quantity)) {
      const filterInfo = [];
      if (color) filterInfo.push(`màu ${color}`);
      if (model) filterInfo.push(`model ${model}`);
      if (status) filterInfo.push(`trạng thái ${status}`);
      
      const filterText = filterInfo.length > 0 ? ` với điều kiện: ${filterInfo.join(', ')}` : '';
      return res.status(400).json({
        message: `Không đủ xe để phân bổ. Chỉ có ${vehicles.length} xe phù hợp${filterText}`
      });
    }
    
    // Cập nhật trạng thái xe
    const vehicleIds = vehicles.map(v => v._id);
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      {
        $set: {
          station_id,
          status: 'available'
        }
      }
    );
    
    // Cập nhật số lượng xe tại trạm
    station.current_vehicles += vehicles.length;
    station.available_vehicles += vehicles.length;
    await station.save();
    
    // Lấy thông tin xe đã cập nhật
    const updatedVehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
      .populate('station_id', 'code name');
    
    // Tạo thông báo chi tiết
    const vehicleInfo = [];
    if (model) vehicleInfo.push(`model ${model}`);
    if (color) vehicleInfo.push(`màu ${color}`);
    const vehicleText = vehicleInfo.length > 0 ? ` (${vehicleInfo.join(', ')})` : '';
    
    return res.status(200).json({
      message: `Đã phân bổ ${vehicles.length} xe${vehicleText} đến trạm ${station.name}`,
      vehicles: updatedVehicles
    });
  } catch (error) {
    console.error('Lỗi khi phân bổ xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Cập nhật trạng thái xe
exports.updateVehicleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['draft', 'available', 'reserved', 'rented', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }
    
    // Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle || !vehicle.is_active) {
      return res.status(404).json({ message: 'Không tìm thấy xe hoặc xe đã bị xóa' });
    }
    
    // Lưu trạng thái cũ để cập nhật trạm
    const oldStatus = vehicle.status;
    
    // Nếu trạng thái không thay đổi, không cần làm gì
    if (oldStatus === status) {
      return res.status(200).json({
        message: `Xe đã ở trạng thái ${status}`,
        vehicle
      });
    }
    
    // Kiểm tra logic chuyển đổi trạng thái
    const validTransitions = {
      'draft': ['available'],
      'available': ['reserved', 'rented', 'maintenance'], 
      'reserved': [], 
      'rented': [], 
      'maintenance': ['available', 'draft'] 
    };
    
   
    if (!validTransitions[oldStatus]) {
      return res.status(400).json({ 
        message: `Trạng thái hiện tại '${oldStatus}' không hợp lệ hoặc không thể thay đổi` 
      });
    }
    
    // Kiểm tra chuyển đổi có hợp lệ không
    if (!validTransitions[oldStatus].includes(status)) {
      // Thông báo cụ thể cho từng trường hợp
      let errorMessage = `Không thể chuyển trạng thái từ ${oldStatus} sang ${status}`;
      
      if (oldStatus === 'reserved') {
        errorMessage = 'Xe đang được đặt trước. Vui lòng hủy booking hoặc đợi khách thanh toán để thay đổi trạng thái.';
      } else if (oldStatus === 'rented') {
        errorMessage = 'Xe đang được thuê. Vui lòng đợi khách trả xe để thay đổi trạng thái.';
      }
      
      return res.status(400).json({ 
        message: errorMessage
      });
    }
    
    // Các kiểm tra đặc biệt cho từng loại chuyển đổi
    if (status === 'available') {
      // Kiểm tra xe phải có trạm
      if (!vehicle.station_id) {
        return res.status(400).json({ 
          message: 'Xe phải được gán vào trạm trước khi đổi trạng thái thành available' 
        });
      }
      
      // Kiểm tra xe phải có biển số thật (không phải biển tạm)
      if (!vehicle.license_plate || vehicle.license_plate.startsWith('TEMP_')) {
        return res.status(400).json({ 
          message: 'Xe phải có biển số thật trước khi đổi trạng thái thành available' 
        });
      }
      
      // Kiểm tra tình trạng kỹ thuật
      if (vehicle.technical_status !== 'good') {
        return res.status(400).json({ 
          message: 'Xe phải ở tình trạng kỹ thuật tốt trước khi đổi trạng thái thành available' 
        });
      }
    }
    
    if (status === 'rented') {
      // Kiểm tra xe phải từ trạng thái available
      if (oldStatus !== 'available') {
        return res.status(400).json({ 
          message: 'Chỉ xe ở trạng thái available mới có thể chuyển sang rented' 
        });
      }
      
      // Có thể thêm kiểm tra xe đã được đặt trước (booking) chưa
    }
    
    
    if (status === 'maintenance') {
      // Kiểm tra lý do bảo trì (có thể thêm vào request body)
      const { maintenance_reason } = req.body;
      if (!maintenance_reason) {
        return res.status(400).json({ 
          message: 'Vui lòng cung cấp lý do bảo trì' 
        });
      }
      
      // Tạo báo cáo bảo trì
      const maintenanceCode = `MT${Date.now().toString().substring(6)}_${vehicle.name}`;
      await Maintenance.create({
        code: maintenanceCode,
        vehicle_id: vehicle._id,
        station_id: vehicle.station_id,
        title: `Bảo trì xe ${vehicle.name}`,
        description: maintenance_reason,
        status: 'reported',
        priority: req.body.priority || 'medium',
        reported_by: req.user._id,
        created_by: req.user._id
      });
    }
    
    // Cập nhật trạng thái
    vehicle.status = status;
    await vehicle.save();
    
    // Cập nhật số lượng xe tại trạm (nếu có)
    if (vehicle.station_id) {
      const station = await Station.findById(vehicle.station_id);
      if (station) {
        // Giảm số lượng xe theo trạng thái cũ
        if (oldStatus === 'available') station.available_vehicles -= 1;
        else if (oldStatus === 'rented') station.rented_vehicles -= 1;
        else if (oldStatus === 'maintenance') station.maintenance_vehicles -= 1;
        else if (oldStatus === 'reserved') station.reserved_vehicles -= 1;
        
        // Tăng số lượng xe theo trạng thái mới
        if (status === 'available') station.available_vehicles += 1;
        else if (status === 'rented') station.rented_vehicles += 1;
        else if (status === 'maintenance') station.maintenance_vehicles += 1;
        else if (status === 'reserved') station.reserved_vehicles += 1;
        
        await station.save();
      }
    }
    
    return res.status(200).json({
      message: `Đã cập nhật trạng thái xe từ ${oldStatus} sang ${status}`,
      vehicle
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Cập nhật thông tin xe
exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    //  Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
    // Kiểm tra xe đã bị xóa chưa
    if (!vehicle.is_active) {
      return res.status(400).json({ message: 'Không thể cập nhật xe đã bị xóa' });
    }
    
    //  Kiểm tra xe có đang được thuê không
    if (vehicle.status === 'rented') {
      return res.status(400).json({ 
        message: 'Không thể cập nhật xe đang được thuê. Vui lòng đợi khách hàng trả xe.' 
      });
    }
    
    // Lấy thông tin cần cập nhật
    const {
      license_plate,
      name,
      model,
      year,
      color,
      type,
      battery_capacity,
      max_range,
      current_battery,
      price_per_day,
      deposit_percentage,
      technical_status
    } = req.body;

    // Validation biển số unique 
    if (license_plate) {
      const existingVehicle = await Vehicle.findOne({ 
        license_plate,
        _id: { $ne: id }
      });

      if (existingVehicle) {
        return res.status(400).json({ 
          message: `Biển số ${license_plate} đã được sử dụng bởi xe ${existingVehicle.name}` 
        });
      }
    }
    
    // Validation mã xe unique
    if (name) {
      const existingVehicle = await Vehicle.findOne({ 
        name,
        _id: { $ne: id }
      });

      if (existingVehicle) {
        return res.status(400).json({ 
          message: `Mã xe ${name} đã tồn tại. Vui lòng chọn mã khác.` 
        });
      }
    }
    
    // (Removed: Model+type uniqueness validation - allow multiple vehicles with same model+type but different colors)
    
    // Cập nhật thông tin - Mongoose sẽ validate các trường còn lại
    if (license_plate) vehicle.license_plate = license_plate;
    if (name) vehicle.name = name;
    if (model) vehicle.model = model;
    if (year) vehicle.year = year;
    if (color) vehicle.color = color;
    if (type) vehicle.type = type;
    if (battery_capacity) vehicle.battery_capacity = battery_capacity;
    if (max_range) vehicle.max_range = max_range;
    if (current_battery !== undefined) vehicle.current_battery = current_battery;
    if (price_per_day) vehicle.price_per_day = price_per_day;
    if (deposit_percentage) vehicle.deposit_percentage = deposit_percentage;
    if (technical_status) vehicle.technical_status = technical_status;
    
    // Cập nhật hình ảnh nếu có
    if (req.files && req.files.length > 0) {
      const imageUrls = [];
      
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer, 'vehicles');
        imageUrls.push(result.url);
      }
      
      if (imageUrls.length > 0) {
        vehicle.images = [...vehicle.images, ...imageUrls];
      }
    }
    
    // Lưu thay đổi - Mongoose sẽ validate
    await vehicle.save();
    
    return res.status(200).json({
      message: 'Cập nhật thông tin xe thành công',
      vehicle
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin xe:', error);
    
    // Xử lý Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Dữ liệu không hợp lệ', 
        errors: messages 
      });
    }
    
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Xóa xe (soft delete)
exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    // Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }

    // Kiểm tra xe đã bị xóa chưa
    if (!vehicle.is_active) {
      return res.status(400).json({ message: 'Xe đã bị xóa trước đó' });
    }

   
    if (vehicle.status === 'maintenance') {
      const activeMaintenance = await Maintenance.findOne({
        vehicle_id: vehicle._id,
        is_active: true,
        status: 'reported'
      });
      
      if (activeMaintenance) {
        return res.status(400).json({ 
          message: 'Không thể xóa xe đang có báo cáo bảo trì chưa hoàn thành',
          maintenance_code: activeMaintenance.code,
          suggestion: 'Vui lòng hoàn thành hoặc xóa báo cáo bảo trì trước'
        });
      }
    }

    // Kiểm tra xe có đang được thuê hoặc đặt trước không
    if (vehicle.status === 'rented' || vehicle.status === 'reserved') {
      return res.status(400).json({ 
        message: 'Không thể xóa xe đang được thuê/đặt trước.' 
      });
    }
    
    // KIỂM TRA CÓ BOOKING ACTIVE KHÔNG
    const { Booking } = require('../models');
    const activeBooking = await Booking.findOne({
      vehicle_id: vehicle._id,
      status: { $in: ['pending', 'confirmed'] }
    });
    
    if (activeBooking) {
      return res.status(400).json({ 
        message: 'Không thể xóa xe có booking chưa hoàn thành',
        booking_code: activeBooking.booking_code,
        booking_status: activeBooking.status,
        suggestion: 'Vui lòng hủy hoặc hoàn thành booking trước'
      });
    }
    
    // KIỂM TRA CÓ RENTAL ACTIVE KHÔNG
    const activeRental = await Rental.findOne({
      vehicle_id: vehicle._id,
      status: { $in: ['active', 'pending_payment'] }
    });
    
    if (activeRental) {
      return res.status(400).json({ 
        message: 'Không thể xóa xe có rental đang active',
        rental_code: activeRental.rental_code,
        suggestion: 'Vui lòng hoàn thành rental trước'
      });
    }
    
    // Soft delete
    vehicle.is_active = false;
    await vehicle.save();
    
    console.log(`🗑️  Soft deleted vehicle: ${vehicle.name} (${vehicle.license_plate || 'No plate'})`);
    
    // Cập nhật số lượng xe tại trạm (nếu có)
    if (vehicle.station_id) {
      const station = await Station.findById(vehicle.station_id);
      if (station) {
        station.current_vehicles = Math.max(0, station.current_vehicles - 1);
        
        // Giảm số lượng xe theo trạng thái (chỉ available và maintenance vì rented/reserved đã bị block)
        if (vehicle.status === 'available') {
          station.available_vehicles = Math.max(0, station.available_vehicles - 1);
        } else if (vehicle.status === 'maintenance') {
          station.maintenance_vehicles = Math.max(0, station.maintenance_vehicles - 1);
        }
        
        await station.save();
        console.log(`✅ Station counts updated: -1 vehicle (${vehicle.status})`);
      }
    }
    
    return res.status(200).json({
      message: 'Xóa xe thành công',
      note: 'Soft delete - dữ liệu vẫn được giữ lại trong database',
      vehicle_name: vehicle.name,
      vehicle_status: vehicle.status
    });
  } catch (error) {
    console.error('Lỗi khi xóa xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Thống kê xe
exports.getVehicleStatistics = async (req, res) => {
  try {
    // Thống kê theo trạng thái
    const statusStats = await Vehicle.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Thống kê theo trạm
    const stationStats = await Vehicle.aggregate([
      { $match: { is_active: true, station_id: { $ne: null } } },
      { $group: { _id: '$station_id', count: { $sum: 1 } } }
    ]);
    
    // Lấy thông tin trạm
    const stationIds = stationStats.map(item => item._id);
    const stations = await Station.find({ _id: { $in: stationIds } }, 'code name');
    
    // Map station info
    const stationMap = {};
    stations.forEach(station => {
      stationMap[station._id] = {
        code: station.code,
        name: station.name
      };
    });
    
    const stationStatsWithInfo = stationStats.map(item => ({
      station: stationMap[item._id] || { code: 'Unknown', name: 'Unknown' },
      count: item.count
    }));
    
    // Thống kê theo loại xe
    const typeStats = await Vehicle.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Thống kê theo màu xe
    const colorStats = await Vehicle.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$color', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    return res.status(200).json({
      statusStats,
      stationStats: stationStatsWithInfo,
      typeStats,
      colorStats
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Báo cáo bảo trì
exports.reportMaintenance = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, maintenance_type } = req.body;
    
    // Lấy images từ req.files (file upload)
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => file.path); // file.path chứa URL từ Cloudinary
    }
    
    // Validate reason
    if (!reason) {
      return res.status(400).json({ message: 'Vui lòng cung cấp lý do bảo trì' });
    }
    
    // Validate maintenance_type
    const validTypes = ['low_battery', 'poor_condition'];
    if (maintenance_type && !validTypes.includes(maintenance_type)) {
      return res.status(400).json({ 
        message: 'maintenance_type không hợp lệ. Chọn: low_battery hoặc poor_condition' 
      });
    }
    
    // Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
    //  CHỈ CHO PHÉP BÁO CÁO XE AVAILABLE
    if (vehicle.status !== 'available') {
      return res.status(400).json({ 
        message: `Chỉ có thể báo cáo bảo trì xe đang available. Xe hiện tại đang ${vehicle.status}` 
      });
    }
    
    // Xác định type cuối cùng (default: poor_condition)
    let finalType = maintenance_type || 'poor_condition';
    
    // ✅ VALIDATION: Nếu Staff chọn low_battery → Kiểm tra pin
    if (req.user.role === 'Station Staff' && finalType === 'low_battery') {
      // Chỉ cho phép low_battery nếu pin < 50%
      if (vehicle.current_battery >= 50) {
        return res.status(400).json({
          message: `Chỉ được báo cáo low_battery khi pin < 50%. Pin hiện tại: ${vehicle.current_battery}%`,
          suggestion: 'Vui lòng chọn maintenance_type = "poor_condition" nếu có vấn đề khác'
        });
      }
    }
    
    // Tạo mã bảo trì
    const maintenanceCode = `MT${Date.now().toString().substring(6)}_${vehicle.name}`;
    
    // Tạo báo cáo bảo trì với type do Staff chọn
    const maintenance = new Maintenance({
      code: maintenanceCode,
      vehicle_id: vehicle._id,
      station_id: vehicle.station_id,
      maintenance_type: finalType,
      title: finalType === 'low_battery' 
        ? `Sạc pin xe ${vehicle.name}`
        : `Bảo trì xe ${vehicle.name}`,
      description: reason,
      status: 'reported',
      images,
      reported_by: req.user._id
    });
    
    // Lưu báo cáo
    await maintenance.save();
    
    // Cập nhật trạng thái xe
    const oldStatus = vehicle.status;
    vehicle.status = 'maintenance';
    vehicle.technical_status = 'needs_maintenance';
    await vehicle.save();
    
    // Cập nhật số lượng xe tại trạm (nếu có)
    if (vehicle.station_id) {
      const station = await Station.findById(vehicle.station_id);
      if (station) {
        // Giảm số lượng xe theo trạng thái cũ
        if (oldStatus === 'available') station.available_vehicles -= 1;
        else if (oldStatus === 'rented') station.rented_vehicles -= 1;
        
        // Tăng số lượng xe bảo trì
        station.maintenance_vehicles += 1;
        
        await station.save();
      }
    }
    
    return res.status(201).json({
      message: 'Báo cáo bảo trì thành công',
      maintenance: {
        code: maintenance.code,
        maintenance_type: maintenance.maintenance_type,
        status: maintenance.status,
        can_staff_fix: maintenance.maintenance_type === 'low_battery',
        title: maintenance.title,
        description: maintenance.description
      }
    });
  } catch (error) {
    console.error('Lỗi khi báo cáo bảo trì:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách xe cho public (customer) - CHỈ HIỂN THỊ 1 MÀU ĐẠI DIỆN
exports.getPublicVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      model, 
      station_id,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;
    
    // Query cơ bản - chỉ lấy xe available
    const baseQuery = { 
      is_active: true,
      status: 'available',
      station_id: { $ne: null }
    };
    
    if (type) baseQuery.type = type;
    if (model) baseQuery.model = model; 
    if (station_id) baseQuery.station_id = new mongoose.Types.ObjectId(station_id);

    // Aggregate để nhóm xe theo model và type - CHỈ LẤY 1 MÀU ĐẠI DIỆN
    const aggregateQuery = [
      { $match: baseQuery },
      // Sắp xếp để lấy màu đầu tiên 
      { $sort: { color: 1, createdAt: 1 } },
      {
        $group: {
          _id: {
            model: '$model',
            type: '$type'
          },
          // Thông tin của màu đại diện (màu đầu tiên)
          brand: { $first: '$brand' },
          model: { $first: '$model' },
          year: { $first: '$year' },
          type: { $first: '$type' },
          representative_color: { $first: '$color' }, // Màu đại diện
          battery_capacity: { $first: '$battery_capacity' },
          max_range: { $first: '$max_range' },
          price_per_day: { $first: '$price_per_day' },
          deposit_percentage: { $first: '$deposit_percentage' },
          // Tổng số xe available của tất cả màu
          total_available: { $sum: 1 },
          // Ảnh của màu đại diện
          images: { $first: '$images' },
          // ID xe mẫu để link đến detail
          sample_vehicle_id: { $first: '$_id' },
          // Danh sách tất cả màu available (để hiện ở detail)
          available_colors: { $addToSet: '$color' },
          // Thông tin trạm
          stations: { $addToSet: '$station_id' },
          createdAt: { $first: '$createdAt' },
          updatedAt: { $first: '$updatedAt' }
        }
      },
      // Populate thông tin trạm
      {
        $lookup: {
          from: 'stations',
          localField: 'stations',
          foreignField: '_id',
          as: 'station_details'
        }
      },
      // Format lại kết quả
      {
        $project: {
          _id: 0,
          id: '$_id.model', // Lấy model làm ID chính
          model: 1,
          brand: 1,
          year: 1,
          type: 1,
          color: '$representative_color', 
          battery_capacity: 1,
          max_range: 1,
          price_per_day: 1,
          deposit_percentage: 1,
          available_quantity: '$total_available',
          images: 1,
          sample_vehicle_id: 1,
          available_colors_count: { $size: '$available_colors' }, // Số màu có sẵn
          createdAt: 1,
          updatedAt: 1,
          stations: {
            $map: {
              input: '$station_details',
              as: 'station',
              in: {
                _id: '$$station._id',
                name: '$$station.name',
                address: '$$station.address'
              }
            }
          }
        }
      },
      // Chỉ hiện model có xe available
      { $match: { available_quantity: { $gt: 0 } } },
      // Sắp xếp
      { $sort: { [sort]: order === 'desc' ? -1 : 1 } },
      // Phân trang
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    ];

    const vehicles = await Vehicle.aggregate(aggregateQuery);

    // Đếm tổng số model và type
    const total = await Vehicle.aggregate([
      { $match: baseQuery },
      { $group: { _id: { model: '$model', type: '$type' } } },
      { $count: 'total' }
    ]);

    // Format thời gian
    const formattedVehicles = vehicles.map(vehicle => {
      if (vehicle.createdAt) {
        vehicle.createdAt = formatVietnamTime(vehicle.createdAt);
      }
      if (vehicle.updatedAt) {
        vehicle.updatedAt = formatVietnamTime(vehicle.updatedAt);
      }
      return vehicle;
    });

    return res.status(200).json({
      vehicles: formattedVehicles,
      pagination: {
        total: total[0]?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((total[0]?.total || 0) / parseInt(limit)),
        timestamp: formatVietnamTime(nowVietnam(), 'DD/MM/YYYY HH:mm:ss')
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Chi tiết xe cho public (customer) - HIỂN THỊ TẤT CẢ MÀU CỦA MODEL
exports.getPublicVehicleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm xe theo ID
    const vehicle = await Vehicle.findById(id)
      .populate('station_id', 'code name address phone email opening_time closing_time');
    
    if (!vehicle || !vehicle.is_active || vehicle.status !== 'available') {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }

    // Lấy TẤT CẢ MÀU của cùng model
    const allColorsOfModel = await Vehicle.aggregate([
      {
        $match: {
          model: vehicle.model,
          is_active: true,
          status: 'available',
          station_id: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$color',
          color: { $first: '$color' },
          available_quantity: { $sum: 1 },
          sample_vehicle_id: { $first: '$_id' },
          images: { $first: '$images' },
          price_per_day: { $first: '$price_per_day' },
          stations: { $addToSet: '$station_id' }
        }
      },
      {
        $lookup: {
          from: 'stations',
          localField: 'stations',
          foreignField: '_id',
          as: 'station_details'
        }
      },
      {
        $project: {
          _id: 0,
          color: 1,
          available_quantity: 1,
          sample_vehicle_id: 1,
          images: 1,
          price_per_day: 1,
          stations: {
            $map: {
              input: '$station_details',
              as: 'station',
              in: {
                _id: '$$station._id',
                name: '$$station.name',
                address: '$$station.address'
              }
            }
          }
        }
      },
      { $sort: { color: 1 } }
    ]);

    // Thông tin chung của model
    const modelInfo = {
      _id: vehicle._id,
      model: vehicle.model,
      brand: vehicle.brand,
      year: vehicle.year,
      type: vehicle.type,
      battery_capacity: vehicle.battery_capacity,
      max_range: vehicle.max_range,
      current_battery: vehicle.current_battery,
      deposit_percentage: vehicle.deposit_percentage,
      technical_status: vehicle.technical_status,
      // Màu hiện tại được chọn
      selected_color: vehicle.color,
      // Thông tin của màu hiện tại
      current_color_info: {
        color: vehicle.color,
        images: vehicle.images,
        price_per_day: vehicle.price_per_day,
        station: vehicle.station_id
      },
      // Tất cả màu available
      available_colors: allColorsOfModel,
      // Thống kê
      total_colors: allColorsOfModel.length,
      total_available: allColorsOfModel.reduce((sum, item) => sum + item.available_quantity, 0),
      createdAt: formatVietnamTime(vehicle.createdAt),
      updatedAt: formatVietnamTime(vehicle.updatedAt)
    };

    return res.status(200).json(modelInfo);
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách xe cho staff
exports.getStaffVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      color,
      type,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Staff chỉ thấy xe của trạm mình và không thấy draft
    const query = { 
      is_active: true,
      station_id: req.user.stationId, // Lấy từ thông tin user đăng nhập
      status: { $ne: 'draft' } // Không thấy xe draft
    };

    // Filter theo status (available, reserved, rented, maintenance)
    if (status && status !== 'draft') {
      query.status = status;
    }
    
    if (color) query.color = color;
    if (type) query.type = type;

    const vehicles = await Vehicle.find(query)
      .select({
        name: 1,
        license_plate: 1,
        brand: 1,
        model: 1,
        year: 1,
        color: 1,
        type: 1,
        battery_capacity: 1,
        max_range: 1,
        current_battery: 1,
        price_per_day: 1,
        deposit_percentage: 1,
        status: 1,
        technical_status: 1,
        images: 1,
        station_id: 1
      })
      .populate('station_id', 'name address')
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Format thời gian theo giờ Việt Nam
    const formattedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      // Chuyển đổi biển số tạm thời thành "Chưa gắn biển"
      if (vehicleObj.license_plate && vehicleObj.license_plate.startsWith('TEMP_')) {
        vehicleObj.license_plate = "Chưa gắn biển";
        vehicleObj.has_license_plate = false; // Thêm trường này để frontend biết xe chưa có biển số thật
      } else {
        vehicleObj.has_license_plate = true;
      }
      
      // Format thời gian
      vehicleObj.createdAt = formatVietnamTime(vehicle.createdAt);
      vehicleObj.updatedAt = formatVietnamTime(vehicle.updatedAt);
      
      return vehicleObj;
    });

    // Thống kê số lượng xe theo trạng thái tại trạm
    const statistics = await Vehicle.aggregate([
      {
        $match: {
          station_id: new mongoose.Types.ObjectId(req.user.stationId),
          status: { $ne: 'draft' },
          is_active: true
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Vehicle.countDocuments(query);
    
    return res.status(200).json({
      vehicles: formattedVehicles,
      statistics: statistics.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        timestamp: formatVietnamTime(nowVietnam(), 'DD/MM/YYYY HH:mm:ss')
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Rút xe từ trạm về trạng thái chưa phân bổ
exports.withdrawVehiclesFromStation = async (req, res) => {
  try {
    // Kiểm tra quyền Admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { 
      station_id, 
      model,
      color,
      quantity 
    } = req.body;
    
    // Validation
    if (!station_id || !quantity) {
      return res.status(400).json({ 
        message: 'Vui lòng cung cấp station_id và quantity' 
      });
    }
    
    // Tìm trạm
    const station = await Station.findById(station_id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy trạm' });
    }
    
    // Tìm xe phù hợp để rút
    const query = { 
      station_id: station_id,
      status: 'available' // CHỈ rút xe available
    };
    
    if (model) query.model = model;
    if (color) query.color = color;
    
    const vehicles = await Vehicle.find(query).limit(parseInt(quantity));
    
    if (vehicles.length === 0) {
      const filterInfo = [];
      if (model) filterInfo.push(`model ${model}`);
      if (color) filterInfo.push(`màu ${color}`);
      
      const filterText = filterInfo.length > 0 ? ` với điều kiện: ${filterInfo.join(', ')}` : '';
      return res.status(400).json({
        message: `Không tìm thấy xe available để rút${filterText}`
      });
    }
    
    // Cập nhật xe: rút về trạng thái draft
    const vehicleIds = vehicles.map(v => v._id);
    await Vehicle.updateMany(
      { _id: { $in: vehicleIds } },
      {
        $set: {
          station_id: null,
          status: 'draft'
        }
      }
    );
    
    // Cập nhật số lượng xe tại trạm
    station.current_vehicles -= vehicles.length;
    station.available_vehicles -= vehicles.length;
    await station.save();
    
    // Lấy thông tin xe đã rút
    const withdrawnVehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
      .select('name model color status');
    
    
    const vehicleInfo = [];
    if (model) vehicleInfo.push(`model ${model}`);
    if (color) vehicleInfo.push(`màu ${color}`);
    const vehicleText = vehicleInfo.length > 0 ? ` (${vehicleInfo.join(', ')})` : '';
    
    return res.status(200).json({
      message: `Đã rút ${vehicles.length} xe${vehicleText} từ trạm ${station.name}`,
      withdrawn_count: vehicles.length,
      station: {
        id: station._id,
        name: station.name,
        remaining_vehicles: station.current_vehicles,
        remaining_available: station.available_vehicles
      },
      vehicles: withdrawnVehicles
    });
    
  } catch (error) {
    console.error('Lỗi khi rút xe từ trạm:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};


exports.getStaffVehicleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
   
    const vehicle = await Vehicle.findById(id)
      .populate('station_id', 'name address code phone email')
      .populate('created_by', 'fullname email');
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
  
    if (req.user.role === 'Station Staff' && vehicle.station_id?._id.toString() !== req.user.stationId.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem xe này. Xe không thuộc trạm của bạn.' 
      });
    }
    
    
    if (!vehicle.is_active) {
      return res.status(404).json({ message: 'Xe đã bị xóa' });
    }
    
   
    const vehicleObj = vehicle.toObject();
    
   
    if (vehicleObj.license_plate && vehicleObj.license_plate.startsWith('TEMP_')) {
      vehicleObj.license_plate = "Chưa gắn biển";
      vehicleObj.has_license_plate = false;
    } else {
      vehicleObj.has_license_plate = true;
    }
    
    
    vehicleObj.createdAt = formatVietnamTime(vehicle.createdAt);
    vehicleObj.updatedAt = formatVietnamTime(vehicle.updatedAt);
    
    
    vehicleObj.staff_info = {
      can_update: vehicle.status !== 'rented', 
      can_change_status: vehicle.status !== 'rented', 
      can_report_maintenance: vehicle.status === 'available', 
      can_delete: vehicle.status !== 'rented' && vehicle.status !== 'available' // Chỉ có thể xóa xe draft hoặc maintenance
    };
    
    return res.status(200).json({
      vehicle: vehicleObj
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết xe cho staff:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách xe cho admin
exports.getAdminVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      color,
      type,
      station_id,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Admin thấy tất cả
    const query = { is_active: true };
    
    if (status) query.status = status;
    if (color) query.color = color;
    if (type) query.type = type;
    if (station_id) query.station_id = station_id;

    const vehicles = await Vehicle.find(query)
      .populate('station_id', 'name address code')
      .populate('created_by', 'fullname email')
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Format thời gian theo giờ Việt Nam
    const formattedVehicles = vehicles.map(vehicle => {
      const vehicleObj = vehicle.toObject();
      
      // Chuyển đổi biển số tạm thời thành "Chưa gắn biển"
      if (vehicleObj.license_plate && vehicleObj.license_plate.startsWith('TEMP_')) {
        vehicleObj.license_plate = "Chưa gắn biển";
        vehicleObj.has_license_plate = false; // Thêm trường này để frontend biết xe chưa có biển số thật
      } else {
        vehicleObj.has_license_plate = true;
      }
      
      // Format thời gian
      vehicleObj.createdAt = formatVietnamTime(vehicle.createdAt);
      vehicleObj.updatedAt = formatVietnamTime(vehicle.updatedAt);
      
      return vehicleObj;
    });

    // Thống kê tổng quan
    const statistics = await Vehicle.aggregate([
      {
        $match: { is_active: true }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Vehicle.countDocuments(query);
    
    return res.status(200).json({
      vehicles: formattedVehicles,
      statistics: statistics.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        timestamp: formatVietnamTime(nowVietnam(), 'DD/MM/YYYY HH:mm:ss')
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Export template Excel cho bulk pricing update
exports.exportPricingTemplate = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }

    const { model, color, year } = req.body;

    // Query để lấy xe cần update giá
    const query = { is_active: true };
    if (model) query.model = model;
    if (color) query.color = color;
    if (year) query.year = year;

    // Lấy xe có thể update giá (AVAILABLE, DRAFT, MAINTENANCE)
    query.status = { $in: ['available', 'draft', 'maintenance'] };

    const vehicles = await Vehicle.find(query).select({
      name: 1,
      model: 1,
      color: 1,
      status: 1,
      price_per_day: 1,
      deposit_percentage: 1
    });

    if (vehicles.length === 0) {
      return res.status(404).json({ 
        message: 'Không tìm thấy xe phù hợp để cập nhật giá' 
      });
    }

    // Tạo Excel template
    const result = await ExcelService.createPricingTemplate(vehicles);

    // Trả về file Excel
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);

    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);

    // Xóa file sau khi đã gửi
    fileStream.on('end', () => {
      fs.unlinkSync(result.filePath);
    });

  } catch (error) {
    console.error('Lỗi khi export pricing template:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Import và cập nhật giá từ Excel
exports.importPricingUpdates = async (req, res) => {
  try {
    // Kiểm tra quyền hạn
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    }
    
    //  Validate file type
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(fileExt)) {
      return res.status(400).json({ 
        message: 'Chỉ chấp nhận file Excel (.xlsx, .xls)' 
      });
    }

    // Xử lý file Excel
    const result = await ExcelService.processPricingImport(req.file.path);

    // Nếu có lỗi, trả về danh sách lỗi
    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        message: 'Có lỗi trong file Excel. Vui lòng sửa và thử lại.'
      });
    }

    // Cập nhật giá cho từng xe
    const updatePromises = result.data.map(async ({ vehicle_code, new_price, new_deposit_percentage }) => {
      // Tìm xe theo mã xe
      const vehicle = await Vehicle.findOne({ 
        name: vehicle_code,
        is_active: true  
      });
      
      if (!vehicle) {
        return {
          success: false,
          vehicle_code,
          message: 'Không tìm thấy xe hoặc xe đã bị xóa'
        };
      }

    
      let warning = null;
      if (vehicle.status === 'rented' || vehicle.status === 'reserved') {
        warning = 'Xe đang được thuê/đặt. Giá mới áp dụng từ lần thuê tiếp theo.';
      }

      // Cập nhật giá và phần trăm cọc
      const updated = await Vehicle.findByIdAndUpdate(
        vehicle._id,
        { 
          price_per_day: new_price,
          deposit_percentage: new_deposit_percentage
        },
        { new: true }
      );

      return {
        success: !!updated,
        vehicle_code,
        old_price: vehicle.price_per_day,
        new_price,
        old_deposit_percentage: vehicle.deposit_percentage,
        new_deposit_percentage,
        status: vehicle.status,
        warning  // Cảnh báo nếu có
      };
    });

    const updateResults = await Promise.all(updatePromises);

    // Phân loại kết quả
    const successes = updateResults.filter(r => r.success);
    const failures = updateResults.filter(r => !r.success);

    // Thống kê theo trạng thái
    const statusStats = successes.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    // Trả về kết quả chi tiết
    return res.status(200).json({
      success: true,
      updated: successes.length,
      failed: failures.length,
      message: `Đã cập nhật giá cho ${successes.length} xe thành công${failures.length > 0 ? `, ${failures.length} thất bại` : ''}`,
      statusStats,
      details: {
        successes,
        failures
      }
    });

  } catch (error) {
    console.error('Lỗi khi import pricing updates:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  } finally {
    // Đảm bảo xóa file tạm
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
};


exports.exportDraftVehicles = async (req, res) => {
  try {

    const idsParam = req.query.ids;
    let vehicleIds = null;

    if (idsParam) {
   
      vehicleIds = idsParam.split(',').filter(id => id.trim());
    }

  
    let query = {
      $or: [
        { license_plate: { $exists: false } },
        { license_plate: null },
        { license_plate: '' },
        { license_plate: 'N/A' },
        { license_plate: 'Chưa gán biển' },
        { license_plate: /^TEMP_/i }, 
        { license_plate: /^chưa/i }
      ],
      is_active: true
    };


    if (vehicleIds && vehicleIds.length > 0) {
      query._id = { $in: vehicleIds };
    }

    const draftVehicles = await Vehicle.find(query).select('name model color license_plate');

    if (draftVehicles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không có xe nào chưa có biển số'
      });
    }

  
    const result = await ExcelService.exportDraftVehicles(draftVehicles);

   
    res.download(result.filePath, result.fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi tải file'
        });
      }

   
      const fs = require('fs');
      fs.unlink(result.filePath, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
      });
    });

  } catch (error) {
    console.error('Error exporting draft vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi export danh sách xe',
      error: error.message
    });
  }
};

module.exports = exports;