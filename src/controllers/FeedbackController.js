const Feedback = require('../models/Feedback');
const Rental = require('../models/Rental');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const mongoose = require('mongoose');
const { nowVietnam } = require('../config/timezone');

// Tạo feedback (Customer)
exports.createFeedback = async (req, res) => {
  try {
    const { type, rental_id } = req.body;
    
    // Validate user
    if (!req.user || !req.user._id) {
      return res.status(401).json({ 
        message: 'User không hợp lệ' 
      });
    }
    
    // Validate
    if (!type || !rental_id) {
      return res.status(400).json({ 
        message: 'Vui lòng cung cấp type và rental_id' 
      });
    }
    
    if (!['rating', 'complaint'].includes(type)) {
      return res.status(400).json({ 
        message: 'Type phải là rating hoặc complaint' 
      });
    }
    
    // Kiểm tra rental tồn tại và thuộc về user
    const rental = await Rental.findById(rental_id)
      .populate('vehicle_id', 'name model brand')
      .populate('station_id', 'name address')
      .populate('user_id', 'fullname email')
      .populate('pickup_staff_id', 'fullname email')
      .populate('return_staff_id', 'fullname email');
    
    if (!rental) {
      return res.status(404).json({ message: 'Không tìm thấy rental' });
    }
    
    // Kiểm tra quyền sở hữu rental
    const rentalUserId = rental.user_id._id ? rental.user_id._id.toString() : rental.user_id.toString();
    if (rentalUserId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bạn không có quyền tạo feedback cho rental này' });
    }
    
    //  CHỈ CHO PHÉP FEEDBACK KHI RENTAL ĐÃ COMPLETED
    if (rental.status !== 'completed') {
      return res.status(400).json({ 
        message: `Chỉ có thể tạo feedback khi rental đã hoàn thành. Trạng thái hiện tại: ${rental.status}` 
      });
    }
    
    // ✅ XỬ LÝ STAFF_ID VÀ STAFF_IDS
    let staff_id = null;
    let staff_ids = [];
    
    if (type === 'rating') {
      // Rating - lấy tất cả staff liên quan
      staff_ids = [rental.pickup_staff_id, rental.return_staff_id].filter(Boolean);
      staff_id = staff_ids[0] || null; // Nhân viên chính
    } else if (type === 'complaint' && req.body.category === 'staff') {
      // Complaint về staff - cần chọn staff cụ thể
      const { staff_role } = req.body; // 'pickup' hoặc 'return'
      
      if (staff_role === 'pickup' && rental.pickup_staff_id) {
        staff_id = rental.pickup_staff_id;
        staff_ids = [rental.pickup_staff_id];
      } else if (staff_role === 'return' && rental.return_staff_id) {
        staff_id = rental.return_staff_id;
        staff_ids = [rental.return_staff_id];
      } else {
        return res.status(400).json({ 
          message: 'Vui lòng chọn staff_role hợp lệ (pickup hoặc return)' 
        });
      }
    }
    // Complaint khác (vehicle, payment, service) - không cần staff
    
    // Kiểm tra đã có feedback chưa
    const existingFeedback = await Feedback.findOne({
      rental_id,
      user_id: req.user._id,
      type
    });
    
    if (existingFeedback) {
      return res.status(400).json({ 
        message: `Bạn đã ${type === 'rating' ? 'đánh giá' : 'khiếu nại'} cho rental này rồi` 
      });
    }
    
    // Validate theo type
    let feedbackData = {
      rental_id,
      user_id: req.user._id,
      staff_id,
      staff_ids,
      type,
      is_active: true
    };
    
    if (type === 'rating') {
      const { 
        overall_rating, 
        staff_service, 
        vehicle_condition, 
        station_cleanliness, 
        checkout_process,
        comment 
      } = req.body;
      
      if (!overall_rating) {
        return res.status(400).json({ message: 'Vui lòng cung cấp overall_rating' });
      }
      
      feedbackData = {
        ...feedbackData,
        overall_rating,
        staff_service: staff_service || null,
        vehicle_condition: vehicle_condition || null,
        station_cleanliness: station_cleanliness || null,
        checkout_process: checkout_process || null,
        comment: comment || ''
       
      };
    } else if (type === 'complaint') {
      const { title, description, category, comment } = req.body;
      
      if (!title || !description || !category) {
        return res.status(400).json({ 
          message: 'Vui lòng cung cấp title, description và category' 
        });
      }
      
      if (!['vehicle', 'staff', 'payment', 'service', 'other'].includes(category)) {
        return res.status(400).json({ 
          message: 'Category phải là vehicle, staff, payment, service hoặc other' 
        });
      }
      
      feedbackData = {
        ...feedbackData,
        title,
        description,
        category,
        comment: comment || '',
        status: 'pending'
      };
    }
    
    // Xử lý images nếu có
    if (req.files && req.files.length > 0) {
      // Validate file types
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidFiles = req.files.filter(file => !allowedTypes.includes(file.mimetype));
      
      if (invalidFiles.length > 0) {
        return res.status(400).json({
          message: `File type không được hỗ trợ. Chỉ chấp nhận: ${allowedTypes.join(', ')}`,
          invalidFiles: invalidFiles.map(f => f.originalname)
        });
      }
      
      feedbackData.images = req.files.map(file => file.path);
    }
    
    const feedback = new Feedback(feedbackData);
    await feedback.save();
    
    // Populate để trả về đầy đủ thông tin
    await feedback.populate([
      { path: 'rental_id', populate: [
        { path: 'vehicle_id', select: 'name model brand' },
        { path: 'station_id', select: 'name address' }
      ]},
      { path: 'user_id', select: 'fullname email' }
    ]);
    
    res.status(201).json({
      success: true,
      message: `${type === 'rating' ? 'Đánh giá' : 'Khiếu nại'} đã được tạo thành công`,
      data: feedback
    });
    
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi tạo feedback',
      error: error.message 
    });
  }
};

