const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const bookingUtils = require('../utils/booking-utils');
const twilio = require('../config/twilio');

const TIMEZONE = 'Europe/Bratislava';

/**
 * POST /booking/appointment
 * Create a new appointment or check availability (for ElevenLabs integration)
 */
router.post('/appointment', async (req, res) => {
  try {
    // Check if Google Calendar is initialized
    try {
      googleCalendar.getCalendar();
    } catch (calendarError) {
      return res.status(503).json({
        success: false,
        error: 'Google Calendar service nedostupný. Prosím kontaktujte nás priamo.',
        fallback: {
          phone: '+421910223761',
          message: 'Zavolajte nám priamo pre rezerváciu termínu'
        }
      });
    }

    const {
      action,
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      vehicleInfo,
      preferredDate,
      preferredTime,
      duration = 60,
      notes
    } = req.body;

    // Handle different actions for ElevenLabs integration
    if (action === 'check_availability' && preferredDate) {
      // Check specific date availability
      const slots = await bookingUtils.getAvailableSlots(preferredDate);
      return res.json({
        success: true,
        action: 'check_availability',
        date: preferredDate,
        availableSlots: slots,
        totalSlots: slots.length,
        message: slots.length > 0 ?
          `Mám ${slots.length} voľných termínov na ${preferredDate}` :
          `Žiaľ, na ${preferredDate} nemám voľný termín`
      });
    }

    if (action === 'find_next_available') {
      // Find next available slot
      const nextSlot = await bookingUtils.findNextAvailableSlot();
      if (!nextSlot) {
        return res.status(404).json({
          success: false,
          action: 'find_next_available',
          message: 'Nenašiel sa žiadny voľný termín v najbližších 14 dňoch'
        });
      }

      const slotTime = moment(nextSlot.slot.start).tz(TIMEZONE);
      return res.json({
        success: true,
        action: 'find_next_available',
        date: nextSlot.date,
        time: slotTime.format('HH:mm'),
        slot: nextSlot.slot,
        message: `Najbližší voľný termín mám ${slotTime.format('DD.MM.YYYY')} o ${slotTime.format('HH:mm')}`
      });
    }

    // Default action is 'book' - continue with original booking logic
    // Validate required fields for booking
    if ((!action || action === 'book') && (!customerName || !customerPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Meno zákazníka a telefónne číslo sú povinné'
      });
    }

    let startTime, endTime;

    // If no preferred date/time, find next available slot
    if (!preferredDate || !preferredTime) {
      const nextSlot = await bookingUtils.findNextAvailableSlot();
      if (!nextSlot) {
        return res.status(404).json({
          success: false,
          error: 'Nenašiel sa žiadny voľný termín v najbližších 14 dňoch'
        });
      }
      startTime = nextSlot.slot.start;
      endTime = nextSlot.slot.end;
    } else {
      // Use preferred date and time
      startTime = moment.tz(`${preferredDate} ${preferredTime}`, 'YYYY-MM-DD HH:mm', TIMEZONE).toISOString();
      endTime = moment(startTime).add(duration, 'minutes').toISOString();

      // Validate appointment time
      bookingUtils.validateAppointmentTime(startTime);

      // Check if slot is available
      const isAvailable = await bookingUtils.isSlotAvailable(startTime, endTime);
      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          error: 'Tento termín je už obsadený. Prosím, vyberte iný termín.'
        });
      }
    }

    // Create appointment
    const appointment = await bookingUtils.createAppointment({
      customerName,
      customerPhone,
      customerEmail,
      serviceType,
      vehicleInfo,
      startTime,
      endTime,
      notes,
      summary: `Servis - ${customerName} (${serviceType || 'Všeobecný'})`
    });

    // SMS disabled for bookings - only Google Calendar notifications
    console.log('Booking created successfully without SMS notifications');

    res.status(201).json({
      success: true,
      message: 'Rezervácia bola úspešne vytvorená',
      appointment: {
        id: appointment.eventId,
        customerName,
        customerPhone,
        start: startTime,
        end: endTime,
        startFormatted: appointmentTime.format('DD.MM.YYYY HH:mm'),
        serviceType,
        vehicleInfo
      }
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Nepodarilo sa vytvoriť rezerváciu'
    });
  }
});

/**
 * DELETE /booking/appointment/:id
 * Cancel an appointment
 */
router.delete('/appointment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { customerPhone, reason } = req.body;

    const result = await bookingUtils.cancelAppointment(id);

    // SMS disabled for booking cancellations - only Google Calendar notifications
    console.log('Booking cancelled successfully without SMS notifications');

    res.json({
      success: true,
      message: result.message,
      appointmentId: id
    });
  } catch (error) {
    console.error('Error canceling appointment:', error);
    res.status(error.message.includes('nájdená') ? 404 : 500).json({
      success: false,
      error: error.message || 'Nepodarilo sa zrušiť rezerváciu'
    });
  }
});

/**
 * GET /booking/availability
 * Get available slots for a specific date or range
 */
