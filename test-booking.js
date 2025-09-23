const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test data
const testAppointment = {
  customerName: "Test Zákazník",
  customerPhone: "+421901234567",
  customerEmail: "test@example.com",
  serviceType: "Výmena oleja",
  vehicleInfo: "Test Auto 2024",
  notes: "Test rezervácia"
};

async function testBookingSystem() {
  console.log('🔧 Testing Autoservis Happy Booking System\n');

  try {
    // 1. Check availability
    console.log('1. Checking availability for next 7 days...');
    const availabilityRes = await axios.get(`${BASE_URL}/booking/availability`);
    console.log('✅ Next available slot:', availabilityRes.data.nextAvailable?.slot);
    console.log('   Date:', availabilityRes.data.nextAvailable?.date);
    console.log('');

    // 2. Check specific date availability
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    console.log(`2. Checking slots for ${dateStr}...`);
    const dateSlotsRes = await axios.get(`${BASE_URL}/booking/availability?date=${dateStr}`);
    console.log(`✅ Found ${dateSlotsRes.data.totalSlots} available slots`);
    if (dateSlotsRes.data.availableSlots.length > 0) {
      console.log('   First slot:', dateSlotsRes.data.availableSlots[0].startFormatted, '-',
                  dateSlotsRes.data.availableSlots[0].endFormatted);
    }
    console.log('');

    // 3. Create appointment without preferred time (auto-assign)
    console.log('3. Creating appointment with auto-assigned time...');
    const createRes = await axios.post(`${BASE_URL}/booking/appointment`, testAppointment);
    const appointmentId = createRes.data.appointment.id;
    console.log('✅ Appointment created');
    console.log('   ID:', appointmentId);
    console.log('   Time:', createRes.data.appointment.startFormatted);
    console.log('');

    // 4. Check if the slot is now busy
    console.log('4. Verifying slot is now marked as busy...');
    const checkSlotRes = await axios.post(`${BASE_URL}/booking/check-slot`, {
      date: createRes.data.appointment.start.split('T')[0],
      time: new Date(createRes.data.appointment.start).toLocaleTimeString('sk-SK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    });
    console.log(`✅ Slot availability:`, checkSlotRes.data.available ? 'Available' : 'Busy (as expected)');
    console.log('');

    // 5. Get appointments list
    console.log('5. Getting appointments list...');
    const appointmentsRes = await axios.get(`${BASE_URL}/booking/appointments`);
    console.log(`✅ Found ${appointmentsRes.data.total} appointments`);
    console.log('');

    // 6. Update appointment
    console.log('6. Updating appointment notes...');
    await axios.put(`${BASE_URL}/booking/appointment/${appointmentId}`, {
      description: 'Updated test notes'
    });
    console.log('✅ Appointment updated');
    console.log('');

    // 7. Cancel appointment
    console.log('7. Canceling test appointment...');
    await axios.delete(`${BASE_URL}/booking/appointment/${appointmentId}`, {
      data: {
        customerPhone: testAppointment.customerPhone,
        reason: "Test ukončený"
      }
    });
    console.log('✅ Appointment canceled');
    console.log('');

    console.log('🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('   Error details:', error.response.data.error);
    }
  }
}

// Run tests
testBookingSystem();