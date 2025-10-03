-- Chat messages table (excluding summaries)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'system' | 'user' | 'character'
  content TEXT NOT NULL,
  emoticon TEXT,
  created_at TEXT NOT NULL,  -- ISO datetime string
  created_timestamp INTEGER NOT NULL  -- Unix timestamp for indexing
);

-- Summary table (separate from regular messages)
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,  -- ISO datetime string
  created_timestamp INTEGER NOT NULL,  -- Unix timestamp for indexing
  message_count INTEGER,  -- Number of messages summarized
  UNIQUE(character, created_timestamp)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_character ON messages(character);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(character, created_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_character ON summaries(character);
CREATE INDEX IF NOT EXISTS idx_summaries_timestamp ON summaries(character, created_timestamp DESC);
