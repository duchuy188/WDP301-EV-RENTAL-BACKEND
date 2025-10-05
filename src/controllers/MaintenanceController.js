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
            priority = 'all',
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
        
        if (priority !== 'all') {
            filter.priority = priority;
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
            .populate('vehicle_id', 'name license_plate model type brand year color current_mileage battery_level')
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
        const { status, notes = '' } = req.body;
        
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
            .populate('vehicle_id', 'name license_plate status');

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
                await vehicle.save();

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

        const maintenance = await Maintenance.findById(id);

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

        // Soft delete
        maintenance.is_active = false;
        await maintenance.save();

        res.json({
            success: true,
            message: 'Xóa báo cáo bảo trì thành công'
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
