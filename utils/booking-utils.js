const moment = require('moment-timezone');
const googleCalendar = require('../config/google-calendar');

const TIMEZONE = 'Europe/Bratislava';
const BUSINESS_HOURS = {
  start: 8, // 8:00 AM
  end: 17,  // 5:00 PM (matches autoservis working hours)
};
const APPOINTMENT_DURATION = 60; // minutes
const BUFFER_TIME = 15; // minutes between appointments

class BookingUtils {
  /**
   * Check if a given time slot is available
   */
  async isSlotAvailable(startTime, endTime) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: calendarId }],
        },
      });

      const busy = response.data.calendars[calendarId].busy || [];
      return busy.length === 0;
    } catch (error) {
      console.error('Error checking slot availability:', error);
      throw error;
    }
  }

  /**
   * Get all busy slots for a date range
   */
  async getBusySlots(startDate, endDate) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate,
          timeMax: endDate,
          items: [{ id: calendarId }],
        },
      });

      return response.data.calendars[calendarId].busy || [];
    } catch (error) {
      console.error('Error getting busy slots:', error);
      throw error;
    }
  }

  /**
   * Get available time slots for a specific date
   */
  async getAvailableSlots(date) {
    const startOfDay = moment.tz(date, TIMEZONE)
      .hour(BUSINESS_HOURS.start)
      .minute(0)
      .second(0);

    const endOfDay = moment.tz(date, TIMEZONE)
      .hour(BUSINESS_HOURS.end)
      .minute(0)
      .second(0);

    // Check if it's a weekend (Saturday = 6, Sunday = 0)
    const dayOfWeek = startOfDay.day();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Return empty array for weekends
      return [];
    }

    const busySlots = await this.getBusySlots(
      startOfDay.toISOString(),
      endOfDay.toISOString()
    );

    const availableSlots = [];
    let currentSlot = startOfDay.clone();

    while (currentSlot.add(APPOINTMENT_DURATION, 'minutes').isBefore(endOfDay)) {
      const slotStart = currentSlot.clone().subtract(APPOINTMENT_DURATION, 'minutes');
      const slotEnd = currentSlot.clone();

      // Check if this slot conflicts with any busy periods
      const isConflict = busySlots.some(busy => {
        const busyStart = moment(busy.start);
        const busyEnd = moment(busy.end);
        return (slotStart.isBefore(busyEnd) && slotEnd.isAfter(busyStart));
      });

      if (!isConflict) {
        availableSlots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          startFormatted: slotStart.format('HH:mm'),
          endFormatted: slotEnd.format('HH:mm'),
        });
      }

      // Add buffer time
      currentSlot.add(BUFFER_TIME, 'minutes');
    }

    return availableSlots;
  }

  /**
   * Find the next available slot from now
   */
  async findNextAvailableSlot(daysToSearch = 14) {
    const now = moment.tz(TIMEZONE);

    for (let i = 0; i < daysToSearch; i++) {
      const searchDate = now.clone().add(i, 'days').format('YYYY-MM-DD');
      const availableSlots = await this.getAvailableSlots(searchDate);

      // Filter out slots that are in the past (for today)
      const validSlots = availableSlots.filter(slot => {
        return moment(slot.start).isAfter(now);
      });

      if (validSlots.length > 0) {
        return {
          date: searchDate,
          slot: validSlots[0],
          allSlots: validSlots
        };
      }
    }

    return null;
  }

  /**
   * Create a calendar event
   */
  async createAppointment(appointmentData) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      const event = {
        summary: appointmentData.summary || `Servis - ${appointmentData.customerName}`,
        description: this.formatDescription(appointmentData),
        start: {
          dateTime: appointmentData.startTime,
          timeZone: TIMEZONE,
        },
        end: {
          dateTime: appointmentData.endTime,
          timeZone: TIMEZONE,
        },
        // Note: Service accounts cannot invite attendees without domain-wide delegation
        // Customer email is stored in description instead
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 },       // 1 hour before
          ],
        },
        extendedProperties: {
          private: {
            customerPhone: appointmentData.customerPhone,
            serviceType: appointmentData.serviceType,
            vehicleInfo: appointmentData.vehicleInfo || '',
          }
        }
      };

      const response = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: event,
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        start: response.data.start,
        end: response.data.end,
      };
    } catch (error) {
      if (error.code === 409) {
        throw new Error('Tento termín už bol medzičasom obsadený. Prosím, vyberte iný termín.');
      }
      console.error('Error creating appointment:', error);
      throw error;
    }
  }

  /**
   * Cancel an appointment
   */
  async cancelAppointment(eventId) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      await calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
      });

      return { success: true, message: 'Rezervácia bola úspešne zrušená' };
    } catch (error) {
      if (error.code === 404) {
        throw new Error('Rezervácia nebola nájdená');
      }
      console.error('Error canceling appointment:', error);
      throw error;
    }
  }

  /**
   * Update an appointment
   */
  async updateAppointment(eventId, updates) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      // Get existing event
      const existing = await calendar.events.get({
        calendarId: calendarId,
        eventId: eventId,
      });

      // Merge updates
      const updatedEvent = {
        ...existing.data,
        ...updates,
      };

      const response = await calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        requestBody: updatedEvent,
      });

      return {
        success: true,
        event: response.data,
      };
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  }

  /**
   * Get appointments for a date range
   */
  async getAppointments(startDate, endDate) {
    try {
      const calendar = googleCalendar.getCalendar();
      const calendarId = googleCalendar.getCalendarId();

      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: startDate,
        timeMax: endDate,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error getting appointments:', error);
      throw error;
    }
  }

  /**
   * Format appointment description
   */
  formatDescription(data) {
    const lines = [
      `Zákazník: ${data.customerName}`,
      `Telefón: ${data.customerPhone}`,
    ];

    if (data.customerEmail) {
      lines.push(`Email: ${data.customerEmail}`);
    }

    if (data.serviceType) {
      lines.push(`Typ servisu: ${data.serviceType}`);
    }

    if (data.vehicleInfo) {
      lines.push(`Vozidlo: ${data.vehicleInfo}`);
    }

    if (data.notes) {
      lines.push(`Poznámky: ${data.notes}`);
    }

    return lines.join('\n');
  }

  /**
   * Validate appointment time
   */
  validateAppointmentTime(startTime) {
    const appointmentTime = moment.tz(startTime, TIMEZONE);
    const dayOfWeek = appointmentTime.day();
    const hour = appointmentTime.hour();
    const minute = appointmentTime.minute();

    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error('Rezervácie sú možné iba v pracovné dni (pondelok - piatok)');
    }

    // Check if it's within business hours
    if (hour < BUSINESS_HOURS.start ||
        (hour === BUSINESS_HOURS.end && minute > 0) ||
        hour > BUSINESS_HOURS.end) {
      throw new Error(`Rezervácie sú možné iba medzi ${BUSINESS_HOURS.start}:00 a ${BUSINESS_HOURS.end}:00`);
    }

    // Check if it's not in the past
    if (appointmentTime.isBefore(moment.tz(TIMEZONE))) {
      throw new Error('Nie je možné rezervovať termín v minulosti');
    }

    return true;
  }
}

module.exports = new BookingUtils();