import { logger } from '../utils/logger';
import { Server as SocketServer, Socket } from 'socket.io';

export function setupSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected:', socket.id);

    socket.on('join-room', (roomCode: string) => {
      socket.join(roomCode);
      logger.info(`Socket ${socket.id} joined room ${roomCode}`);
    });

    socket.on('leave-room', (roomCode: string) => {
      socket.leave(roomCode);
      logger.info(`Socket ${socket.id} left room ${roomCode}`);
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected:', socket.id);
    });
  });

  return io;
}

export function emitToRoom(io: SocketServer, roomCode: string, event: string, data: any) {
  io.to(roomCode).emit(event, data);
}

