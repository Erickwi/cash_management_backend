import { Server as SocketServer, Socket } from 'socket.io';

export function setupSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    console.log('Socket connected:', socket.id);

    socket.on('join-room', (roomCode: string) => {
      socket.join(roomCode);
      console.log(`Socket ${socket.id} joined room ${roomCode}`);
    });

    socket.on('leave-room', (roomCode: string) => {
      socket.leave(roomCode);
      console.log(`Socket ${socket.id} left room ${roomCode}`);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

  return io;
}

export function emitToRoom(io: SocketServer, roomCode: string, event: string, data: any) {
  io.to(roomCode).emit(event, data);
}
