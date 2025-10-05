const mongoose = require('mongoose');
const User = require('./src/models/User');

async function debugStaffPerformance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ev-rental');
    console.log('🔍 Debug Staff Performance API:');
    
    // 1. Kiểm tra tất cả Station Staff
    const allStaff = await User.find({ role: 'Station Staff' });
    console.log('\n📊 Tất cả Station Staff:', allStaff.length);
    allStaff.forEach(staff => {
      console.log('- ID:', staff._id, 'Name:', staff.fullname, 'Active:', staff.is_active, 'StationId:', staff.stationId, 'Created:', staff.createdAt);
    });
    
    // 2. Kiểm tra Active Staff
    const activeStaff = await User.find({ role: 'Station Staff', is_active: true });
    console.log('\n✅ Active Station Staff:', activeStaff.length);
    
    // 3. Kiểm tra Date Range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    console.log('\n📅 Date range:', startDate.toISOString(), 'to', endDate.toISOString());
    
    // 4. Kiểm tra Staff trong date range
    const staffInRange = await User.find({ 
      role: 'Station Staff', 
      is_active: true, 
      createdAt: { $gte: startDate, $lte: endDate } 
    });
    console.log('📅 Staff created in 30 days:', staffInRange.length);
    
    // 5. Test query giống API
    console.log('\n🔍 Test query giống API:');
    let staffMatchQuery = { role: 'Station Staff', is_active: true };
    console.log('Query:', JSON.stringify(staffMatchQuery, null, 2));
    
    const staffs = await User.find(staffMatchQuery)
      .populate('stationId', 'name address')
      .select('fullname email stationId');
    
    console.log('Kết quả query:', staffs.length);
    staffs.forEach(staff => {
      console.log('- Staff:', staff.fullname, 'Station:', staff.stationId);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugStaffPerformance();
