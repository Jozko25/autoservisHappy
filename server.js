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

// Now try to load complex modules safely
let twilio = null;
let googleCalendar = null;
let bookingRoutes = null;
let googleCalendarReady = false;
let googleCalendarInitError = null;

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
const googleCalendarInitialization = googleCalendar.initialize()
  .then(() => {
    console.log('✅ Google Calendar initialized successfully');
    googleCalendarReady = true;
    googleCalendarInitError = null;
    return true;
  })
  .catch(error => {
    console.error('⚠️  Failed to initialize Google Calendar:', error.message);
    console.log('📋 Google Calendar booking features will be unavailable until credentials are provided.');
    console.log('📱 Server will continue running with SMS-only functionality');
    googleCalendarReady = false;
    googleCalendarInitError = error.message;
    return false;
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

app.get('/health', async (_req, res) => {
  let googleCalendarStatus = 'initializing';

  if (googleCalendarReady) {
    googleCalendarStatus = 'initialized';
  } else if (googleCalendarInitError) {
    googleCalendarStatus = 'error';
  }

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      sms: client ? 'available' : 'unavailable',
      booking: googleCalendarReady ? 'available' : 'unavailable'
    },
    twilio: {
      configured: Boolean(client),
      fromNumber
    },
    googleCalendar: {
      configured: googleCalendarReady,
      status: googleCalendarStatus,
      error: googleCalendarInitError
    }
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Autoservis Happy API',
    version: 'UNIFIED-SYSTEM-v9',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      smsWebhook: '/webhook/sms',
      humanRequest: '/webhook/human-request',
      booking: '/booking/appointment',
      unified: '/api/unified'
    },
    services: {
      sms: client ? 'available' : 'unavailable',
      booking: googleCalendarReady ? 'available' : 'unavailable'
    }
  });
});

