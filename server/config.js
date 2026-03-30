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
    {
      urls: process.env.TURN_URL || 'turn:openrelay.metered.ca:80',
      username: process.env.TURN_USERNAME || 'openrelayproject',
      credential: process.env.TURN_CREDENTIAL || 'openrelayproject'
    },
    {
      urls: process.env.TURN_URL_TLS || 'turn:openrelay.metered.ca:443',
      username: process.env.TURN_USERNAME || 'openrelayproject',
      credential: process.env.TURN_CREDENTIAL || 'openrelayproject'
    },
    {
      urls: process.env.TURNS_URL || 'turns:openrelay.metered.ca:443',
      username: process.env.TURN_USERNAME || 'openrelayproject',
      credential: process.env.TURN_CREDENTIAL || 'openrelayproject'
    }
  ],
  
  maxRoomSize: 2,
  
  logging: {
    enabled: true,
    level: process.env.LOG_LEVEL || 'info'
  }
};
