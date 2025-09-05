// Simple test to verify WebSocket connectivity
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3100/ws');

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket server');
  
  // Send a test message
  ws.send(JSON.stringify({
    type: 'test',
    message: 'Hello from test client'
  }));
});

ws.on('message', function message(data) {
  console.log('📨 Received:', data.toString());
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔌 WebSocket connection closed');
});

// Close after 3 seconds
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 3000);