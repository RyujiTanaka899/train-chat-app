const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', socket: 'ready' });
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
});

const PORT = 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test server running on http://0.0.0.0:${PORT}`);
  console.log(`🔌 Socket.IO ready on http://0.0.0.0:${PORT}/socket.io/`);
});