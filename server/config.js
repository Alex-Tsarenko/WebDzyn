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
  
  maxRoomSize: 10,
  
  logging: {
    enabled: true,
    level: process.env.LOG_LEVEL || 'info'
  }
};
