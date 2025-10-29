const mongoose = require('mongoose');
const { nowVietnam } = require('../config/timezone');

const userStatsSchema = new mongoose.Schema({
  // Liên kết
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
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
  
  // RISK MANAGEMENT FIELDS
  risk_score: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  }, // Điểm rủi ro (0-100)
  risk_level: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'], 
    default: 'low' 
  }, // Mức độ rủi ro
  violations: [{
    type: { 
      type: String, 
      enum: ['late_return', 'damage', 'no_show', 'payment_issue', 'rule_violation', 'other'] 
    },
    description: { type: String, required: true },
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high'], 
      default: 'low' 
    },
    points: { type: Number, default: 5 }, // Điểm trừ cho vi phạm
    date: { type: Date, default: Date.now },
    resolved: { type: Boolean, default: false },
    resolved_date: { type: Date, default: null },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  total_violations: { type: Number, default: 0 },
  last_violation_date: { type: Date, default: null },
  
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
userStatsSchema.index({ risk_score: -1 }); // Thêm index cho risk score
userStatsSchema.index({ risk_level: 1 }); // Thêm index cho risk level

// Method để cập nhật thống kê
userStatsSchema.methods.updateStats = async function(rentalData) {
  const { distance, spent, days, vehicle_type, station_id, rental_date, violation_data } = rentalData;
  
  // Cập nhật tổng quan
  this.total_rentals += 1;
  this.total_distance += distance || 0;
  this.total_spent += spent || 0;
  this.total_days += days || 0;
  this.last_rental_date = rental_date || nowVietnam().toDate();
  
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
  
  // RISK MANAGEMENT: Thêm vi phạm nếu có
  if (violation_data) {
    this.addViolation(violation_data);
  } else {
    // Cập nhật risk score (giảm điểm theo thời gian)
    this.updateRiskScore();
  }
  
  this.last_updated = nowVietnam().toDate();
  await this.save();
};

// RISK MANAGEMENT METHODS - LOGIC 6 THÁNG
userStatsSchema.methods.updateRiskScore = function() {
  const now = nowVietnam().toDate();
  const sixMonthsAgo = new Date(now.getTime() - (6 * 30 * 24 * 60 * 60 * 1000));
  
  let newScore = 0;
  
 
  
  this.violations.forEach(violation => {
    if (violation.date >= sixMonthsAgo) {
      let points = violation.points || 5;
      newScore += points;
    }
  });
  
  this.risk_score = Math.min(100, newScore);
  
  // Cập nhật risk level
  if (this.risk_score >= 80) this.risk_level = 'critical';
  else if (this.risk_score >= 60) this.risk_level = 'high';
  else if (this.risk_score >= 30) this.risk_level = 'medium';
  else this.risk_level = 'low';
  
  return this.risk_score;
};

userStatsSchema.methods.addViolation = function(violationData) {
  const violation = {
    type: violationData.type,
    description: violationData.description,
    severity: violationData.severity || 'low',
    points: violationData.points || 5,
    date: nowVietnam().toDate(),
    resolved: violationData.resolved || false,
    resolved_date: violationData.resolved_date || null,
    resolved_by: violationData.resolved_by || null
  };
  
  this.violations.push(violation);
  this.total_violations += 1;
  this.last_violation_date = nowVietnam().toDate();
  
  // Cập nhật risk score
  this.updateRiskScore();
  
  return violation;
};

userStatsSchema.methods.resetRiskScore = function() {
  this.risk_score = 0;
  this.risk_level = 'low';
  

  this.violations = [];
  this.total_violations = 0;
  this.last_violation_date = null;
  
  this.last_updated = nowVietnam().toDate();
};

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;