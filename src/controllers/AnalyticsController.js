const Rental = require('../models/Rental');
const Payment = require('../models/Payment');
const Station = require('../models/Station');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const Maintenance = require('../models/Maintenance');
const Feedback = require('../models/Feedback');
const mongoose = require('mongoose');
const { nowVietnam } = require('../config/timezone');

// Tổng quan doanh thu
exports.getRevenueOverview = async (req, res) => {
    try {
        const { period = 'today', payment_method = 'all' } = req.query;
        
        // Tính toán date range
        const dateRange = getDateRange(period);
        
        // Tổng doanh thu
        const totalRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Số giao dịch
        const transactionCount = await Payment.countDocuments({
            status: 'completed',
            createdAt: { $gte: dateRange.start, $lte: dateRange.end },
            ...(payment_method !== 'all' ? { payment_method } : {})
        });
        
        // Doanh thu hôm qua/tuần trước/tháng trước để tính growth
        const previousPeriod = getPreviousPeriod(period);
        const previousRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Tính growth rate
        const currentTotal = totalRevenue[0]?.total || 0;
        const previousTotal = previousRevenue[0]?.total || 0;
        const growthRate = previousTotal > 0 ? 
            ((currentTotal - previousTotal) / previousTotal * 100) : 0;
        
        // Trạm có doanh thu cao nhất
        const topStation = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
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
                $unwind: '$station'
            },
            {
                $group: {
                    _id: '$station._id',
                    stationName: { $first: '$station.name' },
                    revenue: { $sum: '$amount' }
                }
            },
            {
                $sort: { revenue: -1 }
            },
            {
                $limit: 1
            }
        ]);
        
        res.json({
            success: true,
            data: {
                totalRevenue: currentTotal,
                transactionCount,
                growthRate: Math.round(growthRate * 100) / 100,
                topStation: topStation[0] || null,
                period,
                dateRange
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy tổng quan doanh thu:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy tổng quan doanh thu',
            error: error.message
        });
    }
};

// Doanh thu theo trạm
exports.getRevenueByStation = async (req, res) => {
    try {
        const { period = 'month', date = nowVietnam().toDate().toISOString().split('T')[0], payment_method = 'all' } = req.query;
        
        const dateRange = getDateRange(period, date);
        
        // Doanh thu theo trạm
        const stationRevenue = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
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
                $unwind: '$station'
            },
            {
                $group: {
                    _id: '$station._id',
                    stationName: { $first: '$station.name' },
                    stationCode: { $first: '$station.code' },
                    stationAddress: { $first: '$station.address' },
                    revenue: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    averageTransaction: { $avg: '$amount' }
                }
            },
            {
                $sort: { revenue: -1 }
            }
        ]);
        
        // Tính tổng doanh thu để tính phần trăm
        const totalRevenue = stationRevenue.reduce((sum, station) => sum + station.revenue, 0);
        
        // Thêm phần trăm và growth rate
        const stationRevenueWithPercentage = await Promise.all(
            stationRevenue.map(async (station) => {
                // Tính growth rate so với kỳ trước
                const previousPeriod = getPreviousPeriod(period, date);
                const previousRevenue = await Payment.aggregate([
                    {
                        $match: {
                            status: 'completed',
                            createdAt: { $gte: previousPeriod.start, $lte: previousPeriod.end },
                            ...(payment_method !== 'all' ? { payment_method } : {})
                        }
                    },
                    {
                        $lookup: {
                            from: 'rentals',
                            localField: 'rental_id',
                            foreignField: '_id',
                            as: 'rental'
                        }
                    },
                    {
                        $match: { 'rental.0': { $exists: true } }
                    },
                    {
                        $unwind: '$rental'
                    },
                    {
                        $match: { 'rental.station_id': station._id }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ]);
                
                const previousTotal = previousRevenue[0]?.total || 0;
                const growthRate = previousTotal > 0 ? 
                    ((station.revenue - previousTotal) / previousTotal * 100) : 0;
                
                return {
                    ...station,
                    percentage: totalRevenue > 0 ? (station.revenue / totalRevenue * 100) : 0,
                    growthRate: Math.round(growthRate * 100) / 100
                };
            })
        );
        
        res.json({
            success: true,
            data: {
                stations: stationRevenueWithPercentage,
                totalRevenue,
                period,
                dateRange
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy doanh thu theo trạm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy doanh thu theo trạm',
            error: error.message
        });
    }
};