// Lấy feedback của user (Customer)
exports.getMyFeedbacks = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let matchQuery = { user_id: req.user._id, is_active: true };
    
    if (type) {
      matchQuery.type = type;
    }
    
    if (status && type === 'complaint') {
      matchQuery.status = status;
    }
    
    const feedbacks = await Feedback.find(matchQuery)
      .populate([
        { path: 'rental_id', populate: [
          { path: 'vehicle_id', select: 'name model brand' },
          { path: 'station_id', select: 'name address' }
        ]},
        { path: 'user_id', select: 'fullname email' },
        { path: 'resolved_by', select: 'fullname email' }
      ])
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Feedback.countDocuments(matchQuery);
    
    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error getting my feedbacks:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy feedback',
      error: error.message 
    });
  }
};

// Lấy tất cả feedback (Admin)
exports.getAllFeedbacks = async (req, res) => {
  try {
    const { type, status, category, station_id, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    
    let matchQuery = { is_active: true };
    
    if (type) {
      matchQuery.type = type;
    }
    
    if (status && type === 'complaint') {
      matchQuery.status = status;
    }
    
    if (category && type === 'complaint') {
      matchQuery.category = category;
    }
    
    // Tìm feedbacks với filter
    let feedbacks;
    if (station_id) {
      // Nếu có filter theo station, cần join với Rental
      const pipeline = [
        { $match: { is_active: true } },
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      ];
      
      // Thêm các filter khác
      if (type) pipeline.push({ $match: { type } });
      if (status && type === 'complaint') pipeline.push({ $match: { status } });
      if (category && type === 'complaint') pipeline.push({ $match: { category } });
      
      // Sort và pagination
      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      );
      
      // Lookup thêm thông tin
      pipeline.push(
        {
          $lookup: {
            from: 'vehicles',
            localField: 'rental.vehicle_id',
            foreignField: '_id',
            as: 'vehicle'
          }
        },
        {
          $lookup: {
            from: 'stations',
            localField: 'rental.station_id',
            foreignField: '_id',
            as: 'station'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'staff_id',
            foreignField: '_id',
            as: 'staff'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'resolved_by',
            foreignField: '_id',
            as: 'resolvedBy'
          }
        },
        {
          $addFields: {
            rental_id: {
              _id: '$rental._id',
              vehicle_id: { $arrayElemAt: ['$vehicle', 0] },
              station_id: { $arrayElemAt: ['$station', 0] }
            },
            user_id: { $arrayElemAt: ['$user', 0] },
            staff_id: { $arrayElemAt: ['$staff', 0] },
            resolved_by: { $arrayElemAt: ['$resolvedBy', 0] }
          }
        },
        {
          $project: {
            rental: 0,
            vehicle: 0,
            station: 0,
            user: 0,
            staff: 0,
            resolvedBy: 0
          }
        }
      );
      
      feedbacks = await Feedback.aggregate(pipeline);
    } else {
      // Không filter theo station, dùng cách thông thường
      feedbacks = await Feedback.find(matchQuery)
        .populate([
          { path: 'rental_id', populate: [
            { path: 'vehicle_id', select: 'name model brand' },
            { path: 'station_id', select: 'name address' }
          ]},
          { path: 'user_id', select: 'fullname email' },
          { path: 'staff_id', select: 'fullname email' },
          { path: 'resolved_by', select: 'fullname email' }
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
    }
    
    // Count total với filter
    let total;
    if (station_id) {
      const countPipeline = [
        { $match: { is_active: true } },
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      ];
      
      if (type) countPipeline.push({ $match: { type } });
      if (status && type === 'complaint') countPipeline.push({ $match: { status } });
      if (category && type === 'complaint') countPipeline.push({ $match: { category } });
      
      const countResult = await Feedback.aggregate([...countPipeline, { $count: 'total' }]);
      total = countResult[0]?.total || 0;
    } else {
      total = await Feedback.countDocuments(matchQuery);
    }
    
    // Thống kê với filter
    let statsPipeline = [{ $match: { is_active: true } }];
    
    if (station_id) {
      statsPipeline.push(
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      );
    }
    
    if (type) statsPipeline.push({ $match: { type } });
    if (status && type === 'complaint') statsPipeline.push({ $match: { status } });
    if (category && type === 'complaint') statsPipeline.push({ $match: { category } });
    
    statsPipeline.push({
      $group: {
        _id: null,
        total: { $sum: 1 },
        ratings: { $sum: { $cond: [{ $eq: ['$type', 'rating'] }, 1, 0] } },
        complaints: { $sum: { $cond: [{ $eq: ['$type', 'complaint'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'complaint'] }, { $eq: ['$status', 'pending'] }] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'complaint'] }, { $eq: ['$status', 'resolved'] }] }, 1, 0] } }
      }
    });
    
    const stats = await Feedback.aggregate(statsPipeline);
    
    res.json({
      success: true,
      data: {
        feedbacks,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        },
        stats: stats[0] || { total: 0, ratings: 0, complaints: 0, pending: 0, resolved: 0 }
      }
    });
    
  } catch (error) {
    console.error('Error getting all feedbacks:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy feedback',
      error: error.message 
    });
  }
};

