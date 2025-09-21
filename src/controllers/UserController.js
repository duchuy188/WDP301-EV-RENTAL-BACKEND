const { User, Station } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail, getStaffAccountEmailTemplate } = require('../config/nodemailer');
const { formatVietnamTime, nowVietnam } = require('../config/timezone');

// Tạo tài khoản Staff (chỉ Admin) - KHÔNG gán station
exports.createStaffAccount = async (req, res) => {
  try {
  
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền tạo tài khoản Staff' });
    }

    const {
      fullname, email, phone
    } = req.body;


    if (!fullname || !email || !phone) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
    }


    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }


    const defaultPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

 
    const newUser = new User({
      fullname,
      email,
      phone,
      passwordHash: hashedPassword,
      role: 'Station Staff',
      status: 'active',
      kycStatus: 'not_submitted' 
    });

    await newUser.save();

 
    const userResponse = {
      _id: newUser._id,
      fullname: newUser.fullname,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      stationId: newUser.stationId, 
      status: newUser.status,
      createdAt: formatVietnamTime(newUser.createdAt, 'DD/MM/YYYY HH:mm:ss')
    };

   
    try {
      const emailHtml = getStaffAccountEmailTemplate(fullname, email, defaultPassword);
      await sendEmail({
        to: email,
        subject: 'Tài khoản Staff EV Rental - Thông tin đăng nhập',
        html: emailHtml
      });
      console.log(`Email đã gửi thành công cho staff: ${email}`);
    } catch (emailError) {
      console.error('Lỗi gửi email:', emailError);
   
    }

    res.status(201).json({
      message: 'Đã tạo tài khoản Staff thành công',
      user: userResponse,
      temporaryPassword: defaultPassword, 
      emailSent: true
    });

  } catch (error) {
    console.error('Lỗi khi tạo tài khoản Staff:', error);
    res.status(500).json({ message: 'Lỗi server khi tạo tài khoản' });
  }
};


exports.assignStaffToStation = async (req, res) => {
  try {
   
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền gán staff' });
    }

    const { userId, stationId } = req.body;

  
    if (!userId || !stationId) {
      return res.status(400).json({ message: 'Vui lòng cung cấp userId và stationId' });
    }

   
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    if (user.role !== 'Station Staff') {
      return res.status(400).json({ message: 'User này không phải là Staff' });
    }

   
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ message: 'Không tìm thấy trạm' });
    }

   
    user.stationId = stationId;
    await user.save();

    res.status(200).json({
      message: 'Đã gán staff cho trạm thành công',
      user: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        stationId: user.stationId,
        station: {
          _id: station._id,
          name: station.name,
          code: station.code
        }
      }
    });

  } catch (error) {
    console.error('Lỗi khi gán staff cho station:', error);
    res.status(500).json({ message: 'Lỗi server khi gán staff' });
  }
};


