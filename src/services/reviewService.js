const { query } = require('../config/database');
const agent = require('../agent/agent');
const cloudchatService = require('./cloudchatService');
const logger = require('../utils/logger');

async function computeMetrics(userId, periodStart, periodEnd) {
  const [tasksResult, responsesResult, remindersResult, categoryResult] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'cancelled') AS tasks_assigned,
         COUNT(*) FILTER (WHERE status = 'completed') AS tasks_completed,
         COUNT(*) FILTER (WHERE status = 'overdue') AS tasks_overdue
       FROM tasks
       WHERE assigned_to = $1
         AND due_date BETWEEN $2 AND $3
         AND deleted_at IS NULL`,
      [userId, periodStart, periodEnd]
    ),
    query(
      `SELECT
         COUNT(*) AS total_responses,
         COUNT(*) FILTER (WHERE flagged = TRUE) AS flagged_responses,
         COUNT(*) FILTER (WHERE status_reported = 'problem') AS problem_reports
       FROM task_responses
       WHERE user_id = $1
         AND response_date BETWEEN $2 AND $3`,
      [userId, periodStart, periodEnd]
    ),
    query(
      `SELECT
         COUNT(*) AS total_reminders,
         COUNT(*) FILTER (WHERE status = 'sent') AS sent_reminders,
         AVG(EXTRACT(EPOCH FROM (tr.created_at - rl.sent_at))/3600) AS avg_response_time_hours
       FROM reminder_log rl
       LEFT JOIN task_responses tr
         ON tr.task_id = rl.task_id AND tr.user_id = rl.user_id
         AND tr.created_at > rl.sent_at
       WHERE rl.user_id = $1
         AND rl.scheduled_for BETWEEN $2 AND $3`,
      [userId, periodStart, periodEnd]
    ),
    query(
      `SELECT c.name, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE t.status = 'completed') AS completed
       FROM tasks t
       LEFT JOIN task_categories c ON c.id = t.category_id
       WHERE t.assigned_to = $1
         AND t.due_date BETWEEN $2 AND $3
         AND t.deleted_at IS NULL
       GROUP BY c.name`,
      [userId, periodStart, periodEnd]
    ),
  ]);

  const tasks = tasksResult.rows[0];
  const responses = responsesResult.rows[0];
  const reminders = remindersResult.rows[0];
  const totalReminders = parseInt(reminders.sent_reminders) || 0;
  const totalResponses = parseInt(responses.total_responses) || 0;
  const responseRate = totalReminders > 0
    ? Math.min(100, (totalResponses / totalReminders * 100)).toFixed(2)
    : 0;

  return {
    tasks_assigned: parseInt(tasks.tasks_assigned) || 0,
    tasks_completed: parseInt(tasks.tasks_completed) || 0,
    tasks_overdue: parseInt(tasks.tasks_overdue) || 0,
    response_rate: parseFloat(responseRate),
    avg_response_time_hours: parseFloat(reminders.avg_response_time_hours) || 0,
    problem_reports: parseInt(responses.problem_reports) || 0,
    flagged_responses: parseInt(responses.flagged_responses) || 0,
    by_category: categoryResult.rows,
  };
}

async function generateForUser(userId, period, periodStart) {
  const dayjs = require('dayjs');
  const periodEnd = period === 'weekly'
    ? dayjs(periodStart).add(6, 'day').format('YYYY-MM-DD')
    : dayjs(periodStart).endOf('month').format('YYYY-MM-DD');

  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) throw new Error(`User ${userId} not found`);
  const user = userResult.rows[0];

  const metrics = await computeMetrics(userId, periodStart, periodEnd);
  const reviewData = await agent.generateReview(user, metrics, period, periodStart, periodEnd);

  const result = await query(
    `INSERT INTO performance_reviews
       (user_id, period, period_start, period_end, tasks_assigned, tasks_completed,
        tasks_overdue, response_rate, avg_response_time_hours, problem_reports,
        quality_score, ai_review_text, ai_strengths, ai_improvements)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (user_id, period, period_start) DO UPDATE SET
       tasks_assigned = EXCLUDED.tasks_assigned,
       tasks_completed = EXCLUDED.tasks_completed,
       tasks_overdue = EXCLUDED.tasks_overdue,
       response_rate = EXCLUDED.response_rate,
       quality_score = EXCLUDED.quality_score,
       ai_review_text = EXCLUDED.ai_review_text,
       ai_strengths = EXCLUDED.ai_strengths,
       ai_improvements = EXCLUDED.ai_improvements
     RETURNING *`,
    [
      userId, period, periodStart, periodEnd,
      metrics.tasks_assigned, metrics.tasks_completed, metrics.tasks_overdue,
      metrics.response_rate, metrics.avg_response_time_hours, metrics.problem_reports,
      reviewData.quality_score,
      reviewData.narrative,
      reviewData.strengths || [],
      reviewData.improvements || [],
    ]
  );

  const review = result.rows[0];

  // Send brief summary to PIC via WA
  if (user.phone_number) {
    const picMsg = `📊 *Evaluasi Kinerja ${period === 'weekly' ? 'Mingguan' : 'Bulanan'}*\n` +
      `Periode: ${periodStart} s/d ${periodEnd}\n\n` +
      `✅ Selesai: ${metrics.tasks_completed}/${metrics.tasks_assigned}\n` +
      `⏱️ Respons: ${metrics.response_rate}%\n` +
      `⭐ Skor: ${reviewData.quality_score}/10\n\n` +
      (reviewData.strengths?.length ? `👍 *Kekuatan:*\n${reviewData.strengths.map(s => `• ${s}`).join('\n')}\n\n` : '') +
      (reviewData.improvements?.length ? `📈 *Area Pengembangan:*\n${reviewData.improvements.map(i => `• ${i}`).join('\n')}` : '');
    await cloudchatService.sendText(user.phone_number, picMsg);
    await query('UPDATE performance_reviews SET sent_to_pic_at = NOW() WHERE id = $1', [review.id]);
  }

  // Send summary to supervisor
  if (process.env.SUPERVISOR_PHONE) {
    const supMsg = `📋 *Review ${user.full_name}*\n${reviewData.supervisor_summary || ''}`;
    await cloudchatService.sendText(process.env.SUPERVISOR_PHONE, supMsg);
    await query('UPDATE performance_reviews SET sent_to_supervisor_at = NOW() WHERE id = $1', [review.id]);
  }

  logger.info('Review generated and sent', { userId, period, periodStart, score: reviewData.quality_score });
  return review;
}

async function generateForAll(period, periodStart) {
  const users = await query(
    "SELECT id FROM users WHERE role = 'pic' AND is_active = TRUE"
  );
  for (const user of users.rows) {
    try {
      await generateForUser(user.id, period, periodStart);
    } catch (err) {
      logger.error('Review generation failed for user', { userId: user.id, error: err.message });
    }
  }
}

module.exports = { computeMetrics, generateForUser, generateForAll };
