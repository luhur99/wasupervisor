const { query } = require('../../config/database');
const { CONV_STATE, BUTTON_IDS, TASK_STATUS } = require('../../config/constants');
const conversationService = require('../../services/conversationService');
const taskService = require('../../services/taskService');
const responseService = require('../../services/responseService');
const storageService = require('../../services/storageService');
const cloudchatService = require('../../services/cloudchatService');
const { normalizePhone } = require('../../utils/phoneUtils');
const logger = require('../../utils/logger');

const handle = async (req, res) => {
  // Return 200 immediately — CloudChat has a 2-second timeout
  res.status(200).json({ ok: true });

  const payload = req.body;
  if (!payload || payload.event !== 'message.received') return;

  const data = payload.data || {};
  const phone = normalizePhone(data.from);
  const senderName = data.sender_name || 'PIC';
  const msgType = data.type || 'text';
  const msgText = (data.text || '').trim();
  const mediaUrl = data.media_url || null;
  const buttonId = data.button_id || null;
  const waMessageId = data.message_id || null;

  if (!phone) return;

  // Download media BEFORE anything else — media URLs can expire
  let savedPhotoUrl = null;
  if (mediaUrl && (msgType === 'image' || msgType === 'document')) {
    try {
      const userResult = await query(
        'SELECT id FROM users WHERE phone_number = $1', [phone]
      );
      const userId = userResult.rows[0]?.id || 'unknown';
      savedPhotoUrl = await storageService.savePhotoFromUrl(mediaUrl, 'incoming', userId);
    } catch (err) {
      logger.error('Failed to download media from webhook', { phone, error: err.message });
    }
  }

  // Process asynchronously
  setImmediate(() => processMessage({
    phone, senderName, msgType, msgText, buttonId, waMessageId, savedPhotoUrl,
  }).catch(err => logger.error('Webhook processing error', { phone, error: err.message })));
};

async function processMessage({ phone, senderName, msgType, msgText, buttonId, waMessageId, savedPhotoUrl }) {
  // Identify user
  const userResult = await query(
    'SELECT * FROM users WHERE phone_number = $1 AND is_active = TRUE', [phone]
  );

  if (userResult.rows.length === 0) {
    logger.info('Message from unknown phone', { phone });
    return;
  }

  const user = userResult.rows[0];
  const { state, context } = await conversationService.getState(phone);

  logger.info('Processing WA message', { phone, user: user.full_name, state, msgType, buttonId });

  if (state === CONV_STATE.IDLE) {
    await handleIdleState({ user, phone, msgType, msgText, buttonId, waMessageId, savedPhotoUrl });
  } else if (state === CONV_STATE.AWAITING_PHOTO) {
    await handleAwaitingPhoto({ user, phone, msgType, msgText, savedPhotoUrl, context });
  } else if (state === CONV_STATE.AWAITING_TEXT_AFTER_PHOTO) {
    await handleAwaitingText({ user, phone, msgText, savedPhotoUrl, context, waMessageId });
  }
}

