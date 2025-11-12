const Maintenance = require('../models/Maintenance');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const User = require('../models/User');
const mongoose = require('mongoose');

// Lấy danh sách báo cáo bảo trì
exports.getAllMaintenanceReports = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status = 'all', 
            station_id,
            sort_by = 'createdAt',
            sort_order = 'desc'
        } = req.query;

        // Tạo filter
        const filter = { is_active: true };
        
        if (status !== 'all') {
            filter.status = status;
        }
        
        if (station_id) {
            filter.station_id = new mongoose.Types.ObjectId(station_id);
        }

        // Tạo sort
        const sort = {};
        sort[sort_by] = sort_order === 'desc' ? -1 : 1;

        // Tính pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Query với populate
        const maintenanceReports = await Maintenance.find(filter)
            .populate('vehicle_id', 'name license_plate model type')
            .populate('station_id', 'name address')
            .populate('reported_by', 'fullname email')
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Đếm tổng số
        const total = await Maintenance.countDocuments(filter);

        // Thống kê nhanh
        const stats = await Maintenance.aggregate([
            { $match: { is_active: true } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            reported: 0,
            fixed: 0
        };
        
        stats.forEach(stat => {
            statusStats[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: {
                reports: maintenanceReports,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                },
                stats: statusStats
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách báo cáo bảo trì:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy danh sách báo cáo bảo trì',
            error: error.message
        });
    }
};

// Lấy chi tiết báo cáo bảo trì
exports.getMaintenanceReportById = async (req, res) => {
    try {
        const { id } = req.params;

        const maintenance = await Maintenance.findById(id)
            .populate('vehicle_id', 'name license_plate model type brand year color current_mileage current_battery')
            .populate('station_id', 'name address code')
            .populate('reported_by', 'fullname email phone role');

        if (!maintenance) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy báo cáo bảo trì'
            });
        }

        if (!maintenance.is_active) {
            return res.status(404).json({
                success: false,
                message: 'Báo cáo bảo trì đã bị xóa'
            });
        }

        res.json({
            success: true,
            data: maintenance
        });

    } catch (error) {
        console.error('Lỗi khi lấy chi tiết báo cáo bảo trì:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy chi tiết báo cáo bảo trì',
            error: error.message
        });
    }
};

// Cập nhật trạng thái báo cáo bảo trì
exports.updateMaintenanceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes = '', battery_level } = req.body;
        
        // ✅ Lấy ảnh sau khi sửa từ req.files
        let fixed_images = [];
        if (req.files && req.files.length > 0) {
            fixed_images = req.files.map(file => file.path);
        }

        // Validate status
        if (!['reported', 'fixed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Trạng thái không hợp lệ. Chọn: reported, fixed'
            });
        }

        const maintenance = await Maintenance.findById(id)
            .populate('vehicle_id', 'name license_plate status current_battery');

        if (!maintenance) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy báo cáo bảo trì'
            });
        }

        if (!maintenance.is_active) {
            return res.status(404).json({
                success: false,
                message: 'Báo cáo bảo trì đã bị xóa'
            });
        }

        //  PHÂN QUYỀN THEO MAINTENANCE_TYPE
        if (req.user.role === 'Station Staff') {
            // Staff CHỈ được fix low_battery
            if (maintenance.maintenance_type !== 'low_battery') {
                return res.status(403).json({
                    success: false,
                    message: 'Staff chỉ được phép xử lý bảo trì PIN. Vấn đề này cần Admin duyệt.',
                    maintenance_type: maintenance.maintenance_type
                });
            }
            
            // Kiểm tra battery_level khi fix low_battery
            if (status === 'fixed') {
                if (battery_level === undefined || battery_level === null) {
                    return res.status(400).json({
                        success: false,
                        message: 'Vui lòng nhập mức pin hiện tại (battery_level) khi hoàn thành sạc pin.'
                    });
                }
                
                if (battery_level < 80) {
                    return res.status(400).json({
                        success: false,
                        message: `Mức pin phải đạt ít nhất 80% (hiện tại: ${battery_level}%). Vui lòng sạc thêm trước khi đánh dấu hoàn thành.`
                    });
                }
            }
            
            console.log(`✅ Staff ${req.user.name} fixing low_battery maintenance`);
        }
        // Admin có thể fix tất cả

        const oldStatus = maintenance.status;
        maintenance.status = status;
        maintenance.notes = notes;
        
        // ✅ Thêm ảnh sau khi sửa vào images array
        if (fixed_images.length > 0) {
            maintenance.images = [...maintenance.images, ...fixed_images];
        }
        
        await maintenance.save();

        // Nếu chuyển từ reported sang fixed, cập nhật xe về available
        if (oldStatus === 'reported' && status === 'fixed') {
            const vehicle = await Vehicle.findById(maintenance.vehicle_id._id);
            if (vehicle) {
                vehicle.status = 'available';
                vehicle.technical_status = 'good';
                
                // ✅ CẬP NHẬT BATTERY NẾU CÓ
                if (battery_level !== undefined && battery_level !== null) {
                    // Validate battery level
                    if (battery_level < 0 || battery_level > 100) {
                        return res.status(400).json({
                            success: false,
                            message: 'Mức pin phải từ 0-100%'
                        });
                    }
                    
                    const oldBattery = vehicle.current_battery;
                    vehicle.current_battery = battery_level;
                    console.log(`🔋 Updated battery: ${oldBattery}% → ${battery_level}%`);
                }
                
                await vehicle.save();
                
                
                await maintenance.populate('vehicle_id');

                // Cập nhật số lượng xe tại trạm
                const station = await Station.findById(maintenance.station_id);
                if (station) {
                    station.maintenance_vehicles -= 1;
                    station.available_vehicles += 1;
                    await station.save();
                }
            }
        }

        res.json({
            success: true,
            message: 'Cập nhật trạng thái báo cáo bảo trì thành công',
            data: maintenance
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái báo cáo bảo trì:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái báo cáo bảo trì',
            error: error.message
        });
    }
};

