// Writes one compiled book as a TEI P5 document: the text, its critical apparatus (TEI Guidelines, chapter 12, parallel
// segmentation), each reading's probability (<certainty>, chapter 21) and uncertainty interval (<note>), and a header that
// holds the method, the model attribution, the specification ID and the compilation ID. Purely a formatter: it decides nothing.

export type PR3 = { p: number; lo: number; hi: number };
/** A manuscript that differs from the printed word: its witness index, its key ("" for no word) and its spelling. */
export type DR = { w: number; k: string; t: string };
export type OutWord = { t: string; k: string; e?: 1; c?: number; lo?: number; hi?: number; p?: number; l?: number[]; d?: number[]; dr?: DR[]; dp?: PR3[]; x: number; a?: 1 };
export type OutLine = { ref: string; uncovered?: boolean; witnesses: number[]; lacunose: number[]; absent: number[]; aramaic?: "all" | "part"; words?: OutWord[] };
export type OutReading = { forms: string[]; keys: string; xs: number[]; witnesses: number[]; partly?: number[]; p?: number; lo?: number; hi?: number };
export type OutPlace = { id: number; ref: string; at: number; n: number; cols: [number, number]; confidence: number; weight: number; lost?: boolean; readings: OutReading[]; partlyLost?: number[]; lostEverywhere?: PR3 };
export type OutWitness = {
  siglum: string; kind: string; language: string; name?: string; shelfmark?: string; century?: string;
  date: { estimate: number; margin: number; from: number; to: number; basis: string | null; source: string | null } | null;
  year: number; early: boolean;
  files: { paths: string[]; provenance: string; format: string; license: string; sourceUrl: string }[];
  scribal: { corrections: number | null; lacunae: number };
  reliability?: { estimate: number; low: number; high: number; linesCompared: number; agreementShare: number | null; priorMean: number; priorStrength: number; dateRangeKnown: boolean };
};
export type BookResult = {
  id: string; name: string; section: string; number: number; order: number; language: string;
  settings: { origin: number; halfLife: number; lateAfter: number; undated: number };
  stats: Record<string, number>; witnesses: OutWitness[]; lines: OutLine[]; places: OutPlace[];
};
export type Common = {
  specId: string; specFile: string; specSha256: string; specTitle: string; specSummary: string; compilationId: string; created: string; statement: string;
  attribution: { summary: string; fields: [string, string][] };
  compiler: { program: string; version: string; repository?: string; commit?: string; codeMatchesCommit?: boolean; codeSha256: string; runtime: string };
  method: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f3 = (x: number) => x.toFixed(3);
export const witId = (s: string) => `ms-${s.replace(/[^A-Za-z0-9_.-]/g, "_")}`;

/** How a reading differs from the printed one (both as keys and spellings). */
export function difference(lem: { keys: string[]; forms: string[] }, r: { keys: string[]; forms: string[] }): { type: string; text: string } {
  const A = lem.keys, B = r.keys, q = (xs: string[]) => `“${xs.join(" ")}”`;
  if (!B.length) return { type: "omission", text: `omits ${q(lem.forms)}` };
  if (!A.length) return { type: "addition", text: `adds ${q(r.forms)}` };
  if (A.length === B.length && [...A].sort().join(" ") === [...B].sort().join(" ")) return { type: "transposition", text: `has the same words in another order: ${q(r.forms)}` };
  // the longest common subsequence: what one reading has that the other lacks
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const onlyA: string[] = [], onlyB: string[] = [];
  for (let i = 0, j = 0; i < n || j < m;) {
    if (i < n && j < m && A[i] === B[j]) { i++; j++; } else if (j < m && (i === n || L[i][j + 1] >= L[i + 1][j])) onlyB.push(r.forms[j++] ?? B[j - 1]); else onlyA.push(lem.forms[i++] ?? A[i - 1]);
  }
  if (!onlyA.length) return { type: "addition", text: `adds ${q(onlyB)}` };
  if (!onlyB.length) return { type: "omission", text: `omits ${q(onlyA)}` };
  return { type: "substitution", text: `reads ${q(onlyB)} for ${q(onlyA)}` };
}

const lang = (l: string) => (l.startsWith("Hebrew") ? "hbo" : "grc");

function witnessXml(w: OutWitness): string {
  const unknown = "unknown (not documented in the specification)";
  const items: [string, string][] = [];
  items.push(["Kind", w.kind]);
  items.push(["Dating", w.date ? `${w.date.from === w.date.to ? w.date.from : `${w.date.from} to ${w.date.to}`} (years AD; negative years BC); estimate ${w.date.estimate}, margin of error ±${w.date.margin} years${w.century ? `; recorded as “${w.century}”` : ""}. Method: ${w.date.basis ?? unknown}. Source: ${w.date.source ?? unknown}.` : `${unknown}${w.century ? ` (recorded only as “${w.century}”)` : ""}; for the model's prior the date is taken as unknown`]);
  items.push(["Provenance (place of origin or writing)", unknown]);
  items.push(["Scientific analysis", unknown]);
  items.push(["Physical and scribal evidence", `corrections marked in the transcription: ${w.scribal.corrections === null ? "not recorded in this transcription format (unknown)" : `${w.scribal.corrections} (only the first hand is read)`}; lacunae marked: ${w.scribal.lacunae} (they do not count against the manuscript); condition otherwise ${unknown}`]);
  const r = w.reliability;
  items.push(["Textual agreement", r ? `estimated reliability ${f3(r.estimate)} (90% interval ${f3(r.low)} to ${f3(r.high)}), learned from agreement with the other manuscripts on ${r.linesCompared} line(s)${r.agreementShare === null ? "" : ` (mean agreement ${f3(r.agreementShare)})`}; prior from the date: mean ${f3(r.priorMean)}, weight ${f3(r.priorStrength)}${r.dateRangeKnown ? "" : " (date unknown: weak prior)"}; counted as ${w.early ? "an early copy (independent)" : "a late copy (down-weighted when it shares a reading with other late copies)"}` : "not measured"]);
  for (const f of w.files) items.push(["Transcription", `${f.paths.join(", ")}; from ${f.provenance}; ${f.format}; license: ${f.license}; ${f.sourceUrl}`]);
  const desc = [w.name, w.shelfmark].filter(Boolean).join(", ") || `Manuscript ${w.siglum}`;
  return `<witness xml:id="${witId(w.siglum)}" n="${esc(w.siglum)}">${esc(desc)} (${esc(w.siglum)}, ${esc(w.language)})<note type="evidence"><list type="gloss">${items.map(([k, v]) => `<label>${esc(k)}</label><item>${esc(v)}</item>`).join("")}</list></note></witness>`;
}

/** The method text (Markdown) as TEI paragraphs. */
function methodXml(md: string): string {
  const blocks = md.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b) => {
    const plain = b.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\n(?!\s*[-|])/g, " ");
    const h = plain.match(/^#+\s+(.*)$/);
    if (h) return `<p rend="heading">${esc(h[1])}</p>`;
    return `<p>${esc(plain).replace(/\n/g, "<lb/>")}</p>`;
  }).join("\n");
}

