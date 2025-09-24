# Autoservis Happy - Booking & SMS System

Complete booking and SMS notification system for Autoservis Happy with Google Calendar integration and ElevenLabs voice assistant support.

## 🚀 Production URL
- **Server**: https://autoservishappy-production.up.railway.app
- **Health Check**: https://autoservishappy-production.up.railway.app/health

## 📋 API Endpoints

### Booking System
- `POST /booking/appointment` - Create/check appointments
- `GET /booking/availability` - Check available slots
- `DELETE /booking/appointment/:id` - Cancel appointment
- `PUT /booking/appointment/:id` - Update appointment

### SMS Webhooks
- `POST /webhook/sms` - Send SMS notifications
- `POST /webhook/human-request` - Human contact requests

## 🔧 ElevenLabs Integration

### Configuration Files
- `elevenlabs-config-complete.json` - Complete agent configuration
- `elevenlabs-prompt-complete.txt` - Voice assistant prompt
- `elevenlabs-tools-only.json` - Webhook tools only

### Webhook Tools
1. **rezervacia-terminu** - Booking management
2. **poziadat-o-ludsky-kontakt** - Human contact requests

## 🏢 Business Rules
- **Working Hours**: Monday-Friday 8:00-17:00
- **Appointment Duration**: 60 minutes standard
- **Buffer Time**: 15 minutes between appointments
- **Languages**: Slovak only
- **Time Zone**: Europe/Bratislava

## 💾 Tech Stack
- Node.js + Express
- Google Calendar API v3
- Twilio SMS API
- Railway deployment
- Moment.js for timezone handling