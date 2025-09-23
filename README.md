# Autoservis Happy - SMS & Booking System

Complete booking and notification system for Autoservis Happy with Google Calendar integration and SMS notifications via Twilio.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

**Twilio Configuration:**
- `TWILIO_ACCOUNT_SID`: Your Twilio Account SID
- `TWILIO_AUTH_TOKEN`: Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER`: Your US Twilio phone number (e.g., +15551234567)
- `AUTOSERVIS_PHONE_NUMBER`: Slovak phone number for autoservis notifications (e.g., +421901234567)

**Google Calendar Configuration:**
- `GOOGLE_CALENDAR_ID`: The calendar ID to use (default: 'primary')
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`: Path to Google service account JSON file (default: './google-credentials.json')

**General:**
- `PORT`: Server port (default: 3000)

3. Set up Google Calendar:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Calendar API
   - Create a service account and download the JSON credentials
   - Save the credentials as `google-credentials.json` in the project root
   - Share your Google Calendar with the service account email (found in the JSON file)

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

### POST /webhook/human-request
Send SMS notification when customer requests human contact.

**Request body:**
```json
{
  "customer_name": "Ján Novák",
  "customer_phone": "+421901234567",
  "reason": "Potrebujem konzultáciu",
  "urgency": "vysoká"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Požiadavka o ľudský kontakt bola úspešne odoslaná",
  "messageSid": "SM...",
  "customer_name": "Ján Novák",
  "customer_phone": "+421901234567"
}
```

### GET /health
Health check endpoint.

## Booking API Endpoints

### POST /booking/appointment
Create a new appointment with automatic SMS notifications.

**Request body:**
```json
{
  "customerName": "Ján Novák",
  "customerPhone": "+421901234567",
  "customerEmail": "jan@example.com",
  "serviceType": "Výmena oleja",
  "vehicleInfo": "BMW 320d, 2018",
  "preferredDate": "2024-01-15",
  "preferredTime": "10:00",
  "duration": 60,
  "notes": "Potrebujem aj kontrolu bŕzd"
}
```

If no `preferredDate` and `preferredTime` are provided, the system will automatically find the next available slot.

**Response:**
```json
{
  "success": true,
  "message": "Rezervácia bola úspešne vytvorená",
  "appointment": {
    "id": "abc123",
    "customerName": "Ján Novák",
    "start": "2024-01-15T10:00:00Z",
    "startFormatted": "15.01.2024 10:00"
  }
}
```

### DELETE /booking/appointment/:id
Cancel an existing appointment.

**Request body:**
```json
{
  "customerPhone": "+421901234567",
  "reason": "Zmena plánu"
}
```

### GET /booking/availability
Check available time slots.

**Query parameters:**
- `date`: Specific date in YYYY-MM-DD format (optional)
- `days`: Number of days to search for next available slot (default: 7)

**Response:**
```json
{
  "success": true,
  "date": "2024-01-15",
  "availableSlots": [
    {
      "start": "2024-01-15T08:00:00Z",
      "end": "2024-01-15T09:00:00Z",
      "startFormatted": "08:00",
      "endFormatted": "09:00"
    }
  ]
}
```

### GET /booking/appointments
Get list of appointments.

**Query parameters:**
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format
- `customerPhone`: Filter by customer phone number

### PUT /booking/appointment/:id
Update an existing appointment.

### POST /booking/check-slot
Check if a specific time slot is available.

**Request body:**
```json
{
  "date": "2024-01-15",
  "time": "10:00",
  "duration": 60
}
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set the following environment variables in Railway:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `GOOGLE_CALENDAR_ID`
   - Upload your Google service account credentials JSON file and reference its path

Railway will automatically deploy using the `railway.json` configuration.

## Features

- **Smart Appointment Booking**: Automatically finds next available slot if no preference specified
- **Double Booking Prevention**: Uses Google Calendar free/busy API to prevent conflicts
- **Business Hours Enforcement**: Only allows bookings Monday-Friday, 8:00-17:00
- **SMS Notifications**: Sends confirmation to customers and notifications to staff
- **Flexible Scheduling**: Supports custom appointment durations and buffer times
- **Multi-language Support**: Slovak language interface with proper formatting
- **Appointment Management**: Full CRUD operations for appointments
- **Availability Checking**: Real-time availability lookup with recommendations

## Example Usage

```bash
curl -X POST http://localhost:3000/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+421901234567",
    "message": "Hello from autoservis!"
  }'
```