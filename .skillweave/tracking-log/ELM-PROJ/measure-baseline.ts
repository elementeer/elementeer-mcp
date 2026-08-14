#!/usr/bin/env bun
/**
 * PROJ-006 Messrahmen — ELM-PROJ Baseline Measurement
 *
 * Liest einen Sitzungsmitschnitt (MCP-Tool-Call-Log) und extrahiert
 * die drei Metriken der Baseline.
 *
 * Aufruf:
 *   bun run .skillweave/tracking-log/ELM-PROJ/measure-baseline.ts \
 *     <session-log.json> [--profile content-ops]
 *
 * Sitzungslog-Format:
 *   Ein JSON-Array von Tool-Call-Eintraegen. Jeder Eintrag:
 *   { tool: string, timestamp: string, tokens_in?: number, tokens_out?: number }
 *
 *   tokens_in  = Eingabekontext (Prompt + System Prompt + History)
 *   tokens_out = Antwort-Tokens (vom LLM generiert)
 *
 *   Falls tokens_in fehlt, wird 0 angenommen (Metrik wird auf "unbestimmt" gemeldet).
 *
 * Ausgabe (stdout):
 *   PROJ-006 MEASUREMENT REPORT
 *   ==========================
 *   Quelle: <session-log.json>
 *   Profil: content-ops | free-all
 *
 *   Metrik 1 — Tokens bis zum ersten Write
 *     Kumulierte tokens_in vom ersten Call bis (exklusive) zum ersten Write-Call.
 *     Baseline: ~292.000 | Ziel: < 30.000
 *     Gemessen: <wert> | Status: PASS/FAIL/UNBESTIMMT
 *
 *   Metrik 2 — Tool Calls vor dem ersten Write
 *     Anzahl der Read-Tool-Calls bevor das erste Write-Tool aufgerufen wurde.
 *     Baseline: 34 | Ziel: < 10
 *     Gemessen: <wert> | Status: PASS/FAIL
 *
 *   Metrik 3 — Nutzsignalanteil im Hero-Payload
 *     tokens_out des ersten get_page_data-Calls (content-Projektion)
 *     geteilt durch tokens_out des ersten get_page_data-Calls (full-Projektion),
 *     multipliziert mit 100.
 *     Baseline: 1,2 % | Ziel: > 25 %
 *     Gemessen: <wert> | Status: PASS/FAIL/UNBESTIMMT
 *
 *   Blockiert: ja | Grund: Kein realer Durchlauf, kein Sitzungslog
 *   blocked_on: ["operator: reale Site fuer PROJ-006-Durchlauf"]
 *
 *
 * WAS GENAU GEMESSEN WIRD:
 *
 * "Erster Write": der erste Tool-Call im Log, dessen Tool-Name auf eine
 * der folgenden Praefixe matcht:
 *   create_, update_, delete_, set_, save_, rename_, duplicate_,
 *   bulk_, compose_, inject_, write_, migrate_, apply_
 *
 * Alle Calls VOR dem ersten Write sind der Lesepfad. Deren tokens_in
 * werden aufsummiert (Metrik 1). Deren Anzahl ist Metrik 2.
 *
 * "Nutzsignalanteil": Verhaeltnis zwischen content-Projektion und
 * full-Payload derselben Seite, gemessen an der Token-Groesse der
 * ersten get_page_data-Antwort. Formel:
 *   signalanteil = (tokens_out_content / tokens_out_full) * 100
 *
 * tokens_out ist die Anzahl der Antwort-Tokens, die der MCP-Client vom
 * LLM erhaelt. Falls der Log keine tokens_out enthaelt, ist Metrik 3
 * "unbestimmt" (das Skript versucht nicht, die Tokens aus dem Payload
 * zu schaetzen, denn: was eine andere Schicht tut, ist nicht dieselbe
 * Messung).
 *
 *
 * DRY RUN — REDUZIERTE FORM:
 *
 * Wenn kein Sitzungslog vorliegt, kann das Skript mit dem
 * synthetischen Smoke-Measurement-Fixture laufen. Das produziert KEINE
 * Baseline-Werte, sondern zeigt nur die drei Metrik-Kategorien an und
 * meldet "unbestimmt". Dieser Modus dient zum Verifizieren, dass das
 * Skript ausfuehrbar ist und die Metriken korrekt benannt werden.
 */

import { readFileSync } from 'node:fs';

interface ToolCallEntry {
  tool: string;
  timestamp?: string;
  tokens_in?: number;
  tokens_out?: number;
  // Extended: ein get_page_data-Call kann projection+page_id tragen
  projection?: string;
  page_id?: number;
}

const WRITE_PREFIXES = [
  'create_', 'update_', 'delete_', 'set_', 'save_', 'rename_',
  'duplicate_', 'bulk_', 'compose_', 'inject_', 'write_',
  'migrate_', 'apply_',
];

function isWriteCall(entry: ToolCallEntry): boolean {
  return WRITE_PREFIXES.some(p => entry.tool.startsWith(p));
}

function parseArgs(): { logFile: string; profile: 'content-ops' | 'free-all'; dryRun: boolean } {
  const args = process.argv.slice(2);
  const logFile = args[0] ?? '';
  const profile = args.includes('--profile') && args[args.indexOf('--profile') + 1] === 'content-ops'
    ? 'content-ops' as const
    : 'free-all' as const;
  const dryRun = args.includes('--dry-run') || !logFile;
  return { logFile, profile, dryRun };
}

