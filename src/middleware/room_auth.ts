import { logger } from '../utils/logger';
import { Request, Response, NextFunction } from 'express';
import { query } from '../db';

export interface RoomRequest extends Request {
  roomId?: string;
  deviceId?: string;
}

export async function roomAuth(req: RoomRequest, res: Response, next: NextFunction) {
  const roomCode = req.headers['x-room-code'] as string;
  const deviceId = req.headers['x-device-id'] as string;

  if (!roomCode) {
    return res.status(401).json({ error: 'x-room-code header is required' });
  }

  if (!deviceId) {
    return res.status(401).json({ error: 'x-device-id header is required' });
  }

  try {
    const roomResult = await query('SELECT id FROM rooms WHERE code = $1', [roomCode]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const deviceResult = await query(
      'SELECT id FROM devices WHERE id = $1 AND room_id = $2',
      [deviceId, roomResult.rows[0].id]
    );

    if (deviceResult.rows.length === 0) {
      return res.status(403).json({ error: 'Device not registered in this room' });
    }

    req.roomId = roomResult.rows[0].id;
    req.deviceId = deviceId;
    next();
  } catch (err) {
    logger.error('Auth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