// Xóa báo cáo bảo trì (soft delete)
exports.deleteMaintenanceReport = async (req, res) => {
    try {
        const { id } = req.params;

        const maintenance = await Maintenance.findById(id)
            .populate('vehicle_id', 'name status technical_status');

        if (!maintenance) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy báo cáo bảo trì'
            });
        }

        if (!maintenance.is_active) {
            return res.status(404).json({
                success: false,
                message: 'Báo cáo bảo trì đã bị xóa'
            });
        }

        //  CHỈ CHO XÓA MAINTENANCE STATUS 'REPORTED'
        if (maintenance.status === 'fixed') {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa báo cáo đã hoàn thành',
                reason: 'Báo cáo đã fixed là audit trail, không nên xóa',
                suggestion: 'Chỉ có thể xóa báo cáo đang ở trạng thái "reported"'
            });
        }

        const vehicleId = maintenance.vehicle_id?._id;
        const stationId = maintenance.station_id;
        let vehicleStatusUpdated = false;

        // Soft delete maintenance
        maintenance.is_active = false;
        await maintenance.save();

        console.log(`🗑️  Soft deleted maintenance: ${maintenance.code}`);

        // NẾU XE ĐANG MAINTENANCE → KIỂM TRA CÒN MAINTENANCE ACTIVE NÀO KHÁC KHÔNG
        if (vehicleId && maintenance.vehicle_id.status === 'maintenance') {
            // Kiểm tra xe có maintenance report ACTIVE nào khác không?
            const otherActiveMaintenance = await Maintenance.findOne({
                vehicle_id: vehicleId,
                is_active: true,
                _id: { $ne: maintenance._id }
            });

            // Nếu KHÔNG còn maintenance active nào khác → Chuyển xe về available
            if (!otherActiveMaintenance) {
                const vehicle = await Vehicle.findById(vehicleId);
                
                if (vehicle) {
                    const oldStatus = vehicle.status;
                    vehicle.status = 'available';
                    vehicle.technical_status = 'good';
                    await vehicle.save();
                    
                    vehicleStatusUpdated = true;
                    console.log(`✅ Vehicle ${vehicle.name}: ${oldStatus} → available (no active maintenance left)`);

                    //  CẬP NHẬT STATION COUNTS
                    if (stationId) {
                        const station = await Station.findById(stationId);
                        if (station) {
                            station.maintenance_vehicles = Math.max(0, station.maintenance_vehicles - 1);
                            station.available_vehicles += 1;
                            await station.save();
                            console.log(`✅ Station counts updated: -1 maintenance, +1 available`);
                        }
                    }
                }
            } else {
                console.log(`⚠️  Vehicle ${maintenance.vehicle_id.name} still has ${otherActiveMaintenance.code} active`);
            }
        }

        res.json({
            success: true,
            message: 'Xóa báo cáo bảo trì thành công',
            note: 'Soft delete - dữ liệu vẫn được giữ lại trong database',
            vehicle_status_updated: vehicleStatusUpdated,
            vehicle_name: maintenance.vehicle_id?.name
        });

    } catch (error) {
        console.error('Lỗi khi xóa báo cáo bảo trì:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi xóa báo cáo bảo trì',
            error: error.message
        });
    }
};

// Lấy báo cáo bảo trì theo trạm (cho Station Staff)
exports.getStationMaintenanceReports = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status = 'all' 
        } = req.query;

        // Station Staff chỉ thấy báo cáo của trạm mình
        const stationId = req.user.stationId;
        
        if (!stationId) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không thuộc trạm nào'
            });
        }

        const filter = { 
            is_active: true,
            station_id: new mongoose.Types.ObjectId(stationId)
        };
        
        if (status !== 'all') {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const maintenanceReports = await Maintenance.find(filter)
            .populate('vehicle_id', 'name license_plate model type')
            .populate('reported_by', 'fullname email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Maintenance.countDocuments(filter);

        res.json({
            success: true,
            data: {
                reports: maintenanceReports,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Lỗi khi lấy báo cáo bảo trì trạm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy báo cáo bảo trì trạm',
            error: error.message
        });
    }
};
