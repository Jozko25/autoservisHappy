const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize app and basic setup first
const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Autoservis Happy server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health endpoint - HIGHEST PRIORITY for Railway
app.get('/health', (req, res) => {
  console.log('💚 Health check requested');

  let googleCalendarStatus = 'unknown';
  try {
    if (global.googleCalendarService && global.googleCalendarService.getCalendar) {
      global.googleCalendarService.getCalendar();
      googleCalendarStatus = 'initialized';
    } else {
      googleCalendarStatus = 'not_configured';
    }
  } catch (error) {
    googleCalendarStatus = 'not_configured';
  }

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!global.twilioClient,
    googleCalendarConfigured: googleCalendarStatus,
    environment: process.env.NODE_ENV || 'development',
    services: {
      sms: !!global.twilioClient ? 'available' : 'unavailable',
      booking: googleCalendarStatus === 'initialized' ? 'available' : 'unavailable'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Autoservis Happy API',
    version: '2.0.0-ROBUST-BOOKING',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      sms: '/webhook/sms',
      humanRequest: '/webhook/human-request',
      booking: '/booking/appointment'
    }
  });
});

// Global variables for services
global.twilioClient = null;
global.googleCalendarService = null;

// Initialize Twilio safely
console.log('🔧 Initializing Twilio...');
try {
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACTUAL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken) {
    global.twilioClient = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully');
  } else {
    console.warn('⚠️  Twilio credentials not found. SMS functionality will be disabled.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Twilio client:', error.message);
}

// Initialize Google Calendar safely
console.log('📅 Initializing Google Calendar...');
try {
  const googleCalendar = require('./config/google-calendar');
  global.googleCalendarService = googleCalendar;

  // Initialize asynchronously without blocking
  googleCalendar.initialize()
    .then(() => {
      console.log('✅ Google Calendar initialized successfully');
    })
    .catch(error => {
      console.error('⚠️  Failed to initialize Google Calendar:', error.message);
      console.log('📋 Google Calendar booking features will be unavailable');
    });
} catch (error) {
  console.error('❌ Failed to load Google Calendar module:', error.message);
}

// Load booking routes safely
console.log('📋 Loading booking routes...');
try {
  const bookingRoutes = require('./routes/booking');
  app.use('/booking', bookingRoutes);
  console.log('✅ Booking routes loaded and mounted at /booking/*');
  console.log('📅 Available booking endpoints:');
  console.log('   - POST /booking/appointment (create/check availability)');
  console.log('   - DELETE /booking/appointment/:id (cancel)');
  console.log('   - GET /booking/availability (check slots)');
  console.log('   - GET /booking/appointments (list)');
} catch (error) {
  console.error('❌ Failed to load booking routes:', error.message);
  console.error('❌ Error details:', error.stack);
  console.log('📋 Booking endpoints will be unavailable');
}

// SMS webhook endpoint
app.post('/webhook/sms', async (req, res) => {
  try {
    if (!global.twilioClient) {
      return res.status(503).json({
        error: 'SMS service unavailable - Twilio not configured'
      });
    }

    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields: to, message'
      });
    }

    if (!to.startsWith('+421')) {
      return res.status(400).json({
        error: 'Invalid Slovak phone number format. Must start with +421'
      });
    }

    const messageResponse = await global.twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log(`SMS sent successfully: ${messageResponse.sid}`);

    res.status(200).json({
      success: true,
      messageSid: messageResponse.sid,
      to: to,
      message: message
    });

  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      error: 'Failed to send SMS',
      details: error.message
    });
  }
});

// Human request webhook endpoint
app.post('/webhook/human-request', async (req, res) => {
  try {
    if (!global.twilioClient) {
      return res.status(503).json({
        error: 'SMS service unavailable - Twilio not configured'
      });
    }

    const { customer_name, customer_phone, reason, urgency } = req.body;

    if (!customer_name || !customer_phone) {
      return res.status(400).json({
        error: 'Missing required fields: customer_name, customer_phone'
      });
    }

    const urgencyLevel = urgency || 'stredná';
    const requestReason = reason || 'Všeobecná požiadavka o kontakt';

    const smsMessage = `🚗 AUTOSERVIS HAPPY - POŽIADAVKA O KONTAKT

Zákazník: ${customer_name}
Telefón: ${customer_phone}
Dôvod: ${requestReason}
`;

    const messageResponse = await global.twilioClient.messages.create({
      body: smsMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.AUTOSERVIS_PHONE_NUMBER || '+421910223761'
    });

    console.log(`Human request SMS sent successfully: ${messageResponse.sid}`);
    console.log(`Customer: ${customer_name} (${customer_phone}), Reason: ${requestReason}`);

    res.status(200).json({
      success: true,
      message: 'Požiadavka o ľudský kontakt bola úspešne odoslaná',
      messageSid: messageResponse.sid,
      customer_name: customer_name,
      customer_phone: customer_phone
    });

  } catch (error) {
    console.error('Error sending human request SMS:', error);
    res.status(500).json({
      error: 'Nepodarilo sa odoslať požiadavku o kontakt',
      details: error.message
    });
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.log('🔄 Server will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🔄 Server will continue running...');
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Autoservis Happy server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📱 SMS webhook: http://localhost:${port}/webhook/sms`);
  console.log(`👤 Human request webhook: http://localhost:${port}/webhook/human-request`);
  console.log(`📅 Booking endpoints:`);
  console.log(`   - Create appointment: POST http://localhost:${port}/booking/appointment`);
  console.log(`   - Cancel appointment: DELETE http://localhost:${port}/booking/appointment/:id`);
  console.log(`   - Check availability: GET http://localhost:${port}/booking/availability`);
  console.log(`   - List appointments: GET http://localhost:${port}/booking/appointments`);
  console.log(`🔧 Twilio configured: ${!!global.twilioClient}`);
  console.log(`📆 Google Calendar: ${global.googleCalendarService ? 'Loading...' : 'Not available'}`);
  console.log(`✅ Server startup completed successfully`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});