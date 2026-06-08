async function test(weekOffset) {
  console.log(`\n--- Testing weekOffset: ${weekOffset} ---`);
  try {
    const res = await fetch('https://script.google.com/macros/s/AKfycbyGDo0LAUjH5L7DJQeKB17tJ8x_wD0dwC6GSJCDf5hNPHCBnBzJ4k7PWKBHhhuiiSUBKA/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/api/v1/reports',
        method: 'POST',
        action: 'getScheduleForWeek',
        loginEmail: 'admin@gmail.com',
        data: { weekOffset: weekOffset, options: {} },
      })
    });

    const data = await res.json();
    console.log('Success:', data.success);
    if (!data.success) {
      console.log('Error message:', data.message);
    } else {
      console.log('Dates:', data.data.dates);
      console.log('Schedule size:', data.data.schedule.length);
      if (data.data.schedule.length > 0) {
        console.log('Sample schedule item days keys:', Object.keys(data.data.schedule[0].days || {}));
        console.log('Sample schedule item first day details:', JSON.stringify(data.data.schedule[0].days[Object.keys(data.data.schedule[0].days)[0]], null, 2));
      }
    }
  } catch (e) {
    console.error('Fetch Error:', e.message);
  }
}

async function run() {
  await test(0);
  await test(-42); // August 2025 approx
}

run();
