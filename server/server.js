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
  log('info', '🔌 New client connected', { 
    socketId: socket.id,
    address: socket.handshake.address,
    headers: socket.handshake.headers['user-agent']
  });
  users.set(socket.id, { socketId: socket.id, roomId: null });

  socket.on('create-room', (callback) => {
    const roomId = generateRoomId();
    log('info', '🏠 Creating room', { roomId, socketId: socket.id });
    
    rooms.set(roomId, {
      id: roomId,
      users: [socket.id],
      createdAt: Date.now()
    });
    
    socket.join(roomId);
    const user = users.get(socket.id);
    user.roomId = roomId;
    
    log('info', '✅ Room created successfully', { 
      roomId, 
      socketId: socket.id
    });
    
    if (callback) {
      callback({ success: true, roomId });
    }
  });

  socket.on('join-room', (roomId, callback) => {
    log('info', '🚪 Attempting to join room', { roomId, socketId: socket.id });
    const room = rooms.get(roomId);
    
    if (!room) {
      log('warn', '⚠️ Room not found', { roomId, socketId: socket.id });
      if (callback) {
        callback({ success: false, error: 'Room not found' });
      }
      return;
    }
    
    if (room.users.length >= config.maxRoomSize) {
      log('warn', '⚠️ Room is full', { roomId, socketId: socket.id, maxSize: config.maxRoomSize });
      if (callback) {
        callback({ success: false, error: 'Room is full' });
      }
      return;
    }
    
    socket.join(roomId);
    room.users.push(socket.id);
    const user = users.get(socket.id);
    user.roomId = roomId;
    
    log('info', '✅ User joined room successfully', { 
      roomId, 
      socketId: socket.id, 
      usersCount: room.users.length,
      allUsers: room.users
    });
    
    log('info', '📢 Notifying existing users about new user', { 
      roomId, 
      newUserId: socket.id,
      existingUsers: room.users.filter(id => id !== socket.id)
    });
    socket.to(roomId).emit('user-joined', { userId: socket.id });
    
    if (callback) {
      const existingUsers = room.users.filter(id => id !== socket.id);
      log('info', '📤 Sending join confirmation', {
        roomId,
        existingUsers
      });
      callback({ 
        success: true, 
        roomId, 
        users: existingUsers
      });
    }
  });

  socket.on('audio-data', (data) => {
    const user = users.get(socket.id);
    if (!user || !user.roomId) return;
    
    socket.volatile.to(user.roomId).emit('audio-data', {
      data: data.data,
      userId: socket.id
    });
  });

  socket.on('message', (data) => {
    const { roomId, message } = data;
    log('info', '💬 Chat message received', { 
      roomId, 
      from: socket.id,
      messageLength: message?.length
    });
    
    socket.to(roomId).emit('message', {
      message,
      userId: socket.id,
      timestamp: Date.now()
    });
    log('info', '✅ Chat message forwarded', { roomId, from: socket.id });
  });

  socket.on('leave-room', () => {
    handleUserLeave(socket);
  });

  socket.on('disconnect', (reason) => {
    log('info', '🔌 Client disconnected', { 
      socketId: socket.id,
      reason: reason
    });
    handleUserLeave(socket);
    users.delete(socket.id);
    log('info', '✅ User cleanup complete', { socketId: socket.id });
  });
});

function handleUserLeave(socket) {
  const user = users.get(socket.id);
  if (!user || !user.roomId) {
    log('info', '⚠️ User leave: no room to leave', { socketId: socket.id });
    return;
  }
  
  const roomId = user.roomId;
  const room = rooms.get(roomId);
  
  if (room) {
    const beforeCount = room.users.length;
    room.users = room.users.filter(id => id !== socket.id);
    
    log('info', '🚪 User left room', { 
      roomId, 
      socketId: socket.id, 
      beforeCount,
      remainingUsers: room.users.length,
      remainingUserIds: room.users
    });
    
    log('info', '📢 Notifying remaining users', { 
      roomId, 
      leftUserId: socket.id,
      notifyingUsers: room.users
    });
    socket.to(roomId).emit('user-left', { userId: socket.id });
    
    if (room.users.length === 0) {
      rooms.delete(roomId);
      log('info', '🗑️ Room deleted (empty)', { roomId });
    }
  } else {
    log('warn', '⚠️ Room not found when user leaving', { roomId, socketId: socket.id });
  }
  
  socket.leave(roomId);
  user.roomId = null;
  log('info', '✅ User leave handled', { socketId: socket.id, roomId });
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
