-- Script to create read-only database user for production
-- Run this after the initial schema setup

-- Create read-only user (replace password)
CREATE USER f1_readonly WITH PASSWORD 'CHANGE_THIS_PASSWORD';

-- Grant connect privilege
GRANT CONNECT ON DATABASE neondb TO f1_readonly;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO f1_readonly;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO f1_readonly;

-- Grant SELECT on all sequences (for reading current values)
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO f1_readonly;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO f1_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO f1_readonly;

-- Optional: Create a specific connection limit for the read-only user
ALTER USER f1_readonly CONNECTION LIMIT 50;