exports.getUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      status, 
      stationId,
      search,
      sort = 'createdAt'
    } = req.query;

  
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xem danh sách users' });
    }

    const query = {};

    
    if (role) query.role = role;
    if (status) query.status = status;
    if (stationId) query.stationId = stationId;
    if (search) {
      query.$or = [
        { fullname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

   
    const skip = (parseInt(page) - 1) * parseInt(limit);

   
    let sortOption = {};
    if (sort === 'createdAt') sortOption = { createdAt: -1 };
    else if (sort === 'fullname') sortOption = { fullname: 1 };
    else if (sort === 'email') sortOption = { email: 1 };

   
    const users = await User.find(query)
      .select('-password -refreshTokens')
      .populate('stationId', 'name code')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

   
    const total = await User.countDocuments(query);

    // Format thời gian theo giờ Việt Nam
    const formattedUsers = users.map(user => ({
      ...user.toObject(),
      createdAt: formatVietnamTime(user.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(user.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    }));

    res.status(200).json({
      users: formattedUsers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách users:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách users' });
  }
};


exports.getCustomers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'active', 
      search,
      sort = 'createdAt'
    } = req.query;

   
    const query = { role: 'EV Renter' };

   
    if (status) query.status = status;
    if (search) {
      query.$and = [
        {
          $or: [
            { fullname: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

   
    const skip = (parseInt(page) - 1) * parseInt(limit);

  
    let sortOption = {};
    if (sort === 'createdAt') sortOption = { createdAt: -1 };
    else if (sort === 'fullname') sortOption = { fullname: 1 };
    else if (sort === 'email') sortOption = { email: 1 };

    
    const customers = await User.find(query)
      .select('_id fullname email phone kycStatus kycId createdAt')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

   
    const total = await User.countDocuments(query);

  
    const formattedCustomers = customers.map(customer => ({
      ...customer.toObject(),
      createdAt: formatVietnamTime(customer.createdAt, 'DD/MM/YYYY HH:mm:ss')
    }));

    res.status(200).json({
      message: 'Danh sách khách hàng',
      customers: formattedCustomers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách khách hàng:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách khách hàng' });
  }
};

// Lấy danh sách Staff chưa có station (chỉ Admin)
exports.getUnassignedStaff = async (req, res) => {
  try {
  
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xem danh sách staff' });
    }

    const { page = 1, limit = 10, search } = req.query;

    
    const query = {
      role: 'Station Staff',
      $or: [
        { stationId: { $exists: false } },
        { stationId: null }
      ],
      status: 'active'
    };

    
    if (search) {
      query.$and = [
        {
          $or: [
            { fullname: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        }
      ];
    }

   
    const skip = (parseInt(page) - 1) * parseInt(limit);

  
    const staff = await User.find(query)
      .select('-password -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

 
    const total = await User.countDocuments(query);

    // Format thời gian theo giờ Việt Nam
    const formattedStaff = staff.map(staffMember => ({
      ...staffMember.toObject(),
      createdAt: formatVietnamTime(staffMember.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(staffMember.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    }));

    res.status(200).json({
      message: 'Danh sách staff chưa có station',
      staff: formattedStaff,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách staff chưa có station:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách staff' });
  }
};

// Lấy chi tiết user
exports.getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

   
    if (req.user.role !== 'Admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Bạn không có quyền xem thông tin user này' });
    }

    const user = await User.findById(id)
      .select('-password -refreshTokens')
      .populate('stationId', 'name code address');

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    
    const formattedUser = {
      ...user.toObject(),
      createdAt: formatVietnamTime(user.createdAt, 'DD/MM/YYYY HH:mm:ss'),
      updatedAt: formatVietnamTime(user.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    res.status(200).json({ user: formattedUser });

  } catch (error) {
    console.error('Lỗi khi lấy chi tiết user:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy chi tiết user' });
  }
};

// Cập nhật thông tin user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullname, phone, status, stationId
    } = req.body;

   
    if (req.user.role !== 'Admin' && req.user._id.toString() !== id) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật user này' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    // Cập nhật thông tin
    if (fullname) user.fullname = fullname;
    if (phone) user.phone = phone;
    if (req.user.role === 'Admin') {
      if (status) {
        // Kiểm tra status hợp lệ
        if (!['active', 'suspended', 'blocked'].includes(status)) {
          return res.status(400).json({ message: 'Trạng thái user không hợp lệ' });
        }
        user.status = status;
      }
      if (stationId) {
      
        const station = await Station.findById(stationId);
        if (!station) {
          return res.status(404).json({ message: 'Không tìm thấy trạm' });
        }
        user.stationId = stationId;
      }
    }

    await user.save();

    // Trả về thông tin user cập nhật
    const userResponse = {
      _id: user._id,
      fullname: user.fullname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      stationId: user.stationId,
      status: user.status,
      updatedAt: formatVietnamTime(user.updatedAt, 'DD/MM/YYYY HH:mm:ss')
    };

    res.status(200).json({
      message: 'Đã cập nhật thông tin user thành công',
      user: userResponse
    });

  } catch (error) {
    console.error('Lỗi khi cập nhật user:', error);
    res.status(500).json({ message: 'Lỗi server khi cập nhật user' });
  }
};

// Khóa/mở khóa tài khoản
exports.toggleUserStatus = async (req, res) => {
  try {
    // Chỉ Admin mới có quyền
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền khóa/mở khóa tài khoản' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'suspended', 'blocked'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    // Không cho phép khóa chính mình
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Không thể thay đổi trạng thái của chính mình' });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      message: `Đã ${status === 'active' ? 'mở khóa' : 'khóa'} tài khoản thành công`,
      user: {
        _id: user._id,
        fullname: user.fullname,
        email: user.email,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Lỗi khi thay đổi trạng thái user:', error);
    res.status(500).json({ message: 'Lỗi server khi thay đổi trạng thái user' });
  }
};

// Reset password cho user
exports.resetUserPassword = async (req, res) => {
  try {
    // Chỉ Admin mới có quyền
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền reset password' });
    }

    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }


    const newPassword = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      message: 'Đã reset password thành công',
      newPassword: newPassword 
    });

  } catch (error) {
    console.error('Lỗi khi reset password:', error);
    res.status(500).json({ message: 'Lỗi server khi reset password' });
  }
};

// Lấy danh sách khách hàng rủi ro
exports.getRiskyCustomers = async (req, res) => {
  try {
    // Chỉ Admin mới có quyền
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xem danh sách khách hàng rủi ro' });
    }

    const { page = 1, limit = 10 } = req.query;

  
    const query = {
      role: 'EV Renter',
      status: 'active'
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const riskyCustomers = await User.find(query)
      .select('-password -refreshTokens')
      .populate('kycId', 'status rejection_reason')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      customers: riskyCustomers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách khách hàng rủi ro:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy danh sách khách hàng rủi ro' });
  }
};

// Lấy thống kê users
exports.getUserStats = async (req, res) => {
  try {
    // Chỉ Admin mới có quyền
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Chỉ Admin mới có quyền xem thống kê' });
    }

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const blockedUsers = await User.countDocuments({ status: 'blocked' });

    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const usersByStatus = await User.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      blocked: blockedUsers,
      byRole: usersByRole,
      byStatus: usersByStatus
    });

  } catch (error) {
    console.error('Lỗi khi lấy thống kê users:', error);
    res.status(500).json({ message: 'Lỗi server khi lấy thống kê' });
  }
};