import { logger } from '../utils/logger';
import { Router, Response } from 'express';
import { query } from '../db';
import { RoomRequest } from '../middleware/room_auth';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: RoomRequest, res: Response) => {
  try {
    const { type, month, year, status } = req.query;

    let sql = `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.room_id = $1`;
    const params: any[] = [req.roomId];
    let paramIndex = 2;

    if (type) {
      sql += ` AND t.type = $${paramIndex++}`;
      params.push(type);
    }

    if (month && year) {
      const startDate = dayjs(`${year}-${month}-01`).startOf('month').toISOString();
      const endDate = dayjs(`${year}-${month}-01`).endOf('month').toISOString();
      sql += ` AND t.date >= $${paramIndex++} AND t.date <= $${paramIndex++}`;
      params.push(startDate, endDate);
    }

    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    logger.error('Get transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: RoomRequest, res: Response) => {
  try {
    const { type, category_id, amount, description, date, status } = req.body;

    if (!type || !amount) {
      return res.status(400).json({ error: 'type and amount are required' });
    }

    const validTypes = ['income', 'expense', 'savings', 'emergency'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const result = await query(
      `INSERT INTO transactions (room_id, type, category_id, amount, description, date, status, created_by_device)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.roomId,
        type,
        category_id || null,
        amount,
        description || '',
        date || new Date().toISOString(),
        status || 'paid',
        req.deviceId,
      ]
    );

    const tx = result.rows[0];

    const catResult = await query('SELECT name, icon, color FROM categories WHERE id = $1', [category_id]);
    tx.category_name = catResult.rows[0]?.name || null;
    tx.category_icon = catResult.rows[0]?.icon || null;
    tx.category_color = catResult.rows[0]?.color || null;

    res.status(201).json(tx);
  } catch (err) {
    logger.error('Create transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const { category_id, amount, description, date, status, type } = req.body;

    const result = await query(
      `UPDATE transactions SET
        category_id = COALESCE($1, category_id),
        amount = COALESCE($2, amount),
        description = COALESCE($3, description),
        date = COALESCE($4, date),
        status = COALESCE($5, status),
        type = COALESCE($6, type),
        updated_at = NOW()
       WHERE id = $7 AND room_id = $8
       RETURNING *`,
      [category_id, amount, description, date, status, type, req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/status', async (req: RoomRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!['paid', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'status must be paid or pending' });
    }

    const result = await query(
      `UPDATE transactions SET status = $1, updated_at = NOW()
       WHERE id = $2 AND room_id = $3
       RETURNING *`,
      [status, req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: RoomRequest, res: Response) => {
  try {
    const result = await query(
      'DELETE FROM transactions WHERE id = $1 AND room_id = $2 RETURNING id',
      [req.params.id, req.roomId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

