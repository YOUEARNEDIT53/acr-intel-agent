#!/bin/bash
# Setup local cron job for podcast generation
# Run this script once to configure the cron job

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PYTHON_BIN="$PROJECT_DIR/podcast-venv/bin/python"
PODCAST_SCRIPT="$PROJECT_DIR/scripts/generate_podcast.py"
LOG_FILE="$PROJECT_DIR/podcasts/cron.log"

# Create cron entry - runs daily at 8:30 AM (after digest is generated)
CRON_CMD="30 8 * * * cd $PROJECT_DIR && $PYTHON_BIN $PODCAST_SCRIPT >> $LOG_FILE 2>&1"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "generate_podcast.py"; then
    echo "Podcast cron job already exists"
    crontab -l | grep "generate_podcast.py"
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "Podcast cron job added:"
    echo "$CRON_CMD"
fi

echo ""
echo "To run manually: $PYTHON_BIN $PODCAST_SCRIPT"
echo "Logs will be saved to: $LOG_FILE"
