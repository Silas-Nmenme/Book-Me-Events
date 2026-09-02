require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('./app');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');
const Request = require('./src/models/Request');
const Vendor = require('./src/models/Vendor');


const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';
const allowedOrigins = [...new Set([
  FRONTEND_URL,
  'https://bookmeevent.netlify.app',
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean))];

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Make io available to controllers
    app.set('io', io);

    io.use((socket, next) => {
      try {
        const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
        if (!token) {
          return next(new Error('Socket auth token missing'));
        }

        if (!process.env.JWT_SECRET) {
          return next(new Error('JWT_SECRET not configured'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; // { id, iat, exp }
        return next();
      } catch (err) {
        return next(new Error('Socket auth failed'));
      }
    });

    io.on('connection', async (socket) => {
      console.log('[socket] client connected', socket.id);

      // Attach full user for authorization decisions
      socket.userFull = await User.findById(socket.user.id).select('_id role email');
      if (!socket.userFull) {
        socket.disconnect(true);
        return;
      }

      // Client should emit: socket.emit('join', { userId })
      socket.on('join', ({ userId } = {}) => {
        if (!userId) return;

        const requested = String(userId);
        const ownId = String(socket.userFull._id);

        if (!mongoose.Types.ObjectId.isValid(requested)) {
          return;
        }

        // Non-admin users can only join their own room
        if (socket.userFull.role !== 'ADMIN' && requested !== ownId) {
          return; // ignore unauthorized join attempts
        }

        socket.join(`user:${requested}`);
      });

      socket.on('join:request', async ({ requestId } = {}) => {
        if (!requestId || !mongoose.Types.ObjectId.isValid(String(requestId))) return;

        const request = await Request.findById(requestId).select('user vendor').lean();
        if (!request) return;

        const ownId = String(socket.userFull._id);
        const isOwner = String(request.user) === ownId;
        let isAssignedVendor = false;

        if (request.vendor) {
          const vendor = await Vendor.findById(request.vendor).select('user').lean();
          isAssignedVendor = String(vendor?.user) === ownId;
        }

        if (socket.userFull.role === 'ADMIN' || isOwner || isAssignedVendor) {
          socket.join(`chat:${requestId}`);
        }
      });
    });


    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Frontend: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

startServer();