// Phân tích xu hướng doanh thu
exports.getRevenueTrends = async (req, res) => {
    try {
        const { period = 'month', stations = 'all', payment_method = 'all' } = req.query;
        
        let matchCondition = {
            status: 'completed'
        };
        
        // Lọc theo trạm nếu có
        if (stations !== 'all') {
            const stationIds = stations.split(',').map(id => new mongoose.Types.ObjectId(id));
            matchCondition['rental.station_id'] = { $in: stationIds };
        }
        
        // Group theo ngày/tuần/tháng
        const groupFormat = getGroupFormat(period);
        
        const trends = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: getDateRange(period).start, $lte: getDateRange(period).end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
            },
            {
                $match: matchCondition
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: groupFormat, date: '$createdAt' } }
                    },
                    revenue: { $sum: '$amount' },
                    transactionCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                trends,
                period,
                groupFormat
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy xu hướng doanh thu:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy xu hướng doanh thu',
            error: error.message
        });
    }
};

// Chi tiết doanh thu trạm
exports.getStationRevenueDetail = async (req, res) => {
    try {
        const { stationId } = req.params;
        const { period = 'month', date = nowVietnam().toDate().toISOString().split('T')[0], payment_method = 'all' } = req.query;
        
        const dateRange = getDateRange(period, date);
        
        // Thông tin trạm
        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy trạm'
            });
        }
        
        // Doanh thu theo loại xe
        const revenueByVehicleType = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
            },
            {
                $match: { 'rental.station_id': new mongoose.Types.ObjectId(stationId) }
            },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'rental.vehicle_id',
                    foreignField: '_id',
                    as: 'vehicle'
                }
            },
            {
                $unwind: '$vehicle'
            },
            {
                $group: {
                    _id: '$vehicle.type',
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Doanh thu theo giờ trong ngày
        const revenueByHour = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
            },
            {
                $match: { 'rental.station_id': new mongoose.Types.ObjectId(stationId) }
            },
            {
                $group: {
                    _id: { $hour: '$createdAt' },
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);
        
        // Top khách hàng
        const topCustomers = await Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: dateRange.start, $lte: dateRange.end },
                    ...(payment_method !== 'all' ? { payment_method } : {})
                }
            },
            {
                $lookup: {
                    from: 'rentals',
                    localField: 'rental_id',
                    foreignField: '_id',
                    as: 'rental'
                }
            },
            {
                $match: { 'rental.0': { $exists: true } }
            },
            {
                $unwind: '$rental'
            },
            {
                $match: { 'rental.station_id': new mongoose.Types.ObjectId(stationId) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'rental.user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $group: {
                    _id: '$user._id',
                    customerName: { $first: '$user.fullname' },
                    customerEmail: { $first: '$user.email' },
                    totalSpent: { $sum: '$amount' },
                    rentalCount: { $sum: 1 }
                }
            },
            {
                $sort: { totalSpent: -1 }
            },
            {
                $limit: 10
            }
        ]);
        
        // Tỷ lệ sử dụng xe
        const vehicleUtilization = await Rental.aggregate([
            {
                $match: {
                    station_id: new mongoose.Types.ObjectId(stationId),
                    start_time: { $gte: dateRange.start, $lte: dateRange.end }
                }
            },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: '_id',
                    as: 'vehicle'
                }
            },
            {
                $unwind: '$vehicle'
            },
            {
                $group: {
                    _id: '$vehicle._id',
                    licensePlate: { $first: '$vehicle.license_plate' },
                    vehicleType: { $first: '$vehicle.type' },
                    rentalCount: { $sum: 1 },
                    totalRevenue: { $sum: '$total_amount' }
                }
            },
            {
                $sort: { rentalCount: -1 }
            }
        ]);
        
        res.json({
            success: true,
            data: {
                station: {
                    id: station._id,
                    name: station.name,
                    code: station.code,
                    address: station.address
                },
                revenueByVehicleType,
                revenueByHour,
                topCustomers,
                vehicleUtilization,
                period,
                dateRange
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết doanh thu trạm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy chi tiết doanh thu trạm',
            error: error.message
        });
    }
};

