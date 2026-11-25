// Downloads STEPBible CC BY 4.0 TAGNT & TAHOT TSV files and builds compact
// normalized word-form -> literal US English gloss lookup tables strictly for
// Astro UI rendering (site/src/data/gloss-grc.json & gloss-hbo.json).
// Never used by compilation models.
// Attribution: STEPBible.org / Tyndale House, Cambridge (CC BY 4.0).
import { mkdirSync, writeFileSync } from "node:fs";

const BASE =
  "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT/";

const GRC_FILES = [
  "TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
  "TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt",
];

const HBO_FILES = [
  "TAHOT%20Gen-Deu%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
  "TAHOT%20Jos-Est%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
  "TAHOT%20Job-Sng%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
  "TAHOT%20Isa-Mal%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt",
];

function normGreek(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[ςϲ]/g, "σ")
    .replace(/[^α-ω]/g, "");
}

function normHebrew(raw: string): string {
  return raw
    .replace(/\\.*$/, "")
    .replace(/[^א-ת]/g, "");
}

function cleanGloss(raw: string): string {
  let s = raw
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/<([^>]*)>/g, (_, inner) => (inner.toLowerCase().includes("obj") ? "(obj)" : inner))
    .replace(/\s*\/\s*/g, " ")
    .replace(/\\+/g, "")
    .replace(/[.,;:!?«»"'“”‘’]+$/g, "")
    .replace(/^[.,;:!?«»"'“”‘’]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 36) {
    s = s.split(/[,;]/)[0].trim();
  }
  return s;
}

function addCount(map: Map<string, Map<string, number>>, key: string, gloss: string) {
  if (!key || !gloss) return;
  let inner = map.get(key);
  if (!inner) {
    inner = new Map();
    map.set(key, inner);
  }
  inner.set(gloss, (inner.get(gloss) ?? 0) + 1);
}

function collapseMostFrequent(map: Map<string, Map<string, number>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, counts] of [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    let bestGloss = "";
    let bestCount = -1;
    for (const [g, c] of counts.entries()) {
      if (c > bestCount || (c === bestCount && g.length < bestGloss.length)) {
        bestCount = c;
        bestGloss = g;
      }
    }
    if (bestGloss) out[key] = bestGloss;
  }
  return out;
}

async function fetchText(file: string): Promise<string> {
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${file}`);
  return res.text();
}

async function main() {
  const grcCounts = new Map<string, Map<string, number>>();
  for (const f of GRC_FILES) {
    console.log("Fetching", decodeURIComponent(f));
    const text = await fetchText(f);
    for (const line of text.split(/\r?\n/)) {
      if (!/^[1-3]?[A-Za-z]+\.\d+\.\d+#\d+/.test(line)) continue;
      const cols = line.split("\t");
      const word = normGreek(cols[1] ?? "");
      const eng = cleanGloss(cols[2] ?? "");
      const dictGloss = cleanGloss((cols[4] ?? "").split("=")[1] ?? "");
      const gloss = eng || dictGloss;
      addCount(grcCounts, word, gloss);
    }
  }

  const hboCounts = new Map<string, Map<string, number>>();
  for (const f of HBO_FILES) {
    console.log("Fetching", decodeURIComponent(f));
    const text = await fetchText(f);
    for (const line of text.split(/\r?\n/)) {
      if (!/^[1-3]?[A-Za-z]+\.\d+\.\d+#\d+/.test(line)) continue;
      const cols = line.split("\t");
      const rawHeb = cols[1] ?? "";
      const eng = cleanGloss(cols[3] ?? "");
      const word = normHebrew(rawHeb);
      addCount(hboCounts, word, eng);
      // Also index maqaf-split subwords when rawHeb has no slash-prefixes
      if (rawHeb.includes("־")) {
        const parts = rawHeb.split("־").map(normHebrew).filter(Boolean);
        const gParts = eng.split(/\s+/);
        if (parts.length === gParts.length) {
          for (let i = 0; i < parts.length; i++) addCount(hboCounts, parts[i], gParts[i]);
        }
      }
    }
  }

  const grcObj = collapseMostFrequent(grcCounts);
  const hboObj = collapseMostFrequent(hboCounts);

  const outDir = new URL("../src/data/", import.meta.url).pathname;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}gloss-grc.json`, JSON.stringify(grcObj));
  writeFileSync(`${outDir}gloss-hbo.json`, JSON.stringify(hboObj));
  console.log(`Wrote ${Object.keys(grcObj).length} Greek forms and ${Object.keys(hboObj).length} Hebrew/Aramaic forms.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
