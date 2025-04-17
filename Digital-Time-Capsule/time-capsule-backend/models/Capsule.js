const mongoose = require('mongoose');

const CapsuleSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true  // Add index for better performance
  },
  title: { 
    type: String, 
    default: 'Time Capsule' 
  },
  content: { 
    type: String,
    required: function() { return !this.mediaUrl; }  // Required unless there's media
  },
  unlockDate: { 
    type: Date, 
    required: true,
    index: true  // Add index for better query performance
  },
  unlocked: { 
    type: Boolean, 
    default: false 
  },
  mediaUrl: { 
    type: String 
  },
  mediaType: { 
    type: String,
    enum: ['image', 'video', 'audio', 'raw', '']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true  // Adds updatedAt automatically
});

module.exports = mongoose.model('Capsule', CapsuleSchema);