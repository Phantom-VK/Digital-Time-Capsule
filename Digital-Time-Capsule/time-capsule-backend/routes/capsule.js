const express = require('express');
const jwt = require('jsonwebtoken');
const Capsule = require('../models/Capsule');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const cloudinary = require('../utils/cloudinary'); // Make sure this path is correct
const router = express.Router();

// Encryption functions
const encrypt = (text) => {
  return CryptoJS.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();
};

const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, process.env.ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {  
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = /jpeg|jpg|png|gif|mp4|mp3|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Unsupported file type!'));
  }
};

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Create a text capsule
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, unlockDate, title } = req.body;
    
    if (!content || !unlockDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const capsule = new Capsule({ 
      user: req.user.id, 
      content: encrypt(content), // Encrypt before saving
      title: title || 'My Time Capsule',
      unlockDate: new Date(unlockDate),
      unlocked: false
    });

    await capsule.save();
    res.status(201).json({
      id: capsule._id,
      title: capsule.title,
      unlockDate: capsule.unlockDate,
      createdAt: capsule.createdAt,
      content: content // Return decrypted content in response
    });
  } catch (err) {
    console.error('Capsule creation error:', err);
    res.status(500).json({ error: 'Failed to create capsule' });
  }
});

// Get all user's capsules with auto-unlock
router.get('/', authenticateToken, async (req, res) => {
  try {
    let capsules = await Capsule.find({ user: req.user.id }).lean();
    
    // Process capsules for unlocking and decrypt content
    const processedCapsules = await Promise.all(capsules.map(async (capsule) => {
      // Check if capsule should be unlocked
      const now = new Date();
      const shouldUnlock = now >= new Date(capsule.unlockDate);
      
      // Update unlock status in database if needed
      if (shouldUnlock && !capsule.unlocked) {
        await Capsule.updateOne(
          { _id: capsule._id },
          { $set: { unlocked: true } }
        );
        capsule.unlocked = true;
      }
      
      // Prepare response object
      const result = {
        id: capsule._id,
        title: capsule.title || 'Time Capsule',
        unlockDate: capsule.unlockDate,
        createdAt: capsule.createdAt,
        unlocked: capsule.unlocked || shouldUnlock,
        mediaUrl: capsule.mediaUrl,
        mediaType: capsule.mediaType
      };
      
      // Add content if capsule is unlocked
      if (result.unlocked && capsule.content) {
        result.content = decrypt(capsule.content);
      } else if (capsule.content) {
        result.content = '🔒 Locked until ' + new Date(capsule.unlockDate).toLocaleDateString();
      }
      
      return result;
    }));

    res.json(processedCapsules);
  } catch (err) {
    console.error('Capsule retrieval error:', err);
    res.status(500).json({ error: 'Failed to retrieve capsules' });
  }
});

// Get a single capsule by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const capsule = await Capsule.findOne({ 
      _id: req.params.id,
      user: req.user.id 
    }).lean();
    
    if (!capsule) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    
    const now = new Date();
    const isUnlocked = now >= new Date(capsule.unlockDate) || capsule.unlocked;
    
    // Update unlock status if needed
    if (isUnlocked && !capsule.unlocked) {
      await Capsule.updateOne(
        { _id: capsule._id },
        { $set: { unlocked: true } }
      );
    }
    
    const result = {
      id: capsule._id,
      title: capsule.title || 'Time Capsule',
      unlockDate: capsule.unlockDate,
      createdAt: capsule.createdAt,
      unlocked: isUnlocked,
      mediaUrl: capsule.mediaUrl,
      mediaType: capsule.mediaType
    };
    
    if (isUnlocked && capsule.content) {
      result.content = decrypt(capsule.content);
    } else if (capsule.content) {
      result.content = '🔒 Locked until ' + new Date(capsule.unlockDate).toLocaleDateString();
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error retrieving capsule:', err);
    res.status(500).json({ error: 'Failed to retrieve capsule' });
  }
});

// Upload media capsule
router.post('/upload', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'time-capsules',
      resource_type: 'auto'
    });

    const capsule = new Capsule({
      user: req.user.id,
      mediaUrl: result.secure_url,
      mediaType: result.resource_type,
      title: req.body.title || 'Media Time Capsule',
      unlockDate: new Date(req.body.unlockDate),
      content: req.body.message ? encrypt(req.body.message) : '',
      unlocked: false
    });

    await capsule.save();
    
    // Clean up uploaded file from local storage
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('File cleanup error:', err);
    });

    res.status(201).json({
      id: capsule._id,
      title: capsule.title,
      unlockDate: capsule.unlockDate,
      createdAt: capsule.createdAt,
      mediaUrl: capsule.mediaUrl,
      mediaType: capsule.mediaType,
      content: req.body.message || ''
    });
  } catch (err) {
    console.error('Media upload error:', err);
    // Clean up file if it exists
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: 'Failed to upload media: ' + err.message });
  }
});

// Delete a capsule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const capsule = await Capsule.findOne({ 
      _id: req.params.id,
      user: req.user.id 
    });
    
    if (!capsule) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    
    // Delete media from Cloudinary if exists
    if (capsule.mediaUrl) {
      const publicId = capsule.mediaUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`time-capsules/${publicId}`);
    }
    
    await Capsule.deleteOne({ _id: req.params.id });
    res.json({ message: 'Capsule deleted successfully' });
  } catch (err) {
    console.error('Error deleting capsule:', err);
    res.status(500).json({ error: 'Failed to delete capsule' });
  }
});

// Force unlock a capsule (override the unlock date)
router.patch('/:id/unlock', authenticateToken, async (req, res) => {
  try {
    const capsule = await Capsule.findOne({ 
      _id: req.params.id,
      user: req.user.id 
    });
    
    if (!capsule) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    
    capsule.unlocked = true;
    await capsule.save();
    
    const result = {
      id: capsule._id,
      title: capsule.title || 'Time Capsule',
      unlockDate: capsule.unlockDate,
      createdAt: capsule.createdAt,
      unlocked: true,
      mediaUrl: capsule.mediaUrl,
      mediaType: capsule.mediaType
    };
    
    if (capsule.content) {
      result.content = decrypt(capsule.content);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error unlocking capsule:', err);
    res.status(500).json({ error: 'Failed to unlock capsule' });
  }
});

// Update capsule details
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const capsule = await Capsule.findOne({ 
      _id: req.params.id,
      user: req.user.id 
    });
    
    if (!capsule) {
      return res.status(404).json({ error: 'Capsule not found' });
    }
    
    // Only allow updates if capsule is still locked
    const now = new Date();
    if (now >= new Date(capsule.unlockDate) || capsule.unlocked) {
      return res.status(400).json({ error: 'Cannot update an unlocked capsule' });
    }
    
    // Fields that can be updated
    const { title, unlockDate, content } = req.body;
    
    if (title) capsule.title = title;
    if (unlockDate) capsule.unlockDate = new Date(unlockDate);
    if (content) capsule.content = encrypt(content);
    
    await capsule.save();
    
    res.json({
      id: capsule._id,
      title: capsule.title,
      unlockDate: capsule.unlockDate,
      createdAt: capsule.createdAt,
      content: content || decrypt(capsule.content),
      mediaUrl: capsule.mediaUrl,
      mediaType: capsule.mediaType
    });
  } catch (err) {
    console.error('Error updating capsule:', err);
    res.status(500).json({ error: 'Failed to update capsule' });
  }
});

module.exports = router;