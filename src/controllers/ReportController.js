const Report = require('../models/Report');
const Rental = require('../models/Rental');

class ReportController {

  async createReport(req, res) {
    try {
      const userId = req.user._id;
      const { rental_id, issue_type, description } = req.body;

     
      const rental = await Rental.findOne({
        _id: rental_id,
        user_id: userId,
        status: 'active',
        is_active: true
      }).populate('booking_id vehicle_id');

      if (!rental) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy rental đang hoạt động'
        });
      }


      // Lấy URLs ảnh đã upload (vehicleImageUpload đã upload lên Cloudinary)
      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        imageUrls = req.files.map(file => file.path);
      }

  
      // Tạo mã report random: RPT + 6 ký tự random
      let code;
      let exists = true;
      
      while (exists) {
        code = 'RPT' + Math.random().toString(36).substr(2, 6).toUpperCase();
        exists = await Report.findOne({ code });
      }

   
      const report = await Report.create({
        code,
        rental_id: rental._id,
        booking_id: rental.booking_id._id,
        user_id: userId,
        vehicle_id: rental.vehicle_id._id,
        station_id: rental.station_id,
        issue_type,
        description,
        images: imageUrls
      });

      const populatedReport = await Report.findById(report._id)
        .populate('user_id', 'full_name email phone')
        .populate('vehicle_id', 'name license_plate')
        .populate('rental_id', 'code')
        .populate('station_id', 'name address');

      return res.status(201).json({
        success: true,
        message: 'Tạo báo cáo sự cố thành công',
        data: populatedReport
      });

    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi tạo báo cáo sự cố',
        error: error.message
      });
    }
  }


  async getMyReports(req, res) {
    try {
      const userId = req.user._id;
      const { status } = req.query;

      const filter = { user_id: userId, is_active: true };
      if (status) filter.status = status;

      const reports = await Report.find(filter)
        .populate('vehicle_id', 'name license_plate')
        .populate('rental_id', 'code')
        .populate('station_id', 'name')
        .populate('resolved_by', 'full_name')
        .sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: reports
      });

    } catch (error) {
      console.error('Error getting my reports:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách báo cáo',
        error: error.message
      });
    }
  }

  async getAllReports(req, res) {
    try {
      const { status, issue_type, station_id, page = 1, limit = 20 } = req.query;
      const userRole = req.user.role;
      const userStationId = req.user.stationId; // ⭐ Sửa thành stationId

      const filter = { is_active: true };
      
      // STAFF: Chỉ xem reports của trạm mình
      if (userRole === 'Station Staff') {
        if (!userStationId) {
          return res.status(403).json({
            success: false,
            message: 'Staff chưa được gán trạm'
          });
        }
        filter.station_id = userStationId;
      }
      
      // ADMIN: Xem tất cả, nhưng có thể filter theo trạm
      if (userRole === 'Admin' && station_id) { // ⭐ Sửa thành Admin
        filter.station_id = station_id;
      }
      
      if (status) filter.status = status;
      if (issue_type) filter.issue_type = issue_type;

      const skip = (page - 1) * limit;

      const [reports, total] = await Promise.all([
        Report.find(filter)
          .populate('user_id', 'full_name email phone')
          .populate('vehicle_id', 'name license_plate')
          .populate('rental_id', 'code')
          .populate('station_id', 'name address')
          .populate('resolved_by', 'full_name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Report.countDocuments(filter)
      ]);

      return res.status(200).json({
        success: true,
        data: reports,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Error getting all reports:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách báo cáo',
        error: error.message
      });
    }
  }

  // [STAFF/ADMIN] Xem chi tiết report
  async getReportById(req, res) {
    try {
      const { id } = req.params;
      const userRole = req.user.role;
      const userStationId = req.user.stationId; // ⭐ Đổi từ station_id sang stationId

      const report = await Report.findOne({ _id: id, is_active: true })
        .populate('user_id', 'full_name email phone avatar')
        .populate('vehicle_id', 'name license_plate model brand color type current_battery current_mileage')
        .populate('rental_id', 'code actual_start_time status vehicle_condition_before')
        .populate('booking_id', 'code start_date end_date total_price deposit_amount')
        .populate('station_id', 'name address phone')
        .populate('resolved_by', 'full_name email');

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

    
      if (userRole === 'Station Staff') {
        if (!userStationId) {
          return res.status(403).json({
            success: false,
            message: 'Staff chưa được gán trạm'
          });
        }
        
        if (report.station_id._id.toString() !== userStationId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền xem báo cáo này'
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Error getting report:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin báo cáo',
        error: error.message
      });
    }
  }

  // [STAFF/ADMIN] Giải quyết report
  async resolveReport(req, res) {
    try {
      const { id } = req.params;
      const { resolution_notes } = req.body;
      const staffId = req.user._id;
      const userRole = req.user.role;
      const userStationId = req.user.stationId; // ⭐ Đổi từ station_id sang stationId

      if (!resolution_notes || resolution_notes.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập ghi chú xử lý'
        });
      }

      const report = await Report.findOne({ _id: id, is_active: true });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy báo cáo'
        });
      }

      // STAFF: Chỉ resolve report của trạm mình
      if (userRole === 'Station Staff') {
        if (!userStationId) {
          return res.status(403).json({
            success: false,
            message: 'Staff chưa được gán trạm'
          });
        }
        
        if (report.station_id.toString() !== userStationId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền xử lý báo cáo này'
          });
        }
      }

      if (report.status === 'resolved') {
        return res.status(400).json({
          success: false,
          message: 'Báo cáo đã được giải quyết'
        });
      }

      report.status = 'resolved';
      report.resolution_notes = resolution_notes;
      report.resolved_at = new Date();
      report.resolved_by = staffId;

      await report.save();

      const updatedReport = await Report.findById(report._id)
        .populate('user_id', 'full_name email phone')
        .populate('vehicle_id', 'name license_plate')
        .populate('station_id', 'name')
        .populate('resolved_by', 'full_name');

      return res.status(200).json({
        success: true,
        message: 'Đã giải quyết báo cáo thành công',
        data: updatedReport
      });

    } catch (error) {
      console.error('Error resolving report:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi giải quyết báo cáo',
        error: error.message
      });
    }
  }

  // [STAFF/ADMIN] Thống kê reports
  async getReportStats(req, res) {
    try {
      const userRole = req.user.role;
      const userStationId = req.user.stationId; // ⭐ Sửa thành stationId
      const { station_id } = req.query;

      const filter = { is_active: true };
      
      // STAFF: Chỉ thống kê trạm mình
      if (userRole === 'Station Staff') {
        if (!userStationId) {
          return res.status(403).json({
            success: false,
            message: 'Staff chưa được gán trạm'
          });
        }
        filter.station_id = userStationId;
      }
      
      // ADMIN: Có thể filter theo trạm
      if (userRole === 'Admin' && station_id) { // ⭐ Sửa thành Admin
        filter.station_id = station_id;
      }

      const [
        totalReports,
        pendingReports,
        resolvedReports,
        reportsByType
      ] = await Promise.all([
        Report.countDocuments(filter),
        Report.countDocuments({ ...filter, status: 'pending' }),
        Report.countDocuments({ ...filter, status: 'resolved' }),
        Report.aggregate([
          { $match: filter },
          { $group: { _id: '$issue_type', count: { $sum: 1 } } }
        ])
      ]);

      return res.status(200).json({
        success: true,
        data: {
          total: totalReports,
          pending: pendingReports,
          resolved: resolvedReports,
          byType: reportsByType
        }
      });

    } catch (error) {
      console.error('Error getting report stats:', error);
      return res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thống kê báo cáo',
        error: error.message
      });
    }
  }
}

module.exports = new ReportController();
