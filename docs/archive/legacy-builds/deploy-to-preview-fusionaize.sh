#!/bin/bash
set -e

echo "=== Deploy Elementeer v2.0.0 to preview.fusionaize.com ==="
echo ""

# Configuration
SERVER="preview.fusionaize.com"
SSH_USER="$(whoami)"
WP_PATH="/var/www/html"
ZIP_FILE="elementeer-2.0.0-final-fixed.zip"

# Call generic deploy script
exec ./deploy-plugin.sh "$SERVER" "$SSH_USER" "$WP_PATH" "$ZIP_FILE"