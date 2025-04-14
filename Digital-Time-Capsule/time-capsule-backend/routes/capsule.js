const express = require('express');
const jwt = require('jsonwebtoken');
const Capsule = require('../models/Capsule');
const router = express.Router();

// Create a capsule
router.post('/', async (req, res) => {
  const { content, unlockDate } = req.body;
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const capsule = new Capsule({ user: decoded.id, content, unlockDate });
    await capsule.save();
    res.status(201).json(capsule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's capsules
router.get('/', async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const capsules = await Capsule.find({ user: decoded.id });
    res.json(capsules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;