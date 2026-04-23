-- WA Supervisor - Initial Database Schema
-- Run: psql -U wa_supervisor_user -d wa_supervisor -f 001_initial_schema.sql

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role       AS ENUM ('supervisor', 'pic');
CREATE TYPE task_status     AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_priority   AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE reminder_status AS ENUM ('queued', 'sent', 'failed', 'skipped');
CREATE TYPE conv_state      AS ENUM ('idle', 'awaiting_photo', 'awaiting_text_after_photo');
CREATE TYPE review_period   AS ENUM ('weekly', 'monthly');

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(100)    NOT NULL,
    phone_number    VARCHAR(20)     NOT NULL UNIQUE,
    email           VARCHAR(100)    UNIQUE,
    role            user_role       NOT NULL DEFAULT 'pic',
    department      VARCHAR(100),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    wa_verified_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_phone  ON users(phone_number);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================
-- TABLE: task_categories
-- ============================================================
CREATE TABLE task_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(80)   NOT NULL UNIQUE,
    description TEXT,
    color_hex   CHAR(7)       DEFAULT '#3B82F6',
    icon        VARCHAR(50)   DEFAULT 'tasks',
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title           VARCHAR(200)    NOT NULL,
    description     TEXT,
    category_id     INTEGER         REFERENCES task_categories(id) ON DELETE SET NULL,
    assigned_to     UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    status          task_status     NOT NULL DEFAULT 'pending',
    priority        task_priority   NOT NULL DEFAULT 'medium',
    due_date        DATE            NOT NULL,
    due_time        TIME,
    recurrence      VARCHAR(50),
    recurrence_end  DATE,
    location        VARCHAR(200),
    checklist       JSONB           DEFAULT '[]',
    custom_fields   JSONB           DEFAULT '{}',
    send_reminder   BOOLEAN         NOT NULL DEFAULT TRUE,
    reminder_hour   SMALLINT        NOT NULL DEFAULT 8,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned  ON tasks(assigned_to);
CREATE INDEX idx_tasks_status    ON tasks(status);
CREATE INDEX idx_tasks_due_date  ON tasks(due_date);
CREATE INDEX idx_tasks_category  ON tasks(category_id);
CREATE INDEX idx_tasks_deleted   ON tasks(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_reminder  ON tasks(send_reminder, due_date, reminder_hour)
    WHERE deleted_at IS NULL;

-- ============================================================
-- TABLE: task_responses
-- ============================================================
CREATE TABLE task_responses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID            NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
    message_text    TEXT,
    status_reported VARCHAR(50),
    photo_urls      TEXT[]          DEFAULT '{}',
    media_message_ids TEXT[]        DEFAULT '{}',
    metadata        JSONB           DEFAULT '{}',
    ai_summary      TEXT,
    flagged         BOOLEAN         NOT NULL DEFAULT FALSE,
    flag_reason     TEXT,
    wa_message_id   VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responses_task    ON task_responses(task_id);
CREATE INDEX idx_responses_user    ON task_responses(user_id);
CREATE INDEX idx_responses_date    ON task_responses(response_date);
CREATE INDEX idx_responses_flagged ON task_responses(flagged) WHERE flagged = TRUE;

-- ============================================================
-- TABLE: reminder_log
-- ============================================================
CREATE TABLE reminder_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID            NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          reminder_status NOT NULL DEFAULT 'queued',
    wa_message_id   VARCHAR(100),
    message_preview TEXT,
    scheduled_for   TIMESTAMPTZ     NOT NULL,
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reminders_task      ON reminder_log(task_id);
CREATE INDEX idx_reminders_user      ON reminder_log(user_id);
CREATE INDEX idx_reminders_status    ON reminder_log(status);
CREATE INDEX idx_reminders_scheduled ON reminder_log(scheduled_for);

-- ============================================================
-- TABLE: conversation_state
-- ============================================================
CREATE TABLE conversation_state (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number    VARCHAR(20)     NOT NULL UNIQUE,
    state           conv_state      NOT NULL DEFAULT 'idle',
    context         JSONB           DEFAULT '{}',
    expires_at      TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conv_phone   ON conversation_state(phone_number);
CREATE INDEX idx_conv_expires ON conversation_state(expires_at);

-- ============================================================
-- TABLE: performance_reviews
-- ============================================================
CREATE TABLE performance_reviews (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period                  review_period   NOT NULL,
    period_start            DATE            NOT NULL,
    period_end              DATE            NOT NULL,
    tasks_assigned          INTEGER         NOT NULL DEFAULT 0,
    tasks_completed         INTEGER         NOT NULL DEFAULT 0,
    tasks_overdue           INTEGER         NOT NULL DEFAULT 0,
    response_rate           NUMERIC(5,2),
    avg_response_time_hours NUMERIC(8,2),
    problem_reports         INTEGER         NOT NULL DEFAULT 0,
    quality_score           NUMERIC(3,1),
    ai_review_text          TEXT,
    ai_strengths            TEXT[],
    ai_improvements         TEXT[],
    sent_to_supervisor_at   TIMESTAMPTZ,
    sent_to_pic_at          TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_user   ON performance_reviews(user_id);
CREATE INDEX idx_reviews_period ON performance_reviews(period_start, period_end);
CREATE UNIQUE INDEX idx_reviews_unique ON performance_reviews(user_id, period, period_start);

-- ============================================================
-- TABLE: api_keys
-- ============================================================
CREATE TABLE api_keys (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(100)    NOT NULL,
    key_hash     CHAR(64)        NOT NULL UNIQUE,
    permissions  JSONB           DEFAULT '["read"]',
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log
-- ============================================================
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_type  VARCHAR(20)     NOT NULL,
    actor_id    UUID,
    action      VARCHAR(80)     NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    changes     JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor  ON audit_log(actor_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_time   ON audit_log(created_at);

-- ============================================================
-- AUTO updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conv_updated_at
    BEFORE UPDATE ON conversation_state FOR EACH ROW EXECUTE FUNCTION set_updated_at();
