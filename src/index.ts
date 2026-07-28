import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config();

import { roomAuth } from './middleware/room_auth';
import roomsRouter from './routes/rooms';
import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import recurringRouter from './routes/recurring';
import reportsRouter from './routes/reports';
import { setupSocketHandlers } from './socket/handler';

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/rooms', roomsRouter);

// Auth middleware for protected routes
app.use('/api/categories', roomAuth, categoriesRouter);
app.use('/api/transactions', roomAuth, transactionsRouter);
app.use('/api/recurring', roomAuth, recurringRouter);
app.use('/api/reports', roomAuth, reportsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Cash Management API running on port ${PORT}`);
});

export { io };