// Helper functions
function getDateRange(period, date = nowVietnam().toDate()) {
    const now = new Date(date);
    let start, end;
    
    switch (period) {
        case 'today':
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            start = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
            end = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }
    
    return { start, end };
}

function getPreviousPeriod(period, date = nowVietnam().toDate()) {
    const now = new Date(date);
    let start, end;
    
    switch (period) {
        case 'today':
            const yesterdayToday = new Date(now);
            yesterdayToday.setDate(now.getDate() - 1);
            start = new Date(yesterdayToday.getFullYear(), yesterdayToday.getMonth(), yesterdayToday.getDate());
            end = new Date(yesterdayToday.getFullYear(), yesterdayToday.getMonth(), yesterdayToday.getDate(), 23, 59, 59);
            break;
        case 'week':
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7);
            const startOfLastWeek = new Date(lastWeek);
            startOfLastWeek.setDate(lastWeek.getDate() - lastWeek.getDay());
            start = new Date(startOfLastWeek.getFullYear(), startOfLastWeek.getMonth(), startOfLastWeek.getDate());
            end = new Date(startOfLastWeek.getFullYear(), startOfLastWeek.getMonth(), startOfLastWeek.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
            end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'year':
            const lastYear = new Date(now.getFullYear() - 1, 0, 1);
            start = new Date(lastYear.getFullYear(), 0, 1);
            end = new Date(lastYear.getFullYear(), 11, 31, 23, 59, 59);
            break;
        default:
            const yesterdayDefault = new Date(now);
            yesterdayDefault.setDate(now.getDate() - 1);
            start = new Date(yesterdayDefault.getFullYear(), yesterdayDefault.getMonth(), yesterdayDefault.getDate());
            end = new Date(yesterdayDefault.getFullYear(), yesterdayDefault.getMonth(), yesterdayDefault.getDate(), 23, 59, 59);
    }
    
    return { start, end };
}

function getGroupFormat(period) {
    switch (period) {
        case 'today':
            return '%H:00';
        case 'week':
            return '%Y-%m-%d';
        case 'month':
            return '%Y-%m-%d';
        case 'year':
            return '%Y-%m';
        default:
            return '%Y-%m-%d';
    }
}