// Lấy feedback theo ID
exports.getFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const feedback = await Feedback.findById(id)
      .populate([
        { path: 'rental_id', populate: [
          { path: 'vehicle_id', select: 'name model brand' },
          { path: 'station_id', select: 'name address' }
        ]},
        { path: 'user_id', select: 'fullname email' },
        { path: 'staff_id', select: 'fullname email' },
        { path: 'resolved_by', select: 'fullname email' }
      ]);
    
    if (!feedback || !feedback.is_active) {
      return res.status(404).json({ message: 'Không tìm thấy feedback' });
    }
    
    // Kiểm tra quyền truy cập
    if (req.user.role !== 'Admin' && feedback.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Bạn không có quyền xem feedback này' });
    }
    
    res.json({
      success: true,
      data: feedback
    });
    
  } catch (error) {
    console.error('Error getting feedback by ID:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy feedback',
      error: error.message 
    });
  }
};

// Cập nhật feedback (Admin/Staff)
exports.updateFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, response, comment } = req.body;
    
    const feedback = await Feedback.findById(id);
    
    if (!feedback || !feedback.is_active) {
      return res.status(404).json({ message: 'Không tìm thấy feedback' });
    }
    
    // Chỉ Admin mới có thể cập nhật
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có thể cập nhật feedback' });
    }
    
    // Validate status - chỉ cho complaint
    if (status && feedback.type !== 'complaint') {
      return res.status(400).json({ 
        message: 'Chỉ complaint mới có thể cập nhật status' 
      });
    }
    
    // Validate status
    if (status && !['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ 
        message: 'Status phải là pending hoặc resolved' 
      });
    }
    
    // Cập nhật - chỉ cho complaint
    if (feedback.type === 'complaint') {
      if (status) feedback.status = status;
      if (response !== undefined) feedback.response = response;
      
      if (status === 'resolved') {
        feedback.resolved_by = req.user._id;
      }
    }
    
    // Comment có thể cập nhật cho cả rating và complaint
    if (comment !== undefined) feedback.comment = comment;
    
    await feedback.save();
    
    // Populate để trả về
    await feedback.populate([
      { path: 'rental_id', populate: [
        { path: 'vehicle_id', select: 'name model brand' },
        { path: 'station_id', select: 'name address' }
      ]},
      { path: 'user_id', select: 'fullname email' },
      { path: 'resolved_by', select: 'fullname email' }
    ]);
    
    res.json({
      success: true,
      message: 'Feedback đã được cập nhật thành công',
      data: feedback
    });
    
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi cập nhật feedback',
      error: error.message 
    });
  }
};

