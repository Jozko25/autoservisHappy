const { google } = require('googleapis');
const path = require('path');

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.serviceAccountEmail = null;
  }

  async initialize() {
    try {
      const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
                      path.join(__dirname, '..', 'google-credentials.json');

      const auth = new google.auth.GoogleAuth({
        keyFile: keyPath,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly'
        ],
      });

      const authClient = await auth.getClient();

      // Get service account email for calendar sharing
      if (authClient.email) {
        this.serviceAccountEmail = authClient.email;
        console.log('Service account email:', this.serviceAccountEmail);
      }

      google.options({ auth: authClient });
      this.calendar = google.calendar('v3');

      console.log('Google Calendar API initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Calendar API:', error.message);
      throw error;
    }
  }

  getCalendar() {
    if (!this.calendar) {
      throw new Error('Google Calendar API not initialized. Call initialize() first.');
    }
    return this.calendar;
  }

  getCalendarId() {
    return this.calendarId;
  }

  getServiceAccountEmail() {
    return this.serviceAccountEmail;
  }
}

module.exports = new GoogleCalendarService();