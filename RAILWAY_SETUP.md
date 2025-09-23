# Railway Deployment Setup Guide

## Environment Variables Required

Set these environment variables in your Railway project settings:

### Twilio Configuration (Required for SMS)
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
AUTOSERVIS_PHONE_NUMBER=+421910223761
```

### Google Calendar Configuration (Optional - for booking features)
```
GOOGLE_CALENDAR_ID=primary
```

### Google Service Account Credentials

**Option 1: Upload JSON file**
1. Upload your `google-credentials.json` file to Railway
2. Set environment variable:
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/app/google-credentials.json
   ```

**Option 2: Environment variable (Recommended)**
1. Copy the entire contents of your `google-credentials.json` file
2. Create environment variable:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project",...}
   ```
3. Update the code to use this variable (see below)

## Health Check Configuration

Railway health check is configured to:
- **Path**: `/health`
- **Method**: GET
- **Expected**: 200 OK status

The health endpoint returns:
```json
{
  "status": "OK",
  "timestamp": "2025-09-23T18:08:47.944Z",
  "twilioConfigured": true,
  "googleCalendarConfigured": "initialized",
  "environment": "production",
  "services": {
    "sms": "available",
    "booking": "available"
  }
}
```

## Service Behavior

### SMS Service
- **Available**: When Twilio credentials are configured
- **Fallback**: Manual phone contact if SMS fails

### Booking Service
- **Available**: When Google Calendar is properly configured
- **Fallback**: Redirects to human contact tool for manual booking
- **Error Response**: Provides phone number for direct contact

## Deployment Status

The application will start successfully even if:
- Google Calendar credentials are missing (SMS-only mode)
- Twilio credentials are missing (booking-only mode)
- Both are missing (health check endpoint still works)

## Troubleshooting

### Health Check Failures
1. Check Railway logs for startup errors
2. Verify environment variables are set correctly
3. Ensure port is not hardcoded (Railway assigns PORT automatically)

### Google Calendar Issues
- Verify service account email is shared with calendar
- Check that credentials JSON is valid
- Ensure calendar ID is correct (use 'primary' for main calendar)

### SMS Issues
- Verify Twilio account SID and auth token
- Check phone number format (+1 for US numbers)
- Ensure sufficient Twilio account balance