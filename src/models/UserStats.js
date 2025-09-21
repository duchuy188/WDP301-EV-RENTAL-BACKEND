const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
  // Liên kết
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Thống kê tổng quan
  total_rentals: { 
    type: Number, 
    default: 0 
  }, // Tổng số lần thuê
  total_distance: { 
    type: Number, 
    default: 0 
  }, // Tổng quãng đường (km)
  total_spent: { 
    type: Number, 
    default: 0 
  }, // Tổng chi phí (VND)
  total_days: { 
    type: Number, 
    default: 0 
  }, // Tổng số ngày thuê
  
  // Thống kê theo thời gian
  peak_hours: [{
    hour: { type: Number, min: 0, max: 23 },
    count: { type: Number, default: 0 }
  }], // Giờ cao điểm thuê
  peak_days: [{
    day: { type: Number, min: 0, max: 6 }, // 0=CN, 1=T2...
    count: { type: Number, default: 0 }
  }], // Ngày trong tuần thường thuê
  
  // Thống kê theo loại xe
  vehicle_preferences: [{
    vehicle_type: { type: String, enum: ['scooter', 'motorcycle'] },
    count: { type: Number, default: 0 }
  }],
  
  // Thống kê theo station
  station_preferences: [{
    station_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' },
    count: { type: Number, default: 0 }
  }],
  
  // Thống kê theo tháng
  monthly_stats: [{
    year: { type: Number },
    month: { type: Number, min: 1, max: 12 },
    rentals: { type: Number, default: 0 },
    distance: { type: Number, default: 0 },
    spent: { type: Number, default: 0 }
  }],
  
  // Lần thuê gần nhất
  last_rental_date: { 
    type: Date, 
    default: null 
  },
  
  // Metadata
  last_updated: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Indexes
userStatsSchema.index({ user_id: 1 }, { unique: true });
userStatsSchema.index({ total_rentals: -1 });
userStatsSchema.index({ total_spent: -1 });
userStatsSchema.index({ last_rental_date: -1 });

// Method để cập nhật thống kê
userStatsSchema.methods.updateStats = async function(rentalData) {
  const { distance, spent, days, vehicle_type, station_id, rental_date } = rentalData;
  
  // Cập nhật tổng quan
  this.total_rentals += 1;
  this.total_distance += distance || 0;
  this.total_spent += spent || 0;
  this.total_days += days || 0;
  this.last_rental_date = rental_date || new Date();
  
  // Cập nhật giờ cao điểm
  const hour = rental_date.getHours();
  const hourIndex = this.peak_hours.findIndex(h => h.hour === hour);
  if (hourIndex >= 0) {
    this.peak_hours[hourIndex].count += 1;
  } else {
    this.peak_hours.push({ hour, count: 1 });
  }
  
  // Cập nhật ngày trong tuần
  const day = rental_date.getDay();
  const dayIndex = this.peak_days.findIndex(d => d.day === day);
  if (dayIndex >= 0) {
    this.peak_days[dayIndex].count += 1;
  } else {
    this.peak_days.push({ day, count: 1 });
  }
  
  // Cập nhật loại xe
  if (vehicle_type) {
    const vehicleIndex = this.vehicle_preferences.findIndex(v => v.vehicle_type === vehicle_type);
    if (vehicleIndex >= 0) {
      this.vehicle_preferences[vehicleIndex].count += 1;
    } else {
      this.vehicle_preferences.push({ vehicle_type, count: 1 });
    }
  }
  
  // Cập nhật station
  if (station_id) {
    const stationIndex = this.station_preferences.findIndex(s => s.station_id.toString() === station_id.toString());
    if (stationIndex >= 0) {
      this.station_preferences[stationIndex].count += 1;
    } else {
      this.station_preferences.push({ station_id, count: 1 });
    }
  }
  
  // Cập nhật thống kê theo tháng
  const year = rental_date.getFullYear();
  const month = rental_date.getMonth() + 1;
  const monthIndex = this.monthly_stats.findIndex(m => m.year === year && m.month === month);
  if (monthIndex >= 0) {
    this.monthly_stats[monthIndex].rentals += 1;
    this.monthly_stats[monthIndex].distance += distance || 0;
    this.monthly_stats[monthIndex].spent += spent || 0;
  } else {
    this.monthly_stats.push({
      year,
      month,
      rentals: 1,
      distance: distance || 0,
      spent: spent || 0
    });
  }
  
  this.last_updated = new Date();
  await this.save();
};

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;