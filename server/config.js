module.exports = {
  port: process.env.PORT || 3000,
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  
  socketIO: {
    pingTimeout: 60000,
    pingInterval: 25000,
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  },
  
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  
  maxRoomSize: 2,
  
  logging: {
    enabled: true,
    level: process.env.LOG_LEVEL || 'info'
  }
};
