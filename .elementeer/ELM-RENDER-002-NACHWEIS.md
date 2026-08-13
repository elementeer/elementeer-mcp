# ELM-RENDER-002 — Nachweis

Stand: Vier Vertragsbrueche (ELM-RENDER-001) behoben, Hash-Identitaet entschieden
(ELM-RENDER-002), Tests repariert (ELM-RENDER-003). Nachweis mit echtem Bild
folgt, sobald die Bridge laeuft.

## Was laeuft
- MCP-Server feature/ELM-RENDER-002-screenshots @ acb85cf + Folge-Commits
- elementeer-bridge/apps/api feature/ELM-RENDER-002-screenshot-endpoint @ daccfa6
- Redis 6380, Postgres 5433, MySQL 3307

## Korrektur zur frueheren Fassung (ELM-RENDER-004)

Die fruehere Fassung dieser Datei nannte "Playwright-Chromium nicht installierbar
(CDN 400)" als Blockade. **Das war falsch.** Der Bridge-Proof
(`apps/api/src/page-screenshot/PROOF.md`) ist Zeile fuer Zeile reproduzierbar:
HTTP 200, drei PNGs, Playwright v145.0.7632.6 startet real. Die tatsaechlichen
Ursachen der fruehen Installationsfehlschlaege waren drei andere — ein 15 Tage
alter Playwright-Prozess auf dem Verzeichnis-Lock, ein Lock-Heartbeat, der das
Entpacken von 342 MB nicht ueberlebt, und ein fehlendes zweites Paket
(`chromium-headless-shell`). Siehe
`elementeer-bridge/docs/process/playwright-browser-install.md`.

## Hash-Identitaet (entschieden, ELM-RENDER-002)

Zwei Hashes, klar benannt, verschiedene Laengen:

- `content_hash` = `md5(wp_json_encode(_elementor_data))` → **32 hex**.
  Mutations-Hash, optimistisches Sperren (Plugin `ElementorDocument::contentHash()`).
- `render_hash` = `sha256(...)` → **64 hex** (volle Laenge). Bindet den
  Screenshot an den Render. Zutaten: content_hash + globale-Styles-Version +
  Theme-Identitaet/Version + Schriftarten-Stack. `content_hash` geht als Zutat
  ein, nicht als Ersatz.

Benannter Rest: Die Bridge erhaelt heute nur das ElementorTemplate; globale
Styles, Theme und Fonts sind ihr nicht versioniert bekannt. Bis das Plugin sie
liefert, wird `render_hash` aus dem Template berechnet — diese Einschraenkung ist
im Service-Kommentar dokumentiert, nicht stillschweigend verschwiegen.

## Bridge-Vertrag (verbindlich)
```
POST /api/pages/{pageId}/screenshots
Body:     { template: ElementorTemplate, renderHash?, containers? }
Response: { pageId, renderHash, screenshots{desktop,tablet,mobile}, capturedAt }
Static:   /static/page-screenshots/{pageId}/{renderHash}/{viewport}.png
```
`template` ist ein **Objekt** `{ title, type:"page", version:"0.4",
page_settings, content }`, kein String. `pageId` ist eine **number** (coerced).

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
→ lädt elementor_data von Seite 290, wrappt in ElementorTemplate
→ POST /api/pages/290/screenshots gegen laufende Bridge
→ MCP resource URI elementeer://pages/290/screenshot/<sha256:64hex>
→ read_mcp_resource liefert PNG blob (desktop viewport)
→ render_hash in URI stimmt mit Bridge render_hash ueberein
```

## Hash-Mismatch-Test (ELM-RENDER-002 hergestellt)
1. Screenshot holen → render_hash H1
2. Seite via Elementor aendern und speichern → erneut holen → H2 != H1
3. Zwei verschiedene Seiten mit demselben (handgeschriebenen) Template → zwei verschiedene render_hash (pageId/Elemente sind Zutat)
4. read_mcp_resource mit URI/H1 → "not found" (render_hash gebunden)

## Fehlerfall
1. Bridge stoppen
2. request_screenshot → "Bridge error" (isError: true), kein leeres Bild
