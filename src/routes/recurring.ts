import { logger } from '../utils/logger';
import { Router, Response } from 'express';
import { query } from '../db';
import { RoomRequest } from '../middleware/room_auth';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: RoomRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT r.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM recurring_expenses r
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.room_id = $1 AND r.is_active = true
       ORDER BY r.preferred_day ASC`,
      [req.roomId]
    );
    res.json(result.rows);
  } catch (err) {
    logger.error('Get recurring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: RoomRequest, res: Response) => {
  try {
    const { category_id, amount, description, preferred_day } = req.body;

    if (!category_id || !amount || !preferred_day) {
      return res.status(400).json({ error: 'category_id, amount, and preferred_day are required' });
    }

    if (preferred_day < 1 || preferred_day > 31) {
      return res.status(400).json({ error: 'preferred_day must be between 1 and 31' });
    }

    const result = await query(
      `INSERT INTO recurring_expenses (room_id, category_id, amount, description, preferred_day)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.roomId, category_id, amount, description || '', preferred_day]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error('Create recurring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const { category_id, amount, description, preferred_day, is_active } = req.body;

    const result = await query(
      `UPDATE recurring_expenses SET
        category_id = COALESCE($1, category_id),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        preferred_day = COALESCE($4, preferred_day),
        is_active = COALESCE($5, is_active)
       WHERE id = $6 AND room_id = $7
       RETURNING *`,
      [category_id, amount, description, preferred_day, is_active, req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update recurring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM recurring_expenses WHERE id = $1 AND room_id = $2 RETURNING id',
      [req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring expense not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete recurring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/generate', async (req: RoomRequest, res: Response) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const recurringResult = await query(
      'SELECT * FROM recurring_expenses WHERE room_id = $1 AND is_active = true',
      [req.roomId]
    );

    const generated: any[] = [];

    for (const rec of recurringResult.rows) {
      const day = Math.min(rec.preferred_day, dayjs(`${year}-${month}-01`).endOf('month').date());
      const date = dayjs(`${year}-${month}-${day}`).toISOString();

      const existing = await query(
        `SELECT id FROM transactions
         WHERE room_id = $1 AND recurring_id = $2
         AND date >= $3 AND date < $4`,
        [
          req.roomId,
          rec.id,
          dayjs(`${year}-${month}-01`).startOf('month').toISOString(),
          dayjs(`${year}-${month}-01`).endOf('month').toISOString(),
        ]
      );

      if (existing.rows.length > 0) continue;

      const tx = await query(
        `INSERT INTO transactions (room_id, type, category_id, amount, description, date, status, is_auto_generated, recurring_id, created_by_device)
         VALUES ($1, 'expense', $2, $3, $4, $5, 'pending', true, $6, $7)
         RETURNING *`,
        [req.roomId, rec.category_id, rec.amount, rec.description, date, rec.id, req.deviceId]
      );

      generated.push(tx.rows[0]);
    }

    res.json({ generated, count: generated.length });
  } catch (err) {
    logger.error('Generate recurring error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

