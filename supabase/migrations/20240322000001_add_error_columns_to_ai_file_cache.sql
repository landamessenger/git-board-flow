-- Migration script to add error columns to existing ai_file_cache table
-- This script adds the new error-related columns and fills existing rows with default values

-- Add new columns if they don't exist
DO $$
BEGIN
    -- Add error_counter_total
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_counter_total'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_counter_total INTEGER DEFAULT 0;
    END IF;

    -- Add error_counter_critical
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_counter_critical'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_counter_critical INTEGER DEFAULT 0;
    END IF;

    -- Add error_counter_high
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_counter_high'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_counter_high INTEGER DEFAULT 0;
    END IF;

    -- Add error_counter_medium
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_counter_medium'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_counter_medium INTEGER DEFAULT 0;
    END IF;

    -- Add error_counter_low
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_counter_low'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_counter_low INTEGER DEFAULT 0;
    END IF;

    -- Add error_types
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'error_types'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN error_types TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;

    -- Add errors_payload
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_file_cache' AND column_name = 'errors_payload'
    ) THEN
        ALTER TABLE ai_file_cache ADD COLUMN errors_payload TEXT;
    END IF;
END $$;

-- Update existing rows to set default values for new columns
-- This ensures all existing rows have the correct default values
UPDATE ai_file_cache
SET 
    error_counter_total = COALESCE(error_counter_total, 0),
    error_counter_critical = COALESCE(error_counter_critical, 0),
    error_counter_high = COALESCE(error_counter_high, 0),
    error_counter_medium = COALESCE(error_counter_medium, 0),
    error_counter_low = COALESCE(error_counter_low, 0),
    error_types = COALESCE(error_types, ARRAY[]::TEXT[]),
    errors_payload = COALESCE(errors_payload, NULL)
WHERE 
    error_counter_total IS NULL 
    OR error_counter_critical IS NULL 
    OR error_counter_high IS NULL 
    OR error_counter_medium IS NULL 
    OR error_counter_low IS NULL 
    OR error_types IS NULL;

-- Drop existing functions before recreating them with new columns
DROP FUNCTION IF EXISTS get_ai_file_cache(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_ai_file_caches_by_branch(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS duplicate_ai_file_cache_by_branch(TEXT, TEXT, TEXT, TEXT);

-- Update the get_ai_file_cache function to include new columns
CREATE OR REPLACE FUNCTION get_ai_file_cache(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT,
    path_param TEXT
)
RETURNS TABLE (
    owner TEXT,
    repository TEXT,
    branch TEXT,
    file_name TEXT,
    path TEXT,
    sha TEXT,
    description TEXT,
    consumes TEXT[],
    consumed_by TEXT[],
    error_counter_total INTEGER,
    error_counter_critical INTEGER,
    error_counter_high INTEGER,
    error_counter_medium INTEGER,
    error_counter_low INTEGER,
    error_types TEXT[],
    errors_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ai_file_cache.owner,
        ai_file_cache.repository,
        ai_file_cache.branch,
        ai_file_cache.file_name,
        ai_file_cache.path,
        ai_file_cache.sha,
        ai_file_cache.description,
        ai_file_cache.consumes,
        ai_file_cache.consumed_by,
        ai_file_cache.error_counter_total,
        ai_file_cache.error_counter_critical,
        ai_file_cache.error_counter_high,
        ai_file_cache.error_counter_medium,
        ai_file_cache.error_counter_low,
        ai_file_cache.error_types,
        ai_file_cache.errors_payload,
        ai_file_cache.created_at,
        ai_file_cache.last_updated
    FROM ai_file_cache
    WHERE ai_file_cache.owner = owner_param
    AND ai_file_cache.repository = repository_param
    AND ai_file_cache.branch = branch_param
    AND ai_file_cache.path = path_param
    LIMIT 1;
END;
$$;

-- Update the get_ai_file_caches_by_branch function to include new columns
CREATE OR REPLACE FUNCTION get_ai_file_caches_by_branch(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT
)
RETURNS TABLE (
    owner TEXT,
    repository TEXT,
    branch TEXT,
    file_name TEXT,
    path TEXT,
    sha TEXT,
    description TEXT,
    consumes TEXT[],
    consumed_by TEXT[],
    error_counter_total INTEGER,
    error_counter_critical INTEGER,
    error_counter_high INTEGER,
    error_counter_medium INTEGER,
    error_counter_low INTEGER,
    error_types TEXT[],
    errors_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ai_file_cache.owner,
        ai_file_cache.repository,
        ai_file_cache.branch,
        ai_file_cache.file_name,
        ai_file_cache.path,
        ai_file_cache.sha,
        ai_file_cache.description,
        ai_file_cache.consumes,
        ai_file_cache.consumed_by,
        ai_file_cache.error_counter_total,
        ai_file_cache.error_counter_critical,
        ai_file_cache.error_counter_high,
        ai_file_cache.error_counter_medium,
        ai_file_cache.error_counter_low,
        ai_file_cache.error_types,
        ai_file_cache.errors_payload,
        ai_file_cache.created_at,
        ai_file_cache.last_updated
    FROM ai_file_cache
    WHERE ai_file_cache.owner = owner_param
    AND ai_file_cache.repository = repository_param
    AND ai_file_cache.branch = branch_param
    ORDER BY ai_file_cache.path;
END;
$$;

-- Update the duplicate_ai_file_cache_by_branch function to include new columns
CREATE OR REPLACE FUNCTION duplicate_ai_file_cache_by_branch(
    owner_param TEXT,
    repository_param TEXT,
    source_branch_param TEXT,
    target_branch_param TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO ai_file_cache (
        owner,
        repository,
        branch,
        file_name,
        path,
        sha,
        description,
        consumes,
        consumed_by,
        error_counter_total,
        error_counter_critical,
        error_counter_high,
        error_counter_medium,
        error_counter_low,
        error_types,
        errors_payload,
        created_at,
        last_updated
    )
    SELECT
        owner,
        repository,
        target_branch_param AS branch,
        file_name,
        path,
        sha,
        description,
        consumes,
        consumed_by,
        error_counter_total,
        error_counter_critical,
        error_counter_high,
        error_counter_medium,
        error_counter_low,
        error_types,
        errors_payload,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM ai_file_cache
    WHERE owner = owner_param
    AND repository = repository_param
    AND branch = source_branch_param
    ON CONFLICT (owner, repository, branch, path) DO UPDATE SET
        sha = EXCLUDED.sha,
        description = EXCLUDED.description,
        consumes = EXCLUDED.consumes,
        consumed_by = EXCLUDED.consumed_by,
        error_counter_total = EXCLUDED.error_counter_total,
        error_counter_critical = EXCLUDED.error_counter_critical,
        error_counter_high = EXCLUDED.error_counter_high,
        error_counter_medium = EXCLUDED.error_counter_medium,
        error_counter_low = EXCLUDED.error_counter_low,
        error_types = EXCLUDED.error_types,
        errors_payload = EXCLUDED.errors_payload,
        last_updated = CURRENT_TIMESTAMP;
END;
$$;

