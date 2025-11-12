const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Nodemailer transporter (fallback)
const nodemailerTransporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Unified sendEmail function
 * Try Resend first (primary), fallback to Nodemailer if fails
 */
const sendEmail = async (options) => {
    const { to, subject, html, attachments = [] } = options;

    // Strategy 1: Try Resend first (primary)
    if (process.env.RESEND_API_KEY) {
        try {
            console.log('📧 Attempting to send email via Resend...');
            
            // Convert Nodemailer attachment format to Resend format
            const resendAttachments = attachments.map(att => {
                if (att.content) {
                    return {
                        filename: att.filename,
                        content: att.content
                    };
                } else if (att.path) {
                    return {
                        filename: att.filename,
                        path: att.path
                    };
                }
                return att;
            });

            const { data, error } = await resend.emails.send({
                from: `${process.env.EMAIL_FROM_NAME || 'EV Rental'} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
                to,
                subject,
                html,
                attachments: resendAttachments.length > 0 ? resendAttachments : undefined
            });

            if (error) {
                throw new Error(`Resend error: ${JSON.stringify(error)}`);
            }

            console.log('✅ Email sent successfully via Resend:', data.id);
            return { 
                messageId: data.id, 
                provider: 'resend',
                success: true 
            };

        } catch (resendError) {
            console.warn('⚠️ Resend failed, trying Nodemailer fallback...', resendError.message);
            // Continue to fallback
        }
    } else {
        console.log('ℹ️ RESEND_API_KEY not found, using Nodemailer...');
    }

    // Strategy 2: Fallback to Nodemailer (backup)
    try {
        console.log('📧 Sending email via Nodemailer (fallback)...');
        
        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME || 'EV Rental'} <${process.env.EMAIL_USER || process.env.EMAIL_FROM || 'evstationrental@gmail.com'}>`,
            to,
            subject,
            html,
            attachments
        };

        const info = await nodemailerTransporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully via Nodemailer:', info.messageId);
        return { 
            messageId: info.messageId, 
            provider: 'nodemailer',
            success: true 
        };

    } catch (nodemailerError) {
        console.error('❌ Both Resend and Nodemailer failed:', nodemailerError);
        throw new Error(`Email sending failed: ${nodemailerError.message}`);
    }
};

// Import all email templates from nodemailer.js
const {
    getResetPasswordEmailTemplate,
    getWelcomeEmailTemplate,
    getBookingConfirmationTemplate,
    getStaffAccountEmailTemplate,
    getBookingCancellationTemplate,
    getPaymentSuccessTemplate,
    getContractSignedTemplate,
    getCheckoutReceiptTemplate,
    getWalkInCustomerEmailTemplate,
    getBookingUpdateTemplate
} = require('./nodemailer');

module.exports = {
    sendEmail,
    getResetPasswordEmailTemplate,
    getWelcomeEmailTemplate,
    getBookingConfirmationTemplate,
    getStaffAccountEmailTemplate,
    getBookingCancellationTemplate,
    getPaymentSuccessTemplate,
    getContractSignedTemplate,
    getCheckoutReceiptTemplate,
    getWalkInCustomerEmailTemplate,
    getBookingUpdateTemplate
};