// Thống kê giờ cao điểm/thấp điểm
exports.getPeakAnalysis = async (req, res) => {
    try {
        const { type = 'both', period = '30d', station_id } = req.query;
        
        // Validate type
        const validTypes = ['hours', 'days', 'both'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type không hợp lệ. Chọn: hours, days, both'
            });
        }
        
        // Validate period
        const validPeriods = ['7d', '30d', '90d', '1y'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Period không hợp lệ. Chọn: 7d, 30d, 90d, 1y'
            });
        }
        
        // Tính date range
        const endDate = nowVietnam().toDate();
        const startDate = nowVietnam().toDate();
        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
        }
        
        const result = { period };
        
        if (station_id) {
            result.station_id = station_id;
        }
        
        // Thống kê giờ cao điểm
        if (type === 'hours' || type === 'both') {
            const matchQuery = {
                status: { $in: ['confirmed', 'completed'] },
                createdAt: { $gte: startDate, $lte: endDate }
            };
            
            if (station_id) {
                matchQuery.station_id = new mongoose.Types.ObjectId(station_id);
            }
            
            const Booking = require('../models/Booking');
            
            const hourlyBookings = await Booking.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: { $hour: '$createdAt' },
                        bookings: { $sum: 1 },
                        revenue: { $sum: '$total_price' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]);
            
            // Tạo mảng 24 giờ với giá trị 0
            const hourlyData = Array.from({ length: 24 }, (_, hour) => {
                const data = hourlyBookings.find(h => h._id === hour);
                return {
                    hour,
                    time_range: `${String(hour).padStart(2, '0')}:00-${String((hour + 1) % 24).padStart(2, '0')}:00`,
                    bookings: data?.bookings || 0,
                    revenue: data?.revenue || 0,
                    avg_booking_value: data ? Math.round(data.revenue / data.bookings) : 0
                };
            });
            
            // Sắp xếp theo số bookings để tìm peak và low
            const sortedHours = [...hourlyData].sort((a, b) => b.bookings - a.bookings);
            const peakHours = sortedHours.slice(0, 3).map(h => ({ ...h, trend: 'high' }));
            const lowHours = sortedHours.slice(-3).reverse().map(h => ({ ...h, trend: 'low' }));
            
            const totalBookings = hourlyData.reduce((sum, h) => sum + h.bookings, 0);
            const totalRevenue = hourlyData.reduce((sum, h) => sum + h.revenue, 0);
            
            result.peak_hours = {
                data: hourlyData,
                top_3: peakHours,
                bottom_3: lowHours,
                summary: {
                    total_bookings: totalBookings,
                    total_revenue: totalRevenue,
                    busiest_hour: peakHours[0]?.hour,
                    quietest_hour: lowHours[0]?.hour,
                    peak_bookings: peakHours[0]?.bookings || 0,
                    low_bookings: lowHours[0]?.bookings || 0,
                    avg_bookings_per_hour: Math.round(totalBookings / 24)
                }
            };
        }
        
        // Thống kê ngày cao điểm
        if (type === 'days' || type === 'both') {
            const matchQuery = {
                status: { $in: ['confirmed', 'completed'] },
                createdAt: { $gte: startDate, $lte: endDate }
            };
            
            if (station_id) {
                matchQuery.station_id = new mongoose.Types.ObjectId(station_id);
            }
            
            const Booking = require('../models/Booking');
            
            const dailyBookings = await Booking.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: { $dayOfWeek: '$createdAt' },
                        bookings: { $sum: 1 },
                        revenue: { $sum: '$total_price' }
                    }
                },
                { $sort: { '_id': 1 } }
            ]);
            
            const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
            
            // Tạo mảng 7 ngày với giá trị 0
            const dailyData = Array.from({ length: 7 }, (_, index) => {
                const dayOfWeek = (index + 1) % 7 || 7; // MongoDB dayOfWeek: 1=Sunday, 2=Monday...
                const data = dailyBookings.find(d => d._id === dayOfWeek);
                return {
                    day: index,
                    day_name: dayNames[index],
                    bookings: data?.bookings || 0,
                    revenue: data?.revenue || 0,
                    avg_booking_value: data ? Math.round(data.revenue / data.bookings) : 0
                };
            });
            
            // Sắp xếp theo số bookings để tìm peak và low
            const sortedDays = [...dailyData].sort((a, b) => b.bookings - a.bookings);
            const peakDays = sortedDays.slice(0, 3).map(d => ({ ...d, trend: 'high' }));
            const lowDays = sortedDays.slice(-3).reverse().map(d => ({ ...d, trend: 'low' }));
            
            const totalBookings = dailyData.reduce((sum, d) => sum + d.bookings, 0);
            const totalRevenue = dailyData.reduce((sum, d) => sum + d.revenue, 0);
            
            result.peak_days = {
                data: dailyData,
                top_3: peakDays,
                bottom_3: lowDays,
                summary: {
                    total_bookings: totalBookings,
                    total_revenue: totalRevenue,
                    busiest_day: peakDays[0]?.day_name,
                    quietest_day: lowDays[0]?.day_name,
                    peak_bookings: peakDays[0]?.bookings || 0,
                    low_bookings: lowDays[0]?.bookings || 0,
                    avg_bookings_per_day: Math.round(totalBookings / 7)
                }
            };
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy thống kê giờ cao điểm:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê giờ cao điểm',
            error: error.message
        });
    }
};

