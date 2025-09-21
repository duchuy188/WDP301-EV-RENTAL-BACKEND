const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  // Liên kết
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  rental_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Rental',
    required: true 
  },
  vehicle_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vehicle',
    required: true 
  },
  station_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Station',
    required: true 
  },
  
  // Đánh giá
  vehicle_rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  station_rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  
  // Bình luận
  vehicle_comment: { 
    type: String, 
    default: '' 
  },
  station_comment: { 
    type: String, 
    default: '' 
  },
  
  // Trạng thái
  status: { 
    type: String, 
    enum: ['active', 'hidden'], 
    default: 'active' 
  }
}, { timestamps: true });

const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;