-- Create the ai_file_cache table to store AI-generated file descriptions and relationships
CREATE TABLE IF NOT EXISTS ai_file_cache (
    owner TEXT NOT NULL,
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    file_name TEXT NOT NULL,
    path TEXT NOT NULL,
    sha TEXT NOT NULL,
    description TEXT NOT NULL,
    consumes TEXT[] DEFAULT ARRAY[]::TEXT[],
    consumed_by TEXT[] DEFAULT ARRAY[]::TEXT[],
    error_counter_total INTEGER DEFAULT 0,
    error_counter_critical INTEGER DEFAULT 0,
    error_counter_high INTEGER DEFAULT 0,
    error_counter_medium INTEGER DEFAULT 0,
    error_counter_low INTEGER DEFAULT 0,
    error_types TEXT[] DEFAULT ARRAY[]::TEXT[],
    errors_payload TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner, repository, branch, path)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS ai_file_cache_owner_repo_branch_idx ON ai_file_cache(owner, repository, branch);
CREATE INDEX IF NOT EXISTS ai_file_cache_path_idx ON ai_file_cache(path);
CREATE INDEX IF NOT EXISTS ai_file_cache_sha_idx ON ai_file_cache(sha);

-- Create a trigger to update the last_updated timestamp
CREATE OR REPLACE FUNCTION update_ai_file_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_file_cache_updated_at
    BEFORE UPDATE ON ai_file_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_file_cache_updated_at();

-- Create a function to get file cache by path
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

-- Create a function to get all file caches for a branch
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

-- Create a function to delete file cache entries by branch
CREATE OR REPLACE FUNCTION delete_ai_file_cache_by_branch(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM ai_file_cache
    WHERE owner = owner_param
    AND repository = repository_param
    AND branch = branch_param;
END;
$$;

-- Create a function to delete file cache entries by path
CREATE OR REPLACE FUNCTION delete_ai_file_cache_by_path(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT,
    path_param TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM ai_file_cache
    WHERE owner = owner_param
    AND repository = repository_param
    AND branch = branch_param
    AND path = path_param;
END;
$$;

-- Create a function to duplicate file cache entries from one branch to another
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

