import { logger } from '../utils/logger';
import { Server as SocketServer, Socket } from 'socket.io';
import { query } from '../db';
import { logActivity } from '../services/log_service';

interface ConnectedDevice {
  socketId: string;
  deviceId: string;
  alias: string;
  roomCode: string;
}

const connectedDevices = new Map<string, ConnectedDevice>();

export function setupSocketHandlers(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected:', socket.id);

    socket.on('join-room', async (data: { roomCode: string; deviceId: string }) => {
      const { roomCode, deviceId } = data;

      socket.join(roomCode);
      logger.info(`Socket ${socket.id} joined room ${roomCode}`);

      const deviceResult = await query(
        'SELECT id, alias FROM devices WHERE id = $1',
        [deviceId]
      );

      if (deviceResult.rows.length === 0) {
        logger.warn(`Device ${deviceId} not found in database`);
        return;
      }

      const device = deviceResult.rows[0];

      connectedDevices.set(socket.id, {
        socketId: socket.id,
        deviceId: device.id,
        alias: device.alias,
        roomCode,
      });

      const roomDevices = await getRoomDevices(roomCode);

      socket.emit('room-devices', roomDevices);

      socket.to(roomCode).emit('device-online', {
        device_id: device.id,
        alias: device.alias,
      });

      logger.info(`Device ${device.alias} (${device.id}) joined room ${roomCode}`);

      const roomResult = await query('SELECT id FROM rooms WHERE code = $1', [roomCode]);
      if (roomResult.rows.length > 0) {
        await logActivity({
          roomId: roomResult.rows[0].id,
          deviceId: device.id,
          deviceAlias: device.alias,
          action: 'device_connected',
          entityType: 'device',
          entityId: device.id,
        });
      }
    });

    socket.on('leave-room', (roomCode: string) => {
      socket.leave(roomCode);
      handleDeviceDisconnect(io, socket);
      logger.info(`Socket ${socket.id} left room ${roomCode}`);
    });

    socket.on('disconnect', () => {
      handleDeviceDisconnect(io, socket);
      logger.info('Socket disconnected:', socket.id);
    });
  });

  return io;
}

async function handleDeviceDisconnect(io: SocketServer, socket: Socket) {
  const device = connectedDevices.get(socket.id);
  if (!device) return;

  socket.to(device.roomCode).emit('device-offline', {
    device_id: device.deviceId,
    alias: device.alias,
  });

  const roomResult = await query('SELECT id FROM rooms WHERE code = $1', [device.roomCode]);
  if (roomResult.rows.length > 0) {
    await logActivity({
      roomId: roomResult.rows[0].id,
      deviceId: device.deviceId,
      deviceAlias: device.alias,
      action: 'device_disconnected',
      entityType: 'device',
      entityId: device.deviceId,
    });
  }

  connectedDevices.delete(socket.id);
  logger.info(`Device ${device.alias} (${device.deviceId}) went offline`);
}

async function getRoomDevices(roomCode: string) {
  const result = await query(
    `SELECT d.id, d.alias
     FROM devices d
     JOIN rooms r ON r.id = d.room_id
     WHERE r.code = $1`,
    [roomCode]
  );

  return result.rows.map((row) => {
    const isConnected = Array.from(connectedDevices.values()).some(
      (cd) => cd.deviceId === row.id
    );
    return {
      device_id: row.id,
      alias: row.alias,
      is_online: isConnected,
    };
  });
}

export function emitToRoom(io: SocketServer, roomCode: string, event: string, data: any) {
  io.to(roomCode).emit(event, data);
}
