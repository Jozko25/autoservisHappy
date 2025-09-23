const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
require('dotenv').config();
const googleCalendar = require('./config/google-calendar');
const bookingRoutes = require('./routes/booking');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Twilio client safely
let client = null;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const autoservisPhone = process.env.AUTOSERVIS_PHONE_NUMBER || '+421910223761';

try {
  // Check for both possible environment variable names
  const accountSid = process.env.TWILIO_ACTUAL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log('Twilio client initialized successfully');
  } else {
    console.warn('⚠️  Twilio credentials not found. SMS functionality will be disabled.');
  }
} catch (error) {
  console.error('Failed to initialize Twilio client:', error.message);
}

// Initialize Google Calendar API (don't block server startup)
googleCalendar.initialize().catch(error => {
  console.error('⚠️  Failed to initialize Google Calendar:', error.message);
  console.log('Google Calendar booking features will be unavailable');
  console.log('Server will continue running with SMS-only functionality');
});

// Mount booking routes
app.use('/booking', bookingRoutes);

app.post('/webhook/sms', async (req, res) => {
  try {
    if (!client) {
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

    const messageResponse = await client.messages.create({
      body: message,
      from: fromNumber,
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

app.post('/webhook/human-request', async (req, res) => {
  try {
    if (!client) {
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

    const messageResponse = await client.messages.create({
      body: smsMessage,
      from: fromNumber,
      to: autoservisPhone
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

app.get('/health', (_, res) => {
  let googleCalendarStatus = 'unknown';
  try {
    googleCalendar.getCalendar();
    googleCalendarStatus = 'initialized';
  } catch (error) {
    googleCalendarStatus = 'not_configured';
  }

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    twilioConfigured: !!client,
    googleCalendarConfigured: googleCalendarStatus,
    environment: process.env.NODE_ENV || 'development',
    services: {
      sms: !!client ? 'available' : 'unavailable',
      booking: googleCalendarStatus === 'initialized' ? 'available' : 'unavailable'
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Webhook server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📱 SMS webhook: http://localhost:${port}/webhook/sms`);
  console.log(`👤 Human request webhook: http://localhost:${port}/webhook/human-request`);
  console.log(`📅 Booking endpoints:`);
  console.log(`   - Create appointment: POST http://localhost:${port}/booking/appointment`);
  console.log(`   - Cancel appointment: DELETE http://localhost:${port}/booking/appointment/:id`);
  console.log(`   - Check availability: GET http://localhost:${port}/booking/availability`);
  console.log(`   - List appointments: GET http://localhost:${port}/booking/appointments`);
  console.log(`🔧 Twilio configured: ${!!client}`);
  console.log(`📆 Google Calendar: Initializing...`);
});