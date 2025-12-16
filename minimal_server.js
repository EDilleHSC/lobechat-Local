const express = require('express');

console.log('🚀 Starting Minimal Server...');

const app = express();
app.use(express.json());

app.post('/mcp', (req, res) => {
  console.log('📥 Received:', req.body);

  res.status(200).json({
    ok: true,
    echo: req.body
  });
});

const server = app.listen(8003, () => {
  console.log('✅ Server listening on port 8003');
});

// Keep the process alive
// process.on('SIGINT', () => {
//   console.log('🛑 Shutting down...');
//   server.close(() => {
//     console.log('✅ Server shut down');
//     process.exit(0);
//   });
// });