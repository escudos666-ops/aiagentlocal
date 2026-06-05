#!/bin/bash
# Automated backup script for critical Agentics volumes
# Usage: ./backup.sh [dev|prod]

set -e

ENVIRONMENT=${1:-dev}
BACKUP_DIR="./backups/${ENVIRONMENT}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting backup for $ENVIRONMENT environment..."

# Backup PostgreSQL
echo "📦 Backing up PostgreSQL..."
docker exec postgres pg_dump -U ${POSTGRES_USER:-admin} -d ${POSTGRES_DB:-agentdb} > "$BACKUP_DIR/postgres_$TIMESTAMP.sql"
gzip "$BACKUP_DIR/postgres_$TIMESTAMP.sql"
echo "✓ PostgreSQL backed up: postgres_$TIMESTAMP.sql.gz"

# Backup Qdrant
echo "📦 Backing up Qdrant vector database..."
tar -czf "$BACKUP_DIR/qdrant_$TIMESTAMP.tar.gz" ./data/qdrant
echo "✓ Qdrant backed up: qdrant_$TIMESTAMP.tar.gz"

# Backup MinIO
echo "📦 Backing up MinIO object storage..."
tar -czf "$BACKUP_DIR/minio_$TIMESTAMP.tar.gz" ./data/minio
echo "✓ MinIO backed up: minio_$TIMESTAMP.tar.gz"

# Backup n8n workflows and configs
echo "📦 Backing up n8n workflows..."
tar -czf "$BACKUP_DIR/n8n_$TIMESTAMP.tar.gz" ./data/n8n
echo "✓ n8n backed up: n8n_$TIMESTAMP.tar.gz"

# Optional: Backup Redis (useful if it contains session state)
echo "📦 Backing up Redis..."
docker exec redis redis-cli --rdb /tmp/dump_$TIMESTAMP.rdb 2>/dev/null || echo "⚠ Redis backup skipped (optional)"
if [ -f /tmp/dump_$TIMESTAMP.rdb ]; then
  cp /tmp/dump_$TIMESTAMP.rdb "$BACKUP_DIR/"
  rm /tmp/dump_$TIMESTAMP.rdb
  echo "✓ Redis backed up"
fi

# Clean old backups (keep last 7 days)
echo "🧹 Cleaning old backups (older than 7 days)..."
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo ""
echo "✅ Backup complete! Backups stored in: $BACKUP_DIR"
echo ""
ls -lh "$BACKUP_DIR" | tail -5
