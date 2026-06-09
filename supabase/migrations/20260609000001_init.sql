-- Initial migration: enable pgvector for semantic search.
-- [Source: architecture.md DR-4 / FR2 — workflow_embeddings uses vector(1536) + HNSW]
-- Feature tables land in their own stories (profiles = 1.4, professions = 1.5, …).
create extension if not exists vector;
