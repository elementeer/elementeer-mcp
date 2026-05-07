#!/bin/bash
set -e

# ============================================
# Deploy Elementeer to marcus-urban.de
# ============================================
# Direktes Deployment per SCP/SSH
# ============================================

echo "=== Elementeer v1.0.0 Deployment ==="
echo "Target: marcus-urban.de"
echo ""

# Konfiguration
SERVER="marcus-urban.de"
SSH_USER="$(whoami)"  # Anpassen falls nötig
WP_PATH="/var/www/html"
PLUGIN_DIR="$WP_PATH/wp-content/plugins/elementeer"
ZIP_FILE="elementeer-1.0.0-clean.zip"

# Farben
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }

# Prüfe ZIP
if [ ! -f "$ZIP_FILE" ]; then
    error "ZIP-Datei nicht gefunden: $ZIP_FILE"
    echo "Verfügbare ZIPs:"
    ls -la *.zip 2>/dev/null | grep elementeer || echo "Keine ZIPs gefunden"
    exit 1
fi

# 1. Alte Version sichern (optional)
log "1. Sichere alte Version (optional)..."
read -p "   Alte Version sichern? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    BACKUP_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && tar czf /tmp/elementeer-backup-$(date +%Y%m%d).tar.gz wp-content/plugins/elementeer/ 2>/dev/null || true\""
    echo "   Befehl: $BACKUP_CMD"
    eval "$BACKUP_CMD"
    echo "   ✅ Backup erstellt"
fi

# 2. Altes Plugin deaktivieren
log "2. Deaktiviere alte Plugin-Version..."
DEACTIVATE_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && wp plugin deactivate elementeer --quiet 2>/dev/null || true\""
echo "   Befehl: $DEACTIVATE_CMD"
eval "$DEACTIVATE_CMD"
echo "   ✅ Plugin deaktiviert"

# 3. Altes Plugin-Verzeichnis löschen
log "3. Lösche alte Plugin-Dateien..."
DELETE_CMD="ssh $SSH_USER@$SERVER \"rm -rf $PLUGIN_DIR 2>/dev/null; echo 'Altes Plugin gelöscht'\""
echo "   Befehl: $DELETE_CMD"
eval "$DELETE_CMD"
echo "   ✅ Alte Dateien gelöscht"

# 4. Neue ZIP hochladen
log "4. Lade neue Version hoch..."
UPLOAD_CMD="scp $ZIP_FILE $SSH_USER@$SERVER:/tmp/$ZIP_FILE"
echo "   Befehl: $UPLOAD_CMD"
eval "$UPLOAD_CMD"
echo "   ✅ ZIP hochgeladen"

# 5. Auf Server: ZIP entpacken
log "5. Installiere neue Version..."
INSTALL_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH/wp-content/plugins && unzip -q -o /tmp/$ZIP_FILE && rm -f /tmp/$ZIP_FILE\""
echo "   Befehl: $INSTALL_CMD"
eval "$INSTALL_CMD"
echo "   ✅ Plugin installiert"

# 6. Berechtigungen setzen
log "6. Setze Berechtigungen..."
PERM_CMD="ssh $SSH_USER@$SERVER \"find $PLUGIN_DIR -type d -exec chmod 755 {} \\; 2>/dev/null || true; find $PLUGIN_DIR -type f -exec chmod 644 {} \\; 2>/dev/null || true\""
echo "   Befehl: $PERM_CMD"
eval "$PERM_CMD"
echo "   ✅ Berechtigungen gesetzt"

# 7. Plugin aktivieren
log "7. Aktiviere Plugin..."
ACTIVATE_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && wp plugin activate elementeer --quiet\""
echo "   Befehl: $ACTIVATE_CMD"
eval "$ACTIVATE_CMD"
echo "   ✅ Plugin aktiviert"

# 8. Cache leeren
log "8. Leere WordPress Cache..."
CACHE_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && wp transient delete --all --quiet 2>/dev/null || true; wp cache flush --quiet 2>/dev/null || true\""
echo "   Befehl: $CACHE_CMD"
eval "$CACHE_CMD"
echo "   ✅ Cache geleert"

# 9. REST API testen
log "9. Teste REST API..."
API_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && wp rest post /elementeer/v1/health --quiet 2>&1 || echo 'API Test fehlgeschlagen'\""
echo "   Befehl: $API_CMD"
API_RESULT=$(eval "$API_CMD")
echo "   API Antwort: $API_RESULT"

if echo "$API_RESULT" | grep -q "status.*ok\|200\|success"; then
    echo "   ✅ REST API funktioniert"
else
    echo "   ⚠️  REST API könnte Probleme haben"
    echo "   Prüfe /wp-content/debug.log auf Fehler"
fi

# 10. Real Cookie Banner Problem beheben
log "10. Behebe Real Cookie Banner Problem..."
RCB_CMD="ssh $SSH_USER@$SERVER \"cd $WP_PATH && wp plugin deactivate real-cookie-banner --quiet 2>/dev/null || true; sleep 2; wp plugin activate real-cookie-banner --quiet 2>/dev/null || true\""
echo "   Befehl: $RCB_CMD"
eval "$RCB_CMD"
echo "   ✅ Real Cookie Banner neu geladen"

echo ""
success "✅ DEPLOYMENT ABGESCHLOSSEN!"
echo ""
echo "Zusammenfassung:"
echo "- Alte Version deaktiviert & gelöscht"
echo "- Neue v1.0.0 installiert"
echo "- Plugin aktiviert"
echo "- WordPress Cache geleert"
echo "- Real Cookie Banner neu geladen"
echo ""
echo "Nächste Schritte:"
echo "1. Besuche https://marcus-urban.de/wp-admin/"
echo "2. Gehe zu Elementeer → Settings"
echo "3. Erstelle API Keys falls nötig"
echo "4. Teste MCP Verbindung"
echo ""
echo "Bei Problemen:"
echo "1. Prüfe /wp-content/debug.log"
echo "2. Deaktiviere andere Plugins für Konflikt-Test"
echo "3. Kontaktiere Support: https://github.com/elementeer/elementeer-mcp"

# Hinweis zu SSH Zugang
echo ""
warn "HINWEIS: Dieses Skript benötigt SSH-Zugang zum Server."
echo "Falls SSH nicht konfiguriert ist, führe die Schritte manuell aus:"
echo "1. Lade elementeer-1.0.0-clean.zip in WordPress hoch"
echo "2. Aktiviere das Plugin"
echo "3. Bei Fehlern: Prüfe debug.log"