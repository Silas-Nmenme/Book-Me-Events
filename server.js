require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();

const app = require('./app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://bookmeevent.netlify.app';

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: ['https://bookmeevent.netlify.app', 'http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Make io available to controllers
    app.set('io', io);

    io.on('connection', (socket) => {
      // Client should emit: socket.emit('join', { userId })
      socket.on('join', ({ userId } = {}) => {
        if (!userId) return;
        socket.join(`user:${userId}`);
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
