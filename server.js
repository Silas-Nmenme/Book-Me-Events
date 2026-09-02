require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const app = require('./app');
const connectDB = require('./src/config/db');
const User = require('./src/models/User');


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

        // Non-admin users can only join their own room
        if (socket.userFull.role !== 'ADMIN' && requested !== ownId) {
          return; // ignore unauthorized join attempts
        }

        socket.join(`user:${requested}`);
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
