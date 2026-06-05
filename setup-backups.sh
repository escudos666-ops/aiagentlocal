#!/bin/bash
# Setup automated backups with cron
# Run this once to configure automatic daily backups at 2 AM

BACKUP_SCRIPT="$(pwd)/backup.sh"
CRON_JOB="0 2 * * * $BACKUP_SCRIPT prod >> $(pwd)/backups/cron.log 2>&1"

echo "Setting up automated backups..."
echo "Backup script: $BACKUP_SCRIPT"
echo "Schedule: Daily at 2:00 AM"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
  echo "⚠️  Cron job already configured."
  crontab -l | grep backup.sh
else
  # Add the cron job
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "✅ Cron job added successfully"
  echo ""
  echo "Current cron jobs:"
  crontab -l | grep backup.sh
fi

echo ""
echo "View cron logs: tail -f $(pwd)/backups/cron.log"
echo "List scheduled cron jobs: crontab -l"
echo "Remove this cron job: crontab -e (and delete the line)"
