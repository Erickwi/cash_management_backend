import { logger } from '../utils/logger';
import { Router, Response } from 'express';
import { query } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { logActivity, getRoomLogs } from '../services/log_service';

const router = Router();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const PRESET_CATEGORIES = [
  { name: 'Agua', type: 'expense', icon: 'water_drop', color: '#1565C0' },
  { name: 'Luz', type: 'expense', icon: 'bolt', color: '#FDD835' },
  { name: 'Teléfono', type: 'expense', icon: 'phone', color: '#43A047' },
  { name: 'Internet', type: 'expense', icon: 'wifi', color: '#1E88E5' },
  { name: 'Gas', type: 'expense', icon: 'local_fire_department', color: '#FF7043' },
  { name: 'Supermercado', type: 'expense', icon: 'shopping_cart', color: '#8D6E63' },
  { name: 'Transporte', type: 'expense', icon: 'directions_bus', color: '#42A5F5' },
  { name: 'Renta', type: 'expense', icon: 'home', color: '#7B1FA2' },
  { name: 'Seguros', type: 'expense', icon: 'verified_user', color: '#66BB6A' },
  { name: 'Salud', type: 'expense', icon: 'local_hospital', color: '#EF5350' },
  { name: 'Educación', type: 'expense', icon: 'school', color: '#AB47BC' },
  { name: 'Entretenimiento', type: 'expense', icon: 'movie', color: '#FFA726' },
  { name: 'Otros', type: 'expense', icon: 'more_horiz', color: '#78909C' },
  { name: 'Salario', type: 'income', icon: 'work', color: '#2E7D32' },
  { name: 'Freelance', type: 'income', icon: 'code', color: '#1565C0' },
  { name: 'Inversiones', type: 'income', icon: 'trending_up', color: '#00897B' },
];

// Create room
router.post('/', async (req, res: Response) => {
  try {
    const { alias } = req.body;
    if (!alias) return res.status(400).json({ error: 'alias is required' });

    let code: string;
    let exists = true;
    do {
      code = generateRoomCode();
      const check = await query('SELECT id FROM rooms WHERE code = $1', [code]);
      exists = check.rows.length > 0;
    } while (exists);

    const deviceId = uuidv4();

    await query('BEGIN');

    const roomResult = await query(
      'INSERT INTO rooms (code) VALUES ($1) RETURNING id, code, created_at',
      [code]
    );
    const room = roomResult.rows[0];

    const deviceResult = await query(
      'INSERT INTO devices (id, room_id, alias) VALUES ($1, $2, $3) RETURNING id, alias, created_at',
      [deviceId, room.id, alias]
    );

    for (const cat of PRESET_CATEGORIES) {
      await query(
        'INSERT INTO categories (room_id, name, type, icon, color, is_preset) VALUES ($1, $2, $3, $4, $5, true)',
        [room.id, cat.name, cat.type, cat.icon, cat.color]
      );
    }

    await query('COMMIT');

    await logActivity({
      roomId: room.id,
      deviceId: deviceId,
      deviceAlias: alias,
      action: 'room_created',
      entityType: 'room',
      entityId: room.id,
      details: { code },
    });

    res.status(201).json({
      room: { id: room.id, code: room.code, created_at: room.created_at },
      device: { id: deviceResult.rows[0].id, alias: deviceResult.rows[0].alias, created_at: deviceResult.rows[0].created_at },
    });
  } catch (err) {
    await query('ROLLBACK');
    logger.error('Create room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join room
router.post('/join', async (req, res: Response) => {
  try {
    const { code, alias } = req.body;
    if (!code || !alias) {
      return res.status(400).json({ error: 'code and alias are required' });
    }

    const roomResult = await query('SELECT id, code, created_at FROM rooms WHERE code = $1', [code.toUpperCase()]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const deviceId = uuidv4();
    const room = roomResult.rows[0];

    const deviceResult = await query(
      'INSERT INTO devices (id, room_id, alias) VALUES ($1, $2, $3) RETURNING id, alias, created_at',
      [deviceId, room.id, alias]
    );

    await logActivity({
      roomId: room.id,
      deviceId: deviceId,
      deviceAlias: alias,
      action: 'room_joined',
      entityType: 'device',
      entityId: deviceId,
      details: { code: room.code },
    });

    res.json({
      room: { id: room.id, code: room.code, created_at: room.created_at },
      device: { id: deviceResult.rows[0].id, alias: deviceResult.rows[0].alias, created_at: deviceResult.rows[0].created_at },
    });
  } catch (err) {
    logger.error('Join room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room info
router.get('/:code', async (req, res: Response) => {
  try {
    const roomResult = await query(
      `SELECT r.id, r.code, r.created_at,
        json_agg(json_build_object('id', d.id, 'alias', d.alias, 'created_at', d.created_at)) as devices
      FROM rooms r
      LEFT JOIN devices d ON d.room_id = r.id
      WHERE r.code = $1
      GROUP BY r.id`,
      [req.params.code.toUpperCase()]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(roomResult.rows[0]);
  } catch (err) {
    logger.error('Get room error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room activity logs
router.get('/:code/logs', async (req, res: Response) => {
  try {
    const roomResult = await query('SELECT id FROM rooms WHERE code = $1', [req.params.code.toUpperCase()]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await getRoomLogs(roomResult.rows[0].id, limit, offset);
    res.json(logs);
  } catch (err) {
    logger.error('Get logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register FCM token
router.post('/fcm-token', async (req, res: Response) => {
  try {
    const { deviceId, fcmToken } = req.body;
    if (!deviceId || !fcmToken) {
      return res.status(400).json({ error: 'deviceId and fcmToken are required' });
    }

    await query('UPDATE devices SET fcm_token = $1 WHERE id = $2', [fcmToken, deviceId]);
    res.json({ success: true });
  } catch (err) {
    logger.error('FCM token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

