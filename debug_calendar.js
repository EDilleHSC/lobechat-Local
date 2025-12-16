const fs = require('fs');
const path = require('path');

const CALENDAR_FILE = 'D:\\05_AGENTS-AI\\01_PRODUCTION\\MONEY_PENNY\\memory\\schedule.json';

console.log("📂 Reading file from:", CALENDAR_FILE);

try {
    if (fs.existsSync(CALENDAR_FILE)) {
        const data = fs.readFileSync(CALENDAR_FILE, 'utf8');
        const CALENDAR = JSON.parse(data);
        console.log(`✅ Loaded ${CALENDAR.length} appointments.`);
        
        // Simulate the check_calendar tool logic without a date
        let appointments = CALENDAR;
        appointments.sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));
        
        console.log("\n📅 Calendar Output:");
        console.log(JSON.stringify(appointments, null, 2));
    } else {
        console.log('❌ File not found!');
    }
} catch (error) {
    console.error('❌ Error:', error);
}