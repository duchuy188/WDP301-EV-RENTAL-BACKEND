const { Vehicle, Station, User, Maintenance } = require('../models');
const { uploadToCloudinary } = require('../config/cloudinary');
const ExcelService = require('../services/ExcelService');
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
    

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
   
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;
    
   
    const vehicles = await Vehicle.find(query)
      .populate('station_id', 'code name')
      .populate('created_by', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
  
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
      deposit_amount,
      quantity = 1,
      export_excel = true
    } = req.body;
    

    if (!model || !year || !color || !type || !battery_capacity || !max_range || !price_per_day || !deposit_amount) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }
    
 
    if (quantity <= 0 || quantity > 100) {
      return res.status(400).json({ message: 'Số lượng xe phải từ 1 đến 100' });
    }
    
  
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => file.path); 
    }
    
    // Tạo danh sách xe
    const vehicles = [];
    let lastId = await generateVehicleId();
    
    for (let i = 0; i < quantity; i++) {
 
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
        deposit_amount,
        status: 'draft',
        technical_status: 'good',
        license_plate: `TEMP_${Date.now()}_${i}`, // Temporary license_plate
        images: imageUrls,
        created_by: req.user._id
      });
    }
    
  
    const createdVehicles = [];
    for (const vehicle of vehicles) {
      try {
        const createdVehicle = await Vehicle.create(vehicle);
        createdVehicles.push(createdVehicle);
      } catch (error) {
        console.error(`Lỗi khi tạo xe ${vehicle.name}:`, error.message);
       
      }
    }
    
   
    if (!export_excel) {
      return res.status(201).json({
        message: `Đã tạo ${createdVehicles.length} xe thành công`,
        vehicles: createdVehicles
      });
    }
    
  
    const result = await ExcelService.createVehicleTemplate(createdVehicles, color);
    
  
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.fileName}`);
    
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);
    
 
    fileStream.on('end', () => {
      fs.unlinkSync(result.filePath);
    });
    
  } catch (error) {

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


exports.exportVehicleTemplate = async (req, res) => {
  try {
    const { color, status = 'draft' } = req.query;
    

    const query = { status };
    if (color) query.color = color;
    
    const vehicles = await Vehicle.find(query);
    
    if (vehicles.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy xe phù hợp để export' });
    }
    

    const result = await ExcelService.createVehicleTemplate(vehicles, color);
    

    const fileName = `vehicle_template_${Date.now()}.xlsx`;
    

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(result.filePath);
    fileStream.pipe(res);
    
 
    fileStream.on('end', () => {
      fs.unlinkSync(result.filePath);
    });
  } catch (error) {
    console.error('Lỗi khi export template:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};


exports.importLicensePlates = async (req, res) => {
  try {

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    }
    

    const result = await ExcelService.processLicensePlateImport(req.file.path);

    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        message: 'Có lỗi trong file Excel. Vui lòng sửa và thử lại.'
      });
    }
    

    const updatePromises = result.data.map(async ({ id, license_plate }) => {

      const vehicle = await Vehicle.findById(id);
      if (!vehicle) {
        return {
          success: false,
          id,
          message: 'Không tìm thấy xe'
        };
      }

  
      if (vehicle.status !== 'draft') {
        return {
          success: false,
          id,
          message: `Xe ${vehicle.name} không ở trạng thái draft, không thể cập nhật biển số`
        };
      }


      if (vehicle.license_plate && !vehicle.license_plate.startsWith('TEMP_')) {
        return {
          success: false,
          id,
          message: `Xe ${vehicle.name} đã có biển số ${vehicle.license_plate}, không thể cập nhật`
        };
      }


      const existingVehicle = await Vehicle.findOne({ 
        license_plate,
        _id: { $ne: id }
      });
      
      if (existingVehicle && !existingVehicle.license_plate.startsWith('TEMP_')) {
        return {
          success: false,
          id,
          message: `Biển số ${license_plate} đã được sử dụng bởi xe ${existingVehicle.name}`
        };
      }
      

      const updated = await Vehicle.findByIdAndUpdate(
        id,
        { license_plate },
        { new: true }
      );
      
      return {
        success: !!updated,
        id,
        license_plate,
        name: updated.name
      };
    });
    
    const updateResults = await Promise.all(updatePromises);
    

    const successes = updateResults.filter(r => r.success);
    const failures = updateResults.filter(r => !r.success);


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

    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
};


exports.assignVehiclesByQuantity = async (req, res) => {
  try {

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
    const { color, status = 'draft', quantity, station_id } = req.body;
    
    if (!quantity || !station_id) {
      return res.status(400).json({ message: 'Vui lòng cung cấp số lượng và ID trạm' });
    }
    

    const station = await Station.findById(station_id);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy trạm' });
    }
    

    const currentVehicles = station.current_vehicles || 0;
    if (currentVehicles + parseInt(quantity) > station.max_capacity) {
      return res.status(400).json({
        message: `Trạm không đủ sức chứa. Còn trống ${station.max_capacity - currentVehicles} chỗ`
      });
    }
    

    const query = { status };
    if (color) query.color = color;
    if (status === 'draft') query.license_plate = { $ne: null, $ne: '' };
    query.station_id = null; 
    
    const vehicles = await Vehicle.find(query).limit(parseInt(quantity));
    
    if (vehicles.length < parseInt(quantity)) {
      return res.status(400).json({
        message: `Không đủ xe để phân bổ. Chỉ có ${vehicles.length} xe phù hợp với điều kiện`
      });
    }
    
  
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
    
 
    station.current_vehicles += vehicles.length;
    station.available_vehicles += vehicles.length;
    await station.save();
    

    const updatedVehicles = await Vehicle.find({ _id: { $in: vehicleIds } })
      .populate('station_id', 'code name');
    
    return res.status(200).json({
      message: `Đã phân bổ ${vehicles.length} xe đến trạm ${station.name}`,
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
    

    const validStatuses = ['draft', 'available', 'rented', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }
    

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    

    const oldStatus = vehicle.status;
    
 
    if (oldStatus === status) {
      return res.status(200).json({
        message: `Xe đã ở trạng thái ${status}`,
        vehicle
      });
    }
    
    const validTransitions = {
      'draft': ['available'],
      'available': ['rented', 'maintenance'],
      'rented': ['available', 'maintenance'],
      'maintenance': ['available', 'draft'] 
    };
    

    if (!validTransitions[oldStatus].includes(status)) {
      return res.status(400).json({ 
        message: `Không thể chuyển trạng thái từ ${oldStatus} sang ${status}` 
      });
    }

    if (status === 'available') {
 
      if (!vehicle.station_id) {
        return res.status(400).json({ 
          message: 'Xe phải được gán vào trạm trước khi đổi trạng thái thành available' 
        });
      }
      
     
      if (!vehicle.license_plate || vehicle.license_plate.startsWith('TEMP_')) {
        return res.status(400).json({ 
          message: 'Xe phải có biển số thật trước khi đổi trạng thái thành available' 
        });
      }
      
    
      if (vehicle.technical_status !== 'good') {
        return res.status(400).json({ 
          message: 'Xe phải ở tình trạng kỹ thuật tốt trước khi đổi trạng thái thành available' 
        });
      }
    }
    
    if (status === 'rented') {

      if (oldStatus !== 'available') {
        return res.status(400).json({ 
          message: 'Chỉ xe ở trạng thái available mới có thể chuyển sang rented' 
        });
      }
      

    }
    
    if (status === 'maintenance') {

      const { maintenance_reason } = req.body;
      if (!maintenance_reason) {
        return res.status(400).json({ 
          message: 'Vui lòng cung cấp lý do bảo trì' 
        });
      }
      
      // Tạo báo cáo bảo trì
      const maintenanceCode = `MT${Date.now().toString().substring(6)}`;
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
    

    vehicle.status = status;
    await vehicle.save();

    if (vehicle.station_id) {
      const station = await Station.findById(vehicle.station_id);
      if (station) {

        if (oldStatus === 'available') station.available_vehicles -= 1;
        else if (oldStatus === 'rented') station.rented_vehicles -= 1;
        else if (oldStatus === 'maintenance') station.maintenance_vehicles -= 1;
        

        if (status === 'available') station.available_vehicles += 1;
        else if (status === 'rented') station.rented_vehicles += 1;
        else if (status === 'maintenance') station.maintenance_vehicles += 1;
        
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


exports.updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
 
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
  
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
  
    if (!vehicle.is_active) {
      return res.status(400).json({ message: 'Không thể cập nhật xe đã bị xóa' });
    }

    if (vehicle.status === 'rented') {
      return res.status(400).json({ 
        message: 'Không thể cập nhật xe đang được thuê. Vui lòng đợi khách hàng trả xe.' 
      });
    }
    
 
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
      deposit_amount,
      technical_status
    } = req.body;


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
    if (deposit_amount) vehicle.deposit_amount = deposit_amount;
    if (technical_status) vehicle.technical_status = technical_status;
    

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
    

    await vehicle.save();
    
    return res.status(200).json({
      message: 'Cập nhật thông tin xe thành công',
      vehicle
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin xe:', error);
    
 
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


exports.deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }
    
 
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }


    if (!vehicle.is_active) {
      return res.status(400).json({ message: 'Xe đã bị xóa trước đó' });
    }

    if (vehicle.status === 'rented') {
      return res.status(400).json({ 
        message: 'Không thể xóa xe đang được thuê. Vui lòng đợi khách hàng trả xe.' 
      });
    }
    

    vehicle.is_active = false;
    await vehicle.save();
    

    if (vehicle.station_id) {
      const station = await Station.findById(vehicle.station_id);
      if (station) {
        station.current_vehicles -= 1;
        
    
        if (vehicle.status === 'available') station.available_vehicles -= 1;
        else if (vehicle.status === 'rented') station.rented_vehicles -= 1;
        else if (vehicle.status === 'maintenance') station.maintenance_vehicles -= 1;
        
        await station.save();
      }
    }
    
    return res.status(200).json({
      message: 'Xóa xe thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa xe:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Cập nhật pin xe
exports.updateVehicleBattery = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_battery } = req.body;
    
    // Validate battery
    if (current_battery < 0 || current_battery > 100) {
      return res.status(400).json({ message: 'Pin phải từ 0% đến 100%' });
    }
    
    // Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
    // Cập nhật pin
    vehicle.current_battery = current_battery;
    await vehicle.save();
    
    return res.status(200).json({
      message: 'Cập nhật pin xe thành công',
      vehicle
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật pin xe:', error);
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
    const { reason, priority = 'medium', images = [] } = req.body;
    
    // Validate
    if (!reason) {
      return res.status(400).json({ message: 'Vui lòng cung cấp lý do bảo trì' });
    }
    
    // Tìm xe
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe' });
    }
    
    // Tạo mã bảo trì
    const maintenanceCode = `MT${Date.now().toString().substring(6)}`;
    
    // Tạo báo cáo bảo trì
    const maintenance = new Maintenance({
      code: maintenanceCode,
      vehicle_id: vehicle._id,
      station_id: vehicle.station_id,
      title: `Bảo trì xe ${vehicle.name}`,
      description: reason,
      status: 'reported',
      priority,
      images,
      reported_by: req.user._id,
      created_by: req.user._id
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
      maintenance
    });
  } catch (error) {
    console.error('Lỗi khi báo cáo bảo trì:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách xe cho public (customer)
exports.getPublicVehicles = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      color,
      type,
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
    if (station_id) baseQuery.station_id = station_id;
    if (color) baseQuery.color = color;

    // Aggregate để nhóm xe theo model và màu
    const aggregateQuery = [
      { $match: baseQuery },
      {
        $group: {
          _id: {
            model: '$model',
            color: '$color'
          },
          // Thông tin chung của model
          brand: { $first: '$brand' },
          model: { $first: '$model' },
          year: { $first: '$year' },
          type: { $first: '$type' },
          color: { $first: '$color' },
          battery_capacity: { $first: '$battery_capacity' },
          max_range: { $first: '$max_range' },
          price_per_day: { $first: '$price_per_day' },
          deposit_amount: { $first: '$deposit_amount' },
          // Chỉ đếm số xe available
          available_quantity: { $sum: 1 },
          // Một ảnh đại diện
          sample_image: { $first: { $arrayElemAt: ['$images', 0] } },
          // Danh sách trạm có xe available
          stations: {
            $addToSet: {
              _id: '$station_id',
              quantity: 1
            }
          }
        }
      },
      // Populate thông tin trạm
      {
        $lookup: {
          from: 'stations',
          localField: 'stations._id',
          foreignField: '_id',
          as: 'station_details'
        }
      },
      // Format lại thông tin trạm
      {
        $project: {
          _id: 0,
          model: 1,
          brand: 1,
          year: 1,
          type: 1,
          color: 1,
          battery_capacity: 1,
          max_range: 1,
          price_per_day: 1,
          deposit_amount: 1,
          available_quantity: 1,
          sample_image: 1,
          stations: {
            $map: {
              input: '$station_details',
              as: 'station',
              in: {
                _id: '$$station._id',
                name: '$$station.name',
                address: '$$station.address',
                available_quantity: {
                  $size: {
                    $filter: {
                      input: '$stations',
                      as: 'st',
                      cond: { $eq: ['$$st._id', '$$station._id'] }
                    }
                  }
                }
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

    // Đếm tổng số model xe available
    const total = await Vehicle.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            model: '$model',
            color: '$color'
          }
        }
      },
      { $count: 'total' }
    ]);

    // Format thời gian theo giờ Việt Nam
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

// Chi tiết xe cho public (customer)
exports.getPublicVehicleDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tìm xe
    const vehicle = await Vehicle.findOne({
      _id: id,
      status: 'available',
      is_active: true,
      station_id: { $ne: null }
    }).populate('station_id', 'name address phone email opening_time closing_time');
    
    if (!vehicle) {
      return res.status(404).json({ message: 'Không tìm thấy xe hoặc xe không khả dụng' });
    }
    
    // Lấy số lượng xe cùng model/màu tại trạm
    const sameModelCount = await Vehicle.countDocuments({
      model: vehicle.model,
      color: vehicle.color,
      status: 'available',
      station_id: vehicle.station_id,
      _id: { $ne: vehicle._id }
    });
    
    // Không trả về thông tin nội bộ
    const publicVehicle = {
      _id: vehicle._id,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      type: vehicle.type,
      battery_capacity: vehicle.battery_capacity,
      max_range: vehicle.max_range,
      price_per_day: vehicle.price_per_day,
      deposit_amount: vehicle.deposit_amount,
      images: vehicle.images,
      station: vehicle.station_id,
      similar_vehicles_count: sameModelCount,
      createdAt: formatVietnamTime(vehicle.createdAt),
      updatedAt: formatVietnamTime(vehicle.updatedAt)
    };
    
    return res.status(200).json(publicVehicle);
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

    // Filter theo status (available, rented, maintenance)
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
        deposit_amount: 1,
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
          station_id: mongoose.Types.ObjectId(req.user.stationId),
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
      deposit_amount: 1
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
  
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    }

    const result = await ExcelService.processPricingImport(req.file.path);

    if (result.errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: result.errors,
        message: 'Có lỗi trong file Excel. Vui lòng sửa và thử lại.'
      });
    }

   
    const updatePromises = result.data.map(async ({ vehicle_code, new_price, new_deposit }) => {

      const vehicle = await Vehicle.findOne({ name: vehicle_code });
      if (!vehicle) {
        return {
          success: false,
          vehicle_code,
          message: 'Không tìm thấy xe'
        };
      }

      const updated = await Vehicle.findByIdAndUpdate(
        vehicle._id,
        { 
          price_per_day: new_price,
          deposit_amount: new_deposit
        },
        { new: true }
      );

      return {
        success: !!updated,
        vehicle_code,
        old_price: vehicle.price_per_day,
        new_price,
        old_deposit: vehicle.deposit_amount,
        new_deposit,
        status: vehicle.status
      };
    });

    const updateResults = await Promise.all(updatePromises);

 
    const successes = updateResults.filter(r => r.success);
    const failures = updateResults.filter(r => !r.success);

    
    const statusStats = successes.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});


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

    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
  }
};

module.exports = exports;