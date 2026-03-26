const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, config.socketIO);

app.use(cors(config.cors));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const rooms = new Map();
const users = new Map();

function log(level, message, data = {}) {
  if (config.logging.enabled) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }
}

io.on('connection', (socket) => {
  log('info', 'New client connected', { socketId: socket.id });
  users.set(socket.id, { socketId: socket.id, roomId: null });

  socket.on('create-room', (callback) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      id: roomId,
      users: [socket.id],
      createdAt: Date.now()
    });
    
    socket.join(roomId);
    const user = users.get(socket.id);
    user.roomId = roomId;
    
    log('info', 'Room created', { roomId, socketId: socket.id });
    
    if (callback) {
      callback({ success: true, roomId, iceServers: config.iceServers });
    }
  });

  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      log('warn', 'Room not found', { roomId, socketId: socket.id });
      if (callback) {
        callback({ success: false, error: 'Room not found' });
      }
      return;
    }
    
    if (room.users.length >= config.maxRoomSize) {
      log('warn', 'Room is full', { roomId, socketId: socket.id });
      if (callback) {
        callback({ success: false, error: 'Room is full' });
      }
      return;
    }
    
    socket.join(roomId);
    room.users.push(socket.id);
    const user = users.get(socket.id);
    user.roomId = roomId;
    
    log('info', 'User joined room', { roomId, socketId: socket.id, usersCount: room.users.length });
    
    socket.to(roomId).emit('user-joined', { userId: socket.id });
    
    if (callback) {
      callback({ 
        success: true, 
        roomId, 
        users: room.users.filter(id => id !== socket.id),
        iceServers: config.iceServers 
      });
    }
  });

  socket.on('offer', (data) => {
    const { roomId, offer, targetUserId } = data;
    log('info', 'Offer received', { roomId, from: socket.id, to: targetUserId });
    
    if (targetUserId) {
      io.to(targetUserId).emit('offer', {
        offer,
        userId: socket.id
      });
    } else {
      socket.to(roomId).emit('offer', {
        offer,
        userId: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const { roomId, answer, targetUserId } = data;
    log('info', 'Answer received', { roomId, from: socket.id, to: targetUserId });
    
    if (targetUserId) {
      io.to(targetUserId).emit('answer', {
        answer,
        userId: socket.id
      });
    } else {
      socket.to(roomId).emit('answer', {
        answer,
        userId: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { roomId, candidate, targetUserId } = data;
    log('info', 'ICE candidate received', { roomId, from: socket.id, to: targetUserId });
    
    if (targetUserId) {
      io.to(targetUserId).emit('ice-candidate', {
        candidate,
        userId: socket.id
      });
    } else {
      socket.to(roomId).emit('ice-candidate', {
        candidate,
        userId: socket.id
      });
    }
  });

  socket.on('message', (data) => {
    const { roomId, message } = data;
    log('info', 'Chat message', { roomId, from: socket.id });
    
    socket.to(roomId).emit('message', {
      message,
      userId: socket.id,
      timestamp: Date.now()
    });
  });

  socket.on('leave-room', () => {
    handleUserLeave(socket);
  });

  socket.on('disconnect', () => {
    log('info', 'Client disconnected', { socketId: socket.id });
    handleUserLeave(socket);
    users.delete(socket.id);
  });
});

function handleUserLeave(socket) {
  const user = users.get(socket.id);
  if (!user || !user.roomId) return;
  
  const roomId = user.roomId;
  const room = rooms.get(roomId);
  
  if (room) {
    room.users = room.users.filter(id => id !== socket.id);
    
    log('info', 'User left room', { roomId, socketId: socket.id, remainingUsers: room.users.length });
    
    socket.to(roomId).emit('user-left', { userId: socket.id });
    
    if (room.users.length === 0) {
      rooms.delete(roomId);
      log('info', 'Room deleted (empty)', { roomId });
    }
  }
  
  socket.leave(roomId);
  user.roomId = null;
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    rooms: rooms.size,
    users: users.size
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    users: room.users.length,
    createdAt: room.createdAt
  }));
  
  res.json({ rooms: roomList });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

server.listen(config.port, () => {
  log('info', `Server started on port ${config.port}`);
  console.log(`\n🚀 WebDzyn Server running on http://localhost:${config.port}`);
  console.log(`📡 WebSocket server ready for connections\n`);
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM signal received: closing HTTP server');
  server.close(() => {
    log('info', 'HTTP server closed');
    process.exit(0);
  });
});
