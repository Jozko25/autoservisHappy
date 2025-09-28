const { google } = require('googleapis');
const path = require('path');

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this.serviceAccountEmail = null;
    this.initializationPromise = null;
  }

  async initialize() {
    if (this.calendar) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        let auth;

        // Try environment variable first (recommended for Railway)
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
          const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
          auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: [
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar.readonly'
            ],
          });
        } else {
          // Fallback to file-based credentials
          const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ||
                          path.join(__dirname, '..', 'google-credentials.json');

          // Check if credentials exist
          const fs = require('fs');
          if (!fs.existsSync(keyPath)) {
            throw new Error('Google Calendar credentials not found. Please set GOOGLE_SERVICE_ACCOUNT_JSON environment variable or add google-credentials.json file.');
          }

          auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: [
              'https://www.googleapis.com/auth/calendar',
              'https://www.googleapis.com/auth/calendar.events',
              'https://www.googleapis.com/auth/calendar.readonly'
            ],
          });
        }

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
        this.calendar = null;
        console.error('Failed to initialize Google Calendar API:', error.message);
        throw error;
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async ensureInitialized() {
    if (this.calendar) {
      return true;
    }
    await this.initialize();
    return true;
  }

  getCalendar() {
    if (!this.calendar) {
      throw new Error('Google Calendar API not initialized. Call ensureInitialized() first.');
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
