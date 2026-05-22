-- TeamSync Schema Extensions
-- Threads, reactions, mentions, DMs, notifications, files, voice rooms, audit logs, search

-- ── Schema Updates to Existing Tables ───────────────────────

-- Add parent_message_id to messages for thread replies
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);

-- Add archived_at to channels for soft delete
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_channels_archived ON channels(archived_at) WHERE archived_at IS NULL;

-- ── Threads ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_message_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_parent ON message_threads(parent_message_id);

-- ── Reactions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON message_reactions(user_id);

-- ── Mentions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON message_mentions(mentioned_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_mentions_message ON message_mentions(message_id);

-- ── DM Conversations ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id))
);

CREATE INDEX IF NOT EXISTS idx_dm_user_a ON dm_conversations(user_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_user_b ON dm_conversations(user_b_id, last_message_at DESC);

-- ── DM Messages ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_conv ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON dm_messages(sender_id);

-- ── Notifications ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'reaction', 'workflow', 'deployment', 'incident', 'ai_summary', 'approval')),
  title TEXT NOT NULL,
  body TEXT,
  source_service TEXT NOT NULL,
  source_id TEXT,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(user_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications(source_service, source_id);

-- ── File Attachments ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  dm_message_id UUID REFERENCES dm_messages(id) ON DELETE SET NULL,
  uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_dm ON file_attachments(dm_message_id);

-- ── Channel Members ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channel_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  last_read_at TIMESTAMPTZ,
  notification_preference TEXT NOT NULL DEFAULT 'all' CHECK (notification_preference IN ('all', 'mentions', 'none')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

-- ── Voice Rooms ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voice_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sfu_provider TEXT NOT NULL DEFAULT 'livekit',
  sfu_room_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  participant_count INTEGER NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_rooms_channel ON voice_rooms(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_rooms_active ON voice_rooms(is_active, participant_count DESC);

-- ── Voice Room Participants ──────────────────────────────────

CREATE TABLE IF NOT EXISTS voice_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  UNIQUE(room_id, user_id, joined_at)
);

CREATE INDEX IF NOT EXISTS idx_voice_participants_room ON voice_room_participants(room_id, left_at);

-- ── Audit Logs ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS message_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  dm_message_id UUID REFERENCES dm_messages(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create', 'edit', 'delete', 'react', 'unreact', 'mention')),
  previous_content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_message ON message_audit_logs(message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON message_audit_logs(actor_id, created_at DESC);

-- ── AI Summaries ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  thread_parent_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  summary_type TEXT NOT NULL CHECK (summary_type IN ('channel_daily', 'channel_weekly', 'thread', 'meeting', 'workflow')),
  content TEXT NOT NULL,
  source_message_count INTEGER NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'gpt-4o',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_channel ON ai_summaries(channel_id, summary_type, created_at DESC);

-- ── Search Vector Extension ──────────────────────────────────

ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_message_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_message_search ON messages;
CREATE TRIGGER trg_update_message_search
  BEFORE INSERT OR UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_message_search_vector();

-- Backfill search vectors for existing messages
UPDATE messages SET search_vector = to_tsvector('english', COALESCE(content, ''))
WHERE search_vector IS NULL;

-- ── Vector Extension for Semantic Search ─────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);

-- ── Updated At Triggers ──────────────────────────────────────

CREATE TRIGGER update_voice_rooms_updated_at BEFORE UPDATE ON voice_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS Policies ─────────────────────────────────────────────

-- Channel members: users can only see channels they are members of (for private channels)
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY channel_members_select ON channel_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY channel_members_insert ON channel_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner', 'admin')
    )
  );

-- Notifications: users can only see their own
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- DM conversations: users can only see their own conversations
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_conversations_select ON dm_conversations
  FOR SELECT USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- DM messages: users can only see messages in their conversations
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dm_messages_select ON dm_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dm_conversations dc
      WHERE dc.id = dm_messages.conversation_id
      AND (dc.user_a_id = auth.uid() OR dc.user_b_id = auth.uid())
    )
  );

-- File attachments: users can see files from channels they are members of or their DMs
ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY file_attachments_select ON file_attachments
  FOR SELECT USING (
    uploader_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM messages m
      JOIN channel_members cm ON m.channel_id = cm.channel_id
      WHERE m.id = file_attachments.message_id AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM dm_messages dm
      JOIN dm_conversations dc ON dm.conversation_id = dc.id
      WHERE dm.id = file_attachments.dm_message_id
      AND (dc.user_a_id = auth.uid() OR dc.user_b_id = auth.uid())
    )
  );
