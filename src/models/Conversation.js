const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Liên kết
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  
  // Thông tin hội thoại
  session_id: {
    type: String,
    required: true
  },
  
  // Lịch sử tin nhắn
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      suggestions: [String],
      actions: [String],
      context: String
    }
  }],
  
  // Thông tin bổ sung
  user_role: {
    type: String,
    enum: ['EV Renter', 'Station Staff', 'Admin'],
    required: true
  },
  
  // Trạng thái
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  
  // Metadata
  total_messages: {
    type: Number,
    default: 0
  },
  
  last_activity: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true 
});

  // Indexes
conversationSchema.index({ user_id: 1, session_id: 1 });
conversationSchema.index({ user_id: 1, last_activity: -1 });
conversationSchema.index({ session_id: 1 }, { unique: true });

// Methods
conversationSchema.methods.addMessage = function(role, message, metadata = {}) {
  this.messages.push({
    role,
    message,
    timestamp: new Date(),
    metadata
  });
  
  this.total_messages += 1;
  this.last_activity = new Date();
  
  return this.save();
};

conversationSchema.methods.getRecentMessages = function(limit = 10) {
  return this.messages
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
    .reverse();
};

conversationSchema.methods.getConversationHistory = function() {
  return this.messages.map(msg => ({
    role: msg.role,
    message: msg.message,
    timestamp: msg.timestamp
  }));
};

// Static methods
conversationSchema.statics.findActiveSession = function(userId, sessionId) {
  return this.findOne({
    user_id: userId,
    session_id: sessionId,
    status: 'active'
  });
};

conversationSchema.statics.createNewSession = function(userId, userRole, sessionId) {
  return this.create({
    user_id: userId,
    session_id: sessionId,
    user_role: userRole,
    status: 'active',
    messages: [],
    total_messages: 0
  });
};

conversationSchema.statics.getUserConversations = function(userId, limit = 20) {
  return this.find({ user_id: userId })
    .sort({ last_activity: -1 })
    .limit(limit)
    .select('session_id user_role status total_messages last_activity createdAt');
};

// Pre-save middleware
conversationSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    this.total_messages = this.messages.length;
  }
  next();
});

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
