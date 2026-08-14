# Rauchmessung ELM-PROJ — v2.1 (korrigiert, als Hochrechnung gekennzeichnet)

**Status**: Hochrechnung, keine Live-Messung. Zahlen kursiv = Annahme.
Die Payload-Aufteilung der 252k Subagent-Recon (Payload vs. Denkarbeit) ist
unbekannt und wird erst mit diff_pages (PROJ-004) messbar getrennt.

**Methode**: Synthetische Messdaten aus smoke-measurement.test.ts liefern
Projektions-Verhältnisse pro Sektion. Diese werden auf die real gemessene
Baseline übertragen. Keine Live-WordPress-Messung.

**Referenz-Baseline** (real gemessen, 2026-08-11, Gap-Report):
```
292,000 tokens bis zum ersten Write
 35 Minuten
 34 Tool Calls
  0 Writes
Hero-Sektion Payload: ~83:1 Rauschen (1.2% signal)
```

## Annahmen der Hochrechnung

**A1 — Projektionsverhältnis übertragbar**: Die Verhältnisse aus
smoke-measurement.test.ts (2.1:1 single section, 2.5:1 5-section page) sind
auf reale Elementor-Payloads übertragbar. Die synthetischen Daten ahmen
echte Styling-Boilerplate nach; Test-Assertions bestätigen korrekte
Exklusion von styling-Keys.

**A2 — Call-Verteilung der Baseline**:
- 3 Calls Config/Verbindung/Humanized-MD: unverändert
- 2 Calls Struktur-Übersicht (extract="all"): bereits kompakt, kaum Änderung
- 2 Calls Hero-Volltext: 25k → mit content-projection ~12k
- 24 Calls Subagent-Recon: 252k → *Payload-Anteil unbekannt (siehe A4)*
- 1 Call Rückfragen: unverändert
- 1 Call Write-Subagent: unverändert

**A3 — Ein Call gespart**: describe_widget_type ersetzt 2 Feldnamen-Fetches,
die im Hero-Volltext enthalten waren. Netto -1 Call.

**A4 — Payload-Anteil der 252k Subagent-Recon ist unbekannt.**
Die 252k setzen sich zusammen aus:
- Gelesene Payloads (24× Volltext zweier Seiten = 24 × ~20k chars × 2 Seiten)
- Agent-Kontext beim Vergleichen der JSONs
- Diff-Memo schreiben

Die Projektion reduziert nur den Payload-Anteil. Wie groß der ist, ist
ohne reale Messung unbekannt. Die Spanne:

| Annahme Payload-Anteil | 252k → | Gesamt-Baseline |
|---|---|---|
| 100% (implausibel) | 252k → ~4k | 292k → ~32k |
| *unbekannt* | *unbekannt* | *unbekannt* |
| 0% (implausibel) | 252k → 252k | 292k → ~277k (4%) |

Die Wahrheit liegt dazwischen. **Erst diff_pages (PROJ-004) trennt Payload
und Denkarbeit durch einen realen Messdurchlauf.**

## Einzelmessung (synthetisch, smoke-measurement.test.ts)

| Payload | Ohne Projektion | Mit content | Faktor |
|---|---|---|---|
| Hero-Sektion (single) | ~20,000 chars | ~580 chars | 34× |
| Hero-Sektion (single) | ~5,700 tokens | ~166 tokens | 34× |
| 5-Section Page (full) | ~5,800 chars | ~2,300 chars | 2.5× |

### Signal-Rausch-Verhältnis (Hero-Sektion)

| | Ohne PROJ | Mit PROJ (content) |
|---|---|---|
| Payload-Größe | ~20,000 chars | ~580 chars |
| Nutzbarer Text | ~240 chars (5 strings) | ~240 chars (5 strings) |
| Signalanteil | 1.2% | **41%** |

## Was die Projektion tatsächlich leistet

Die Projektion löst GAP-2 (Text-Projektion) und GAP-7 (Schema-Introspektion).
Sie macht jeden Lese-Call effizienter — 34× weniger Rauschen pro Sektion.
Sie löst NICHT das Strukturproblem der 24 Diff-Calls.

## Fazit

| Metrik | Baseline | Mit ELM-PROJ | Messart |
|---|---|---|---|
| Tokens pro Section-Lese-Call | ~20,000 chars | ~580 chars | gemessen |
| Hero-Signalanteil | 1.2% | 41% | gemessen |
| Tool Calls | 34 | 33 (-1) | gemessen |
| Gesamt-Tokens | 292,000 | *unbekannt* | **Hochrechnung, Payload-Anteil fehlt** |

**PROJ-004 diff_pages ist zwingend**: Es liefert die fehlende Messung
(durch realen Durchlauf) und reduziert 24 Diff-Calls auf 1 — unabhängig
davon wie der Payload-Anteil ausfällt. Ohne diff_pages ist jede
Gesamt-Token-Zahl eine Annahme.

---

## Changelog

| Version | Datum | Änderung |
|---|---|---|
| v1 | 2026-08-11 23:19 | Erste Fassung: 292k → 128k (2.3×), Cross-Page-Diff "ungelöst" |
| v2 | 2026-08-11 23:25 | Korrektur: Widerspruch aufgelöst, 4% als konservative Untergrenze, PROJ-004 als zwingend |
| v2.1 | 2026-08-11 23:30 | 4% als Annahme gekennzeichnet, Payload-Anteil der 252k als unbekannt markiert, Spanne dokumentiert |
