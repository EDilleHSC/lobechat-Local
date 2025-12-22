const http = require('http');

const data = JSON.stringify({
  decisions: [{
    filename: 'test_file2.txt',
    original_route: 'UNKNOWN',
    final_route: 'INTAKE',
    confidence: 67,
    timestamp: new Date().toISOString()
  }]
});

const options = {
  hostname: 'localhost',
  port: 8005,
  path: '/clear_exceptions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Sending POST to /clear_exceptions...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
  process.exit(1);
});

req.write(data);
req.end();