const express = require('express');
const router = express.Router();
const ChatbotController = require('../controllers/ChatbotController');
const authenticateToken = require('../middlewares/authMiddleware');

// Tất cả routes đều cần authentication
router.use(authenticateToken);

// Gửi message và nhận response
router.post('/message', ChatbotController.sendMessage);

// Lấy lịch sử hội thoại
router.get('/history', ChatbotController.getConversationHistory);

// Lấy danh sách hội thoại của user
router.get('/conversations', ChatbotController.getUserConversations);

// Tạo hội thoại mới
router.post('/conversations', ChatbotController.createNewConversation);


// Lấy gợi ý dựa trên role
router.get('/suggestions', ChatbotController.getSuggestions);


module.exports = router;