async function handleIdleState({ user, phone, msgType, msgText, buttonId, waMessageId, savedPhotoUrl }) {
  // Parse button click: format is "selesai__taskId" or "kendala__taskId" or "tunda__taskId"
  let action = null;
  let taskId = null;

  if (buttonId) {
    const parts = buttonId.split('__');
    action = parts[0];
    taskId = parts[1] || null;
  }

  // If a task UUID was included in button, validate it
  if (taskId) {
    const taskResult = await query(
      `SELECT t.*, u.phone_number AS pic_phone
       FROM tasks t LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND u.phone_number = $2 AND t.deleted_at IS NULL`,
      [taskId, phone]
    );
    if (taskResult.rows.length === 0) {
      await cloudchatService.sendText(phone, 'Maaf, tugas tidak ditemukan atau sudah tidak aktif.');
      return;
    }
  }

  if (action === BUTTON_IDS.SELESAI && taskId) {
    await conversationService.setState(phone, CONV_STATE.AWAITING_PHOTO, {
      taskId, userId: user.id, statusReported: 'done', photos: [],
    });
    await cloudchatService.sendText(phone, `Bagus! Silakan kirim foto bukti penyelesaian tugas. Jika tidak ada foto, ketik "-" untuk skip.`);

  } else if (action === BUTTON_IDS.KENDALA && taskId) {
    await conversationService.setState(phone, CONV_STATE.AWAITING_TEXT_AFTER_PHOTO, {
      taskId, userId: user.id, statusReported: 'problem', photos: [], isProblem: true,
    });
    await cloudchatService.sendText(phone, `Ceritakan kendala yang Anda hadapi. Anda juga bisa kirim foto jika perlu.`);

  } else if (action === BUTTON_IDS.TUNDA && taskId) {
    await taskService.updateStatus(taskId, TASK_STATUS.IN_PROGRESS);
    await responseService.save({
      taskId, userId: user.id, messageText: 'Tugas ditunda', statusReported: 'in_progress',
      photoUrls: [], waMessageId,
    });
    await cloudchatService.sendText(phone, `Baik, tugas akan ditandai sebagai "Sedang Dikerjakan". Jangan lupa selesaikan segera ya!`);

  } else {
    // No specific button action — check if PIC has tasks today
    const tasks = await taskService.getTasksByPhone(phone);
    if (tasks.length === 0) {
      await cloudchatService.sendText(phone, `Halo ${user.full_name}! Tidak ada tugas aktif untuk Anda hari ini.`);
      return;
    }

    if (tasks.length === 1) {
      // Single task — auto-pick it and show action buttons
      const task = tasks[0];
      await cloudchatService.sendButton(phone, {
        title: task.title,
        text: task.description || `Tugas: ${task.category_name || 'Umum'}`,
        footer: `Prioritas: ${task.priority} | Batas: ${task.due_date}`,
        buttons: [
          { id: `selesai__${task.id}`, text: 'Selesai ✅' },
          { id: `kendala__${task.id}`, text: 'Ada Kendala ⚠️' },
          { id: `tunda__${task.id}`, text: 'Tunda ⏳' },
        ],
      });
    } else {
      // Multiple tasks — list them with buttons for each
      for (const task of tasks.slice(0, 3)) {
        await cloudchatService.sendButton(phone, {
          title: task.title,
          text: `📋 ${task.category_name || 'Tugas'}\n${task.description || ''}`.trim(),
          footer: `Batas: ${task.due_date}`,
          buttons: [
            { id: `selesai__${task.id}`, text: 'Selesai ✅' },
            { id: `kendala__${task.id}`, text: 'Kendala ⚠️' },
            { id: `tunda__${task.id}`, text: 'Tunda ⏳' },
          ],
        });
      }
    }
  }
}

async function handleAwaitingPhoto({ user, phone, msgType, msgText, savedPhotoUrl, context }) {
  if (msgType === 'image' && savedPhotoUrl) {
    const photos = [...(context.photos || []), savedPhotoUrl];
    await conversationService.setState(phone, CONV_STATE.AWAITING_TEXT_AFTER_PHOTO, { ...context, photos });
    await cloudchatService.sendText(phone, `Foto diterima! Tambahkan keterangan pekerjaan (opsional, ketik "-" untuk selesai).`);
  } else if (msgType === 'text') {
    // Skip photo
    await conversationService.setState(phone, CONV_STATE.AWAITING_TEXT_AFTER_PHOTO, { ...context });
    await cloudchatService.sendText(phone, `Tambahkan keterangan pekerjaan (atau ketik "-" untuk selesai tanpa keterangan).`);
  } else {
    await cloudchatService.sendText(phone, `Silakan kirim foto atau ketik "-" untuk melanjutkan tanpa foto.`);
  }
}

async function handleAwaitingText({ user, phone, msgText, savedPhotoUrl, context, waMessageId }) {
  const photos = [...(context.photos || [])];
  if (savedPhotoUrl) photos.push(savedPhotoUrl);

  const finalText = msgText === '-' ? null : msgText;

  const response = await responseService.save({
    taskId: context.taskId,
    userId: user.id,
    messageText: finalText,
    statusReported: context.isProblem ? 'problem' : 'done',
    photoUrls: photos,
    waMessageId,
  });

  if (context.statusReported === 'done') {
    await taskService.updateStatus(context.taskId, TASK_STATUS.COMPLETED);
  }

  await conversationService.resetState(phone);
  await cloudchatService.sendText(phone, `Laporan berhasil dicatat! ✅ Terima kasih, ${user.full_name}. Kerja bagus!`);
}

module.exports = { handle };
