const nodemailer = require('nodemailer');

// Tạo transporter cho nodemailer
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Hàm gửi email
const sendEmail = async (options) => {
    const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

// CSS chung cho tất cả email templates - Theme xanh lá xe điện
const getCommonStyles = () => {
    return `
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #2d3748;
                background: linear-gradient(135deg, #48bb78 0%, #38a169 50%, #2f855a 100%);
                padding: 20px 0;
            }
            .email-wrapper {
                max-width: 650px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(15px);
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 25px 50px rgba(56, 161, 105, 0.25);
                border: 1px solid rgba(72, 187, 120, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #48bb78 0%, #38a169 50%, #2f855a 100%);
                color: white;
                padding: 40px 20px;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="rgba(255,255,255,0.15)"></path></svg>') no-repeat center bottom;
                background-size: cover;
                opacity: 0.4;
            }
            .logo-container {
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 15px;
                position: relative;
                z-index: 2;
                width: fit-content;
            }
            .logo-icon {
                width: 72px;
                height: 72px;
                background: transparent;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                animation: none;
                border: none;
            }
            .logo-icon svg {
                width: 72px;
                height: 72px;
                fill: white;
            }
            .logo-icon img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                display: block;
                transform: scale(1.2);
            }
            @keyframes rotate {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .logo {
                font-size: 32px;
                font-weight: 800;
                position: relative;
                z-index: 2;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .logo::after {
                content: '';
                position: absolute;
                bottom: -5px;
                left: 0;
                width: 100%;
                height: 3px;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
                border-radius: 2px;
            }
            .subtitle {
                font-size: 16px;
                opacity: 0.95;
                position: relative;
                z-index: 2;
                font-weight: 500;
                letter-spacing: 0.5px;
            }
            .content {
                padding: 40px 30px;
                background: white;
            }
            .greeting {
                font-size: 24px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
            }
            .greeting::before {
                content: '🌿';
                margin-right: 10px;
                font-size: 26px;
                animation: bounce 2s infinite;
            }
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-5px); }
            }
            .message {
                font-size: 16px;
                color: #4a5568;
                margin-bottom: 25px;
                line-height: 1.7;
            }
            .cta-container {
                text-align: center;
                margin: 35px 0;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #48bb78 0%, #38a169 50%, #2f855a 100%);
                color: white;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 50px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 15px 35px rgba(72, 187, 120, 0.4);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                border: 2px solid rgba(255, 255, 255, 0.1);
            }
            .cta-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                transition: left 0.5s;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 40px rgba(72, 187, 120, 0.5);
            }
            .cta-button:hover::before {
                left: 100%;
            }
            .features {
                background: linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%);
                padding: 30px;
                border-radius: 15px;
                margin: 25px 0;
                border: 2px solid rgba(72, 187, 120, 0.1);
                position: relative;
                overflow: hidden;
            }
            .features::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #48bb78, #38a169, #2f855a);
            }
            .features h3 {
                color: #2d3748;
                font-size: 20px;
                margin-bottom: 20px;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .features h3::before {
                content: '⚡';
                margin-right: 10px;
                font-size: 22px;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
            .features ul {
                list-style: none;
                padding: 0;
            }
            .features li {
                padding: 15px 0;
                border-bottom: 1px solid rgba(72, 187, 120, 0.1);
                position: relative;
                padding-left: 40px;
                color: #4a5568;
                font-size: 15px;
                transition: all 0.3s ease;
            }
            .features li:last-child {
                border-bottom: none;
            }
            .features li::before {
                content: '🔋';
                position: absolute;
                left: 0;
                font-size: 18px;
                animation: glow 3s ease-in-out infinite alternate;
            }
            @keyframes glow {
                from { filter: brightness(1); }
                to { filter: brightness(1.3); }
            }
            .warning-box {
                background: linear-gradient(135deg, #fefcbf 0%, #f6e05e 100%);
                padding: 25px;
                border-radius: 15px;
                border-left: 5px solid #d69e2e;
                margin: 25px 0;
                font-size: 14px;
                color: #744210;
                position: relative;
                box-shadow: 0 5px 15px rgba(214, 158, 46, 0.1);
            }
            .warning-box::before {
                content: '⚠️';
                position: absolute;
                top: -10px;
                left: 20px;
                background: #f6e05e;
                padding: 5px 10px;
                border-radius: 20px;
                font-size: 16px;
                box-shadow: 0 2px 8px rgba(214, 158, 46, 0.3);
            }
            .eco-badge {
                display: inline-flex;
                align-items: center;
                background: linear-gradient(135deg, #48bb78, #38a169);
                color: white;
                padding: 8px 16px;
                border-radius: 25px;
                font-size: 13px;
                font-weight: 600;
                margin: 10px 5px;
                box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3);
            }
            .eco-badge::before {
                content: '🌱';
                margin-right: 6px;
            }
            .footer {
                background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
                padding: 35px 20px;
                text-align: center;
                border-top: 3px solid #48bb78;
                position: relative;
            }
            .footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #48bb78, #38a169, #2f855a);
            }
            .footer p {
                color: #718096;
                font-size: 13px;
                margin: 8px 0;
            }
            .social-links {
                margin: 25px 0;
                display: flex;
                justify-content: center;
                flex-wrap: wrap;
            }
            .social-links a {
                display: inline-flex;
                align-items: center;
                margin: 5px 8px;
                color: #48bb78;
                text-decoration: none;
                font-size: 14px;
                padding: 10px 16px;
                border-radius: 25px;
                background: rgba(72, 187, 120, 0.1);
                transition: all 0.3s ease;
                border: 1px solid rgba(72, 187, 120, 0.2);
            }
            .social-links a:hover {
                background: rgba(72, 187, 120, 0.2);
                transform: translateY(-2px);
            }
            .divider {
                height: 3px;
                background: linear-gradient(90deg, transparent, #48bb78, #38a169, #48bb78, transparent);
                margin: 30px 0;
                border-radius: 2px;
                position: relative;
                overflow: hidden;
            }
            .divider::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
                animation: shine 3s infinite;
            }
            @keyframes shine {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            /* Mobile responsive */
            @media only screen and (max-width: 600px) {
                .email-wrapper {
                    margin: 10px;
                    border-radius: 15px;
                }
                .header {
                    padding: 30px 15px;
                }
                .content {
                    padding: 25px 20px;
                }
                .logo {
                    font-size: 28px;
                }
                .logo-icon {
                    width: 40px;
                    height: 40px;
                    margin-right: 10px;
                }
                .cta-button {
                    padding: 14px 28px;
                    font-size: 15px;
                }
                .features {
                    padding: 20px;
                }
                .social-links {
                    flex-direction: column;
                    align-items: center;
                }
                .social-links a {
                    margin: 3px 0;
                    width: 200px;
                    justify-content: center;
                }
            }
        </style>
    `;
};

// Template email reset password - Green EV Theme
const getResetPasswordEmailTemplate = (resetUrl, userName) => {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đặt Lại Mật Khẩu - EV Rental</title>
        ${getCommonStyles()}
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">
                        <img src="https://res.cloudinary.com/dcrbmfhbo/image/upload/v1758043354/Gemini_Generated_Image_c89jtfc89jtfc89j_z5gt9t.png" alt="EV Rental Logo" style="width: 64px; height: 64px; object-fit: contain;" />
                    </div>
                    <div class="logo">EV Rental</div>
                </div>
                <div class="subtitle">Dịch vụ thuê xe điện xanh - sạch - tiết kiệm</div>
                <div class="eco-badge">100% Năng lượng tái tạo</div>
                <div class="eco-badge">Zero Emission</div>
            </div>
            
            <div class="content">
                <div class="greeting">Xin chào ${userName}!</div>
                
                <div class="message">
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản EV Rental của bạn. 
                    Để đảm bảo an toàn cho tài khoản và tiếp tục hành trình xanh, vui lòng nhấp 
                    vào nút bên dưới để tạo mật khẩu mới.
                </div>

                <div class="cta-container">
                    <a href="${resetUrl}" class="cta-button">
                        🔐 Đặt Lại Mật Khẩu Ngay
                    </a>
                </div>

                <div class="divider"></div>

                <div class="warning-box">
                    <strong>Thông tin bảo mật quan trọng:</strong><br><br>
                    • Liên kết này chỉ có hiệu lực trong <strong>60 phút</strong><br>
                    • Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này<br>
                    • Để bảo vệ tài khoản xanh của bạn, không chia sẻ liên kết này với ai<br>
                    • Sử dụng mật khẩu mạnh để bảo vệ môi trường số của bạn
                </div>

                <div class="message">
                    <strong>🌐 Link dự phòng:</strong><br>
                    Nếu nút phía trên không hoạt động, bạn có thể copy và paste đường link sau:<br>
                    <a href="${resetUrl}" style="color: #48bb78; word-break: break-all; font-weight: 500;">${resetUrl}</a>
                </div>

                <div class="message" style="margin-top: 30px; background: linear-gradient(135deg, #f0fff4, #e6fffa); padding: 20px; border-radius: 12px; border-left: 4px solid #48bb78;">
                    <strong>🚗💚 Cần hỗ trợ?</strong><br>
                    Đội ngũ EV Support luôn sẵn sàng hỗ trợ bạn 24/7! Liên hệ qua:<br>
                    📱 Hotline: 1900-EVGREEN (1900-384733)<br>
                    📧 Email: evstationrental@gmail.com<br>
                    💬 Live Chat trong app
                </div>
            </div>

            <div class="footer">
                <div class="social-links">
                    <a href="#">🌱 Eco Community</a>
                    <a href="#">📱 EV Mobile App</a>
                    <a href="#">🔋 Charging Stations</a>
                    <a href="#">💚 Green Support</a>
                </div>
                <p><strong>© ${new Date().getFullYear()} EV Rental</strong> - Driving Towards A Greener Future 🌍</p>
                <p>🏢 Địa chỉ: 123 Đường Xanh, Eco Park, Quận 7, TP.HCM</p>
                <p>🌿 Cam kết: 100% năng lượng tái tạo | Zero carbon footprint</p>
                <p style="font-size: 11px; margin-top: 15px;">
                    Bạn nhận được email này vì đã yêu cầu đặt lại mật khẩu cho tài khoản EV Rental
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Template email chào mừng - Green EV Theme
const getWelcomeEmailTemplate = (userName) => {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Chào Mừng Đến EV Rental - Hành Trình Xanh Bắt Đầu!</title>
        ${getCommonStyles()}
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">
                        <img src="https://res.cloudinary.com/dcrbmfhbo/image/upload/v1758043354/Gemini_Generated_Image_c89jtfc89jtfc89j_z5gt9t.png" alt="EV Rental Logo" style="width: 64px; height: 64px; object-fit: contain;" />
                    </div>
                    <div class="logo">EV Rental</div>
                </div>
                <div class="subtitle">Chào mừng bạn đến với cuộc cách mạng xanh!</div>
                <div class="eco-badge">Eco-Friendly Journey</div>
                <div class="eco-badge">Clean Energy Pioneer</div>
            </div>
            
            <div class="content">
                <div class="greeting">Chào mừng ${userName}!</div>
                
                <div class="message">
                    🎉 <strong>Chúc mừng bạn đã gia nhập cộng đồng EV Rental!</strong><br><br>
                    Cảm ơn bạn đã chọn chúng tôi làm người bạn đồng hành trên hành trình khám phá 
                    thế giới với phương tiện di chuyển thân thiện với môi trường. Cùng nhau, chúng ta 
                    sẽ tạo nên một tương lai xanh - sạch - bền vững! 🌍💚
                </div>

                <div class="features">
                    <h3>Trải nghiệm xe điện tuyệt vời dành cho bạn</h3>
                    <ul>
                        <li><strong>Smart Booking:</strong> Đặt xe điện thông minh chỉ trong vài touch với AI assistant</li>
                        <li><strong>Green Navigation:</strong> Tìm đường tối ưu và trạm sạc gần nhất với EV GPS</li>
                        <li><strong>Eco Dashboard:</strong> Theo dõi carbon footprint và điểm xanh tích lũy</li>
                        <li><strong>Premium EVs:</strong> Đa dạng dòng xe điện cao cấp từ Tesla, VinFast đến BYD</li>
                        <li><strong>Green Rewards:</strong> Nhận ưu đãi độc quyền và eco-points mỗi chuyến đi</li>
                        <li><strong>24/7 EcoSupport:</strong> Hỗ trợ chuyên nghiệp mọi lúc với đội ngũ Green Expert</li>
                        <li><strong>Zero Emission:</strong> 100% năng lượng tái tạo, góp phần bảo vệ hành tinh xanh</li>
                        <li><strong>Silent Drive:</strong> Trải nghiệm lái xe êm ái, không tiếng ồn, không khí thải</li>
                    </ul>
                </div>

                <div class="cta-container">
                    <a href="#" class="cta-button">
                        🚗⚡ Bắt Đầu Hành Trình Xanh
                    </a>
                </div>

                <div class="divider"></div>

                <div style="background: linear-gradient(135deg, #f0fff4, #e6fffa); padding: 25px; border-radius: 15px; margin: 25px 0; border: 2px solid #48bb78;">
                    <h3 style="color: #2d3748; margin-bottom: 20px; text-align: center; display: flex; align-items: center; justify-content: center;">
                        🌱 <span style="margin: 0 10px;">Bí quyết để trở thành Green Driver</span> 🌱
                    </h3>
                    <div style="color: #4a5568; line-height: 1.8;">
                        <p><strong>🔋 Bước 1:</strong> Hoàn thiện Green Profile để unlock premium EVs</p>
                        <p><strong>📱 Bước 2:</strong> Tải EV Rental App để quản lý thuê xe mọi lúc mọi nơi</p>
                        <p><strong>🌐 Bước 3:</strong> Follow Green Community để cập nhật xu hướng xe điện mới nhất</p>
                        <p><strong>💚 Bước 4:</strong> Tham gia EV Club để chia sẻ kinh nghiệm lái xe xanh với cộng đồng</p>
                        <p><strong>🏆 Bước 5:</strong> Tích lũy Eco-Points để đổi rewards và nâng cấp membership</p>
                    </div>
                </div>

                <div class="message" style="margin-top: 30px;">
                    <strong>💬 Cần hỗ trợ bắt đầu hành trình?</strong><br>
                    Green Support Team luôn sẵn sàng hỗ trợ bạn 24/7! Chúng tôi cam kết phản hồi trong vòng 5 phút với:<br><br>
                    
                    🌐 <strong>Multi-channel Support:</strong><br>
                    📱 EV Hotline: 1900-EVGREEN (1900-384733)<br>
                    📧 Email: evstationrental@gmail.com<br>
                    💬 Live Chat trong EV App<br>
                    🤖 AI Assistant: EVie - trợ lý thông minh 24/7<br>
                </div>

                <div class="message" style="text-align: center; margin-top: 40px; font-size: 18px; color: #2d3748;">
                    <strong>🌍 Cùng nhau tạo nên một hành tinh xanh! 🌍</strong><br>
                    <span style="color: #48bb78; font-weight: 600;">Every Mile Matters. Every Choice Counts. 🏍️💚⚡</span>
                </div>
            </div>

            <div class="footer">
                <div class="social-links">
                    <a href="#">🌱 EV Community</a>
                    <a href="#">📱 Download App</a>
                    <a href="#">🔋 Charging Map</a>
                    <a href="#">💚 Green News</a>
                    <a href="#">🏆 Eco Rewards</a>
                </div>
                <p><strong>© ${new Date().getFullYear()} EV Rental</strong> - Your Green Journey Partner 🌍💚</p>
                <p>🏢 Green Headquarters: 123 Đường Xanh, Eco Park, Quận 7, TP.HCM</p>
                <p>📞 EV Hotline: 1900-EVGREEN | 📧 evstationrental@gmail.com</p>
                <p>🌿 <strong>Eco Commitment:</strong> 100% renewable energy | Carbon negative footprint</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 11px; color: #a0aec0;">
                        Bạn nhận được email này vì đã đăng ký tài khoản EV Rental<br>
                        🌱 Mỗi email này được gửi bằng năng lượng tái tạo 100%
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Template email xác nhận đặt xe - Green EV Theme
const getBookingConfirmationTemplate = (userName, bookingDetails) => {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Xác Nhận Đặt Xe Điện - EV Rental</title>
        ${getCommonStyles()}
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">
                        <img src="https://res.cloudinary.com/dcrbmfhbo/image/upload/v1758043354/Gemini_Generated_Image_c89jtfc89jtfc89j_z5gt9t.png" alt="EV Rental Logo" style="width: 64px; height: 64px; object-fit: contain;" />
                    </div>
                    <div class="logo">EV Rental</div>
                </div>
                <div class="subtitle">Xác nhận đặt xe điện thành công</div>
                <div class="eco-badge">Green Journey Confirmed</div>
                <div class="eco-badge">Zero Emission Trip</div>
            </div>
            
            <div class="content">
                <div class="greeting">Cảm ơn ${userName}!</div>
                
                <div class="message">
                    🎊 <strong>Chúc mừng! Đặt xe điện của bạn đã được xác nhận thành công!</strong><br><br>
                    Chiếc xe điện cao cấp đã được chuẩn bị sẵn sàng với 100% pin đầy, nội thất 
                    sạch sẽ và hệ thống an toàn được kiểm tra kỹ lưỡng. Hành trình xanh của bạn 
                    sắp bắt đầu! 🌱⚡
                </div>

                <div class="features">
                    <h3>Chi tiết đặt xe điện của bạn</h3>
                    <ul style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #48bb78;">
                        <li><strong>🎫 Booking ID:</strong> <span style="color: #48bb78; font-weight: bold;">${bookingDetails.bookingId}</span></li>
                        <li><strong>🎫 Booking Code:</strong> <span style="color: #48bb78; font-weight: bold;">${bookingDetails.bookingCode}</span></li>
                        <li><strong>🚗 Xe điện:</strong> ${bookingDetails.carModel} <span style="background: #48bb78; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">PREMIUM EV</span></li>
                        <li><strong>🔋 Mức pin:</strong> 100% (Range: ~400km)</li>
                        <li><strong>⏰ Thời gian nhận:</strong> ${bookingDetails.pickupTime}</li>
                        <li><strong>📍 Điểm nhận xe:</strong> ${bookingDetails.pickupLocation}<br>
                            <span style="color: #666; font-size: 14px;">🏢 Địa chỉ: 123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM</span><br>
                            <span style="color: #666; font-size: 14px;">📞 Hotline: 028 1234 5678 | ⏰ Giờ mở cửa: 6:00 - 22:00</span></li>
                        <li><strong>⏰ Thời gian trả:</strong> ${bookingDetails.returnTime}</li>
                        <li><strong>💰 Tổng chi phí:</strong> <span style="color: #48bb78; font-weight: bold; font-size: 16px;">${bookingDetails.totalCost}</span></li>
                        <li><strong>🌱 Carbon saved:</strong> <span style="color: #48bb78; font-weight: bold;">~12.5kg CO₂</span></li>
                        <li><strong>💚 Eco-Points earned:</strong> <span style="color: #48bb78; font-weight: bold;">+250 points</span></li>
                        <li><strong>📱 QR Code:</strong><br>
                            ${bookingDetails.qrCodeImage ? `<img src="${bookingDetails.qrCodeImage}" alt="QR Code" style="width: 150px; height: 150px; margin: 10px 0; border: 2px solid #48bb78; border-radius: 8px; display: block;" /><br>` : ''}
                            <span style="color: #666; font-size: 14px;">🔍 Quét QR này tại trạm để nhận xe | ⏰ Hết hạn: ${bookingDetails.qrExpiresAt}</span></li>
                    </ul>
                </div>

                <div class="cta-container">
                    <a href="#" class="cta-button" style="margin: 5px;">
                        📱 Mở EV App
                    </a>
                    <a href="#" class="cta-button" style="margin: 5px; background: linear-gradient(135deg, #2f855a, #276749);">
                        🗺️ Charging Map
                    </a>
                </div>

                <div class="warning-box">
                    <strong>Checklist chuẩn bị cho chuyến đi xanh:</strong><br><br>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px;">
                        <div style="flex: 1; min-width: 200px;">
                            📄 <strong>Giấy tờ cần thiết:</strong><br>
                            • CMND/CCCD gốc hợp lệ<br>
                            • Bằng lái xe hạng A hoặc A1 <br>
                            • Booking confirmation (email này)
                        </div>
                        <div style="flex: 1; min-width: 200px;">
                            ⏰ <strong>Thời gian & địa điểm:</strong><br>
                            • Có mặt sớm 15 phút<br>
                            • Tải EV Rental App trước<br>
                            • Kiểm tra điện thoại đủ pin
                        </div>
                    </div>
                </div>

                <div style="background: linear-gradient(135deg, #f0fff4, #e6fffa); padding: 25px; border-radius: 15px; margin: 25px 0; border-left: 5px solid #48bb78;">
                    <h3 style="color: #2d3748; margin-bottom: 15px; display: flex; align-items: center;">
                        ⚡ <span style="margin-left: 10px;">Hướng dẫn lái xe máy điện cho người mới</span>
                    </h3>
                    <div style="color: #4a5568; line-height: 1.7;">
                        <p><strong>🏍️ Khởi động:</strong> Bật khóa điện, đợi đèn báo sáng, nhấn nút khởi động</p>
                        <p><strong>🔄 Chế độ lái:</strong> ECO (tiết kiệm) → COMFORT (cân bằng) → SPORT (mạnh mẽ)</p>
                        <p><strong>🔋 Sạc điện:</strong> Sử dụng EV Charging Map để tìm trạm sạc gần nhất</p>
                        <p><strong>🎯 Phanh tái sinh:</strong> Tận dụng phanh tái sinh để tăng quãng đường</p>
                        <p><strong>📱 Kết nối:</strong> Sync điện thoại qua Bluetooth để navigation và music</p>
                        <p><strong>🛡️ An toàn:</strong> Luôn đội mũ bảo hiểm (có sẵn 2 mũ), kiểm tra phanh trước khi đi</p>
                        <p><strong>⚡ Tăng tốc:</strong> Xe máy điện tăng tốc mượt mà, không cần số</p>
                        <p><strong>🔊 Âm thanh:</strong> Xe chạy rất êm, không có tiếng động cơ</p>
                    </div>
                </div>

              

                <div class="message" style="margin-top: 30px; padding: 20px; background: rgba(72, 187, 120, 0.05); border-radius: 12px; border: 1px solid rgba(72, 187, 120, 0.2);">
                    <strong>🚨 Emergency & Support</strong><br><br>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                        <div>
                            <strong>🔧 Technical Support:</strong><br>
                            📞 1900-EVTECH (1900-388324)<br>
                            💬 Live chat trong EV App
                            📧 Email: evstationrental@gmail.com
                        </div>
                        <div>
                            <strong>🚑 Emergency 24/7:</strong><br>
                            📞 1900-EVSOS (1900-387767)<br>
                            📍 GPS tracking hỗ trợ tức thì
                        </div>
                        <div>
                            <strong>⚡ Charging Issues:</strong><br>
                            📞 1900-EVCHARGE (1900-382427)<br>
                            🗺️ Alternative charging suggestions
                        </div>
                    </div>
                </div>

                <div class="message" style="text-align: center; margin-top: 40px; font-size: 18px; color: #2d3748;">
                    <strong>🌟 Chúc bạn có chuyến đi xanh tuyệt vời! 🌟</strong><br>
                    <span style="color: #48bb78; font-weight: 600;">Ride Electric. Ride Future. Ride Green! 🏍️💚⚡</span>
                </div>
            </div>

            <div class="footer">
                <div class="social-links">
                    <a href="#">🔄 Modify Booking</a>
                    <a href="#">📱 EV App</a>
                    <a href="#">🗺️ Charging Map</a>
                    <a href="#">💬 Live Support</a>
                    <a href="#">📸 Share Journey</a>
                </div>
                <p><strong>© ${new Date().getFullYear()} EV Rental</strong> - Your Trusted Green Journey Partner 🌍</p>
                <p>🏢 Green HQ: 123 Đường Xanh, Eco Park, Q7, HCMC | 📞 1900-EVGREEN</p>
                <p>🌱 <strong>Impact Report:</strong> Cùng khách hàng đã tiết kiệm 1,250 tấn CO₂ trong năm 2024!</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 11px; color: #a0aec0;">
                        Emergency hotline 24/7: 1900-EVSOS | Tracking ID: ${bookingDetails.bookingId}<br>
                        🔋 Powered by 100% renewable energy | Carbon negative operation
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Template email tạo tài khoản Staff - Green EV Theme
const getStaffAccountEmailTemplate = (staffName, email, password) => {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tài Khoản Staff - EV Rental</title>
        ${getCommonStyles()}
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">
                        <img src="https://res.cloudinary.com/dcrbmfhbo/image/upload/v1758043354/Gemini_Generated_Image_c89jtfc89jtfc89j_z5gt9t.png" alt="EV Rental Logo" style="width: 64px; height: 64px; object-fit: contain;" />
                    </div>
                    <div class="logo">EV Rental</div>
                </div>
                <div class="subtitle">Chào mừng nhân viên mới!</div>
                <div class="eco-badge">Staff Portal</div>
                <div class="eco-badge">Green Team</div>
            </div>
            
            <div class="content">
                <div class="greeting">Xin chào ${staffName}!</div>
                
                <div class="message">
                    🎉 <strong>Chúc mừng bạn đã gia nhập đội ngũ EV Rental!</strong><br><br>
                    Tài khoản nhân viên của bạn đã được tạo thành công. Bạn có thể sử dụng thông tin 
                    đăng nhập bên dưới để truy cập hệ thống quản lý và bắt đầu công việc tại trạm.
                </div>

                <div class="features">
                    <h3>Thông tin đăng nhập</h3>
                    <ul style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #48bb78;">
                        <li><strong>📧 Email:</strong> <span style="color: #48bb78; font-weight: bold;">${email}</span></li>
                        <li><strong>🔐 Mật khẩu tạm thời:</strong> <span style="color: #48bb78; font-weight: bold; font-size: 18px; background: #f0fff4; padding: 5px 10px; border-radius: 5px;">${password}</span></li>
                        <li><strong>👤 Vai trò:</strong> Station Staff</li>
                        <li><strong>📱 Hệ thống:</strong> EV Rental Management Portal</li>
                    </ul>
                </div>

                <div class="cta-container">
                    <a href="#" class="cta-button">
                        🚀 Truy Cập Hệ Thống
                    </a>
                </div>

                <div class="warning-box">
                    <strong>⚠️ Lưu ý bảo mật quan trọng:</strong><br><br>
                    • <strong>Đổi mật khẩu ngay</strong> sau lần đăng nhập đầu tiên<br>
                    • <strong>Không chia sẻ</strong> thông tin đăng nhập với ai khác<br>
                    • <strong>Đăng xuất</strong> sau mỗi phiên làm việc<br>
                    • <strong>Báo cáo ngay</strong> nếu phát hiện hoạt động bất thường
                </div>

                <div style="background: linear-gradient(135deg, #f0fff4, #e6fffa); padding: 25px; border-radius: 15px; margin: 25px 0; border: 2px solid #48bb78;">
                    <h3 style="color: #2d3748; margin-bottom: 20px; text-align: center; display: flex; align-items: center; justify-content: center;">
                        🌱 <span style="margin: 0 10px;">Hướng dẫn sử dụng hệ thống</span> 🌱
                    </h3>
                    <div style="color: #4a5568; line-height: 1.8;">
                        <p><strong>🔋 Quản lý xe điện:</strong> Kiểm tra trạng thái, sạc pin, bảo trì</p>
                        <p><strong>📋 Xử lý đặt xe:</strong> Xác nhận booking, giao xe, nhận xe</p>
                        <p><strong>👥 Hỗ trợ khách hàng:</strong> Tư vấn, giải đáp thắc mắc</p>
                        <p><strong>📊 Báo cáo hàng ngày:</strong> Thống kê doanh thu, sử dụng xe</p>
                        <p><strong>🔧 Bảo trì định kỳ:</strong> Kiểm tra an toàn, vệ sinh xe</p>
                    </div>
                </div>

                <div class="message" style="margin-top: 30px; background: linear-gradient(135deg, #f0fff4, #e6fffa); padding: 20px; border-radius: 12px; border-left: 4px solid #48bb78;">
                    <strong>🚗💚 Cần hỗ trợ?</strong><br>
                    Đội ngũ IT Support luôn sẵn sàng hỗ trợ bạn! Liên hệ qua:<br>
                    📱 Hotline: 1900-EVSUPPORT (1900-387788)<br>
                    📧 Email: itsupport@evrental.com<br>
                    💬 Internal Chat trong hệ thống
                </div>

                <div class="message" style="text-align: center; margin-top: 40px; font-size: 18px; color: #2d3748;">
                    <strong>🌟 Chào mừng bạn đến với gia đình EV Rental! 🌟</strong><br>
                    <span style="color: #48bb78; font-weight: 600;">Cùng nhau tạo nên tương lai xanh! 🏍️💚⚡</span>
                </div>
            </div>

            <div class="footer">
                <div class="social-links">
                    <a href="#">🌱 Staff Portal</a>
                    <a href="#">📱 Mobile App</a>
                    <a href="#">🔋 Charging Guide</a>
                    <a href="#">💚 Green Team</a>
                </div>
                <p><strong>© ${new Date().getFullYear()} EV Rental</strong> - Internal Staff Communication 🌍</p>
                <p>🏢 Địa chỉ: 123 Đường Xanh, Eco Park, Quận 7, TP.HCM</p>
                <p>🌿 Cam kết: 100% năng lượng tái tạo | Zero carbon footprint</p>
                <p style="font-size: 11px; margin-top: 15px;">
                    Email này được gửi tự động khi tạo tài khoản nhân viên mới
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};

// Template email hủy booking - Green EV Theme
const getBookingCancellationTemplate = (userName, booking) => {
    return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hủy Đặt Xe - EV Rental</title>
        ${getCommonStyles()}
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo-container">
                    <div class="logo-icon">
                        <img src="https://res.cloudinary.com/dcrbmfhbo/image/upload/v1758043354/Gemini_Generated_Image_c89jtfc89jtfc89j_z5gt9t.png" alt="EV Rental Logo" style="width: 64px; height: 64px; object-fit: contain;" />
                    </div>
                    <div class="logo">EV Rental</div>
                </div>
                <div class="subtitle">Thông báo hủy đặt xe</div>
                <div class="eco-badge">Booking Cancelled</div>
            </div>
            
            <div class="content">
                <div class="greeting">Xin chào ${userName}!</div>
                
                <div class="message">
                    Chúng tôi xác nhận đã hủy đặt xe của bạn thành công. 
                    Cảm ơn bạn đã thông báo sớm để chúng tôi có thể phục vụ khách hàng khác.
                </div>
                
                <div class="features">
                    <h3>Chi tiết booking đã hủy</h3>
                    <ul style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #48bb78;">
                        <li><strong>🎫 Booking ID:</strong> <span style="color: #48bb78; font-weight: bold;">${booking.code}</span></li>
                        <li><strong>🚗 Xe điện:</strong> ${booking.vehicle_id?.name || 'N/A'}</li>
                        <li><strong>📍 Trạm:</strong> ${booking.station_id?.name || 'N/A'}</li>
                        <li><strong>📅 Ngày hủy:</strong> ${new Date().toLocaleDateString('vi-VN')}</li>
                        <li><strong>📝 Lý do:</strong> ${booking.cancellation_reason || 'Không có lý do'}</li>
                    </ul>
                </div>
                
                <div class="warning-box">
                    <strong>💡 Thông tin quan trọng:</strong><br><br>
                    • Booking đã được hủy thành công<br>
                    • Xe đã được trả về trạng thái available<br>
                    • Không có phí hủy cho booking này<br>
                    • Bạn có thể đặt xe mới bất cứ lúc nào
                </div>
                
                <div class="cta-container">
                    <a href="#" class="cta-button">
                        🚗⚡ Đặt Xe Mới Ngay
                    </a>
                </div>
                
                <div class="message" style="text-align: center; margin-top: 40px; font-size: 18px; color: #2d3748;">
                    <strong>💚 Cảm ơn bạn đã sử dụng dịch vụ EV Rental!</strong><br>
                    <span style="color: #48bb78; font-weight: 600;">Hẹn gặp lại bạn trong những chuyến đi xanh tiếp theo! 🌱</span>
                </div>
            </div>
            
            <div class="footer">
                <div class="social-links">
                    <a href="#">🌱 EV Community</a>
                    <a href="#">📱 Mobile App</a>
                    <a href="#">🔋 Charging Map</a>
                    <a href="#">💚 Green Support</a>
                </div>
                <p><strong>© ${new Date().getFullYear()} EV Rental</strong> - Your Green Journey Partner 🌍</p>
                <p>🏢 Green HQ: 123 Đường Xanh, Eco Park, Q7, HCMC | 📞 1900-EVGREEN</p>
                <p>🌿 <strong>Eco Commitment:</strong> 100% renewable energy | Carbon negative footprint</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;">
                    <p style="font-size: 11px; color: #a0aec0;">
                        Email này được gửi tự động khi booking bị hủy<br>
                        🌱 Mỗi email này được gửi bằng năng lượng tái tạo 100%
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

module.exports = {
    sendEmail,
    getResetPasswordEmailTemplate,
    getWelcomeEmailTemplate,
    getBookingConfirmationTemplate,
    getStaffAccountEmailTemplate,
    getBookingCancellationTemplate
};
