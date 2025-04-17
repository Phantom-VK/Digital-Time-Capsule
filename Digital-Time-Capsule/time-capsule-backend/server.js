const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment Variables Validation
const requiredEnvVars = ['MONGO_URI', 'EMAIL_USER', 'EMAIL_PASS', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected Successfully"))
  .catch(err => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify Email Configuration
transporter.verify((error) => {
  if (error) {
    console.error("Email Transporter Error:", error);
  } else {
    console.log("Email Transporter Ready");
  }
});

// Email Service
const sendUnlockEmail = async (email, capsuleContent) => {
  try {
    await transporter.sendMail({
      from: `"Time Capsule" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔓 Your Time Capsule is Unlocked!',
      html: `<h1>Your secret message:</h1><p>${capsuleContent}</p>`,
    });
    console.log(`Unlock email sent to ${email}`);
  } catch (error) {
    console.error("Email Sending Error:", error);
    throw new Error("Failed to send email");
  }
};

// Routes
const authRoutes = require('./routes/auth');
const capsuleRoutes = require('./routes/capsule');

// Static folder for uploads (if you need direct access)
app.use('./uploads', express.static(path.join(__dirname, 'uploads')));

// Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/capsules', capsuleRoutes);  
// Health Check
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Time Capsule API is running',
    timestamp: new Date()
  });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

// Server Startup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Export for testing
module.exports = { app, sendUnlockEmail };