# Autoservis Happy - SMS Webhook

Webhook listener that sends SMS messages via Twilio from US numbers to Slovak phone numbers.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your Twilio credentials:
- `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER`: Your US Twilio phone number (e.g., +15551234567)
- `PORT`: Server port (default: 3000)

## Usage

Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## API Endpoints

### POST /webhook/sms
Send SMS to Slovak phone number.

**Request body:**
```json
{
  "to": "+421901234567",
  "message": "Your message text"
}
```

**Response:**
```json
{
  "success": true,
  "messageSid": "SM...",
  "to": "+421901234567",
  "message": "Your message text"
}
```

### GET /health
Health check endpoint.

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set the following environment variables in Railway:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

Railway will automatically deploy using the `railway.json` configuration.

## Example Usage

```bash
curl -X POST http://localhost:3000/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+421901234567",
    "message": "Hello from autoservis!"
  }'
```