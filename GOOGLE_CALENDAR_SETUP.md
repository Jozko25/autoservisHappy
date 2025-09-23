# Google Calendar API Setup Guide

This guide will walk you through setting up Google Calendar API for the Autoservis Happy booking system.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: "Autoservis Happy"
4. Click "Create"

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "Service account"
3. Fill in:
   - Service account name: `autoservis-happy-calendar`
   - Service account ID: (auto-generated)
   - Description: "Service account for calendar bookings"
4. Click "Create and Continue"
5. Skip the optional steps (roles and users)
6. Click "Done"

## Step 4: Generate Service Account Key

1. In the Credentials page, find your service account
2. Click on the service account email
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Choose "JSON" format
6. Click "Create"
7. Save the downloaded JSON file as `google-credentials.json` in your project root

## Step 5: Share Calendar with Service Account

1. Open Google Calendar in your browser
2. Find the calendar you want to use (or create a new one)
3. Click the three dots next to the calendar → "Settings and sharing"
4. In "Share with specific people", click "Add people"
5. Enter the service account email (found in your JSON file, looks like: `autoservis-happy-calendar@your-project.iam.gserviceaccount.com`)
6. Set permission to "Make changes to events"
7. Click "Send"

## Step 6: Get Calendar ID (Optional)

If you're not using the primary calendar:

1. In Google Calendar settings for your calendar
2. Find "Calendar ID" in the "Integrate calendar" section
3. Copy this ID and set it in your `.env` file as `GOOGLE_CALENDAR_ID`

## Step 7: Configure Environment

Add to your `.env` file:

```env
# Google Calendar Configuration
GOOGLE_CALENDAR_ID=primary
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-credentials.json
```

## Testing the Setup

After completing the setup:

1. Start your server: `npm run dev`
2. Check the console for "Google Calendar API initialized successfully"
3. Run the test script: `node test-booking.js`

## Troubleshooting

### "Calendar not found" error
- Make sure you've shared the calendar with the service account email
- Verify the GOOGLE_CALENDAR_ID is correct

### "Insufficient permissions" error
- Ensure the service account has "Make changes to events" permission
- Check that the API is enabled in Google Cloud Console

### "Invalid grant" error
- Your service account key might be invalid
- Generate a new key from Google Cloud Console

## Security Notes

1. **Never commit** the `google-credentials.json` file to version control
2. Add it to `.gitignore`
3. In production, use environment variables or secure key management services
4. Regularly rotate service account keys
5. Use least privilege principle - only grant necessary permissions

## Rate Limits

Google Calendar API has the following limits:
- 1,000,000 queries per day
- 500 queries per 100 seconds per user
- 50 requests per second

For a typical auto service, these limits should be more than sufficient.