import { query } from '../db';
import { logger } from '../utils/logger';

export interface LogParams {
  roomId: string;
  deviceId?: string;
  deviceAlias?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_logs (room_id, device_id, device_alias, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.roomId,
        params.deviceId || null,
        params.deviceAlias || null,
        params.action,
        params.entityType || null,
        params.entityId || null,
        params.details ? JSON.stringify(params.details) : null,
      ]
    );
  } catch (err) {
    logger.error('Failed to write activity log:', err);
  }
}

export async function getRoomLogs(roomId: string, limit = 50, offset = 0) {
  const result = await query(
    `SELECT id, device_alias, action, entity_type, entity_id, details, created_at
     FROM activity_logs
     WHERE room_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [roomId, limit, offset]
  );
  return result.rows;
}
