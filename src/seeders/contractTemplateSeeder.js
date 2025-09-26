/**
 * Contract Template Seeder
 * Tạo contract template mẫu cho hệ thống
 */

require('dotenv').config();
const mongoose = require('mongoose');
const ContractTemplate = require('../models/ContractTemplate');
const User = require('../models/User');

const createDefaultContractTemplate = async () => {
  try {
    // Kiểm tra template đã tồn tại chưa
    const existingTemplate = await ContractTemplate.findOne({ code: 'TPL001' });
    if (existingTemplate) {
      console.log('✅ Contract template TPL001 đã tồn tại');
      return existingTemplate;
    }

    // Tìm admin user để làm created_by
    const adminUser = await User.findOne({ role: 'Admin' });
    if (!adminUser) {
      console.log('❌ Không tìm thấy admin user để tạo template');
      return null;
    }

    // Tạo contract template mẫu
    const template = await ContractTemplate.create({
      code: 'TPL001',
      name: 'Template thuê xe điện cơ bản',
      title: 'Hợp đồng thuê xe điện',
      description: 'Template chuẩn cho thuê xe điện tại các trạm',
      
      content_template: `
        <div class="contract-content">
          <h2>HỢP ĐỒNG THUÊ XE ĐIỆN</h2>
          
          <div class="contract-info">
            <p><strong>Mã hợp đồng:</strong> {{contract_code}}</p>
            <p><strong>Ngày tạo:</strong> {{created_date}}</p>
          </div>

          <div class="parties">
            <h3>BÊN CHO THUÊ (Bên A):</h3>
            <p><strong>Công ty:</strong> EV Rental Company</p>
            <p><strong>Địa chỉ:</strong> {{station_address}}</p>
            <p><strong>Đại diện:</strong> Nhân viên trạm {{station_name}}</p>
          </div>

          <div class="parties">
            <h3>BÊN THUÊ (Bên B):</h3>
            <p><strong>Họ và tên:</strong> {{customer_name}}</p>
            <p><strong>Email:</strong> {{customer_email}}</p>
            <p><strong>Số điện thoại:</strong> {{customer_phone}}</p>
          </div>

          <div class="vehicle-info">
            <h3>THÔNG TIN XE:</h3>
            <p><strong>Tên xe:</strong> {{vehicle_name}}</p>
            <p><strong>Biển số:</strong> {{vehicle_license}}</p>
            <p><strong>Model:</strong> {{vehicle_model}}</p>
            <p><strong>Màu sắc:</strong> {{vehicle_color}}</p>
          </div>

          <div class="rental-period">
            <h3>THỜI GIAN THUÊ:</h3>
            <p><strong>Từ ngày:</strong> {{start_date}}</p>
            <p><strong>Đến ngày:</strong> {{end_date}}</p>
          </div>

          <div class="special-conditions">
            {{#if special_conditions}}
            <h3>ĐIỀU KIỆN ĐẶC BIỆT:</h3>
            <p>{{special_conditions}}</p>
            {{/if}}
          </div>

          <div class="notes">
            {{#if notes}}
            <h3>GHI CHÚ:</h3>
            <p>{{notes}}</p>
            {{/if}}
          </div>
        </div>
      `,
      
      terms_template: `
        <div class="contract-terms">
          <h2>ĐIỀU KHOẢN HỢP ĐỒNG</h2>
          
          <h3>ĐIỀU 1: MỤC ĐÍCH SỬ DỤNG</h3>
          <p>1.1. Bên B cam kết sử dụng xe điện {{vehicle_name}} đúng mục đích thuê và tuân thủ các quy định giao thông.</p>
          <p>1.2. Không được sử dụng xe cho mục đích vận chuyển hàng hóa nguy hiểm, chất cấm.</p>
          <p>1.3. Không được cho người khác thuê lại hoặc sử dụng xe ngoài mục đích đã thỏa thuận.</p>

          <h3>ĐIỀU 2: TRÁCH NHIỆM CỦA BÊN THUÊ</h3>
          <p>2.1. Bảo quản xe cẩn thận, không làm hư hỏng hoặc mất mát.</p>
          <p>2.2. Sạc pin đầy đủ trước khi trả xe.</p>
          <p>2.3. Báo cáo ngay các sự cố kỹ thuật cho bên cho thuê.</p>
          <p>2.4. Tuân thủ lịch trình thuê đã thỏa thuận.</p>

          <h3>ĐIỀU 3: TRÁCH NHIỆM CỦA BÊN CHO THUÊ</h3>
          <p>3.1. Cung cấp xe trong tình trạng tốt, đầy đủ phụ kiện.</p>
          <p>3.2. Hỗ trợ kỹ thuật 24/7 trong thời gian thuê.</p>
          <p>3.3. Thay thế xe khác nếu xe gặp sự cố không thể khắc phục.</p>

          <h3>ĐIỀU 4: PHÍ VÀ THANH TOÁN</h3>
          <p>4.1. Phí thuê được tính theo ngày từ {{start_date}} đến {{end_date}}.</p>
          <p>4.2. Phí cọc được hoàn lại sau khi trả xe (trừ các khoản phí phát sinh).</p>
          <p>4.3. Phí phát sinh (trễ giờ, hư hỏng) sẽ được tính riêng.</p>

          <h3>ĐIỀU 5: BẢO HIỂM VÀ RỦI RO</h3>
          <p>5.1. Xe đã được bảo hiểm tai nạn và trộm cắp.</p>
          <p>5.2. Bên thuê chịu trách nhiệm về các vi phạm giao thông trong thời gian thuê.</p>
          <p>5.3. Bên thuê bồi thường thiệt hại do lỗi cá nhân gây ra.</p>

          <h3>ĐIỀU 6: CHẤM DỨT HỢP ĐỒNG</h3>
          <p>6.1. Hợp đồng chấm dứt khi hết thời hạn thuê hoặc trả xe sớm.</p>
          <p>6.2. Bên cho thuê có quyền chấm dứt hợp đồng nếu bên thuê vi phạm nghiêm trọng.</p>
          <p>6.3. Thông báo chấm dứt hợp đồng trước ít nhất 24 giờ.</p>

          <h3>ĐIỀU 7: GIẢI QUYẾT TRANH CHẤP</h3>
          <p>7.1. Các tranh chấp được giải quyết thông qua thương lượng.</p>
          <p>7.2. Nếu không thương lượng được, đưa ra Tòa án có thẩm quyền.</p>

          <h3>ĐIỀU 8: HIỆU LỰC</h3>
          <p>8.1. Hợp đồng có hiệu lực từ ngày ký và có giá trị đến {{end_date}}.</p>
          <p>8.2. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau.</p>
        </div>
      `,
      
      placeholders: [
        {
          key: '{{customer_name}}',
          label: 'Tên khách hàng',
          type: 'text',
          required: true
        },
        {
          key: '{{customer_email}}',
          label: 'Email khách hàng',
          type: 'text',
          required: true
        },
        {
          key: '{{customer_phone}}',
          label: 'Số điện thoại',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_name}}',
          label: 'Tên xe',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_license}}',
          label: 'Biển số xe',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_model}}',
          label: 'Model xe',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_color}}',
          label: 'Màu xe',
          type: 'text',
          required: true
        },
        {
          key: '{{station_name}}',
          label: 'Tên trạm',
          type: 'text',
          required: true
        },
        {
          key: '{{station_address}}',
          label: 'Địa chỉ trạm',
          type: 'text',
          required: true
        },
        {
          key: '{{start_date}}',
          label: 'Ngày bắt đầu',
          type: 'date',
          required: true
        },
        {
          key: '{{end_date}}',
          label: 'Ngày kết thúc',
          type: 'date',
          required: true
        },
        {
          key: '{{contract_code}}',
          label: 'Mã hợp đồng',
          type: 'text',
          required: true
        },
        {
          key: '{{created_date}}',
          label: 'Ngày tạo',
          type: 'date',
          required: true
        },
        {
          key: '{{special_conditions}}',
          label: 'Điều kiện đặc biệt',
          type: 'text',
          required: false
        },
        {
          key: '{{notes}}',
          label: 'Ghi chú',
          type: 'text',
          required: false
        }
      ],
      
      status: 'active',
      default_valid_days: 7,
      created_by: adminUser._id
    });

    console.log('✅ Đã tạo contract template mẫu:', template.code);
    return template;

  } catch (error) {
    console.error('❌ Lỗi khi tạo contract template:', error);
    return null;
  }
};

