# ELM-RENDER-002 — Nachweis

Blockiert auf: Playwright-Chromium nicht auf dieser Maschine installierbar (CDN 400).
Kein Code-Fehler im MCP-Server oder in der Bridge.

## Was laeuft
- MCP-Server feature/ELM-RENDER-002-screenshots, Commits 20ea5e0 + e11e4e1 + [NEXT]
- elementeer-bridge/apps/api, Stand feature/ELM-RENDER-002
- Redis 6380, Postgres 5433, MySQL 3307

## Bridge-Vertrag (verbindlich)
```
POST /api/pages/{pageId}/screenshots
Body:     { template, contentHash?, containers? }
Response: { pageId, contentHash, screenshots{desktop,tablet,mobile}, capturedAt }
Static:   /static/page-screenshots/{pageId}/{contentHash}/{viewport}.png
```

## Bridge starten
```bash
cd elementeer-bridge/apps/api
API_PORT=3201 \
REDIS_URL=redis://localhost:6380 \
DATABASE_URL='postgresql://elementify:elementify_password@localhost:5433/elementify_auth' \
pnpm dev
```

## Bridge API-Key
Entweder direkt in die DB (Postgres 5433):
```bash
node -e "const crypto=require('crypto'); const p=crypto.randomBytes(32).toString('hex'); const h=crypto.createHash('sha256').update(p).digest('hex'); console.log('plain:',p,'\nhash:',h)"
docker exec -i elementify-bridge-postgres-1 psql -h 127.0.0.1 -U elementify -d elementify_auth \
  -c "INSERT INTO api_keys (id, key_hash, name, rate_limit_tier, user_id) VALUES ('<cuid>', '<hash>', 'ELM-RENDER-002', 'ENTERPRISE', '<user_id>') RETURNING id;"
```
Oder alternativ via Bridge-API (braucht einen existierenden Key):
```bash
curl -X POST http://localhost:3201/api/auth/keys \
  -H 'X-API-Key: <existing>' -H 'Content-Type: application/json' \
  -d '{"name":"ELM-RENDER-002","tier":"ENTERPRISE"}'
```

## MCP-Server Env
```
export ELEMENTEER_BRIDGE_URL=http://localhost:3201
export ELEMENTEER_BRIDGE_API_KEY=<plain-key-von-oben>
```

## Test-Seite
preview.fusionaize.com (API-Key in ~/.elementeer/config.json, Site fusionaize-preview)
Seite #290 ("Where Humans & AI Agents Work as One") — URL https://preview.fusionaize.com/

## Erwartetes Ergebnis
```
request_screenshot({ page_id: 290, template: 'full_page' })
→ MCP resource URI elementeer://pages/290/screenshot/<sha256>
→ read_mcp_resource liefert PNG blob
→ content_hash in URI stimmt mit Bridge content_hash ueberein
```

## Hash-Mismatch-Test
1. Screenshot holen → Hash H1
2. Seite via Elementor aendern und speichern
3. Screenshot erneut holen → Hash H2 != H1
4. read_mcp_resource mit URI/H1 → "not found" (Cache abgelaufen oder anderer Key)

## Fehlerfall
1. Bridge stoppen
2. request_screenshot → "Bridge error: Bridge unreachable" (isError: true)
3. Kein leeres Bild, kein Platzhalter
