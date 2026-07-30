import { logger } from '../utils/logger';
import { Router, Response } from 'express';
import { query } from '../db';
import { RoomRequest } from '../middleware/room_auth';
import { logActivity } from '../services/log_service';

const router = Router();

router.get('/', async (req: RoomRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM categories WHERE room_id = $1 ORDER BY is_preset DESC, name ASC',
      [req.roomId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Get categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: RoomRequest, res: Response) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    const result = await query(
      `INSERT INTO categories (room_id, name, type, icon, color, is_preset)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING *`,
      [req.roomId, name, type, icon || 'category', color || '#78909C']
    );

    await logActivity({
      roomId: req.roomId!,
      deviceId: req.deviceId,
      action: 'category_created',
      entityType: 'category',
      entityId: result.rows[0].id,
      details: { name, type },
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Create category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const { name, icon, color } = req.body;
    const result = await query(
      `UPDATE categories SET name = COALESCE($1, name), icon = COALESCE($2, icon), color = COALESCE($3, color)
       WHERE id = $4 AND room_id = $5
       RETURNING *`,
      [name, icon, color, req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await logActivity({
      roomId: req.roomId!,
      deviceId: req.deviceId,
      action: 'category_updated',
      entityType: 'category',
      entityId: req.params.id as string,
      details: { name, icon, color },
    });

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM categories WHERE id = $1 AND room_id = $2 AND is_preset = false RETURNING id',
      [req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or cannot be deleted' });
    }

    await logActivity({
      roomId: req.roomId!,
      deviceId: req.deviceId,
      action: 'category_deleted',
      entityType: 'category',
      entityId: req.params.id as string,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

