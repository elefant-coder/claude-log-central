-- Claude Log Central - Database Initialization
-- PostgreSQL 16 with JSONB + Partitioning + GIN indexes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Sessions table
CREATE TABLE claude_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(256) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_requests INTEGER DEFAULT 0,
    total_tokens_input BIGINT DEFAULT 0,
    total_tokens_output BIGINT DEFAULT 0,
    total_cost_usd NUMERIC(10, 6) DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    UNIQUE(client_id, session_id)
);

CREATE INDEX idx_sessions_client_id ON claude_sessions(client_id);
CREATE INDEX idx_sessions_started_at ON claude_sessions(started_at DESC);

-- Main logs table (partitioned by month)
CREATE TABLE claude_logs (
    id UUID DEFAULT uuid_generate_v4(),
    client_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(256),
    request_id VARCHAR(256) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model VARCHAR(128),

    -- Request
    prompt JSONB,
    system_prompt TEXT,

    -- Response
    response JSONB,
    stop_reason VARCHAR(64),

    -- Tool usage
    tool_calls JSONB DEFAULT '[]',
    tool_results JSONB DEFAULT '[]',

    -- Computer Use
    computer_use JSONB DEFAULT '[]',

    -- Git operations
    git_operations JSONB DEFAULT '[]',

    -- Metrics
    latency_ms INTEGER,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_usd NUMERIC(10, 6) DEFAULT 0,

    -- Status
    status_code INTEGER DEFAULT 200,
    error JSONB,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create partitions for current and next 6 months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..6 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'claude_logs_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF claude_logs FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END LOOP;
END $$;

-- Indexes
CREATE INDEX idx_logs_client_id ON claude_logs(client_id);
CREATE INDEX idx_logs_session_id ON claude_logs(session_id);
CREATE INDEX idx_logs_timestamp ON claude_logs(timestamp DESC);
CREATE INDEX idx_logs_model ON claude_logs(model);
CREATE INDEX idx_logs_status ON claude_logs(status_code);
CREATE INDEX idx_logs_prompt_gin ON claude_logs USING GIN(prompt jsonb_path_ops);
CREATE INDEX idx_logs_response_gin ON claude_logs USING GIN(response jsonb_path_ops);
CREATE INDEX idx_logs_tool_calls_gin ON claude_logs USING GIN(tool_calls jsonb_path_ops);
CREATE INDEX idx_logs_error ON claude_logs(status_code) WHERE status_code >= 400;

-- Full text search index on common search fields
CREATE INDEX idx_logs_client_timestamp ON claude_logs(client_id, timestamp DESC);

-- Log retention cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM claude_logs WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Auto-create future partitions
CREATE OR REPLACE FUNCTION create_future_partitions()
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..3 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'claude_logs_' || TO_CHAR(start_date, 'YYYY_MM');

        BEGIN
            EXECUTE FORMAT(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF claude_logs FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
        EXCEPTION WHEN duplicate_table THEN
            NULL;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