// Tạo template VIP
const createVipContractTemplate = async () => {
  try {
    // Kiểm tra template đã tồn tại chưa
    const existingTemplate = await ContractTemplate.findOne({ code: 'TPL002' });
    if (existingTemplate) {
      console.log('✅ Contract template TPL002 đã tồn tại');
      return existingTemplate;
    }

    // Tìm admin user để làm created_by
    const adminUser = await User.findOne({ role: 'Admin' });
    if (!adminUser) {
      console.log('❌ Không tìm thấy admin user để tạo template');
      return null;
    }

    // Tạo contract template VIP
    const template = await ContractTemplate.create({
      code: 'TPL002',
      name: 'Template thuê xe điện VIP',
      title: 'Hợp đồng thuê xe điện VIP',
      description: 'Template đặc biệt cho khách hàng VIP',
      
      content_template: `
        <div class="contract-content vip">
          <h2>HỢP ĐỒNG THUÊ XE ĐIỆN VIP</h2>
          
          <div class="vip-badge">
            <span>🌟 KHÁCH HÀNG VIP 🌟</span>
          </div>
          
          <div class="contract-info">
            <p><strong>Mã hợp đồng:</strong> {{contract_code}}</p>
            <p><strong>Ngày tạo:</strong> {{created_date}}</p>
            <p><strong>Loại:</strong> VIP Contract</p>
          </div>

          <div class="parties">
            <h3>BÊN CHO THUÊ (Bên A):</h3>
            <p><strong>Công ty:</strong> EV Rental Company</p>
            <p><strong>Địa chỉ:</strong> {{station_address}}</p>
            <p><strong>Đại diện:</strong> Manager trạm {{station_name}}</p>
          </div>

          <div class="parties">
            <h3>BÊN THUÊ VIP (Bên B):</h3>
            <p><strong>Họ và tên:</strong> {{customer_name}}</p>
            <p><strong>Email:</strong> {{customer_email}}</p>
            <p><strong>Số điện thoại:</strong> {{customer_phone}}</p>
            <p><strong>Loại khách:</strong> VIP Customer</p>
          </div>

          <div class="vehicle-info">
            <h3>THÔNG TIN XE VIP:</h3>
            <p><strong>Tên xe:</strong> {{vehicle_name}}</p>
            <p><strong>Biển số:</strong> {{vehicle_license}}</p>
            <p><strong>Model:</strong> {{vehicle_model}}</p>
            <p><strong>Màu sắc:</strong> {{vehicle_color}}</p>
            <p><strong>Đặc điểm:</strong> Xe cao cấp, đầy đủ phụ kiện</p>
          </div>

          <div class="rental-period">
            <h3>THỜI GIAN THUÊ:</h3>
            <p><strong>Từ ngày:</strong> {{start_date}}</p>
            <p><strong>Đến ngày:</strong> {{end_date}}</p>
          </div>

          <div class="vip-benefits">
            <h3>QUYỀN LỢI VIP:</h3>
            <ul>
              <li>Hỗ trợ 24/7 qua hotline VIP</li>
              <li>Ưu tiên thay xe khi có sự cố</li>
              <li>Miễn phí sạc pin tại các trạm</li>
              <li>Giảm giá 10% cho lần thuê tiếp theo</li>
              <li>Bảo hiểm toàn diện</li>
            </ul>
          </div>

          <div class="special-conditions">
            {{#if special_conditions}}
            <h3>ĐIỀU KIỆN ĐẶC BIỆT:</h3>
            <p>{{special_conditions}}</p>
            {{/if}}
          </div>

          <div class="notes">
            {{#if notes}}
            <h3>GHI CHÚ:</h3>
            <p>{{notes}}</p>
            {{/if}}
          </div>
        </div>
      `,
      
      terms_template: `
        <div class="contract-terms vip">
          <h2>ĐIỀU KHOẢN HỢP ĐỒNG VIP</h2>
          
          <h3>ĐIỀU 1: MỤC ĐÍCH SỬ DỤNG</h3>
          <p>1.1. Bên B cam kết sử dụng xe điện {{vehicle_name}} đúng mục đích thuê và tuân thủ các quy định giao thông.</p>
          <p>1.2. Không được sử dụng xe cho mục đích vận chuyển hàng hóa nguy hiểm, chất cấm.</p>
          <p>1.3. Không được cho người khác thuê lại hoặc sử dụng xe ngoài mục đích đã thỏa thuận.</p>

          <h3>ĐIỀU 2: TRÁCH NHIỆM CỦA BÊN THUÊ VIP</h3>
          <p>2.1. Bảo quản xe cẩn thận, không làm hư hỏng hoặc mất mát.</p>
          <p>2.2. Sạc pin đầy đủ trước khi trả xe (hoặc sử dụng dịch vụ sạc miễn phí).</p>
          <p>2.3. Báo cáo ngay các sự cố kỹ thuật qua hotline VIP.</p>
          <p>2.4. Tuân thủ lịch trình thuê đã thỏa thuận.</p>

          <h3>ĐIỀU 3: TRÁCH NHIỆM CỦA BÊN CHO THUÊ</h3>
          <p>3.1. Cung cấp xe trong tình trạng tốt, đầy đủ phụ kiện cao cấp.</p>
          <p>3.2. Hỗ trợ kỹ thuật 24/7 qua hotline VIP.</p>
          <p>3.3. Thay thế xe khác trong vòng 30 phút nếu xe gặp sự cố.</p>
          <p>3.4. Miễn phí sạc pin tại tất cả các trạm.</p>

          <h3>ĐIỀU 4: PHÍ VÀ THANH TOÁN VIP</h3>
          <p>4.1. Phí thuê được tính theo ngày từ {{start_date}} đến {{end_date}}.</p>
          <p>4.2. Phí cọc được hoàn lại sau khi trả xe (trừ các khoản phí phát sinh).</p>
          <p>4.3. Phí phát sinh được giảm 50% cho khách VIP.</p>
          <p>4.4. Giảm giá 10% cho lần thuê tiếp theo.</p>

          <h3>ĐIỀU 5: BẢO HIỂM VÀ RỦI RO VIP</h3>
          <p>5.1. Xe đã được bảo hiểm toàn diện (tai nạn, trộm cắp, thiên tai).</p>
          <p>5.2. Bên thuê chịu trách nhiệm về các vi phạm giao thông trong thời gian thuê.</p>
          <p>5.3. Bên thuê bồi thường thiệt hại do lỗi cá nhân gây ra (giảm 50% cho VIP).</p>

          <h3>ĐIỀU 6: CHẤM DỨT HỢP ĐỒNG</h3>
          <p>6.1. Hợp đồng chấm dứt khi hết thời hạn thuê hoặc trả xe sớm.</p>
          <p>6.2. Bên cho thuê có quyền chấm dứt hợp đồng nếu bên thuê vi phạm nghiêm trọng.</p>
          <p>6.3. Thông báo chấm dứt hợp đồng trước ít nhất 12 giờ (VIP).</p>

          <h3>ĐIỀU 7: GIẢI QUYẾT TRANH CHẤP</h3>
          <p>7.1. Các tranh chấp được giải quyết thông qua thương lượng với Manager.</p>
          <p>7.2. Nếu không thương lượng được, đưa ra Tòa án có thẩm quyền.</p>

          <h3>ĐIỀU 8: HIỆU LỰC</h3>
          <p>8.1. Hợp đồng có hiệu lực từ ngày ký và có giá trị đến {{end_date}}.</p>
          <p>8.2. Hợp đồng được lập thành 02 bản có giá trị pháp lý như nhau.</p>
          <p>8.3. Khách VIP được ưu tiên trong mọi dịch vụ.</p>
        </div>
      `,
      
      placeholders: [
        {
          key: '{{customer_name}}',
          label: 'Tên khách hàng VIP',
          type: 'text',
          required: true
        },
        {
          key: '{{customer_email}}',
          label: 'Email khách hàng',
          type: 'text',
          required: true
        },
        {
          key: '{{customer_phone}}',
          label: 'Số điện thoại',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_name}}',
          label: 'Tên xe VIP',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_license}}',
          label: 'Biển số xe',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_model}}',
          label: 'Model xe',
          type: 'text',
          required: true
        },
        {
          key: '{{vehicle_color}}',
          label: 'Màu xe',
          type: 'text',
          required: true
        },
        {
          key: '{{station_name}}',
          label: 'Tên trạm',
          type: 'text',
          required: true
        },
        {
          key: '{{station_address}}',
          label: 'Địa chỉ trạm',
          type: 'text',
          required: true
        },
        {
          key: '{{start_date}}',
          label: 'Ngày bắt đầu',
          type: 'date',
          required: true
        },
        {
          key: '{{end_date}}',
          label: 'Ngày kết thúc',
          type: 'date',
          required: true
        },
        {
          key: '{{contract_code}}',
          label: 'Mã hợp đồng',
          type: 'text',
          required: true
        },
        {
          key: '{{created_date}}',
          label: 'Ngày tạo',
          type: 'date',
          required: true
        },
        {
          key: '{{special_conditions}}',
          label: 'Điều kiện đặc biệt',
          type: 'text',
          required: false
        },
        {
          key: '{{notes}}',
          label: 'Ghi chú',
          type: 'text',
          required: false
        }
      ],
      
      status: 'active',
      default_valid_days: 14, // VIP có thời hạn dài hơn
      created_by: adminUser._id
    });

    console.log('✅ Đã tạo contract template VIP:', template.code);
    return template;

  } catch (error) {
    console.error('❌ Lỗi khi tạo contract template VIP:', error);
    return null;
  }
};

// Chạy seeder
const runContractTemplateSeeder = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Đã kết nối database');
    
    console.log('🌱 Bắt đầu tạo contract templates...');
    
    const basicTemplate = await createDefaultContractTemplate();
    const vipTemplate = await createVipContractTemplate();
    
    if (basicTemplate && vipTemplate) {
      console.log('✅ Hoàn thành tạo contract templates!');
      console.log(`   - Template cơ bản: ${basicTemplate.code}`);
      console.log(`   - Template VIP: ${vipTemplate.code}`);
    } else {
      console.log('⚠️ Một số template không được tạo thành công');
    }
    
    // Đóng kết nối
    await mongoose.connection.close();
    console.log('✅ Đã đóng kết nối database');
    
  } catch (error) {
    console.error('❌ Lỗi khi chạy contract template seeder:', error);
    await mongoose.connection.close();
  }
};

module.exports = {
  createDefaultContractTemplate,
  createVipContractTemplate,
  runContractTemplateSeeder
};
