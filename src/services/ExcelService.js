const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class ExcelService {
  /**
   * Tạo file Excel template cho việc import biển số xe
   * @param {Array} vehicles - Danh sách xe cần tạo template
   * @param {String} color - Màu xe
   * @returns {String} - Đường dẫn tới file Excel đã tạo
   */
  static async createVehicleTemplate(vehicles, color) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Vehicles');
      
      // Tạo header
      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Tên xe', key: 'name', width: 30 },
        { header: 'Biển số xe', key: 'license_plate', width: 20 }
      ];
      
      // Style cho header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      
      // Thêm dữ liệu
      vehicles.forEach(vehicle => {
        worksheet.addRow({
          id: vehicle._id.toString(),
          name: vehicle.name + (color ? ` - ${color}` : ''),
          license_plate: ''
        });
      });
      
      // Tạo tên file
      const fileName = `vehicle_template_${color || 'all'}_${uuidv4().substring(0, 8)}.xlsx`;
      const filePath = path.join(__dirname, '..', '..', 'uploads', fileName);
      
      // Đảm bảo thư mục uploads tồn tại
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Lưu file
      await workbook.xlsx.writeFile(filePath);
      
      return {
        fileName,
        filePath,
        vehicleCount: vehicles.length
      };
    } catch (error) {
      console.error('Lỗi khi tạo Excel template:', error);
      throw new Error('Không thể tạo file Excel template');
    }
  }
  
  /**
   * Đọc và xử lý file Excel để cập nhật biển số xe
   * @param {String} filePath - Đường dẫn tới file Excel
   * @returns {Array} - Danh sách các cặp {id, license_plate}
   */
  static async processLicensePlateImport(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      
      const worksheet = workbook.getWorksheet(1);
      const result = {
        data: [],
        errors: []
      };
      
      // Bỏ qua hàng header (row 1)
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const id = row.getCell(1).value;
        const name = row.getCell(2).value;
        const licensePlate = row.getCell(3).value;
        
        if (!id) continue;
        
        // Validate biển số
        if (!licensePlate) {
          result.errors.push({
            row: i,
            id,
            message: 'Biển số không được để trống'
          });
          continue;
        }
        
        // Validate format biển số
        const licensePlateRegex = /^[0-9]{2}[A-Z]-[0-9]{3}\.[0-9]{2}$/;
        if (!licensePlateRegex.test(licensePlate)) {
          result.errors.push({
            row: i,
            id,
            message: 'Biển số không đúng định dạng (VD: 51A-123.45)'
          });
          continue;
        }
        
        result.data.push({
          id,
          license_plate: licensePlate
        });
      }
      
      return result;
    } catch (error) {
      console.error('Lỗi khi xử lý file Excel:', error);
      throw new Error('Không thể đọc hoặc xử lý file Excel');
    }
  }

  /**
   * Tạo Excel template cho việc update giá xe hàng loạt
   * @param {Array} vehicles - Danh sách xe cần update giá
   * @returns {Object} - Thông tin file Excel đã tạo
   */
  static async createPricingTemplate(vehicles) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // 1. Tạo worksheet chính
      const worksheet = workbook.addWorksheet('Pricing Update');
      
      // 2. Tạo header với style
      worksheet.columns = [
        { header: 'Mã Xe', key: 'vehicle_code', width: 15 },
        { header: 'Model', key: 'model', width: 20 },
        { header: 'Màu', key: 'color', width: 15 },
        { header: 'Trạng Thái', key: 'status', width: 15 },
        { header: 'Giá Hiện Tại', key: 'current_price', width: 20 },
        { header: 'Giá Mới', key: 'new_price', width: 20 },
        { header: 'Cọc Hiện Tại', key: 'current_deposit', width: 20 },
        { header: 'Cọc Mới', key: 'new_deposit', width: 20 }
      ];

      // 3. Style cho header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };

      // 4. Thêm data
      vehicles.forEach(vehicle => {
        worksheet.addRow({
          vehicle_code: vehicle.name,
          model: vehicle.model,
          color: vehicle.color,
          status: vehicle.status,
          current_price: vehicle.price_per_day,
          new_price: vehicle.price_per_day,
          current_deposit: vehicle.deposit_amount,
          new_deposit: vehicle.deposit_amount
        });
      });

      // 5. Thêm sheet hướng dẫn
      const guideSheet = workbook.addWorksheet('Hướng Dẫn');
      guideSheet.addRow(['HƯỚNG DẪN CẬP NHẬT GIÁ XE']);
      guideSheet.addRow(['1. Nhập giá mới vào cột "Giá Mới"']);
      guideSheet.addRow(['2. Nhập tiền cọc mới vào cột "Cọc Mới"']);
      guideSheet.addRow(['3. Giá phải từ 50,000đ đến 300,000đ']);
      guideSheet.addRow(['4. Tiền cọc phải từ 500,000đ đến 3,000,000đ']);
      guideSheet.addRow(['5. Xe đang được thuê (RENTED) vẫn được update giá mới']);
      guideSheet.addRow(['6. Hợp đồng đang active sẽ giữ nguyên giá cũ']);

      // 6. Lưu file
      const fileName = `pricing_update_${Date.now()}.xlsx`;
      const filePath = path.join(__dirname, '..', '..', 'uploads', fileName);

      await workbook.xlsx.writeFile(filePath);

      return {
        fileName,
        filePath,
        vehicleCount: vehicles.length
      };

    } catch (error) {
      console.error('Lỗi khi tạo pricing template:', error);
      throw new Error('Không thể tạo file Excel template');
    }
  }

  /**
   * Đọc và xử lý file Excel update giá
   * @param {String} filePath - Đường dẫn tới file Excel
   * @returns {Object} - Kết quả xử lý
   */
  static async processPricingImport(filePath) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.getWorksheet('Pricing Update');
      
     
      const result = {
        data: [],
        errors: []
      };

      // Đọc từng dòng (skip header)
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        
     
        
        // Kiểm tra xem row có tồn tại không
        if (!row || !row.values || row.values.length === 0) {
          console.log(`Row ${i} is empty, skipping`);
          continue;
        }
        
    
        // Lấy giá trị từ các cột, với fallback về null nếu cột không tồn tại
        const vehicle_code = row.getCell(1)?.value || null; // Cột A - Mã Xe (VH001)
        const new_price = row.getCell(6)?.value || null;    // Cột F - Giá Mới (150000)
        const new_deposit = row.getCell(8)?.value || null;  // Cột H - Cọc Mới (1500000)

        // Validate data
        if (!vehicle_code || !new_price || !new_deposit) {
          console.log(`Row ${i} validation failed:`, {
            vehicle_code,
            new_price,
            new_deposit
          });
          result.errors.push({
            row: i,
            message: `Thiếu thông tin bắt buộc - Mã xe: ${vehicle_code || 'trống'}, Giá: ${new_price || 'trống'}, Cọc: ${new_deposit || 'trống'}`
          });
          continue;
        }

        // Validate giá
        if (new_price < 50000 || new_price > 300000) {
          result.errors.push({
            row: i,
            message: 'Giá không hợp lệ (50,000đ - 300,000đ)'
          });
          continue;
        }

        // Validate cọc
        if (new_deposit < 500000 || new_deposit > 3000000) {
          result.errors.push({
            row: i,
            message: 'Tiền cọc không hợp lệ (500,000đ - 3,000,000đ)'
          });
          continue;
        }

        // Thêm vào kết quả
        result.data.push({
          vehicle_code,
          new_price,
          new_deposit
        });
      }

      return result;

    } catch (error) {
      console.error('Lỗi khi xử lý file Excel:', error);
      throw new Error('Không thể đọc hoặc xử lý file Excel');
    }
  }
}

module.exports = ExcelService;