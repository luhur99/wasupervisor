const TIMEZONE = 'Asia/Jakarta';

const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const CONV_STATE = {
  IDLE: 'idle',
  AWAITING_PHOTO: 'awaiting_photo',
  AWAITING_TEXT_AFTER_PHOTO: 'awaiting_text_after_photo',
};

const REMINDER_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

const BUTTON_IDS = {
  SELESAI: 'selesai',
  KENDALA: 'kendala',
  TUNDA: 'tunda',
};

const CONV_EXPIRY_HOURS = 2;
const MAX_PHOTOS_PER_RESPONSE = 5;

module.exports = {
  TIMEZONE,
  TASK_STATUS,
  TASK_PRIORITY,
  CONV_STATE,
  REMINDER_STATUS,
  BUTTON_IDS,
  CONV_EXPIRY_HOURS,
  MAX_PHOTOS_PER_RESPONSE,
};
