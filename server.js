const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Initialize app first to ensure it starts
const app = express();
const port = process.env.PORT || 3000;

console.log('🚀 Starting Autoservis Happy server...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', port);

// Basic middleware setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Essential health endpoint first (before any complex initialization)
app.get('/health', (req, res) => {
  console.log('💚 Health check requested');
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    message: 'Server is running'
  });
});

// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({
    name: 'Autoservis Happy API',
    version: 'UNIFIED-SYSTEM-v8',
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

// Now try to load complex modules safely
let twilio = null;
let googleCalendar = null;
let bookingRoutes = null;

try {
  twilio = require('twilio');
  console.log('✅ Twilio module loaded');
} catch (error) {
  console.error('❌ Failed to load Twilio module:', error.message);
}

try {
  googleCalendar = require('./config/google-calendar');
  console.log('✅ Google Calendar module loaded');
} catch (error) {
  console.error('❌ Failed to load Google Calendar module:', error.message);
}

try {
  bookingRoutes = require('./routes/booking');
  console.log('✅ Booking routes loaded');
} catch (error) {
  console.error('❌ Failed to load booking routes:', error.message);
}

// Mount booking routes if available
if (bookingRoutes) {
  app.use('/booking', bookingRoutes);
  console.log('✅ Booking routes mounted');
} else {
  console.log('⚠️  Booking routes not available');
}

// Initialize Twilio client safely
let client = null;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const autoservisPhone = process.env.AUTOSERVIS_PHONE_NUMBER || '+421910223761';

console.log('🔧 Initializing Twilio...');
try {
  // Check for both possible environment variable names
  const accountSid = process.env.TWILIO_ACTUAL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log('✅ Twilio client initialized successfully');
  } else {
    console.warn('⚠️  Twilio credentials not found. SMS functionality will be disabled.');
  }
} catch (error) {
  console.error('❌ Failed to initialize Twilio client:', error.message);
}

// Initialize Google Calendar API (don't block server startup)
console.log('📅 Initializing Google Calendar...');
googleCalendar.initialize()
  .then(() => {
    console.log('✅ Google Calendar initialized successfully');
  })
  .catch(error => {
    console.error('⚠️  Failed to initialize Google Calendar:', error.message);
    console.log('📋 Google Calendar booking features will be unavailable');
    console.log('📱 Server will continue running with SMS-only functionality');
  });

// Mount booking routes
app.use('/booking', bookingRoutes);

// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({
    name: 'Autoservis Happy API',
    version: '1.0.0',
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

