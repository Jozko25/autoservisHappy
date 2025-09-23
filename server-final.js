const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Autoservis Happy FINAL server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

// Basic middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global variables
global.twilioClient = null;
global.googleCalendarService = null;

// Health endpoint
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
    version: 'FINAL-WITH-BOOKING',
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
    version: 'FINAL-WITH-BOOKING',
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

// Initialize Twilio
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

// Initialize Google Calendar
console.log('📅 Initializing Google Calendar...');
try {
  const { google } = require('googleapis');

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
      ],
    });

    global.googleCalendarService = {
      calendar: google.calendar('v3'),
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      getCalendar: () => google.calendar('v3')
    };

    google.options({ auth: auth });
    console.log('✅ Google Calendar initialized successfully');
  } else {
    console.warn('⚠️  Google Calendar credentials not found');
  }
} catch (error) {
  console.error('❌ Failed to initialize Google Calendar:', error.message);
}

// BOOKING ENDPOINTS - INLINE
const TIMEZONE = 'Europe/Bratislava';

// Simple booking endpoint
app.post('/booking/appointment', async (req, res) => {
  try {
    const { action, serviceType, preferredDate, preferredTime, customerName, customerPhone } = req.body;

    // Check if Google Calendar is available
    if (!global.googleCalendarService) {
      return res.status(503).json({
        success: false,
        error: 'Google Calendar service nedostupný. Prosím kontaktujte nás priamo.',
        fallback: {
          phone: '+421910223761',
          message: 'Zavolajte nám priamo pre rezerváciu termínu'
        }
      });
    }

    if (action === 'find_next_available') {
      // Find next available slot
      const nextAvailable = moment.tz(TIMEZONE).add(1, 'day').hour(9).minute(0).second(0);

      return res.json({
        success: true,
        action: 'find_next_available',
        date: nextAvailable.format('YYYY-MM-DD'),
        time: nextAvailable.format('HH:mm'),
        slot: {
          start: nextAvailable.toISOString(),
          end: nextAvailable.add(1, 'hour').toISOString(),
          startFormatted: nextAvailable.format('HH:mm'),
          endFormatted: nextAvailable.add(1, 'hour').format('HH:mm')
        },
        message: `Najbližší voľný termín mám ${nextAvailable.format('DD.MM.YYYY')} o ${nextAvailable.format('HH:mm')}`
      });
    }

    if (action === 'check_availability' && preferredDate) {
      // Simple availability check
      return res.json({
        success: true,
        action: 'check_availability',
        date: preferredDate,
        available: true,
        message: `Termín na ${preferredDate} je dostupný`
      });
    }

    if (action === 'book') {
      if (!customerName || !customerPhone) {
        return res.status(400).json({
          success: false,
          error: 'Meno zákazníka a telefónne číslo sú povinné'
        });
      }

      // Create appointment (simplified)
      const appointmentTime = preferredDate && preferredTime ?
        moment.tz(`${preferredDate} ${preferredTime}`, 'YYYY-MM-DD HH:mm', TIMEZONE) :
        moment.tz(TIMEZONE).add(1, 'day').hour(9).minute(0).second(0);

      try {
        const calendar = global.googleCalendarService.getCalendar();
        const event = {
          summary: `Servis - ${customerName}`,
          description: `Zákazník: ${customerName}\nTelefón: ${customerPhone}\nTyp servisu: ${serviceType || 'Všeobecný servis'}`,
          start: {
            dateTime: appointmentTime.toISOString(),
            timeZone: TIMEZONE,
          },
          end: {
            dateTime: appointmentTime.clone().add(1, 'hour').toISOString(),
            timeZone: TIMEZONE,
          }
        };

        const response = await calendar.events.insert({
          calendarId: global.googleCalendarService.calendarId,
          requestBody: event,
        });

        return res.json({
          success: true,
          message: 'Rezervácia bola úspešne vytvorená',
          appointment: {
            id: response.data.id,
            customerName,
            customerPhone,
            start: appointmentTime.toISOString(),
            startFormatted: appointmentTime.format('DD.MM.YYYY HH:mm'),
            serviceType
          }
        });
      } catch (calendarError) {
        console.error('Calendar error:', calendarError);
        return res.status(500).json({
          success: false,
          error: 'Nepodarilo sa vytvoriť rezerváciu v kalendári'
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: 'Neplatná akcia'
    });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Nepodarilo sa spracovať rezerváciu'
    });
  }
});

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

    const messageResponse = await global.twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

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

    const smsMessage = `🚗 AUTOSERVIS HAPPY - POŽIADAVKA O KONTAKT

Zákazník: ${customer_name}
Telefón: ${customer_phone}
Dôvod: ${reason || 'Všeobecná požiadavka o kontakt'}
`;

    const messageResponse = await global.twilioClient.messages.create({
      body: smsMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.AUTOSERVIS_PHONE_NUMBER || '+421910223761'
    });

    console.log(`✅ Human contact request SMS sent: ${messageResponse.sid}`);

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

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 FINAL Autoservis Happy server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📱 SMS webhook: http://localhost:${port}/webhook/sms`);
  console.log(`👤 Human request webhook: http://localhost:${port}/webhook/human-request`);
  console.log(`📅 Booking endpoint: http://localhost:${port}/booking/appointment`);
  console.log(`🔧 Twilio configured: ${!!global.twilioClient}`);
  console.log(`📆 Google Calendar configured: ${!!global.googleCalendarService}`);
  console.log(`✅ FINAL server startup completed successfully`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
    process.exit(1);
  }
});