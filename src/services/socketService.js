const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let ioInstance = null;

function init(server) {
  if (ioInstance) return ioInstance;
  ioInstance = new Server(server, {
    cors: {
      origin: [
        'https://dualdimension.org',
        'https://www.dualdimension.org',
        'http://localhost:3000',
      ],
      credentials: true,
    },
    transports: ['websocket'],
  });

  ioInstance.use((socket, next) => {
    // Accept token from query or headers
    const token = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication error: No token provided'));
    try {
      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.user = payload;
      return next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const { user } = socket;
    if (!user) return;
    // Join userId room for targeted notifications
    socket.join(`user:${user.userId}`);
    // Optionally join tenant room
    if (user.tenantId) {
      socket.join(`tenant:${user.tenantId}`);
    }
    // Optionally log connection
    console.log(`Socket connected: userId=${user.userId}, tenantId=${user.tenantId}`);
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: userId=${user.userId}`);
    });
  });

  return ioInstance;
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.io not initialized!');
  return ioInstance;
}

module.exports = { init, getIO }; 