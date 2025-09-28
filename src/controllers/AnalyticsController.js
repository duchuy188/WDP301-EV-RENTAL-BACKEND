const Rental = require('../models/Rental');
const Payment = require('../models/Payment');
const Station = require('../models/Station');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const mongoose = require('mongoose');

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
        const { period = 'month', date = new Date().toISOString().split('T')[0], payment_method = 'all' } = req.query;
        
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
        const { period = 'month', date = new Date().toISOString().split('T')[0], payment_method = 'all' } = req.query;
        
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
function getDateRange(period, date = new Date()) {
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

function getPreviousPeriod(period, date = new Date()) {
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
