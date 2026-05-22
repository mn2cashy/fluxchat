const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// ─── Matchmaking Queue ──────────────────────────────────────────────────────
const waitingQueue = [];
const activeChats = new Map(); // socketId -> partnerSocketId

// ─── Health endpoint ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'fluxchat-server',
    online: io.engine.clientsCount,
    waiting: waitingQueue.length,
    chats: activeChats.size / 2,
    status: 'running',
  });
});

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ─── Socket.IO ──────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ── Search for a partner ──
  socket.on('search', ({ mode, myGender, wantGender }) => {
    console.log(`${socket.id} searching: mode=${mode}`);

    // Check if we can match with someone waiting
    const matchIdx = waitingQueue.findIndex(
      (s) => s.id !== socket.id && s.data.mode === mode
    );

    if (matchIdx !== -1 && waitingQueue.length > 0) {
      // Match found!
      const partner = waitingQueue.splice(matchIdx, 1)[0];

      // Create the chat room
      const roomId = uuidv4();
      socket.join(roomId);
      partner.socket.join(roomId);

      // Store active chat
      activeChats.set(socket.id, { partnerId: partner.id, roomId });
      activeChats.set(partner.id, { partnerId: socket.id, roomId });

      // Notify both
      socket.emit('partner-found', { partnerType: 'real', roomId });
      partner.socket.emit('partner-found', { partnerType: 'real', roomId });

      console.log(`Match: ${socket.id} <-> ${partner.id}`);
    } else {
      // No match - add to queue
      waitingQueue.push({
        id: socket.id,
        socket,
        data: { mode, myGender, wantGender },
        joinedAt: Date.now(),
      });

      // Tell the user their position
      socket.emit('waiting', { position: waitingQueue.length });
      socket.emit('matched', { queued: true });

      // If queue gets too large, match with bot
      // But since frontend handles bot fallback, this is fine
    }
  });

  // ── Stop searching ──
  socket.on('stop-search', () => {
    const idx = waitingQueue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) {
      waitingQueue.splice(idx, 1);
    }
  });

  // ── WebRTC Signaling ──
  socket.on('signal', ({ description, candidate, to }) => {
    // Relay to partner
    const chat = activeChats.get(socket.id);
    if (chat) {
      const partnerSocket = io.sockets.sockets.get(chat.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('signal', { description, candidate });
      }
    }
  });

  // ── Chat message ──
  socket.on('chat-message', ({ message }) => {
    const chat = activeChats.get(socket.id);
    if (chat) {
      const partnerSocket = io.sockets.sockets.get(chat.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('chat-message', { message, from: 'partner' });
      }
    }
  });

  // ── Typing indicator ──
  socket.on('chat:typing', ({ typing }) => {
    const chat = activeChats.get(socket.id);
    if (chat) {
      const partnerSocket = io.sockets.sockets.get(chat.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner-typing', { typing });
      }
    }
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove from waiting queue
    const idx = waitingQueue.findIndex((s) => s.id === socket.id);
    if (idx !== -1) {
      waitingQueue.splice(idx, 1);
    }

    // Notify partner in active chat
    const chat = activeChats.get(socket.id);
    if (chat) {
      const partnerSocket = io.sockets.sockets.get(chat.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('partner-left');
      }
      activeChats.delete(socket.id);
      activeChats.delete(chat.partnerId);
    }
  });
});

// ─── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`FluxChat server running on port ${PORT}`);
});
