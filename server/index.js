import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 10e6, // 10 MB for image sharing
});

// ─── Helpers ────────────────────────────────────────────────────────
function uid() {
  return crypto.randomBytes(8).toString('hex');
}

// ─── In-Memory Store ────────────────────────────────────────────────
const rooms = new Map();

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ─── Room helpers ───────────────────────────────────────────────────
function generateRoomCode() {
  // 6-char uppercase alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function getOrCreateRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, {
      messages: [],
      users: new Map(),
      lastActivity: Date.now(),
      inactivityTimer: null,
    });
  }
  return rooms.get(code);
}

function resetInactivityTimer(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.lastActivity = Date.now();

  if (room.inactivityTimer) {
    clearTimeout(room.inactivityTimer);
  }

  room.inactivityTimer = setTimeout(() => {
    if (room) {
      room.messages = [];
      io.to(roomCode).emit('messages:cleared', {
        reason: 'Messages deleted after 5 minutes of inactivity',
      });
    }
    if (room && room.users.size === 0) {
      rooms.delete(roomCode);
    }
  }, INACTIVITY_TIMEOUT);
}

function getUserList(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  return Array.from(room.users.values());
}

// ─── REST endpoints ─────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/rooms/create', (_req, res) => {
  const code = generateRoomCode();
  getOrCreateRoom(code);
  resetInactivityTimer(code);
  res.json({ roomCode: code });
});

app.post('/rooms/check', (req, res) => {
  const { roomCode } = req.body;
  if (!roomCode) return res.status(400).json({ error: 'roomCode required' });
  const exists = rooms.has(roomCode.toUpperCase());
  res.json({ exists, roomCode: roomCode.toUpperCase() });
});

// ─── Socket.IO ──────────────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('room:join', ({ roomCode, userName }, callback) => {
    const code = roomCode.toUpperCase();
    const room = getOrCreateRoom(code);

    currentRoom = code;
    currentUser = {
      id: socket.id,
      name: userName || `User-${socket.id.slice(0, 4)}`,
      joinedAt: Date.now(),
    };

    room.users.set(socket.id, currentUser);
    socket.join(code);
    resetInactivityTimer(code);

    if (typeof callback === 'function') {
      callback({
        success: true,
        messages: room.messages,
        users: getUserList(code),
      });
    }

    io.to(code).emit('users:update', getUserList(code));

    const sysMsg = {
      id: uid(),
      sender: 'system',
      senderName: 'System',
      type: 'system',
      content: `${currentUser.name} joined the room`,
      timestamp: Date.now(),
    };
    room.messages.push(sysMsg);
    io.to(code).emit('message:new', sysMsg);
  });

  socket.on('message:send', ({ content }) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const msg = {
      id: uid(),
      sender: socket.id,
      senderName: currentUser.name,
      type: 'text',
      content,
      timestamp: Date.now(),
    };

    room.messages.push(msg);
    io.to(currentRoom).emit('message:new', msg);
    resetInactivityTimer(currentRoom);
  });

  socket.on('message:image', ({ dataUrl, fileName }) => {
    if (!currentRoom || !currentUser) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const msg = {
      id: uid(),
      sender: socket.id,
      senderName: currentUser.name,
      type: 'image',
      content: dataUrl,
      fileName: fileName || 'image',
      timestamp: Date.now(),
    };

    room.messages.push(msg);
    io.to(currentRoom).emit('message:new', msg);
    resetInactivityTimer(currentRoom);
  });

  socket.on('typing:start', () => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit('typing:update', {
      userId: socket.id,
      userName: currentUser.name,
      isTyping: true,
    });
  });

  socket.on('typing:stop', () => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit('typing:update', {
      userId: socket.id,
      userName: currentUser.name,
      isTyping: false,
    });
  });

  // WebRTC Signaling
  socket.on('call:initiate', ({ to, offer, callType }) => {
    io.to(to).emit('call:incoming', {
      from: socket.id,
      fromName: currentUser?.name,
      offer,
      callType,
    });
  });

  socket.on('call:answer', ({ to, answer }) => {
    io.to(to).emit('call:answered', { from: socket.id, answer });
  });

  socket.on('call:ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('call:ice-candidate', { from: socket.id, candidate });
  });

  socket.on('call:end', ({ to }) => {
    io.to(to).emit('call:ended', { from: socket.id });
  });

  socket.on('call:reject', ({ to }) => {
    io.to(to).emit('call:rejected', { from: socket.id });
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.users.delete(socket.id);
    io.to(currentRoom).emit('users:update', getUserList(currentRoom));

    if (currentUser) {
      const sysMsg = {
        id: uid(),
        sender: 'system',
        senderName: 'System',
        type: 'system',
        content: `${currentUser.name} left the room`,
        timestamp: Date.now(),
      };
      room.messages.push(sysMsg);
      io.to(currentRoom).emit('message:new', sysMsg);
    }

    socket.to(currentRoom).emit('typing:update', {
      userId: socket.id,
      userName: currentUser?.name,
      isTyping: false,
    });

    resetInactivityTimer(currentRoom);
    currentRoom = null;
    currentUser = null;
  });
});

// ─── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Ephemeral Chat server running on port ${PORT}`);
});