// Unified API endpoint for ElevenLabs - handles both human contact and booking
app.post('/api/unified', async (req, res) => {
  try {
    const { request_type, customer_name, customer_phone, booking_action, service_type, preferred_date, preferred_time, reason } = req.body;

    console.log('Unified request:', { request_type, customer_name, customer_phone, booking_action });

    if (!request_type || !customer_name || !customer_phone) {
      return res.status(400).json({
        success: false,
        error: 'Chýbajú povinné údaje: request_type, customer_name, customer_phone'
      });
    }

    if (request_type === 'human_contact') {
      // Handle human contact request
      if (!client) {
        return res.status(503).json({
          success: false,
          error: 'SMS služba nie je dostupná'
        });
      }

      const smsMessage = `🚗 AUTOSERVIS HAPPY - POŽIADAVKA O KONTAKT

Zákazník: ${customer_name}
Telefón: ${customer_phone}
Dôvod: ${reason || 'Požiadavka o ľudský kontakt cez hlasovú asistentku'}
`;

      const messageResponse = await client.messages.create({
        body: smsMessage,
        from: fromNumber,
        to: autoservisPhone
      });

      console.log(`Unified human request SMS sent: ${messageResponse.sid}`);

      return res.json({
        success: true,
        type: 'human_contact',
        message: 'Vaša požiadavka o kontakt bola odoslaná. Niekto z tímu Vás bude čoskoro kontaktovať.',
        messageSid: messageResponse.sid
      });

    } else if (request_type === 'booking') {
      // Handle booking request - forward internally
      const bookingRequest = {
        body: {
          action: booking_action || 'find_next_available',
          customerName: customer_name,
          customerPhone: customer_phone,
          serviceType: service_type || 'Všeobecný servis',
          preferredDate: preferred_date,
          preferredTime: preferred_time,
          notes: reason
        }
      };

      // Simulate internal booking request
      const bookingUtils = require('./utils/booking-utils');

      if (booking_action === 'check_availability' && preferred_date) {
        const slots = await bookingUtils.getAvailableSlots(preferred_date);
        return res.json({
          success: true,
          type: 'booking',
          action: 'check_availability',
          date: preferred_date,
          availableSlots: slots,
          totalSlots: slots.length,
          message: slots.length > 0 ?
            `Mám ${slots.length} voľných termínov na ${preferred_date}` :
            `Žiaľ, na ${preferred_date} nemám voľný termín`
        });
      }

      if (booking_action === 'find_next_available') {
        const nextSlot = await bookingUtils.findNextAvailableSlot();
        if (!nextSlot) {
          return res.status(404).json({
            success: false,
            type: 'booking',
            message: 'Nenašiel sa žiadny voľný termín v najbližších 14 dňoch'
          });
        }

        const moment = require('moment-timezone');
        const slotTime = moment(nextSlot.slot.start).tz('Europe/Bratislava');
        return res.json({
          success: true,
          type: 'booking',
          action: 'find_next_available',
          date: nextSlot.date,
          time: slotTime.format('HH:mm'),
          slot: nextSlot.slot,
          message: `Najbližší voľný termín mám ${slotTime.format('DD.MM.YYYY')} o ${slotTime.format('HH:mm')}`
        });
      }

      if (booking_action === 'book') {
        // Create booking
        let startTime, endTime;
        const moment = require('moment-timezone');

        if (!preferred_date || !preferred_time) {
          const nextSlot = await bookingUtils.findNextAvailableSlot();
          if (!nextSlot) {
            return res.status(404).json({
              success: false,
              type: 'booking',
              error: 'Nenašiel sa žiadny voľný termín'
            });
          }
          startTime = nextSlot.slot.start;
          endTime = nextSlot.slot.end;
        } else {
          startTime = moment.tz(`${preferred_date} ${preferred_time}`, 'YYYY-MM-DD HH:mm', 'Europe/Bratislava').toISOString();
          endTime = moment(startTime).add(60, 'minutes').toISOString();

          bookingUtils.validateAppointmentTime(startTime);
          const isAvailable = await bookingUtils.isSlotAvailable(startTime, endTime);
          if (!isAvailable) {
            return res.status(409).json({
              success: false,
              type: 'booking',
              error: 'Tento termín je už obsadený. Prosím, vyberte iný termín.'
            });
          }
        }

        const appointment = await bookingUtils.createAppointment({
          customerName: customer_name,
          customerPhone: customer_phone,
          serviceType: service_type,
          startTime,
          endTime,
          notes: reason,
          summary: `Servis - ${customer_name} (${service_type || 'Všeobecný'})`
        });

        return res.json({
          success: true,
          type: 'booking',
          message: 'Rezervácia bola úspešne vytvorená',
          appointment: {
            id: appointment.eventId,
            customerName: customer_name,
            customerPhone: customer_phone,
            start: startTime,
            end: endTime,
            startFormatted: moment(startTime).tz('Europe/Bratislava').format('DD.MM.YYYY HH:mm'),
            serviceType: service_type
          }
        });
      }

    } else {
      return res.status(400).json({
        success: false,
        error: 'Neplatný typ požiadavky. Použite "human_contact" alebo "booking"'
      });
    }

  } catch (error) {
    console.error('Unified endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Nastala chyba pri spracovaní požiadavky',
      details: error.message
    });
  }
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.log('🔄 Server will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🔄 Server will continue running...');
});

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
  console.log(`🔧 Twilio configured: ${!!client}`);
  console.log(`📆 Google Calendar: Initializing...`);
  console.log(`✅ Server startup completed successfully`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use`);
    process.exit(1);
  }
});