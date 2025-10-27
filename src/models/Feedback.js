const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // Liên kết
  rental_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Rental',
    required: true 
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  staff_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  staff_ids: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  // Loại feedback
  type: { 
    type: String, 
    enum: ['rating', 'complaint'], 
    required: true 
  },
  
  // Rating (nếu type = 'rating')
  overall_rating: { type: Number, min: 1, max: 5 },
  staff_service: { type: Number, min: 1, max: 5 },
  vehicle_condition: { type: Number, min: 1, max: 5 },
  station_cleanliness: { type: Number, min: 1, max: 5 },
  checkout_process: { type: Number, min: 1, max: 5 },
  
  // Complaint (nếu type = 'complaint')
  title: { type: String },
  description: { type: String },
  category: { 
    type: String, 
    enum: ['vehicle', 'staff', 'payment', 'service', 'other'] 
  },
  staff_role: {
    type: String,
    enum: ['pickup', 'return'],
    required: function() {
      return this.type === 'complaint' && this.category === 'staff';
    }
  },
  
  // Trạng thái xử lý (chỉ cho complaint)
  status: { 
    type: String, 
    enum: ['pending', 'resolved'],
    required: function() {
      return this.type === 'complaint';
    }
  },
  response: { 
    type: String, 
    default: ''
  },
  resolved_by: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: function() {
      return this.type === 'complaint' && this.status === 'resolved';
    }
  },
  
  // Chung
  comment: { type: String },
  images: [{ type: String }],
  
  // Metadata
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes
feedbackSchema.index({ rental_id: 1 });
feedbackSchema.index({ user_id: 1 });
feedbackSchema.index({ staff_id: 1 });
feedbackSchema.index({ staff_ids: 1 });
feedbackSchema.index({ type: 1 });
feedbackSchema.index({ status: 1 });
feedbackSchema.index({ created_at: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;