function measure(entries: ToolCallEntry[], profile: string) {
  let cumulativeTokensIn = 0;
  let readCallsBeforeFirstWrite = 0;
  let firstWriteFound = false;
  let firstGetPageDataContent: ToolCallEntry | null = null;
  let firstGetPageDataFull: ToolCallEntry | null = null;

  for (const entry of entries) {
    if (!firstWriteFound && isWriteCall(entry)) {
      firstWriteFound = true;
      break; // Stop beim ersten Write — danach zaelt nichts mehr
    }

    if (!firstWriteFound) {
      cumulativeTokensIn += entry.tokens_in ?? 0;
      readCallsBeforeFirstWrite++;

      if (entry.tool === 'get_page_data') {
        if (entry.projection === 'content' && !firstGetPageDataContent) {
          firstGetPageDataContent = entry;
        }
        if (entry.projection === 'full' && !firstGetPageDataFull) {
          firstGetPageDataFull = entry;
        }
      }
    }
  }

  const signalPct = (firstGetPageDataContent && firstGetPageDataFull)
    ? ((firstGetPageDataContent.tokens_out ?? 0) / (firstGetPageDataFull.tokens_out ?? 1)) * 100
    : undefined;

  const tokensInDetermined = entries.some(e => e.tokens_in !== undefined);
  const tokensOutDetermined = entries.some(e => e.tokens_out !== undefined);

  return {
    profile,
    totalEntries: entries.length,
    cumulativeTokensIn,
    readCallsBeforeFirstWrite,
    firstWriteFound,
    signalPct,
    firstGetPageDataContent: firstGetPageDataContent
      ? { tokens_out: firstGetPageDataContent.tokens_out, projection: firstGetPageDataContent.projection }
      : null,
    firstGetPageDataFull: firstGetPageDataFull
      ? { tokens_out: firstGetPageDataFull.tokens_out, projection: firstGetPageDataFull.projection }
      : null,
    tokensInDetermined,
    tokensOutDetermined,
  };
}

function report(result: ReturnType<typeof measure>) {
  console.log('PROJ-006 MEASUREMENT REPORT');
  console.log('==========================');
  console.log(`Profil: ${result.profile}`);
  console.log(`Eintraege im Log: ${result.totalEntries}`);
  console.log();

  console.log('Metrik 1 — Tokens bis zum ersten Write');
  console.log('  Kumulierte tokens_in vom ersten Call bis (exklusive) zum ersten Write-Call.');
  console.log('  Baseline: ~292.000 | Ziel: < 30.000');
  if (!result.tokensInDetermined) {
    console.log('  Gemessen: UNBESTIMMT (Log enthaelt keine tokens_in-Eintraege)');
  } else {
    const status = result.cumulativeTokensIn < 30_000 ? 'PASS' : 'FAIL';
    console.log(`  Gemessen: ${result.cumulativeTokensIn.toLocaleString()} | Status: ${status}`);
  }
  console.log();

  console.log('Metrik 2 — Tool Calls vor dem ersten Write');
  console.log('  Anzahl der Read-Tool-Calls bevor das erste Write-Tool aufgerufen wurde.');
  console.log('  Baseline: 34 | Ziel: < 10');
  if (!result.firstWriteFound) {
    console.log(`  Gemessen: ${result.readCallsBeforeFirstWrite} (Kein Write gefunden — gesamter Log ist Lesepfad)`);
  } else {
    const status = result.readCallsBeforeFirstWrite < 10 ? 'PASS' : 'FAIL';
    console.log(`  Gemessen: ${result.readCallsBeforeFirstWrite} | Status: ${status}`);
  }
  console.log();

  console.log('Metrik 3 — Nutzsignalanteil im Hero-Payload');
  console.log('  tokens_out(content) / tokens_out(full) * 100');
  console.log('  Baseline: 1,2 % | Ziel: > 25 %');
  if (!result.tokensOutDetermined) {
    console.log('  Gemessen: UNBESTIMMT (Log enthaelt keine tokens_out-Eintraege)');
  } else if (result.signalPct === undefined) {
    console.log('  Gemessen: UNBESTIMMT (Get_page_data mit content/full nicht im Log)');
  } else {
    const status = result.signalPct > 25 ? 'PASS' : 'FAIL';
    console.log(`  Gemessen: ${result.signalPct.toFixed(1)} % | Status: ${status}`);
  }
  console.log();

  console.log('Blockiert: ja | Grund: Kein realer Durchlauf, kein Sitzungslog');
  console.log('blocked_on: ["operator: reale Site fuer PROJ-006-Durchlauf"]');
}

// --- MAIN ---

const { logFile, profile, dryRun } = parseArgs();

if (dryRun) {
  console.log('DRY RUN — Kein Sitzungslog. Messrahmen verifiziert.');
  console.log(`Erwartetes Log-Format: JSON-Array von { tool, timestamp?, tokens_in?, tokens_out? }`);
  console.log(`Write-Tool-Praefixe: ${WRITE_PREFIXES.join(', ')}`);
  console.log(`Profil: ${profile}`);
  console.log();

  const emptyResult = measure([], profile);
  report(emptyResult);
} else {
  const raw = readFileSync(logFile, 'utf-8');
  const entries: ToolCallEntry[] = JSON.parse(raw);
  const result = measure(entries, profile);
  report(result);
}
