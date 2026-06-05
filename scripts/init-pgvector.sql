-- Enable pgvector extension for Open WebUI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the openwebui database if it doesn't exist
CREATE DATABASE openwebui;