export const ENCODING = [
  "Each numbered line (chapter:line) is an <ab> with @n. Its <note type=\"coverage\"> elements list, by @target, the manuscripts that have text in the line (subtype \"covering\"), those whose text of the line is wholly lost (subtype \"lacunose\") and those that mark the line as not in the manuscript (subtype \"absent\").",
  "A <w> outside an <app> is read by every covering manuscript. Its @cert is the model's probability that it is original; the line's <note type=\"probability\"> gives that probability with its 90% uncertainty interval.",
  "Every point where the covering manuscripts do not all agree, and every point where some are lost, is an <app>. @type is \"variant\" (two or more readings with support: the model's places), \"singular\" (one manuscript alone differs from all the others), \"lacuna\" (the surviving manuscripts agree but some are lost there) or \"lost\" (every manuscript is lost somewhere in the place: no reading survives whole, nothing is printed).",
  "In each <app>, <lem> is the printed (selected) reading. Every attested reading, the selected one first, is a <rdg> whose @wit lists its manuscripts; <certainty locus=\"value\" degree=\"…\"/> in the <rdg> is the model's probability that the reading is original and <note type=\"interval\"> its 90% uncertainty interval (5th to 95th percentile). A <rdg> other than the selected one has @type (omission, addition, substitution or transposition) and a <note type=\"difference\"> saying how it differs from the printed reading. An empty reading (no words) is an omission.",
  "<witDetail type=\"lacunose\"> lists the manuscripts lost or unreadable at that point; <witDetail type=\"partly-lacunose\"> those that are lost in part of a place but whose surviving words fit exactly one reading, and are counted for it (they are also in that reading's @wit). <note type=\"unattested\"> is the probability that the original is in none of the manuscripts held.",
  "Spellings that copyists used for one word (listed in the method) are one reading, so they are not set out as variants; each printed word is spelled as in the oldest manuscript that has it. Greek is written without accents or breathings, as in the manuscripts; Hebrew as in the transcriptions. Words of the Aramaic parts have xml:lang=\"arc\".",
];

