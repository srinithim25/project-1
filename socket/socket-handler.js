const { Server } = require('socket.io');

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

    socket.on('join:warehouse', (warehouseId) => {
      socket.join(warehouseId);
      socket.join('dashboard'); // also join global dashboard room
      console.log(`   └─ Joined room: ${warehouseId}`);
      socket.emit('joined', { warehouseId, socketId: socket.id });
    });

    socket.on('join:dashboard', () => {
      socket.join('dashboard');
    });

    socket.on('leave:warehouse', (warehouseId) => {
      socket.leave(warehouseId);
    });

    socket.on('cell:optimistic', ({ warehouseId, cell }) => {
      socket.to(warehouseId).emit('cell:updated', cell);
    });

    socket.on('disconnect', () => {
      console.log(`🔌  Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

// Broadcast a dashboard stats refresh to all dashboard listeners
const broadcastStatsRefresh = (warehouseId) => {
  if (!io) return;
  io.to('dashboard').emit('stats:refresh', { warehouseId });
};

module.exports = { initSocket, getIO, broadcastStatsRefresh };