// Thống kê bảo trì
exports.getMaintenanceAnalytics = async (req, res) => {
    try {
        const { period = '30d', station_id } = req.query;
        
        // Tính date range
        const endDate = nowVietnam().toDate();
        const startDate = nowVietnam().toDate();
        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
        }
        
        const matchQuery = {
            is_active: true,
            createdAt: { $gte: startDate, $lte: endDate }
        };
        
        if (station_id) {
            matchQuery.station_id = new mongoose.Types.ObjectId(station_id);
        }
        
        // Tổng quan bảo trì
        const totalReports = await Maintenance.countDocuments(matchQuery);
        
        const statusStats = await Maintenance.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const reportedCount = statusStats.find(s => s._id === 'reported')?.count || 0;
        const fixedCount = statusStats.find(s => s._id === 'fixed')?.count || 0;
        
        // Bảo trì theo trạm
        const maintenanceByStation = await Maintenance.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'stations',
                    localField: 'station_id',
                    foreignField: '_id',
                    as: 'station'
                }
            },
            { $unwind: '$station' },
            {
                $group: {
                    _id: '$station_id',
                    stationName: { $first: '$station.name' },
                    stationAddress: { $first: '$station.address' },
                    totalReports: { $sum: 1 },
                    reportedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] }
                    },
                    fixedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { totalReports: -1 } }
        ]);
        
        // Bảo trì theo loại xe
        const maintenanceByVehicleType = await Maintenance.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: '_id',
                    as: 'vehicle'
                }
            },
            { $unwind: '$vehicle' },
            {
                $group: {
                    _id: '$vehicle.type',
                    totalReports: { $sum: 1 },
                    reportedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] }
                    },
                    fixedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { totalReports: -1 } }
        ]);
        
        // Xu hướng bảo trì theo ngày
        const dailyTrends = await Maintenance.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    totalReports: { $sum: 1 },
                    reportedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] }
                    },
                    fixedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);
        
        // Top xe cần bảo trì nhiều nhất
        const topVehiclesNeedingMaintenance = await Maintenance.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: '_id',
                    as: 'vehicle'
                }
            },
            { $unwind: '$vehicle' },
            {
                $group: {
                    _id: '$vehicle_id',
                    vehicleName: { $first: '$vehicle.name' },
                    licensePlate: { $first: '$vehicle.license_plate' },
                    vehicleType: { $first: '$vehicle.type' },
                    totalReports: { $sum: 1 },
                    reportedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'reported'] }, 1, 0] }
                    },
                    fixedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { totalReports: -1 } },
            { $limit: 10 }
        ]);
        
        res.json({
            success: true,
            data: {
                period,
                summary: {
                    totalReports,
                    reportedCount,
                    fixedCount,
                    completionRate: totalReports > 0 ? Math.round((fixedCount / totalReports) * 100) : 0
                },
                byStation: maintenanceByStation,
                byVehicleType: maintenanceByVehicleType,
                dailyTrends,
                topVehiclesNeedingMaintenance,
                dateRange: {
                    start: startDate,
                    end: endDate
                }
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy thống kê bảo trì:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê bảo trì',
            error: error.message
        });
    }
};

