// Minimal server for Railway deployment debugging
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting minimal server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint - most important for Railway
app.get('/health', (req, res) => {
  console.log('💚 Health check requested');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Minimal server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Autoservis Happy API',
    status: 'minimal mode',
    timestamp: new Date().toISOString(),
    message: 'Server is running in minimal mode for debugging'
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Minimal server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});