// Xóa feedback (Admin)
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    
    const feedback = await Feedback.findById(id);
    
    if (!feedback) {
      return res.status(404).json({ message: 'Không tìm thấy feedback' });
    }
    
    // Soft delete
    feedback.is_active = false;
    await feedback.save();
    
    res.json({
      success: true,
      message: 'Feedback đã được xóa thành công'
    });
    
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi xóa feedback',
      error: error.message 
    });
  }
};

// Thống kê feedback (Admin)
exports.getFeedbackStats = async (req, res) => {
  try {
    const { period = '30d', station_id } = req.query;
    
    // Tính date range
    const now = nowVietnam().toDate();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Thống kê tổng quan
    let overviewPipeline = [
      { 
        $match: { 
          is_active: true,
          createdAt: { $gte: startDate }
        } 
      }
    ];
    
    if (station_id) {
      overviewPipeline.push(
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      );
    }
    
    overviewPipeline.push({
      $group: {
        _id: null,
        total: { $sum: 1 },
        ratings: { $sum: { $cond: [{ $eq: ['$type', 'rating'] }, 1, 0] } },
        complaints: { $sum: { $cond: [{ $eq: ['$type', 'complaint'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'complaint'] }, { $eq: ['$status', 'pending'] }] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'complaint'] }, { $eq: ['$status', 'resolved'] }] }, 1, 0] } },
        avgRating: { $avg: { $cond: [{ $eq: ['$type', 'rating'] }, '$overall_rating', null] } }
      }
    });
    
    const overview = await Feedback.aggregate(overviewPipeline);
    
    // Thống kê theo category (complaints)
    let byCategoryPipeline = [
      { 
        $match: { 
          is_active: true,
          type: 'complaint',
          createdAt: { $gte: startDate }
        } 
      }
    ];
    
    if (station_id) {
      byCategoryPipeline.push(
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      );
    }
    
    byCategoryPipeline.push(
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    );
    
    const byCategory = await Feedback.aggregate(byCategoryPipeline);
    
    // Thống kê theo ngày (7 ngày gần nhất)
    let dailyStatsPipeline = [
      { 
        $match: { 
          is_active: true,
          createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        } 
      }
    ];
    
    if (station_id) {
      dailyStatsPipeline.push(
        {
          $lookup: {
            from: 'rentals',
            localField: 'rental_id',
            foreignField: '_id',
            as: 'rental'
          }
        },
        { $unwind: '$rental' },
        { $match: { 'rental.station_id': new mongoose.Types.ObjectId(station_id) } }
      );
    }
    
    dailyStatsPipeline.push(
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          ratings: { $sum: { $cond: [{ $eq: ['$type', 'rating'] }, 1, 0] } },
          complaints: { $sum: { $cond: [{ $eq: ['$type', 'complaint'] }, 1, 0] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    );
    
    const dailyStats = await Feedback.aggregate(dailyStatsPipeline);
    
    res.json({
      success: true,
      data: {
        period,
        dateRange: {
          start: startDate,
          end: now
        },
        overview: overview[0] || { total: 0, ratings: 0, complaints: 0, pending: 0, resolved: 0, avgRating: 0 },
        byCategory,
        dailyStats
      }
    });
    
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({ 
      message: 'Lỗi server khi lấy thống kê feedback',
      error: error.message 
    });
  }
};
