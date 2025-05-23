-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the chunks table
CREATE TABLE IF NOT EXISTS chunks (
    owner TEXT NOT NULL,
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    path TEXT NOT NULL,
    type TEXT NOT NULL,
    index INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    shasum TEXT NOT NULL,
    vector vector(768) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner, repository, branch, path, type, index, chunk_index)
);

-- Create an index for faster vector similarity search
CREATE INDEX IF NOT EXISTS chunks_vector_idx ON chunks USING ivfflat (vector vector_cosine_ops)
WITH (lists = 100);

-- Create a function for vector similarity search
CREATE OR REPLACE FUNCTION match_chunks(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT,
    type_param TEXT,
    query_embedding vector(768),
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    owner TEXT,
    repository TEXT,
    branch TEXT,
    path TEXT,
    type TEXT,
    index INTEGER,
    chunk_index INTEGER,
    content TEXT,
    shasum TEXT,
    vector vector(768),
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        chunks.owner,
        chunks.repository,
        chunks.branch,
        chunks.path,
        chunks.type,
        chunks.index,
        chunks.chunk_index,
        chunks.content,
        chunks.shasum,
        chunks.vector,
        1 - (chunks.vector <=> query_embedding) as similarity
    FROM chunks
    WHERE chunks.owner = owner_param
    AND chunks.repository = repository_param
    AND chunks.branch = branch_param
    AND chunks.type = type_param
    ORDER BY chunks.vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chunks_updated_at
    BEFORE UPDATE ON chunks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a function to get distinct paths
CREATE OR REPLACE FUNCTION get_distinct_paths(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT
)
RETURNS TABLE (
    path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT chunks.path
    FROM chunks
    WHERE chunks.owner = owner_param
    AND chunks.repository = repository_param
    AND chunks.branch = branch_param
    ORDER BY chunks.path;
END;
$$;

-- Create a function to delete all entries from a specific branch
CREATE OR REPLACE FUNCTION delete_branch_entries(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM chunks
    WHERE owner = owner_param
    AND repository = repository_param
    AND branch = branch_param;
END;
$$;

-- Create a function to delete entries from a specific branch and path
CREATE OR REPLACE FUNCTION delete_branch_path_entries(
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
    DELETE FROM chunks
    WHERE owner = owner_param
    AND repository = repository_param
    AND branch = branch_param
    AND path = path_param;
END;
$$;

-- Create a function to duplicate all entries from one branch to another
CREATE OR REPLACE FUNCTION duplicate_branch_entries(
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
    INSERT INTO chunks (
        owner,
        repository,
        branch,
        path,
        type,
        index,
        chunk_index,
        content,
        shasum,
        vector,
        created_at,
        updated_at
    )
    SELECT
        owner,
        repository,
        target_branch_param AS branch, -- <--- aquí cambiamos el branch
        path,
        type,
        index,
        chunk_index,
        content,
        shasum,
        vector,
        CURRENT_TIMESTAMP, -- nuevo created_at
        CURRENT_TIMESTAMP  -- nuevo updated_at
    FROM chunks
    WHERE owner = owner_param
      AND repository = repository_param
      AND branch = source_branch_param;
END;
$$;

-- Create a function to duplicate entries from one branch and file (path) to another branch
CREATE OR REPLACE FUNCTION duplicate_file_entries(
    owner_param TEXT,
    repository_param TEXT,
    source_branch_param TEXT,
    path_param TEXT,
    target_branch_param TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO chunks (
        owner,
        repository,
        branch,
        path,
        type,
        index,
        chunk_index,
        content,
        shasum,
        vector,
        created_at,
        updated_at
    )
    SELECT
        owner,
        repository,
        target_branch_param AS branch, -- Cambiamos solo el branch
        path,
        type,
        index,
        chunk_index,
        content,
        shasum,
        vector,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    FROM chunks
    WHERE owner = owner_param
      AND repository = repository_param
      AND branch = source_branch_param
      AND path = path_param;
END;
$$;

-- Create a function to count entries from a specific branch
CREATE OR REPLACE FUNCTION count_branch_entries(
    owner_param TEXT,
    repository_param TEXT,
    branch_param TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    entry_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO entry_count
    FROM chunks
    WHERE owner = owner_param
      AND repository = repository_param
      AND branch = branch_param;

    RETURN entry_count;
END;
$$;

-- Create a function to get the vector of a chunk's content
CREATE OR REPLACE FUNCTION get_vector_of_chunk_content(
    owner_param TEXT,
    repository_param TEXT,
    content_param TEXT
)
RETURNS vector(768)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_vector vector(768);
BEGIN
    -- Get the vector from the first matching chunk
    SELECT vector INTO result_vector
    FROM chunks
    WHERE owner = owner_param
    AND repository = repository_param
    AND content = content_param
    LIMIT 1;

    RETURN result_vector;
END;
$$;
