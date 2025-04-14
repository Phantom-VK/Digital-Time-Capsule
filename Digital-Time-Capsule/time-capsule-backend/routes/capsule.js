const express = require('express');
const jwt = require('jsonwebtoken');
const Capsule = require('../models/Capsule');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
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
  destination: 'uploads/',
  filename: (req, file, cb) => {  
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Create a text capsule
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content, unlockDate } = req.body;
    
    if (!content || !unlockDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const capsule = new Capsule({ 
      user: req.user.id, 
      content: encrypt(content), // Encrypt before saving
      unlockDate: new Date(unlockDate) 
    });

    await capsule.save();
    res.status(201).json({
      ...capsule.toObject(),
      content: content // Return decrypted content in response
    });
  } catch (err) {
    console.error('Capsule creation error:', err);
    res.status(500).json({ error: 'Failed to create capsule' });
  }
});

// Get user's capsules with auto-unlock
router.get('/', authenticateToken, async (req, res) => {
  try {
    let capsules = await Capsule.find({ user: req.user.id }).lean();
    
    // Process capsules for unlocking and decrypt content
    const processedCapsules = await Promise.all(capsules.map(async (capsule) => {
      const decryptedContent = decrypt(capsule.content);
      
      if (new Date() >= new Date(capsule.unlockDate)) {
        if (!capsule.unlocked) {
          await Capsule.updateOne(
            { _id: capsule._id },
            { $set: { unlocked: true } }
          );
          // Add email notification logic here if needed
        }
        return { 
          ...capsule, 
          content: decryptedContent,
          unlocked: true 
        };
      }
      
      return {
        ...capsule,
        content: capsule.unlocked ? decryptedContent : '🔒 Content locked until ' + new Date(capsule.unlockDate).toLocaleDateString()
      };
    }));

    res.json(processedCapsules);
  } catch (err) {
    console.error('Capsule retrieval error:', err);
    res.status(500).json({ error: 'Failed to retrieve capsules' });
  }
});

// Upload media capsule
router.post('/upload', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'time-capsules',
      resource_type: 'auto'
    });

    const capsule = new Capsule({
      user: req.user.id,
      mediaUrl: result.secure_url,
      mediaType: result.resource_type,
      unlockDate: new Date(req.body.unlockDate),
      content: req.body.message ? encrypt(req.body.message) : undefined
    });

    await capsule.save();
    
    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('File cleanup error:', err);
    });

    res.status(201).json({
      ...capsule.toObject(),
      content: req.body.message || undefined
    });
  } catch (err) {
    console.error('Media upload error:', err);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

module.exports = router;