/** One book as a TEI P5 document. */
export function bookTei(B: BookResult, C: Common): string {
  const W = B.witnesses, id = (i: number) => `#${witId(W[i].siglum)}`, ids = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b).map(id).join(" ");
  const L = lang(B.language);
  const out: string[] = [];
  const P = B.places;
  const cert = (x: PR3) => `<certainty locus="value" degree="${f3(x.p)}"/><note type="interval">${f3(x.lo)} to ${f3(x.hi)}</note>`;
  const wEl = (t: string, a?: boolean, c?: number) => `<w${a && L === "hbo" ? ' xml:lang="arc"' : ""}${c !== undefined ? ` cert="${f3(c)}"` : ""}>${esc(t)}</w>`;
  const lacunose = (xs?: number[], type = "lacunose") => (xs?.length ? `<witDetail wit="${ids(xs)}" type="${type}">${type === "lacunose" ? "lost or unreadable here" : "lost in part of this place; the surviving words fit only the reading it is counted for"}</witDetail>` : "");
  const stats = B.stats;

  out.push(`<?xml version="1.0" encoding="UTF-8"?>
<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:lang="en">
<teiHeader>
<fileDesc>
<titleStmt>
<title type="main">${esc(B.name)}: the original text, compiled under specification ${esc(C.specId)}</title>
<title type="sub">Compilation ${esc(C.compilationId)}</title>
<respStmt><resp>Selection of readings and estimation of their probabilities (the non-deterministic judgments)</resp><name type="model">${esc(C.attribution.summary)}</name></respStmt>
<respStmt><resp>Deterministic compilation: reading the transcriptions, lining up the words, computing the model and writing this file</resp><name type="program">${esc(C.compiler.program)} ${esc(C.compiler.version)}${C.compiler.commit ? ` at commit ${esc(C.compiler.commit)}` : ""}${C.compiler.codeMatchesCommit === false ? " (with changes not yet committed)" : ""}, code SHA-256 ${esc(C.compiler.codeSha256)}, ${esc(C.compiler.runtime)}</name></respStmt>
</titleStmt>
<editionStmt><edition>Compilation <idno type="compilation">${esc(C.compilationId)}</idno> under specification <idno type="specification">${esc(C.specId)}</idno></edition></editionStmt>
<extent><measure unit="lines" quantity="${stats.lines}"/><measure unit="words" quantity="${stats.words}"/><measure unit="manuscripts" quantity="${stats.manuscripts}"/><measure unit="variation-places" quantity="${stats.places}"/></extent>
<publicationStmt>
<publisher>Open Lexis</publisher>
<idno type="specification">${esc(C.specId)}</idno>
<idno type="compilation">${esc(C.compilationId)}</idno>
<date when="${esc(C.created)}">${esc(C.created)}</date>
<availability><p>The ancient text is in the public domain. Each transcription read for this book keeps the license its source archive states; the license of each is given with its witness below.</p></availability>
</publicationStmt>
<notesStmt><note type="specification">${esc(C.statement)}</note></notesStmt>
<sourceDesc>
<listWit>
${W.map(witnessXml).join("\n")}
</listWit>
</sourceDesc>
</fileDesc>
<encodingDesc>
<projectDesc><p>${esc(C.specTitle)} (${esc(C.specFile)}, SHA-256 ${esc(C.specSha256)}): ${esc(C.specSummary)}</p><p>${esc(C.statement)}</p></projectDesc>
<editorialDecl>
<p rend="heading">Method</p>
${methodXml(C.method)}
<p rend="heading">Settings of the model for this book</p>
<p>The original is taken as written in ${B.settings.origin < 0 ? `${-B.settings.origin} BC` : `AD ${B.settings.origin}`}; the expected reliability halves its distance to 0.5 every ${B.settings.halfLife} years; copies made more than ${B.settings.lateAfter} years after the original are late copies; a manuscript without a documented date range is given a weak prior set for the year ${B.settings.undated}.</p>
<p rend="heading">Encoding of this file</p>
${ENCODING.map((p) => `<p>${esc(p)}</p>`).join("\n")}
</editorialDecl>
<variantEncoding method="parallel-segmentation" location="internal"/>
<appInfo>
<application ident="model" version="${esc(C.attribution.fields.find(([k]) => k === "teiVersion")?.[1] ?? "0")}"><label>${esc(C.attribution.summary)}</label><desc>The system that made the non-deterministic judgments of this compilation (complete attribution).</desc>
${C.attribution.fields.filter(([k]) => k !== "teiVersion").map(([k, v]) => `<p n="${esc(k)}">${esc(v)}</p>`).join("\n")}
</application>
<application ident="compiler" version="${esc(C.compiler.version)}"><label>${esc(C.compiler.program)}</label><desc>Deterministic compiler. Repository ${esc(C.compiler.repository ?? "unknown")}, commit ${esc(C.compiler.commit ?? "none")}${C.compiler.codeMatchesCommit === false ? " (with changes not yet committed)" : ""}, code SHA-256 ${esc(C.compiler.codeSha256)}, runtime ${esc(C.compiler.runtime)}.</desc></application>
</appInfo>
</encodingDesc>
<profileDesc><langUsage>${L === "hbo" ? `<language ident="hbo">Biblical Hebrew</language>${B.language.includes("Aramaic") ? '<language ident="arc">Biblical Aramaic</language>' : ""}` : '<language ident="grc">Koine Greek</language>'}<language ident="en">English (editorial matter)</language></langUsage></profileDesc>
</teiHeader>
<text xml:lang="${L}">
<body>
<div type="book" n="${esc(B.id)}">
<head xml:lang="en">${esc(B.name)}</head>`);

  const placesOfLine = new Map<string, OutPlace[]>();
  for (const p of P) (placesOfLine.get(p.ref) ?? placesOfLine.set(p.ref, []).get(p.ref)!).push(p);
  let chapter = "";
  for (const l of B.lines) {
    const ch = l.ref.split(":")[0];
    if (ch !== chapter) { if (chapter) out.push("</div>"); out.push(`<div type="chapter" n="${ch}">`); chapter = ch; }
    const cov = [
      l.witnesses.length ? `<note type="coverage" subtype="covering" target="${ids(l.witnesses)}"/>` : "",
      l.lacunose.length ? `<note type="coverage" subtype="lacunose" target="${ids(l.lacunose)}"/>` : "",
      l.absent.length ? `<note type="coverage" subtype="absent" target="${ids(l.absent)}"/>` : "",
    ].join("");
    const ar = l.aramaic === "all" && L === "hbo" ? ' xml:lang="arc"' : "";
    if (l.uncovered) {
      const allAbsent = !l.lacunose.length && l.absent.length;
      out.push(`<ab n="${l.ref}" type="${allAbsent ? "absent" : "uncovered"}">${cov}${allAbsent ? "" : '<gap reason="lost"/>'}</ab>`);
      continue;
    }
    const ws = l.words!, parts: string[] = [];
    const zero = new Map<number, OutPlace[]>();
    for (const p of placesOfLine.get(l.ref) ?? []) if (p.lost || p.n === 0) (zero.get(p.at) ?? zero.set(p.at, []).get(p.at)!).push(p);
    const readers = (w: OutWord) => { const out = new Set([...(w.l ?? []), ...(w.d ?? [])]); return l.witnesses.filter((m) => !out.has(m)); };
    const placeXml = (p: OutPlace) => {
      if (p.lost || !p.readings.length) return `<app type="lost" n="${p.id}"><lem><gap reason="lost"/></lem>${lacunose(p.partlyLost)}<note type="lost">Every manuscript that covers this point is lost somewhere within it, so no reading survives whole and nothing is printed.</note></app>`;
      const ch = p.readings[0], lemKeys = ch.keys ? ch.keys.split(" ") : [];
      const arW = ws.slice(p.at, p.at + p.n).some((w) => w.a);
      const rd = p.readings.map((r, i) => {
        const keys = r.keys ? r.keys.split(" ") : [];
        const diff = i ? difference({ keys: lemKeys, forms: ch.forms }, { keys, forms: r.forms }) : undefined;
        return `<rdg wit="${ids([...r.witnesses, ...(r.partly ?? [])])}"${diff ? ` type="${diff.type}"` : ""}>${r.forms.map((t) => wEl(t)).join("")}${cert({ p: r.p!, lo: r.lo!, hi: r.hi! })}${diff ? `<note type="difference">${esc(diff.text)}</note>` : ""}</rdg>`;
      }).join("");
      const partly = p.readings.flatMap((r) => r.partly ?? []);
      return `<app type="variant" n="${p.id}">${ch.forms.length ? `<lem>${ch.forms.map((t) => wEl(t, arW)).join("")}</lem>` : "<lem/>"}${rd}${lacunose(partly, "partly-lacunose")}${lacunose(p.partlyLost)}${p.lostEverywhere ? `<note type="unattested">${f3(p.lostEverywhere.p)} (90% interval ${f3(p.lostEverywhere.lo)} to ${f3(p.lostEverywhere.hi)})</note>` : ""}</app>`;
    };
    const flush = (i: number) => { for (const p of zero.get(i) ?? []) parts.push(placeXml(p)); };
    let unanimous: PR3 | undefined;
    for (let i = 0; i < ws.length;) {
      flush(i);
      const w = ws[i];
      if (w.p !== undefined) { let j = i; while (j < ws.length && ws[j].p === w.p) j++; parts.push(placeXml(P[w.p])); i = j; continue; }
      const own: PR3 = { p: w.c!, lo: w.lo!, hi: w.hi! };
      if (w.e) { // a word that one manuscript alone (or a few, each alone) adds where the others have none: nothing is printed
        parts.push(`<app type="singular"><lem/><rdg wit="${ids(readers(w))}">${cert(own)}</rdg>${w.dr!.map((d, j) => `<rdg wit="${id(d.w)}" type="addition">${wEl(d.t)}${cert(w.dp![j])}<note type="difference">${esc(difference({ keys: [], forms: [] }, { keys: [d.k], forms: [d.t] }).text)}</note></rdg>`).join("")}${lacunose(w.l)}</app>`);
        i++; continue;
      }
      const omitsOnly = (x: OutWord) => (x.dr ?? []).every((d) => !d.k);
      if (!w.d && !w.l) { // read by every covering manuscript
        parts.push(wEl(w.t, !!w.a, w.c)); unanimous ??= own; i++; continue;
      }
      // a run of words with the same lost manuscripts and the same manuscripts leaving them out (and the same probability) is one point
      let j = i + 1;
      if (omitsOnly(w)) while (j < ws.length && ws[j].p === undefined && !ws[j].e && !zero.has(j) && omitsOnly(ws[j]) && (ws[j].l ?? []).join() === (w.l ?? []).join() && (ws[j].d ?? []).join() === (w.d ?? []).join() && ws[j].c === w.c && ws[j].lo === w.lo && ws[j].hi === w.hi) j++;
      const run = ws.slice(i, j), forms = run.map((x) => x.t), keys = run.map((x) => x.k);
      const lem = `<lem>${run.map((x) => wEl(x.t, !!x.a)).join("")}</lem>`;
      const sel = `<rdg wit="${ids(readers(w))}">${forms.map((t) => wEl(t)).join("")}${cert(own)}</rdg>`;
      const others = (w.dr ?? []).map((d, k) => {
        const rk = d.k ? [d.k] : [], rf = d.k ? [d.t] : [], diff = difference({ keys, forms }, { keys: rk, forms: rf });
        return `<rdg wit="${id(d.w)}" type="${diff.type}">${rf.map((t) => wEl(t)).join("")}${cert(w.dp![k])}<note type="difference">${esc(diff.text)}</note></rdg>`;
      }).join("");
      parts.push(`<app type="${w.d ? "singular" : "lacuna"}">${lem}${sel}${others}${lacunose(w.l)}</app>`);
      i = j;
    }
    flush(ws.length);
    const prob = unanimous ? `<note type="probability">Each word not in an apparatus entry: probability ${f3(unanimous.p)} (90% interval ${f3(unanimous.lo)} to ${f3(unanimous.hi)}).</note>` : "";
    out.push(`<ab n="${l.ref}"${ar}>${cov}${parts.join("")}${prob}</ab>`);
  }
  if (chapter) out.push("</div>");
  out.push(`</div>
</body>
</text>
</TEI>
`);
  return out.join("\n");
}