router.get('/availability', async (req, res) => {
  try {
    const { date, days = 7 } = req.query;

    if (date) {
      // Get slots for specific date
      const slots = await bookingUtils.getAvailableSlots(date);
      res.json({
        success: true,
        date,
        availableSlots: slots,
        totalSlots: slots.length
      });
    } else {
      // Get next available slot
      const nextAvailable = await bookingUtils.findNextAvailableSlot(parseInt(days));
      if (!nextAvailable) {
        return res.status(404).json({
          success: false,
          message: `Nenašiel sa žiadny voľný termín v najbližších ${days} dňoch`
        });
      }

      res.json({
        success: true,
        nextAvailable: {
          date: nextAvailable.date,
          slot: nextAvailable.slot,
          allSlotsForDay: nextAvailable.allSlots
        }
      });
    }
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Nepodarilo sa skontrolovať dostupnosť'
    });
  }
});

/**
 * GET /booking/appointments
 * Get appointments for a date range
 */
router.get('/appointments', async (req, res) => {
  try {
    const { startDate, endDate, customerPhone } = req.query;

    const start = startDate ?
      moment.tz(startDate, TIMEZONE).startOf('day').toISOString() :
      moment.tz(TIMEZONE).startOf('day').toISOString();

    const end = endDate ?
      moment.tz(endDate, TIMEZONE).endOf('day').toISOString() :
      moment.tz(TIMEZONE).add(30, 'days').endOf('day').toISOString();

    let appointments = await bookingUtils.getAppointments(start, end);

    // Filter by customer phone if provided
    if (customerPhone) {
      appointments = appointments.filter(apt =>
        apt.extendedProperties?.private?.customerPhone === customerPhone
      );
    }

    // Format appointments for response
    const formattedAppointments = appointments.map(apt => ({
      id: apt.id,
      summary: apt.summary,
      start: apt.start.dateTime || apt.start.date,
      end: apt.end.dateTime || apt.end.date,
      startFormatted: moment(apt.start.dateTime || apt.start.date)
        .tz(TIMEZONE).format('DD.MM.YYYY HH:mm'),
      customerPhone: apt.extendedProperties?.private?.customerPhone,
      serviceType: apt.extendedProperties?.private?.serviceType,
      vehicleInfo: apt.extendedProperties?.private?.vehicleInfo,
      status: apt.status
    }));

    res.json({
      success: true,
      appointments: formattedAppointments,
      total: formattedAppointments.length,
      dateRange: {
        start: moment(start).tz(TIMEZONE).format('DD.MM.YYYY'),
        end: moment(end).tz(TIMEZONE).format('DD.MM.YYYY')
      }
    });
  } catch (error) {
    console.error('Error getting appointments:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Nepodarilo sa načítať rezervácie'
    });
  }
});

/**
 * PUT /booking/appointment/:id
 * Update an appointment
 */
router.put('/appointment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If changing time, validate and check availability
    if (updates.startTime) {
      bookingUtils.validateAppointmentTime(updates.startTime);

      const endTime = updates.endTime ||
        moment(updates.startTime).add(60, 'minutes').toISOString();

      const isAvailable = await bookingUtils.isSlotAvailable(
        updates.startTime,
        endTime
      );

      if (!isAvailable) {
        return res.status(409).json({
          success: false,
          error: 'Nový termín je už obsadený'
        });
      }

      updates.start = { dateTime: updates.startTime, timeZone: TIMEZONE };
      updates.end = { dateTime: endTime, timeZone: TIMEZONE };
      delete updates.startTime;
      delete updates.endTime;
    }

    const result = await bookingUtils.updateAppointment(id, updates);

    res.json({
      success: true,
      message: 'Rezervácia bola úspešne aktualizovaná',
      appointment: result.event
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Nepodarilo sa aktualizovať rezerváciu'
    });
  }
});

/**
 * POST /booking/check-slot
 * Check if a specific time slot is available
 */
router.post('/check-slot', async (req, res) => {
  try {
    const { date, time, duration = 60 } = req.body;

    if (!date || !time) {
      return res.status(400).json({
        success: false,
        error: 'Dátum a čas sú povinné'
      });
    }

    const startTime = moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', TIMEZONE).toISOString();
    const endTime = moment(startTime).add(duration, 'minutes').toISOString();

    // Validate time
    try {
      bookingUtils.validateAppointmentTime(startTime);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        available: false,
        reason: validationError.message
      });
    }

    const isAvailable = await bookingUtils.isSlotAvailable(startTime, endTime);

    res.json({
      success: true,
      available: isAvailable,
      slot: {
        start: startTime,
        end: endTime,
        startFormatted: moment(startTime).tz(TIMEZONE).format('DD.MM.YYYY HH:mm'),
        endFormatted: moment(endTime).tz(TIMEZONE).format('HH:mm')
      }
    });
  } catch (error) {
    console.error('Error checking slot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Nepodarilo sa skontrolovať termín'
    });
  }
});

module.exports = router;