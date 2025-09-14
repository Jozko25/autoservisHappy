const express = require('express');
const twilio = require('twilio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const autoservisPhone = process.env.AUTOSERVIS_PHONE_NUMBER || '+421901234567';

app.post('/webhook/sms', async (req, res) => {
  try {
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
Naliehavosť: ${urgencyLevel}

Prosím kontaktujte zákazníka do 30 minút.`;

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

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Webhook server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`SMS webhook: http://localhost:${port}/webhook/sms`);
  console.log(`Human request webhook: http://localhost:${port}/webhook/human-request`);
});