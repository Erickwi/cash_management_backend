import { logger } from '../utils/logger';
import { Router, Response } from 'express';
import { query } from '../db';
import { RoomRequest } from '../middleware/room_auth';
import dayjs from 'dayjs';
import { logActivity } from '../services/log_service';

const router = Router();

router.get('/monthly', async (req: RoomRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ error: 'month and year are required' });
    }

    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toISOString();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toISOString();

    const params = [req.roomId, startDate, endDate];

    const summaryResult = await query(
      `SELECT
        type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE room_id = $1 AND date >= $2 AND date <= $3
       GROUP BY type`,
      params
    );

    const incomeResult = await query(
      `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.room_id = $1 AND t.date >= $2 AND t.date <= $3 AND t.type = 'income'
       ORDER BY t.date DESC`,
      params
    );

    const expenseResult = await query(
      `SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.room_id = $1 AND t.date >= $2 AND t.date <= $3 AND t.type = 'expense'
       ORDER BY t.date DESC`,
      params
    );

    const expenseByCategory = await query(
      `SELECT c.id, c.name, c.icon, c.color, COALESCE(SUM(t.amount), 0) as total, COUNT(*) as count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.room_id = $1 AND t.date >= $2 AND t.date <= $3 AND t.type = 'expense'
       GROUP BY c.id, c.name, c.icon, c.color
       ORDER BY total DESC`,
      params
    );

    const savingsResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE room_id = $1 AND date >= $2 AND date <= $3 AND type = 'savings'`,
      params
    );

    const emergencyResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE room_id = $1 AND date >= $2 AND date <= $3 AND type = 'emergency'`,
      params
    );

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalSavings = 0;
    let totalEmergency = 0;

    for (const row of summaryResult.rows) {
      switch (row.type) {
        case 'income': totalIncome = parseFloat(row.total); break;
        case 'expense': totalExpenses = parseFloat(row.total); break;
        case 'savings': totalSavings = parseFloat(row.total); break;
        case 'emergency': totalEmergency = parseFloat(row.total); break;
      }
    }

    const deviceResult = await query(
      'SELECT alias FROM devices WHERE room_id = $1',
      [req.roomId]
    );
    const members = deviceResult.rows.map((r: any) => r.alias);

    await logActivity({
      roomId: req.roomId!,
      deviceId: req.deviceId,
      action: 'report_generated',
      entityType: 'report',
      details: { month, year, type: 'monthly' },
    });

    res.json({
      month,
      year,
      members,
      summary: {
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_savings: totalSavings || parseFloat(savingsResult.rows[0]?.total || '0'),
        total_emergency: totalEmergency || parseFloat(emergencyResult.rows[0]?.total || '0'),
        balance: totalIncome - totalExpenses,
      },
      incomes: incomeResult.rows,
      expenses: expenseResult.rows,
      expense_by_category: expenseByCategory.rows,
    });
  } catch (err) {
    logger.error('Report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

