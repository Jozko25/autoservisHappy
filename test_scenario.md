# Test Scenarios for Flexible Appointment Scheduling

## Scenario 1: Customer Requests Later Time Same Day
**Input:**
- Customer: "Chcem sa objednať"
- System: Offers 8:00 AM appointment
- Customer: "Niečo neskôršie nemáte?" or "Máte popoludní?"

**Expected System Response:**
- Uses tool with `booking_action: "find_alternative"` and `time_preference: "later_same_day"`
- Presents multiple time options (e.g., 10:00, 14:00, 16:00)
- Allows customer to select preferred time
- Confirms booking with selected time

## Scenario 2: Customer Requests Different Day
**Input:**
- Customer: "Chcem sa objednať"
- System: Offers tomorrow 8:00 AM
- Customer: "Čo iný deň?" or "Máte niečo na budúci týždeň?"

**Expected System Response:**
- Uses tool with `booking_action: "find_alternative"` and `time_preference: "different_day"`
- Presents options from different days
- Allows selection and confirms

## Scenario 3: Customer Requests Morning Slots
**Input:**
- Customer: "Chcem sa objednať"
- System: Offers afternoon slot
- Customer: "Radšej ráno" or "Máte dopoludnia?"

**Expected System Response:**
- Uses tool with `booking_action: "find_alternative"` and `time_preference: "morning"`
- Presents morning slots (8:00-12:00)
- Confirms selected morning slot

## Scenario 4: Customer Requests Afternoon Slots
**Input:**
- Customer: "Chcem sa objednať"
- System: Offers morning slot
- Customer: "Potrebujem popoludní" or "Po obede"

**Expected System Response:**
- Uses tool with `booking_action: "find_alternative"` and `time_preference: "afternoon"`
- Presents afternoon slots (13:00-17:00)
- Confirms selected afternoon slot

## Key Implementation Points:
1. ✅ System now recognizes requests for alternative times
2. ✅ Uses `find_alternative` action with appropriate `time_preference`
3. ✅ Presents multiple options to customer
4. ✅ Always requires final `book` action to confirm reservation
5. ✅ Supports four preference types: later_same_day, different_day, morning, afternoon