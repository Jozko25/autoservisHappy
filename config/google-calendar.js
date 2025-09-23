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
      // Check if Google Calendar credentials are available
      const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
                      path.join(__dirname, '..', 'google-credentials.json');

      // Check if credentials exist
      const fs = require('fs');
      if (!fs.existsSync(keyPath)) {
        throw new Error(`Google Calendar credentials not found at: ${keyPath}. Please add google-credentials.json file or set GOOGLE_SERVICE_ACCOUNT_KEY_PATH environment variable.`);
      }

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