// Thống kê hiệu suất nhân viên
exports.getStaffPerformance = async (req, res) => {
    try {
        const { period = '30d', station_id } = req.query;
        
        // Tính date range
        const endDate = nowVietnam().toDate();
        const startDate = nowVietnam().toDate();
        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
        }
        
        // Lấy tất cả staff
        let staffMatchQuery = { role: 'Station Staff', status: 'active' };
        if (station_id) {
            staffMatchQuery.stationId = new mongoose.Types.ObjectId(station_id);
        }
        
        const staffs = await User.find(staffMatchQuery)
            .populate('stationId', 'name address')
            .select('fullname email stationId');
        
        // Thống kê cho từng staff
        const staffPerformance = await Promise.all(
            staffs.map(async (staff) => {
                // Số lượt giao/nhận xe
                const rentalStats = await Rental.aggregate([
                    {
                        $match: {
                            $or: [
                                { pickup_staff_id: staff._id },
                                { return_staff_id: staff._id }
                            ],
                            status: 'completed',
                            actual_start_time: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_rentals: { $sum: 1 },
                            pickup_count: {
                                $sum: { $cond: [{ $eq: ['$pickup_staff_id', staff._id] }, 1, 0] }
                            },
                            return_count: {
                                $sum: { $cond: [{ $eq: ['$return_staff_id', staff._id] }, 1, 0] }
                            }
                        }
                    }
                ]);
                
                const rentalData = rentalStats[0] || { total_rentals: 0, pickup_count: 0, return_count: 0 };
                
                // Thống kê feedback
                const feedbackStats = await Feedback.aggregate([
                    {
                        $match: {
                            staff_ids: staff._id,
                            type: 'rating',
                            is_active: true,
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_ratings: { $sum: 1 },
                            avg_overall_rating: { $avg: '$overall_rating' },
                            avg_staff_service: { $avg: '$staff_service' },
                            avg_vehicle_condition: { $avg: '$vehicle_condition' },
                            avg_station_cleanliness: { $avg: '$station_cleanliness' },
                            avg_checkout_process: { $avg: '$checkout_process' }
                        }
                    }
                ]);
                
                const feedbackData = feedbackStats[0] || {
                    total_ratings: 0,
                    avg_overall_rating: 0,
                    avg_staff_service: 0,
                    avg_vehicle_condition: 0,
                    avg_station_cleanliness: 0,
                    avg_checkout_process: 0
                };
                
                // Thống kê complaint
                const complaintStats = await Feedback.aggregate([
                    {
                        $match: {
                            staff_ids: staff._id,
                            type: 'complaint',
                            is_active: true,
                            createdAt: { $gte: startDate, $lte: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total_complaints: { $sum: 1 },
                            pending_complaints: {
                                $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                            },
                            resolved_complaints: {
                                $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                            }
                        }
                    }
                ]);
                
                const complaintData = complaintStats[0] || {
                    total_complaints: 0,
                    pending_complaints: 0,
                    resolved_complaints: 0
                };
                
                // Tính performance score
                const performanceScore = calculatePerformanceScore(
                    rentalData.total_rentals,
                    feedbackData.avg_overall_rating,
                    feedbackData.total_ratings,
                    complaintData.total_complaints
                );
                
                return {
                    staff_id: staff._id,
                    staff_name: staff.fullname,
                    staff_email: staff.email,
                    station: staff.stationId ? {
                        id: staff.stationId._id,
                        name: staff.stationId.name,
                        address: staff.stationId.address
                    } : null,
                    performance_score: performanceScore,
                    rental_stats: {
                        total_rentals: rentalData.total_rentals,
                        pickup_count: rentalData.pickup_count,
                        return_count: rentalData.return_count
                    },
                    feedback_stats: {
                        total_ratings: feedbackData.total_ratings,
                        avg_overall_rating: Math.round(feedbackData.avg_overall_rating * 100) / 100,
                        avg_staff_service: Math.round(feedbackData.avg_staff_service * 100) / 100,
                        avg_vehicle_condition: Math.round(feedbackData.avg_vehicle_condition * 100) / 100,
                        avg_station_cleanliness: Math.round(feedbackData.avg_station_cleanliness * 100) / 100,
                        avg_checkout_process: Math.round(feedbackData.avg_checkout_process * 100) / 100
                    },
                    complaint_stats: {
                        total_complaints: complaintData.total_complaints,
                        pending_complaints: complaintData.pending_complaints,
                        resolved_complaints: complaintData.resolved_complaints,
                        resolution_rate: complaintData.total_complaints > 0 ? 
                            Math.round((complaintData.resolved_complaints / complaintData.total_complaints) * 100) : 100
                    }
                };
            })
        );
        
        // Sắp xếp theo performance score
        staffPerformance.sort((a, b) => b.performance_score - a.performance_score);
        
        res.json({
            success: true,
            data: {
                period,
                staff_performance: staffPerformance,
                summary: {
                    total_staff: staffPerformance.length,
                    avg_performance_score: staffPerformance.length > 0 ? 
                        Math.round((staffPerformance.reduce((sum, s) => sum + s.performance_score, 0) / staffPerformance.length) * 100) / 100 : 0,
                    top_performer: staffPerformance[0] || null,
                    date_range: {
                        start: startDate,
                        end: endDate
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy thống kê hiệu suất nhân viên:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy thống kê hiệu suất nhân viên',
            error: error.message
        });
    }
};

// Chi tiết hiệu suất nhân viên
exports.getStaffPerformanceDetail = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { period = '30d' } = req.query;
        
        // Kiểm tra staff có tồn tại không
        const staff = await User.findById(staffId)
            .populate('stationId', 'name address')
            .select('fullname email stationId role');
        
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy nhân viên'
            });
        }
        
        if (staff.role !== 'Station Staff') {
            return res.status(400).json({
                success: false,
                message: 'Người dùng này không phải là Station Staff'
            });
        }
        
        // Tính date range
        const endDate = nowVietnam().toDate();
        const startDate = nowVietnam().toDate();
        switch (period) {
            case '7d':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(endDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(endDate.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
        }
        
        // Chi tiết rental
        const rentalDetails = await Rental.aggregate([
            {
                $match: {
                    $or: [
                        { pickup_staff_id: new mongoose.Types.ObjectId(staffId) },
                        { return_staff_id: new mongoose.Types.ObjectId(staffId) }
                    ],
                    status: 'completed',
                    actual_start_time: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'vehicles',
                    localField: 'vehicle_id',
                    foreignField: '_id',
                    as: 'vehicle'
                }
            },
            {
                $unwind: '$vehicle'
            },
            {
                $lookup: {
                    from: 'stations',
                    localField: 'station_id',
                    foreignField: '_id',
                    as: 'station'
                }
            },
            {
                $unwind: '$station'
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
                $unwind: '$user'
            },
            {
                $project: {
                    rental_id: '$_id',
                    vehicle_name: '$vehicle.name',
                    vehicle_type: '$vehicle.type',
                    license_plate: '$vehicle.license_plate',
                    station_name: '$station.name',
                    customer_name: '$user.fullname',
                    customer_email: '$user.email',
                    pickup_staff_id: '$pickup_staff_id',
                    return_staff_id: '$return_staff_id',
                    actual_start_time: '$actual_start_time',
                    actual_end_time: '$actual_end_time',
                    total_amount: '$total_amount',
                    is_pickup: { $eq: ['$pickup_staff_id', new mongoose.Types.ObjectId(staffId)] },
                    is_return: { $eq: ['$return_staff_id', new mongoose.Types.ObjectId(staffId)] }
                }
            },
            {
                $sort: { actual_start_time: -1 }
            }
        ]);
        
        // Chi tiết feedback
        const feedbackDetails = await Feedback.find({
            staff_ids: new mongoose.Types.ObjectId(staffId),
            is_active: true,
            createdAt: { $gte: startDate, $lte: endDate }
        })
        .populate('rental_id', 'vehicle_id station_id user_id')
        .populate('user_id', 'fullname email')
        .populate('rental_id.vehicle_id', 'name type license_plate')
        .populate('rental_id.station_id', 'name address')
        .sort({ createdAt: -1 });
        
        // Thống kê tổng hợp
        const rentalStats = await Rental.aggregate([
            {
                $match: {
                    $or: [
                        { pickup_staff_id: new mongoose.Types.ObjectId(staffId) },
                        { return_staff_id: new mongoose.Types.ObjectId(staffId) }
                    ],
                    status: 'completed',
                    actual_start_time: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total_rentals: { $sum: 1 },
                    pickup_count: {
                        $sum: { $cond: [{ $eq: ['$pickup_staff_id', new mongoose.Types.ObjectId(staffId)] }, 1, 0] }
                    },
                    return_count: {
                        $sum: { $cond: [{ $eq: ['$return_staff_id', new mongoose.Types.ObjectId(staffId)] }, 1, 0] }
                    }
                }
            }
        ]);
        
        const feedbackStats = await Feedback.aggregate([
            {
                $match: {
                    staff_ids: new mongoose.Types.ObjectId(staffId),
                    type: 'rating',
                    is_active: true,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total_ratings: { $sum: 1 },
                    avg_overall_rating: { $avg: '$overall_rating' },
                    avg_staff_service: { $avg: '$staff_service' },
                    avg_vehicle_condition: { $avg: '$vehicle_condition' },
                    avg_station_cleanliness: { $avg: '$station_cleanliness' },
                    avg_checkout_process: { $avg: '$checkout_process' }
                }
            }
        ]);
        
        const complaintStats = await Feedback.aggregate([
            {
                $match: {
                    staff_ids: new mongoose.Types.ObjectId(staffId),
                    type: 'complaint',
                    is_active: true,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total_complaints: { $sum: 1 },
                    pending_complaints: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    resolved_complaints: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    }
                }
            }
        ]);
        
        const rentalData = rentalStats[0] || { total_rentals: 0, pickup_count: 0, return_count: 0 };
        const feedbackData = feedbackStats[0] || {
            total_ratings: 0,
            avg_overall_rating: 0,
            avg_staff_service: 0,
            avg_vehicle_condition: 0,
            avg_station_cleanliness: 0,
            avg_checkout_process: 0
        };
        const complaintData = complaintStats[0] || {
            total_complaints: 0,
            pending_complaints: 0,
            resolved_complaints: 0
        };
        
        // Tính performance score
        const performanceScore = calculatePerformanceScore(
            rentalData.total_rentals,
            feedbackData.avg_overall_rating,
            feedbackData.total_ratings,
            complaintData.total_complaints
        );
        
        res.json({
            success: true,
            data: {
                staff: {
                    id: staff._id,
                    name: staff.fullname,
                    email: staff.email,
                    station: staff.stationId ? {
                        id: staff.stationId._id,
                        name: staff.stationId.name,
                        address: staff.stationId.address
                    } : null
                },
                period,
                performance_score: performanceScore,
                rental_stats: {
                    total_rentals: rentalData.total_rentals,
                    pickup_count: rentalData.pickup_count,
                    return_count: rentalData.return_count
                },
                feedback_stats: {
                    total_ratings: feedbackData.total_ratings,
                    avg_overall_rating: Math.round(feedbackData.avg_overall_rating * 100) / 100,
                    avg_staff_service: Math.round(feedbackData.avg_staff_service * 100) / 100,
                    avg_vehicle_condition: Math.round(feedbackData.avg_vehicle_condition * 100) / 100,
                    avg_station_cleanliness: Math.round(feedbackData.avg_station_cleanliness * 100) / 100,
                    avg_checkout_process: Math.round(feedbackData.avg_checkout_process * 100) / 100
                },
                complaint_stats: {
                    total_complaints: complaintData.total_complaints,
                    pending_complaints: complaintData.pending_complaints,
                    resolved_complaints: complaintData.resolved_complaints,
                    resolution_rate: complaintData.total_complaints > 0 ? 
                        Math.round((complaintData.resolved_complaints / complaintData.total_complaints) * 100) : 100
                },
                rental_details: rentalDetails,
                feedback_details: feedbackDetails,
                date_range: {
                    start: startDate,
                    end: endDate
                }
            }
        });
        
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết hiệu suất nhân viên:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy chi tiết hiệu suất nhân viên',
            error: error.message
        });
    }
};

// Helper function tính performance score
function calculatePerformanceScore(totalRentals, avgRating, totalRatings, totalComplaints) {
    // Base score từ số lượng rental (0-40 điểm)
    const rentalScore = Math.min(totalRentals * 2, 40);
    
    // Rating score (0-40 điểm)
    const ratingScore = avgRating ? (avgRating / 5) * 40 : 0;
    
    // Bonus cho số lượng rating (0-10 điểm)
    const ratingBonus = Math.min(totalRatings * 0.5, 10);
    
    // Penalty cho complaint (0-10 điểm penalty)
    const complaintPenalty = Math.min(totalComplaints * 2, 10);
    
    // Tính tổng điểm
    const totalScore = rentalScore + ratingScore + ratingBonus - complaintPenalty;
    
    // Đảm bảo điểm từ 0-100
    return Math.max(0, Math.min(100, Math.round(totalScore * 100) / 100));
}