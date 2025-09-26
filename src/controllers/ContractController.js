/**
 * ContractController - Xử lý logic hợp đồng
 * 
 * Chức năng:
 * - Tạo contract từ rental
 * - Ký contract (staff/customer)
 * - Generate PDF contract
 * - Quản lý contract templates
 */

const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');
const Rental = require('../models/Rental');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Station = require('../models/Station');
const ContractService = require('../services/ContractService');
const nodemailer = require('../config/nodemailer');

// Gửi email hợp đồng cho customer
const sendContractEmail = async (contract) => {
  try {
    // Generate PDF
    const pdfBuffer = await ContractService.generateContractPDF(contract);
    
    // Upload PDF to Cloudinary nếu chưa có
    let pdfUrl = contract.contract_file_url;
    if (!pdfUrl) {
      const uploadResult = await ContractService.uploadContractPDF(pdfBuffer, contract.code);
      pdfUrl = uploadResult.secure_url;
      
      // Update contract với PDF URL
      contract.contract_file_url = pdfUrl;
      contract.contract_file_public_id = uploadResult.public_id;
      await contract.save();
    }

    // Sử dụng template từ nodemailer
    const emailContent = nodemailer.getContractSignedTemplate({
      ...contract.toObject(), // ✅ Convert Mongoose document to plain object
      pdfBuffer: pdfBuffer
    });

    // Gửi email
    await nodemailer.sendEmail({
      to: contract.user_id.email,
      subject: `Hợp đồng thuê xe điện - Mã: ${contract.code}`,
      html: emailContent,
      attachments: [{
        filename: `hop-dong-${contract.code}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    console.log(`✅ Đã gửi email hợp đồng cho ${contract.user_id.email}`);
    
  } catch (error) {
    console.error('❌ Lỗi khi gửi email hợp đồng:', error);
    // Không throw error để không ảnh hưởng đến flow chính
  }
};

// Tạo contract từ rental (Staff/Admin only)
const createContract = async (req, res) => {
  try {
    const { 
      rental_id, 
      template_id,
      special_conditions,
      notes 
    } = req.body;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể tạo contract' 
      });
    }

    // Validate required fields
    if (!rental_id) {
      return res.status(400).json({ 
        message: 'rental_id là bắt buộc' 
      });
    }

    // Tìm rental
    const rental = await Rental.findById(rental_id)
      .populate('booking_id', 'code start_date end_date user_id vehicle_id station_id')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model color')
      .populate('station_id', 'name address');

    if (!rental) {
      return res.status(404).json({ 
        message: 'Không tìm thấy rental' 
      });
    }

    // Kiểm tra rental status
    if (rental.status !== 'active') {
      return res.status(400).json({ 
        message: 'Rental chưa được kích hoạt' 
      });
    }

    // Kiểm tra contract đã tồn tại
    const existingContract = await Contract.findOne({ 
      rental_id: rental_id,
      is_active: true 
    });

    if (existingContract) {
      return res.status(400).json({ 
        message: 'Contract đã tồn tại cho rental này' 
      });
    }

    // Tìm template (mặc định nếu không có)
    let template;
    if (template_id) {
      template = await ContractTemplate.findById(template_id);
    } else {
      template = await ContractTemplate.findOne({ status: 'active' });
    }

    if (!template) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract template' 
      });
    }

    // Tạo contract code
    const contractCode = await ContractService.generateContractCode();

    // Render template với data
    const contractData = {
      customer_name: rental.user_id.fullname,
      customer_email: rental.user_id.email,
      customer_phone: rental.user_id.phone,
      vehicle_name: rental.vehicle_id.name,
      vehicle_license: rental.vehicle_id.license_plate,
      vehicle_model: rental.vehicle_id.model,
      vehicle_color: rental.vehicle_id.color,
      station_name: rental.station_id.name,
      station_address: rental.station_id.address,
      start_date: rental.booking_id.start_date,
      end_date: rental.booking_id.end_date,
      contract_code: contractCode,
      created_date: new Date(),
      special_conditions: special_conditions || '',
      notes: notes || ''
    };

    const renderedContent = await ContractService.renderContractTemplate(template.content_template, contractData);
    const renderedTerms = await ContractService.renderContractTemplate(template.terms_template, contractData);

    // Tạo contract
    const contract = await Contract.create({
      code: contractCode,
      rental_id: rental._id,
      user_id: rental.user_id._id,
      vehicle_id: rental.vehicle_id._id,
      station_id: rental.station_id._id,
      template_id: template._id,
      title: template.title,
      content: renderedContent,
      terms: renderedTerms,
      special_conditions: special_conditions || '',
      notes: notes || '',
      valid_from: rental.booking_id.start_date,
      valid_until: rental.booking_id.end_date,
      staff_signed_by: req.user._id,
      created_by: req.user._id
    });

    // Populate contract data
    const populatedContract = await Contract.findById(contract._id)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('created_by', 'fullname email');

    return res.status(201).json({
      message: 'Tạo contract thành công',
      contract: ContractService.formatContractResponse(populatedContract)
    });

  } catch (error) {
    console.error('Lỗi khi tạo contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy chi tiết contract
const getContractDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await Contract.findById(id)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model color')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('customer_signed_by', 'fullname email')
      .populate('created_by', 'fullname email');

    if (!contract) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract' 
      });
    }

    // Kiểm tra quyền xem
    if (req.user.role !== 'Admin' && 
        req.user.role !== 'Station Staff' && 
        contract.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem contract này' 
      });
    }

    return res.status(200).json({
      message: 'Lấy chi tiết contract thành công',
      contract: ContractService.formatContractResponse(contract)
    });

  } catch (error) {
    console.error('Lỗi khi lấy chi tiết contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Ký contract
const signContract = async (req, res) => {
  try {
    const { id } = req.params;
    let { signature, signature_type } = req.body;

    if (!signature || !signature_type) {
      return res.status(400).json({ 
        message: 'signature và signature_type là bắt buộc' 
      });
    }

    if (!['staff', 'customer'].includes(signature_type)) {
      return res.status(400).json({ 
        message: 'signature_type phải là staff hoặc customer' 
      });
    }

    // ✅ CLEAN BASE64 SIGNATURE
    try {
      // Loại bỏ data:image/png;base64, prefix
      if (signature.includes(',')) {
        signature = signature.split(',')[1];
      }
      
      // Loại bỏ whitespace và line breaks
      signature = signature.replace(/\s/g, '');
      
      // Validate base64 format
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(signature)) {
        return res.status(400).json({ 
          message: 'Chữ ký không đúng định dạng base64' 
        });
      }

      // Validate base64 length (không quá dài)
      if (signature.length > 1000000) { // ~750KB
        return res.status(400).json({ 
          message: 'Chữ ký quá lớn, vui lòng vẽ nhỏ hơn' 
        });
      }

    } catch (cleanError) {
      console.error('Lỗi khi clean base64:', cleanError);
      return res.status(400).json({ 
        message: 'Chữ ký không hợp lệ' 
      });
    }

    const contract = await Contract.findById(id)
      .populate('user_id', 'fullname email');

    if (!contract) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract' 
      });
    }

    // Kiểm tra quyền ký
    if (signature_type === 'staff') {
      if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
        return res.status(403).json({ 
          message: 'Chỉ nhân viên mới có thể ký staff signature' 
        });
      }
      
      contract.staff_signature = signature;
      contract.staff_signed_at = new Date();
      contract.staff_signed_by = req.user._id;
      
    } else if (signature_type === 'customer') {
    
      if (req.user.role === 'Customer' && 
          contract.user_id._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          message: 'Bạn không có quyền ký contract này' 
        });
      }
      
      contract.customer_signature = signature;
      contract.customer_signed_at = new Date();
      contract.customer_signed_by = req.user._id;
    }

    // Cập nhật status
    if (contract.staff_signature && contract.customer_signature) {
      contract.status = 'signed';
      
      // ✅ AUTO GỬI EMAIL KHI CÓ ĐỦ 2 CHỮ KÝ
      // Populate contract trước khi gửi email
      const populatedContractForEmail = await Contract.findById(contract._id)
        .populate('user_id', 'fullname email phone')
        .populate('vehicle_id', 'name license_plate model')
        .populate('station_id', 'name address');
      
      await sendContractEmail(populatedContractForEmail);
    }

    await contract.save();

    // Populate contract data
    const populatedContract = await Contract.findById(contract._id)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('customer_signed_by', 'fullname email')
      .populate('created_by', 'fullname email');

    return res.status(200).json({
      message: 'Ký contract thành công',
      contract: ContractService.formatContractResponse(populatedContract)
    });

  } catch (error) {
    console.error('Lỗi khi ký contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Generate PDF contract
const generateContractPDF = async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await Contract.findById(id)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model color')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('customer_signed_by', 'fullname email');

    if (!contract) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract' 
      });
    }

    // Kiểm tra quyền xem
    if (req.user.role !== 'Admin' && 
        req.user.role !== 'Station Staff' && 
        contract.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem contract này' 
      });
    }

    try {
      // Generate PDF
      const pdfBuffer = await ContractService.generateContractPDF(contract);
      
      // Upload PDF to Cloudinary
      const uploadResult = await ContractService.uploadContractPDF(pdfBuffer, contract.code);
      
      // Update contract with PDF URL
      contract.contract_file_url = uploadResult.secure_url;
      contract.contract_file_public_id = uploadResult.public_id;
      await contract.save();
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="contract-${contract.code}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      return res.send(pdfBuffer);
      
    } catch (pdfError) {
      console.error('Lỗi khi generate/upload PDF:', pdfError);
      
      // Fallback: return contract data without PDF
      return res.status(200).json({
        message: 'Contract found, nhưng không thể tạo PDF',
        contract: ContractService.formatContractResponse(contract),
        error: 'PDF generation failed'
      });
    }

  } catch (error) {
    console.error('Lỗi khi generate PDF:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Lấy danh sách contracts
const getContracts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      station_id,
      search,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;

    // Xây dựng query
    const query = { is_active: true };
    if (status) query.status = status;
    if (station_id) query.station_id = station_id;

    // Search with sanitization
    if (search) {
      const sanitizedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { code: { $regex: sanitizedSearch, $options: 'i' } },
        { title: { $regex: sanitizedSearch, $options: 'i' } }
      ];
    }

    // Staff chỉ xem contracts của station mình
    if (req.user.role === 'Station Staff' && req.user.stationId) {
      query.station_id = req.user.stationId;
    }

    // Customer chỉ xem contracts của mình
    if (req.user.role === 'Customer') {
      query.user_id = req.user._id;
    }

    // Tính pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;

    // Lấy contracts
    const contracts = await Contract.find(query)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('customer_signed_by', 'fullname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Đếm tổng
    const total = await Contract.countDocuments(query);

    // Format contracts
    const formattedContracts = contracts.map(contract => 
      ContractService.formatContractResponse(contract)
    );

    return res.status(200).json({
      message: 'Lấy danh sách contracts thành công',
      contracts: formattedContracts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Lỗi khi lấy danh sách contracts:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Hủy contract
const cancelContract = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Kiểm tra quyền hạn
    if (req.user.role !== 'Station Staff' && req.user.role !== 'Admin') {
      return res.status(403).json({ 
        message: 'Chỉ nhân viên mới có thể hủy contract' 
      });
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract' 
      });
    }

    if (contract.status === 'cancelled') {
      return res.status(400).json({ 
        message: 'Contract đã được hủy' 
      });
    }

    contract.status = 'cancelled';
    contract.notes = contract.notes + `\nHủy contract: ${reason || 'Không có lý do'}`;
    await contract.save();

    return res.status(200).json({
      message: 'Hủy contract thành công',
      contract: ContractService.formatContractResponse(contract)
    });

  } catch (error) {
    console.error('Lỗi khi hủy contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// Xem contract online (HTML)
const getContractView = async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await Contract.findById(id)
      .populate('rental_id', 'code status')
      .populate('user_id', 'fullname email phone')
      .populate('vehicle_id', 'name license_plate model color')
      .populate('station_id', 'name address')
      .populate('template_id', 'name title')
      .populate('staff_signed_by', 'fullname email')
      .populate('customer_signed_by', 'fullname email')
      .populate('created_by', 'fullname email');

    if (!contract) {
      return res.status(404).json({ 
        message: 'Không tìm thấy contract' 
      });
    }

    // Kiểm tra quyền xem
    if (req.user.role !== 'Admin' && 
        req.user.role !== 'Station Staff' && 
        contract.user_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Bạn không có quyền xem contract này' 
      });
    }

    // Tạo HTML content cho contract
    const htmlContent = ContractService.createContractHTML(contract);

    // Set response headers cho HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    return res.send(htmlContent);

  } catch (error) {
    console.error('Lỗi khi xem contract:', error);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  createContract,
  getContractDetails,
  signContract,
  generateContractPDF,
  getContractView,
  getContracts,
  cancelContract
};
