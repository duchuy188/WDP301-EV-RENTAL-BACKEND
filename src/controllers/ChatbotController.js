const ChatbotService = require('../services/ChatbotService');
const { Conversation } = require('../models');
const { v4: uuidv4 } = require('uuid');

class ChatbotController {
  // Gửi message và nhận response
  static async sendMessage(req, res) {
    try {
      const { message, session_id } = req.body;
      const userId = req.user._id;
      const userRole = req.user.role;

      // Validate input
      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Tin nhắn không được để trống'
        });
      }

      // Tạo session_id mới nếu chưa có
      const currentSessionId = session_id || uuidv4();

      // Tìm hoặc tạo conversation
      let conversation = await Conversation.findActiveSession(userId, currentSessionId);
      
      if (!conversation) {
        conversation = await Conversation.createNewSession(userId, userRole, currentSessionId);
      }

      // Lưu tin nhắn của user TRƯỚC KHI xử lý
      await conversation.addMessage('user', message.trim());

      // Lấy lịch sử hội thoại gần đây (bao gồm tin nhắn vừa lưu)
      const conversationHistory = conversation.getRecentMessages(10);

      // Xử lý message với ChatbotService
      const response = await ChatbotService.processMessage(
        message.trim(),
        userRole,
        userId,
        conversationHistory
      );

      if (!response.success) {
        return res.status(500).json({
          success: false,
          message: response.message,
          suggestions: response.suggestions || []
        });
      }

      // Lưu response của bot với intent và sentiment
      await conversation.addMessage('assistant', response.message, {
        suggestions: response.suggestions,
        actions: response.actions,
        context: response.context,
        intent: response.intent,
        sentiment: response.sentiment
      });

      // Trả về response
      res.json({
        success: true,
        message: response.message,
        suggestions: response.suggestions,
        actions: response.actions,
        context: response.context,
        intent: response.intent,
        sentiment: response.sentiment,
        session_id: currentSessionId,
        conversation_id: conversation._id
      });

    } catch (error) {
      console.error('Error in sendMessage:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi xử lý tin nhắn',
        error: error.message
      });
    }
  }

  // Lấy lịch sử hội thoại
  static async getConversationHistory(req, res) {
    try {
      const { session_id } = req.query;
      const userId = req.user._id;

      if (!session_id) {
        return res.status(400).json({
          success: false,
          message: 'Session ID là bắt buộc'
        });
      }

      const conversation = await Conversation.findActiveSession(userId, session_id);

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy hội thoại'
        });
      }

      const history = conversation.getConversationHistory();

      res.json({
        success: true,
        data: {
          session_id: conversation.session_id,
          user_role: conversation.user_role,
          total_messages: conversation.total_messages,
          last_activity: conversation.last_activity,
          messages: history
        }
      });

    } catch (error) {
      console.error('Error in getConversationHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy lịch sử hội thoại',
        error: error.message
      });
    }
  }

  // Lấy danh sách hội thoại của user
  static async getUserConversations(req, res) {
    try {
      const userId = req.user._id;
      const { limit = 20 } = req.query;

      const conversations = await Conversation.getUserConversations(userId, parseInt(limit));

      res.json({
        success: true,
        data: {
          conversations: conversations.map(conv => ({
            session_id: conv.session_id,
            user_role: conv.user_role,
            status: conv.status,
            total_messages: conv.total_messages,
            last_activity: conv.last_activity,
            created_at: conv.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Error in getUserConversations:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy danh sách hội thoại',
        error: error.message
      });
    }
  }

  // Tạo hội thoại mới
  static async createNewConversation(req, res) {
    try {
      const userId = req.user._id;
      const userRole = req.user.role;
      const sessionId = uuidv4();

      const conversation = await Conversation.createNewSession(userId, userRole, sessionId);

      res.json({
        success: true,
        message: 'Tạo hội thoại mới thành công',
        data: {
          session_id: conversation.session_id,
          user_role: conversation.user_role,
          created_at: conversation.createdAt
        }
      });

    } catch (error) {
      console.error('Error in createNewConversation:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi tạo hội thoại mới',
        error: error.message
      });
    }
  }


  // Lấy gợi ý dựa trên role
  static async getSuggestions(req, res) {
    try {
      const userRole = req.user.role;
      const { context } = req.query;

      let suggestions = [];

      switch (userRole) {
        case 'EV Renter':
          suggestions = [
            'Tìm trạm gần nhất',
            'Xem lịch sử thuê xe',
            'Đặt xe mới',
            'Hỏi về giá cả',
            'Hướng dẫn sử dụng'
          ];
          break;

        case 'Station Staff':
          suggestions = [
            'Xem xe đang thuê',
            'Tính phí phát sinh',
            'Cập nhật trạng thái xe',
            'Kiểm tra thông tin khách hàng',
            'Hướng dẫn quy trình'
          ];
          break;

        case 'Admin':
          suggestions = [
            'Xem báo cáo doanh thu',
            'Phân tích nhu cầu',
            'Quản lý trạm',
            'Xem thống kê hệ thống',
            'Gợi ý đầu tư'
          ];
          break;

        default:
          suggestions = [
            'Hướng dẫn sử dụng',
            'Liên hệ hỗ trợ',
            'Xem thông tin hệ thống'
          ];
      }

      res.json({
        success: true,
        data: {
          suggestions: suggestions,
          user_role: userRole
        }
      });

    } catch (error) {
      console.error('Error in getSuggestions:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server khi lấy gợi ý',
        error: error.message
      });
    }
  }

}

module.exports = ChatbotController;