// Unified API endpoint for ElevenLabs - handles both human contact and booking
app.post('/api/unified', async (req, res) => {
  try {
    const {
      request_type,
      customer_name,
      customer_phone,
      booking_action,
      service_type,
      preferred_date,
      preferred_time,
      reason,
      time_preference
    } = req.body;

    // Smart fallback for missing request_type
    let resolvedRequestType = request_type;

    if (!resolvedRequestType) {
      // If any booking-related field is present, assume it's a booking request
      if (booking_action || service_type || preferred_date || preferred_time || time_preference) {
        resolvedRequestType = 'booking';
        console.warn(`⚠️ Unified API: Missing request_type, defaulting to "booking" based on booking fields present: ${JSON.stringify({ booking_action, service_type, preferred_date, preferred_time, time_preference })}`);
      }
      // If we have contact details but no booking fields, assume human contact
      else if (customer_name && customer_phone && reason) {
        resolvedRequestType = 'human_contact';
        console.warn(`⚠️ Unified API: Missing request_type, defaulting to "human_contact" based on contact details with reason`);
      }
      // Default to booking if we have basic customer info (most common case)
      else if (customer_name || customer_phone) {
        resolvedRequestType = 'booking';
        console.warn(`⚠️ Unified API: Missing request_type, defaulting to "booking" as the most common use case`);
      }
    }

    console.log('📞 Unified request:', {
      request_type: resolvedRequestType,
      original_request_type: request_type,
      customer_name,
      customer_phone,
      booking_action,
      preferred_date,
      preferred_time
    });

    // Only fail if we still couldn't determine the request type
    if (!resolvedRequestType && !customer_name && !customer_phone) {
      return res.status(400).json({
        success: false,
        error: 'Chýbajú povinné údaje: request_type, customer_name, customer_phone'
      });
    }

    if (resolvedRequestType === 'human_contact') {
      if (!customer_name || !customer_phone) {
        return res.status(400).json({
          success: false,
          error: 'Pre spojenie s človekom sú povinné meno aj telefónne číslo.'
        });
      }

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
    }

    if (resolvedRequestType !== 'booking') {
      return res.status(400).json({
        success: false,
        error: 'Neplatný typ požiadavky. Použite "human_contact" alebo "booking".'
      });
    }

    const action = booking_action || 'find_next_available';
    const normalizedService = service_type || 'Servis vozidla';

    if (action === 'book' && (!customer_name || !customer_phone)) {
      return res.status(400).json({
        success: false,
        type: 'booking',
        error: 'Pre potvrdenie rezervácie potrebujeme meno aj telefónne číslo.'
      });
    }

    try {
      await googleCalendar.ensureInitialized();
      googleCalendarReady = true;
      googleCalendarInitError = null;
    } catch (calendarError) {
      googleCalendarReady = false;
      googleCalendarInitError = calendarError.message;
      return res.status(503).json({
        success: false,
        type: 'booking',
        error: 'Kalendár nie je dostupný. Prosím skúste to o chvíľu alebo kontaktujte recepciu priamo.',
        details: calendarError.message,
        fallback: {
          phone: autoservisPhone,
          message: 'Zavolajte nám prosím na recepciu pre dokončenie rezervácie.'
        }
      });
    }

    const bookingUtils = require('./utils/booking-utils');
    const moment = require('moment-timezone');

    switch (action) {
      case 'check_availability': {
        if (!preferred_date) {
          const nextSlot = await bookingUtils.findNextAvailableSlot();

          if (!nextSlot) {
            return res.status(404).json({
              success: false,
              type: 'booking',
              action: 'find_next_available',
              message: 'Nenašiel sa žiadny voľný termín v najbližších 14 dňoch'
            });
          }

          const slotTime = moment(nextSlot.slot.start).tz('Europe/Bratislava');

          return res.json({
            success: true,
            type: 'booking',
            action: 'find_next_available',
            fallback: {
              reason: 'missing_preferred_date',
              originalAction: 'check_availability'
            },
            date: nextSlot.date,
            time: slotTime.format('HH:mm'),
            slot: nextSlot.slot,
            message: `Najbližší voľný termín mám ${slotTime.format('DD.MM.YYYY')} o ${slotTime.format('HH:mm')}`
          });
        }

        const slots = await bookingUtils.getAvailableSlots(preferred_date);
        return res.json({
          success: true,
          type: 'booking',
          action: 'check_availability',
          date: preferred_date,
          availableSlots: slots,
          totalSlots: slots.length,
          message: slots.length > 0
            ? `Mám ${slots.length} voľných termínov na ${preferred_date}`
            : `Žiaľ, na ${preferred_date} nemám voľný termín`
        });
      }

      case 'find_next_available': {
        const nextSlot = await bookingUtils.findNextAvailableSlot();
        if (!nextSlot) {
          return res.status(404).json({
            success: false,
            type: 'booking',
            message: 'Nenašiel sa žiadny voľný termín v najbližších 14 dňoch'
          });
        }

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

      case 'find_alternative': {
        let alternativeSlots = [];

        if (time_preference === 'later_same_day' && preferred_date) {
          const allSlots = await bookingUtils.getAvailableSlots(preferred_date);
          if (preferred_time) {
            const originalTime = moment.tz(`${preferred_date} ${preferred_time}`, 'YYYY-MM-DD HH:mm', 'Europe/Bratislava');
            alternativeSlots = allSlots.filter(slot => moment(slot.start).isAfter(originalTime));
          } else {
            alternativeSlots = allSlots;
          }
        } else if (time_preference === 'different_day') {
          for (let i = 1; i <= 7; i++) {
            const checkDate = moment().add(i, 'days').format('YYYY-MM-DD');
            const daySlots = await bookingUtils.getAvailableSlots(checkDate);
            if (daySlots.length > 0) {
              alternativeSlots = alternativeSlots.concat(daySlots.slice(0, 3));
            }
            if (alternativeSlots.length >= 5) break;
          }
        } else if (time_preference === 'morning') {
          for (let i = 0; i <= 7; i++) {
            const checkDate = moment().add(i, 'days').format('YYYY-MM-DD');
            const daySlots = await bookingUtils.getAvailableSlots(checkDate);
            const morningSlots = daySlots.filter(slot => {
              const hour = moment(slot.start).hour();
              return hour >= 8 && hour < 12;
            });
            if (morningSlots.length > 0) {
              alternativeSlots = alternativeSlots.concat(morningSlots.slice(0, 3));
            }
            if (alternativeSlots.length >= 5) break;
          }
        } else if (time_preference === 'afternoon') {
          for (let i = 0; i <= 7; i++) {
            const checkDate = moment().add(i, 'days').format('YYYY-MM-DD');
            const daySlots = await bookingUtils.getAvailableSlots(checkDate);
            const afternoonSlots = daySlots.filter(slot => {
              const hour = moment(slot.start).hour();
              return hour >= 12 && hour <= 17;
            });
            if (afternoonSlots.length > 0) {
              alternativeSlots = alternativeSlots.concat(afternoonSlots.slice(0, 3));
            }
            if (alternativeSlots.length >= 5) break;
          }
        }

        if (alternativeSlots.length === 0) {
          return res.status(404).json({
            success: false,
            type: 'booking',
            message: 'Nenašli sa žiadne alternatívne termíny podľa vašich preferencií'
          });
        }

        return res.json({
          success: true,
          type: 'booking',
          action: 'find_alternative',
          alternativeSlots: alternativeSlots.map(slot => ({
            ...slot,
            dateFormatted: moment(slot.start).tz('Europe/Bratislava').format('DD.MM.YYYY'),
            startFormatted: moment(slot.start).tz('Europe/Bratislava').format('HH:mm')
          })),
          totalSlots: alternativeSlots.length,
          message: `Našiel som ${alternativeSlots.length} alternatívnych termínov`
        });
      }

      case 'book': {
        let startTime;
        let endTime;

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
          serviceType: normalizedService,
          startTime,
          endTime,
          notes: reason,
          summary: `Servis - ${customer_name} (${normalizedService})`
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
            serviceType: normalizedService
          }
        });
      }

      default:
        return res.status(400).json({
          success: false,
          type: 'booking',
          error: `Neznáma akcia "${action}"`
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
