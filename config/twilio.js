const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.autoservisPhone = process.env.AUTOSERVIS_PHONE_NUMBER || '+421910223761';

    try {
      const accountSid = process.env.TWILIO_ACTUAL_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;

      if (accountSid && authToken) {
        this.client = twilio(accountSid, authToken);
        console.log('Twilio client initialized for booking service');
      }
    } catch (error) {
      console.error('Failed to initialize Twilio:', error.message);
    }
  }

  async sendSMS(to, message) {
    if (!this.client) {
      console.warn('SMS not sent - Twilio not configured');
      return null;
    }

    try {
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });
      return response;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  async sendNotification(message) {
    return this.sendSMS(this.autoservisPhone, message);
  }
}

module.exports = new TwilioService();