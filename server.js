require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');

const { initSocket } = require('./socket/socket-handler');
const warehouseRoutes = require('./routes/warehouse.routes');
const authRoutes = require('./routes/auth.routes');
const shipmentRoutes = require('./routes/shipment.routes');
const { authenticateToken } = require('./middleware/auth.middleware');

const app = express();
const server = http.createServer(app);

// ─── Middleware ───
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/warehouse', authenticateToken, warehouseRoutes);
app.use('/api/shipments', authenticateToken, shipmentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), service: 'Lume Logistics API' });
});

// ─── Socket.io ───
initSocket(server);

// ─── MongoDB ───
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected');
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀  Lume server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });
