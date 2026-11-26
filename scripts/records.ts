// Writes the archive records: one YAML file per manuscript (archives/manuscripts/<id>.yaml: the physical object, its dates,
// holdings and reproductions) and one per transcription file (archives/transcriptions/<archive>/<file stem>.yaml: who made it,
// when, from what, how it was checked and what it is based on). See docs/archive-records.md.
//   bun scripts/records.ts [--evidence <evidence repository>] [--ntvmr <folder of NTVMR metadata JSON, one <docID>.json each>]
// Every value comes with its source and the exact words. Values are read from the transcription headers, from the INTF
// catalogue snapshot in the evidence repository, from NTVMR metadata when given, and from the archive-level facts in
// scripts/records-upstream.ts. Entries written by hand (whose sources are all web pages this script does not produce) are kept.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  findAll, headerHaystacks, PLACEHOLDER, kid, kids, manuscriptId, manuscriptPath, norm, parseHeader, readHeader, textOf, transcriptionId, transcriptionPath,
  type Source, type XNode,
} from "./lib/records";
import { COPIES, UPSTREAM } from "./records-upstream";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const EVIDENCE = arg("--evidence") ?? (existsSync(`${ROOT}../evidence/sources`) ? `${ROOT}../evidence` : undefined);
const NTVMR = arg("--ntvmr");
const TODAY = new Date().toISOString().slice(0, 10);

/** Archives whose TEI headers this repository's import script wrote (the source publishes no XML): not a source of facts. */
const OWN_HEADERS = new Set(["cntr", "etcbc-dss", "aleppo", "dt-ucph-sp", "tal-florentin-sp"]);
const LISTE_URL = "https://ntvmr.uni-muenster.de/community/api/metadata/liste/search/?docID=10000-49999&limit=&detail=document&format=json";
const NTVMR_META_URL = (doc: number) => `https://ntvmr.uni-muenster.de/community/vmr/api/metadata/manuscript/get/?docID=${doc}&format=json`;
const isManaged = (s: Source, ntvmr: boolean, liste: boolean) =>
  "path" in s || (liste && s.url === LISTE_URL) || (ntvmr && /\/vmr\/api\/metadata\/manuscript\/get\/\?docID=\d+/.test(s.url)) || UPSTREAM_KEYS.has(`${s.url}\n${s.quote}`);
const UPSTREAM_KEYS = new Set<string>();

type Any = Record<string, any>;
const tr = new Map<string, Any>(), ms = new Map<string, Any>();
let quotesChecked = 0;
const problems: string[] = [];

// ---------- helpers ----------
const src = (path: string, locator: string, quote: string): Source => ({ path, locator, quote: norm(quote) });
const raw = (header: string, tag: string, i = 0) => norm((header.replace(/<!--[\s\S]*?-->/g, " ").match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, "g")) ?? [])[i] ?? "");
/** A day.month.year date as the Birmingham headers write it (13.5.2024), as YYYY-MM-DD. */
const dmy = (s?: string) => { const m = s?.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m && +m[2] <= 12 && +m[1] <= 31 ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined; };
const yearish = (s?: string) => (s && /^-?\d{4}(-\d\d(-\d\d)?)?$/.test(s) ? (/^-?\d{4}$/.test(s) ? +s : s) : undefined);
const keyOf = (x: Any) => JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k]) => k !== "sources" && k !== "statement")));
const nameKey = (n: string) => n.toLowerCase().replace(/^the /, "").replace(/[^\p{L}\p{N}]/gu, "");
/** Adds a value to a list, or merges its sources into an equal value already there. */
function add(list: Any[], v: Any, key = keyOf) {
  const k = key(v), old = list.find((x) => key(x) === k);
  if (!old) { list.push(v); return v; }
  for (const s of v.sources) if (!old.sources.some((o: Source) => JSON.stringify(o) === JSON.stringify(s))) old.sources.push(s);
  if (v.roles) old.roles = [...new Set([...(old.roles ?? []), ...v.roles])];
  for (const [k2, x] of Object.entries(v)) if (old[k2] === undefined) old[k2] = x;
  return old;
}
const list = (o: Any, k: string) => (o[k] ??= []);
/** A credited name as written, without a joining word in front or a full stop at the end. */
const cleanName = (n: string) => n.replace(/^(?:with|and) /i, "").replace(/(\p{L}{2})\.$/u, "$1").trim();
/** The funder named in a sentence such as "This transcription was made as part of the X project, which has received funding from the Y". */
const funderIn = (t: string) => t.match(/(?:funding from|funded by) (?:the )?(.+?)(?: under | \(grant|,|\.$|$)/)?.[1];
const personKey = (p: Any) => nameKey(p.name) + (p.generalPractice ? "*" : "");
function addPerson(o: Any, p: Any) {
  const parts = p.name.split(/,\s*/), list2 = parts.length > 1 && !ORG.test(p.name) && parts.every((x: string) => new RegExp(`^${NAME}$`, "u").test(x)) ? parts : [p.name];
  for (const n of list2) { const name = cleanName(n); if (name) add(list(o, "people"), { ...p, name }, personKey); }
}

/** Library of Congress relator codes for a credit, from its words. */
function roles(resp: string): string[] {
  const r: string[] = [], t = resp.toLowerCase();
  if (/created by|^creat|made by/.test(t)) r.push("cre");
  if (/transcri/.test(t) && !/conver/.test(t)) r.push("trc");
  if (/reconcil|revis|review/.test(t)) r.push("rev");
  if (/proofread|proof-read|checked/.test(t)) r.push("pfr");
  if (/\bedit(or|ed by)\b/.test(t)) r.push("edt");
  if (/conver|xml|encod|mark-?up/.test(t)) r.push("mrk");
  if (/fund/.test(t)) r.push("fnd");
  if (/sponsor/.test(t)) r.push("spn");
  if (/publish/.test(t)) r.push("pbl");
  if (/principal investigator|director/.test(t)) r.push("pdr");
  if (/photograph|imag(ing|es) (taken|made)/.test(t)) r.push("pht");
  return r;
}
const NAME = "[A-Z][\\p{L}'’.-]*(?: (?:van |de |von |der )?[A-Z][\\p{L}'’.-]*)+";
const ORG = /\b(Council|Project|Institute|Institut|University|Universität|Library|Society|Societies|Board|Foundation|Academy|Programme|Center|Centre|Scheme)\b/;
const splitNames = (s: string): string[] => ORG.test(s) ? [s] : s.split(/,\s*(?:and\s+)?|\s+and\s+|\s*&\s*/).map((x) => x.trim()).filter((x) => new RegExp(`^${NAME}$`, "u").test(x));

/** Sentences of a paragraph; a period after a single capital letter or a short abbreviation does not end one. */
function sentences(p: string): string[] {
  const out: string[] = []; let cur = "";
  for (const tok of p.split(/(?<=[.;!?])\s+/)) {
    cur = cur ? `${cur} ${tok}` : tok;
    const last = cur.split(" ").pop() ?? "";
    if (/^(?:[A-Z]|[A-Z][a-z]{0,2}|cf|ed|fol|ff|no|vol|p|pp|St|Dr|Mr|Mrs|Gr|Nat|Bibl|Univ|Inv|Add|MS|Ms|e\.g|i\.e|etc|ca|c)\.$/.test(last) || /^[A-Z]\.[A-Z]\.$/.test(last)) continue;
    if (/^\d{1,2}\.$/.test(last)) continue;
    out.push(cur); cur = "";
  }
  if (cur) out.push(cur);
  return out.map(norm).filter(Boolean);
}
const years = (s: string) => [...s.matchAll(/\b(1[5-9]\d\d|20\d\d)\b/g)].map((m) => +m[1]);
function dateOf(s: string): Any {
  let m = s.match(/between (\d{4}) and (\d{4})/) ?? s.match(/\b(\d{4}) ?(?:-|to|and) ?(\d{4})\b/);
  if (m) return { from: +m[1], to: +m[2] };
  m = s.match(/\b(\d{4})-(\d{2})\b(?!-)/);
  if (m && +m[2] > 12) return { from: +m[1], to: +(m[1].slice(0, 2) + m[2]) };
  const y = years(s); return y.length ? { when: y[0] } : {};
}

// ---------- transcription records from a TEI header ----------
function fromHeader(path: string, archive: string, header: string, rec: Any, msr: Any) {
  const h = parseHeader(header), fd = kid(h, "fileDesc"), ts = kid(fd, "titleStmt"), es = kid(fd, "editionStmt"), ps = kid(fd, "publicationStmt");
  const sd = kid(fd, "sourceDesc"), ed = kid(h, "encodingDesc"), rd = kid(h, "revisionDesc"), L = "teiHeader/fileDesc";
  const titles = kids(ts, "title").filter((t) => textOf(t));
  const title = titles.find((t) => t.a.level === "a" && t.a.type === "main") ?? titles.find((t) => !t.a.type || t.a.type === "main") ?? titles[0];
  if (title) rec.title = { text: textOf(title), sources: [src(path, `${L}/titleStmt/title`, textOf(title))] };
  // people credited in the title statement and the publication statement
  kids(ts, "respStmt").forEach((rs, i) => {
    const resp = kids(rs, "resp").map(textOf).join(" "), loc = `${L}/titleStmt/respStmt[${i + 1}]`, q = textOf(rs);
    if (/assembled by/i.test(resp)) { rec.generatedBy = { text: q, sources: [src(path, loc, q)] }; return; }
    for (const n of kids(rs).filter((k) => ["name", "persName", "orgName"].includes(k.t) && k.a.type !== "email" && k.a.type !== "url")) {
      const name = textOf(n).replace(/^with /i, ""); if (!name) continue;
      addPerson(rec, { name, ...(n.a.type === "org" || n.t === "orgName" ? { kind: "organisation" } : /^members of /i.test(name) ? { kind: "group" } : {}), roles: roles(resp), statement: resp, sources: [src(path, loc, q)] });
    }
  });
  for (const [tag, role] of [["funder", "fnd"], ["sponsor", "spn"], ["principal", "pdr"], ["editor", "edt"], ["author", "cre"]] as const) {
    if (tag === "editor" && archive === "uxlc") continue; // the UXLC header names the codex's copyist and Masorete here
    kids(ts, tag).forEach((n, i) => {
      const inner = kids(n).filter((k) => ["name", "persName", "orgName"].includes(k.t));
      let names = inner.length ? inner.map(textOf) : [textOf(n)];
      if (!inner.length && /^(This|Partly)\b/.test(names[0])) { const f = funderIn(names[0]); names = f ? [f] : []; }
      for (const name of names.filter(Boolean)) addPerson(rec, { name, roles: [role], ...(name !== textOf(n) ? { statement: textOf(n) } : {}), sources: [src(path, `${L}/titleStmt/${tag}[${i + 1}]`, textOf(n))] });
    });
  }
  kids(ps, "publisher").forEach((n, i) => {
    const inner = kids(n).filter((k) => ["name", "persName", "orgName"].includes(k.t));
    const names = inner.length ? inner.map(textOf) : [n.c.filter((x) => typeof x === "string").map((x) => norm(x as string)).join(" ").trim() || textOf(n)];
    for (const name of names.filter(Boolean)) addPerson(rec, { name, roles: ["pbl"], sources: [src(path, `${L}/publicationStmt/publisher[${i + 1}]`, textOf(n))] });
  });
  for (const d of kids(ps, "date")) {
    const t = textOf(d); if (!t && !d.a.when) continue;
    const w = yearish(d.a.when) ?? dmy(t);
    add(list(rec, "published"), { ...(t ? { text: t } : {}), ...(w !== undefined ? { when: w } : {}), sources: [src(path, `${L}/publicationStmt/date`, raw(header, "date", header.slice(0, header.indexOf("<publicationStmt")).split(/<date\b/).length - 1) || t)] });
  }
  const av = kid(ps, "availability");
  if (av && textOf(av)) rec.rights = { statement: textOf(av), sources: [src(path, `${L}/publicationStmt/availability`, textOf(av))] };
  // version and revisions
  const edn = kid(es, "edition");
  if (edn && textOf(edn)) {
    const t = textOf(edn), d = kid(edn, "date"), v = kid(edn, "version");
    const label = edn.a.n ?? (v ? textOf(v) : t.match(/\b(?:Version|version|edition) ([\d.]+)/)?.[1]);
    const when = yearish(d?.a.when) ?? yearish(edn.a.when) ?? dmy(d ? textOf(d) : undefined);
    rec.version = { ...(label ? { label } : {}), text: t, ...(when !== undefined ? { when } : {}), sources: [src(path, `${L}/editionStmt/edition`, t)] };
  }
  const changes = kids(rd, "change").map((c) => ({ ...(c.a.n ? { n: c.a.n } : {}), ...(yearish(c.a.when) !== undefined ? { when: yearish(c.a.when) } : {}), description: textOf(c) })).filter((c) => c.description);
  const steps = kids(kid(es, "respStmt"), "resp").map((r) => ({ description: textOf(r) })).filter((c) => c.description);
  if (changes.length || steps.length) {
    const q = changes.length ? changes[0].description : steps[0].description;
    rec.revisions = { entries: [...changes, ...steps], sources: [src(path, changes.length ? "teiHeader/revisionDesc" : `${L}/editionStmt/respStmt`, q)] };
  }
  // UXLC: the text it starts from, and who made the corrections
  const notes = kid(fd, "notesStmt");
  for (const n of kids(notes, "note")) {
    const m = textOf(n).match(/The original text file (\S+) was provided by the ([^.]+?)\./);
    if (m) add(list(rec, "basedOn"), { name: `${m[1]}, provided by the ${m[2]}`, relation: "derived-from", sources: [src(path, `${L}/notesStmt/note`, m[0])] });
  }
  for (const c of kids(notes, "correction")) {
    const a = kid(c, "author"); if (!a || !textOf(a)) continue;
    addPerson(rec, { name: textOf(a), roles: ["ctb"], statement: "author of corrections", sources: [src(path, `${L}/notesStmt/correction/author`, raw(header, "author", 0).includes(textOf(a)) ? `<author>${textOf(a)}</author>` : textOf(a))] });
  }
  // sentences of the project and editorial descriptions, and the source description's notes
  const surrogates = findAll(sd, "surrogates")[0];
  const surrSentences = surrogates ? kids(surrogates, "p").flatMap((p) => sentences(textOf(p))) : surrogates ? [] : [];
  const paras: { loc: string; text: string }[] = [];
  for (const [part, el] of [["projectDesc", kid(ed, "projectDesc")], ["editorialDecl", kid(ed, "editorialDecl")]] as const)
    kids(el).forEach((p, i) => { const t = textOf(p); if (t) paras.push({ loc: `teiHeader/encodingDesc/${part}/${p.t}[${i + 1}]`, text: t }); });
  findAll(sd, "note").forEach((n, i) => { const t = textOf(n); if (t) paras.push({ loc: `${L}/sourceDesc//note[${i + 1}]`, text: t }); });
  for (const p of paras) {
    // the plain-text header kept from an older IGNTP file
    const tb = p.text.match(/Transcribed by: ?([A-Z]{2,}?(?:-[A-Z]{2,}?)*)(?=Transcription|[^A-Za-z]|$)/);
    if (tb) addPerson(rec, { name: tb[1], roles: ["trc"], statement: "Transcribed by", sources: [src(path, p.loc, tb[0])] });
    const tm = p.text.match(/Transcription begun: ?[\d./-]+ ?Transcription finished: ?[\d./-]+/);
    if (tm) add(list(rec, "made"), { text: tm[0], sources: [src(path, p.loc, tm[0])] });
    for (const s of sentences(p.text)) sentence(path, s, p.loc, rec, msr, surrSentences);
  }
}

/** True when the years of a sentence date the images, as in "transcribed from digital images taken by the project in 2006-2009". */
function imageYear(s: string) {
  const m = s.match(/\b(images?|photographs?|microfilm)\b[^.]*?\b(taken|made|produced|photographed|captured)\b/i);
  if (!m) return false;
  const y = s.search(/\b(1[5-9]\d\d|20\d\d)\b/);
  return y > (m.index ?? 0);
}

function sentence(path: string, s: string, loc: string, rec: Any, msr: Any, surr: string[]) {
  const S = [src(path, loc, s)], archive = path.split("/")[1], stem = path.split("/")[2].replace(/\.xml$/, "");
  const practice = (kind: string) => add(list(list(rec, "method", {} as any) as any, "practices"), { kind, text: s, sources: S });
  const m2 = (o: Any, k: string) => ((o.method ??= {})[k] ??= []);
  const practices = (kind: string) => add(m2(rec, "practices"), { kind, text: s, sources: S });
  void practice;
  const published = /\b(published|made available|first edition)\b/i.test(s);
  if (years(s).length && !/transcription editor|guidelines|version \d/i.test(s) && !/convert/i.test(s)) {
    if (published) add(list(rec, "published"), { text: s, ...dateOf(s), sources: S });
    else if (/\b(made|produced|created|transcribed|undertaken|begun|completed)\b/i.test(s) && !imageYear(s)) add(list(rec, "made"), { text: s, ...dateOf(s), sources: S });
  }
  // what it was made from
  const from = (kind: string, reproduction?: string) => add(list(rec, "madeFrom"), { kind, ...(reproduction ? { reproduction } : {}), description: s, sources: S });
  if (/no images (of the manuscript )?(were|are) available/i.test(s)) from("no-images");
  else if (/microfilm/i.test(s) && /(used|from|transcri)/i.test(s)) from("microfilm");
  else if (/typescript/i.test(s)) from("typescript");
  else if (/(editio princeps|Monumenta Sacra|transcription of the (printed )?edition|from the (printed )?edition)/i.test(s)) from("edition");
  else if (/verified against the manuscript|from the manuscript itself|directly from the manuscript/i.test(s)) { from("original"); practices("verification-against-original"); }
  else if (/\bimages?\b/i.test(s) && /\b(from|using|used|made from|transcribed)\b/i.test(s) && !/reconcil/i.test(s)) {
    let cands = surr.map((x, i) => ({ x, i })).filter(({ x }) => /image|photograph/i.test(x));
    if (/digital/i.test(s)) { const d = cands.filter(({ x }) => /digital/i.test(x)); if (d.length) cands = d; }
    const rid = cands.length === 1 ? `${archive}-${cands[0].i + 1}` : undefined;
    if (rid && !msr.reproductions?.some((r: Any) => r.id === rid)) from("images"); else from("images", rid);
  }
  // what it is based on
  if (/made by the INTF and converted into XML by ITSEE/i.test(s)) {
    const intf = existsSync(`${ROOT}archives/intf/${stem}.xml`) ? { transcription: `intf/${stem}` } : {};
    add(list(rec, "basedOn"), { ...intf, name: "the INTF transcription", relation: "derived-from", description: s, sources: S });
    addPerson(rec, { name: "INTF", kind: "organisation", roles: ["cre"], statement: s, sources: S });
    addPerson(rec, { name: "ITSEE", kind: "organisation", roles: ["mrk"], statement: s, sources: S });
  }
  let m = s.match(/(the transcription in the thesis by [A-Z]\S+ [A-Z][\p{L}-]+|[A-Z]\S+ [A-Z][\p{L}-]+'s thesis transcription)/u);
  if (m) add(list(rec, "basedOn"), { name: m[1], relation: "derived-from", description: s, sources: S });
  m = s.match(/based on that of ([A-Z][\p{L}-]+)/u);
  if (m) add(list(rec, "basedOn"), { name: `the transcription by ${m[1]}`, relation: "derived-from", description: s, sources: S });
  // people named in a sentence
  const who = (re: RegExp, role: string[]) => {
    for (const mm of s.matchAll(re)) for (const name of splitNames(mm[1])) if (!/^(The|This|It|INTF|ITSEE)\b/.test(name)) addPerson(rec, { name, roles: role, statement: s, sources: S });
  };
  const LIST = `(${NAME}(?:(?:, | and | & )${NAME})*)`;
  who(new RegExp(`(?:transcription was|transcriptions were) made by (?:the )?${LIST}`, "gu"), ["cre"]);
  who(new RegExp(`\\btranscribed by ${LIST}`, "gu"), ["trc"]);
  who(new RegExp(`${LIST} (?:then )?transcribed\\b`, "gu"), ["trc"]);
  who(new RegExp(`\\bproof-?read by ${LIST}`, "gu"), ["pfr"]);
  who(new RegExp(`${LIST} (?:then |also |later )?proof-?read\\b`, "gu"), ["pfr"]);
  who(new RegExp(`\\breconciled by ${LIST}`, "gu"), ["rev"]);
  who(new RegExp(`\\bconverted (?:to|into) XML by ${LIST}`, "gu"), ["mrk"]);
  who(new RegExp(`\\bconverted by ${LIST}`, "gu"), ["mrk"]);
  who(new RegExp(`${LIST} later revised\\b`, "gu"), ["rev"]);
  m = s.match(/(?:transcription was|transcriptions were) made by the ((?:International Greek New Testament Project|Codex Zacynthius Project|IGNTP|INTF)\b)/);
  if (m) addPerson(rec, { name: m[1], kind: "organisation", roles: ["cre"], statement: s, sources: S });
  // how it was checked
  if (/double[- ]transcribed|two independent|double independent|independent transcriptions/i.test(s)) practices("independent-double-transcription");
  if (/automatically compared|compared by software|automatic comparison/i.test(s)) practices("automatic-comparison");
  if (/reconcil|compared with \S+ trans/i.test(s)) practices("reconciliation");
  if (/reconcil/i.test(s) && /images/i.test(s)) practices("checked-against-images");
  if (/proof-?read/i.test(s)) practices("proofreading");
  if (/(revised|corrected|checked|compared)\b.*\b(published|printed edition|edition)\b|to correspond to the (printed )?edition/i.test(s)) practices("compared-with-edition");
  if (/compared (it )?with (other|the other|existing) transcriptions/i.test(s)) practices("compared-with-other-transcriptions");
  if (/adapted from|altered to (match|correspond)|base text was/i.test(s)) practices("base-text-adaptation");
  if (/convert(ed)? (to|into) XML|XML conversion|converted by/i.test(s)) practices("conversion-to-xml");
  // guidelines, tools, encoding, base text, scope, conventions
  if (/guidelines/i.test(s)) add(m2(rec, "guidelines"), { text: s, sources: S });
  if (/transcription editor|\bCOLLATE\b|oxygen|python|conversion script|Anastasia|Excel|software|Workspace for Collaborative Editing/i.test(s)) add(m2(rec, "tools"), { text: s, sources: S });
  if (/\bTEI\b|Unicode/i.test(s) && !/guidelines/i.test(s)) add(m2(rec, "encoding"), { text: s, sources: S });
  if (/base texts? (used|was|is)|collation base|base text:/i.test(s)) add(list(rec, "baseText"), { text: s, sources: S });
  if (/^(this transcription (covers|is of|includes the text of)|it (covers|consists of)|the transcription covers|covers all)/i.test(s)) add(list(rec, "scope"), { text: s, sources: S });
  if (/(are|is|have|has) not (been )?(normally )?(recorded|encoded|transcribed|included)|the transcription (includes|records|does not)|are recorded|are encoded|are marked/i.test(s)) add(m2(rec, "conventions"), { text: s, sources: S });
}

// ---------- manuscript records from a TEI header ----------
function msFromHeader(path: string, archive: string, header: string, msr: Any) {
  const h = parseHeader(header), sd = kid(kid(h, "fileDesc"), "sourceDesc"), md = findAll(sd, "msDesc")[0];
  const L = "teiHeader/fileDesc/sourceDesc/msDesc";
  if (md) {
    const id = kid(md, "msIdentifier"), loc = `${L}/msIdentifier`;
    let cur: XNode[] = [];
    const groups: XNode[][] = [];
    for (const k of kids(id)) {
      if (["msName", "altIdentifier"].includes(k.t)) continue;
      if ((k.t === "country" || k.t === "settlement" || k.t === "region") && cur.some((x) => x.t === "repository" || x.t === "idno")) { groups.push(cur); cur = []; }
      cur.push(k);
    }
    if (cur.length) groups.push(cur);
    for (const g of groups) {
      const get = (t: string) => g.filter((x) => x.t === t).map(textOf).filter((x) => x && !PLACEHOLDER.test(x));
      const hold: Any = {};
      if (get("repository")[0]) hold.repository = get("repository")[0];
      if (get("settlement")[0]) hold.settlement = get("settlement")[0];
      if (get("country")[0]) hold.country = get("country")[0];
      if (get("idno").length) hold.idno = get("idno");
      if (!hold.repository && !hold.settlement && !hold.idno) continue;
      hold.sources = [src(path, loc, g.map(textOf).filter(Boolean).join(" "))];
      add(list(msr, "holdings"), hold);
    }
    kids(id, "msName").forEach((n, i) => { const t = textOf(n); if (t) add(list(msr, "names"), { text: t, ...(n.a.lang ? { language: n.a.lang } : {}), sources: [src(path, `${loc}/msName`, raw(header, "msName", i) || t)] }); });
    kids(id, "altIdentifier").forEach((a, i) => {
      const v = textOf(kid(a, "idno")) || textOf(a); if (!v) return;
      add(list(msr, "identifiers"), { scheme: a.a.type ?? "other", value: v, sources: [src(path, `${loc}/altIdentifier`, raw(header, "altIdentifier", i) || v)] });
    });
    findAll(md, "origDate").forEach((d, i) => {
      const t = textOf(d), o: Any = {};
      if (t) o.text = t;
      for (const k of ["when", "notBefore", "notAfter"]) if (yearish(d.a[k]) !== undefined) o[k] = yearish(d.a[k]);
      if (yearish(d.a.from) !== undefined && o.notBefore === undefined) o.notBefore = yearish(d.a.from);
      if (yearish(d.a.to) !== undefined && o.notAfter === undefined) o.notAfter = yearish(d.a.to);
      if (!Object.keys(o).length) return;
      o.of = "writing";
      o.sources = [src(path, `${L}/history/origin/origDate`, raw(header, "origDate", i) || t)];
      add(list(msr, "dates"), o);
    });
    findAll(md, "origPlace").forEach((p) => { const t = textOf(p); if (t && !/^unknown/i.test(t)) add(list(msr, "originPlaces"), { text: t, sources: [src(path, `${L}/history/origin/origPlace`, t)] }); });
    const od = findAll(md, "objectDesc")[0];
    if (od?.a.form) msr.form ??= { text: od.a.form, sources: [src(path, `${L}/physDesc/objectDesc`, (norm(header).match(/<objectDesc\b[^>]*>/) ?? [""])[0])] };
    const sup = findAll(md, "support")[0];
    if (sup && textOf(sup)) msr.material ??= { text: textOf(sup), sources: [src(path, `${L}/physDesc/objectDesc/supportDesc/support`, textOf(sup))] };
    findAll(md, "textLang").forEach((t) => { const x = textOf(t); if (x) add(list(msr, "languages"), { text: x, sources: [src(path, `${L}/msContents/textLang`, x)] }); });
  }
  const sg = findAll(sd, "surrogates")[0];
  if (sg) kids(sg, "p").flatMap((p) => sentences(textOf(p))).forEach((s, i) => {
    if (!/image|photograph|facsimile|microfilm|edition/i.test(s)) return;
    const kind = /multispectral/i.test(s) ? "multispectral" : /microfilm/i.test(s) ? "microfilm" : /facsimile/i.test(s) ? "facsimile" : /raking/i.test(s) ? "digital-raking-light" : /colou?r digital|digital colou?r|colou?r images/i.test(s) ? "digital-colour" : /black[- ]and[- ]white/i.test(s) ? "black-and-white-photograph" : undefined;
    const r: Any = { id: `${archive}-${i + 1}`, ...(kind ? { kind } : {}), description: s };
    const d = dateOf(s); if (Object.keys(d).length) r.when = { text: s.match(/\b\d{4}([-–]\d{2,4}| and \d{4})?/)?.[0].trim() ?? String(years(s)[0]), ...d, sources: [src(path, `${L}/additional/surrogates`, s)] };
    r.sources = [src(path, `${L}/additional/surrogates`, s)];
    const old = (msr.reproductions ??= []).find((x: Any) => x.description === s);
    if (old) { if (!old.sources.some((o: Any) => o.path === path)) old.sources.push(r.sources[0]); } else msr.reproductions.push(r);
  });
}

// ---------- the INTF catalogue and NTVMR metadata ----------
let liste: string | undefined;
if (EVIDENCE) {
  const dir = `${EVIDENCE}/sources/intf-ntvmr`;
  const snap = existsSync(dir) ? readdirSync(dir).filter((d) => /^\d{4}-\d\d-\d\d$/.test(d)).sort().pop() : undefined;
  if (snap && existsSync(`${dir}/${snap}/catalogue.json`)) liste = readFileSync(`${dir}/${snap}/catalogue.json`, "utf8"); // the whole list, docID 10000 to 49999
}
const docOf = (s: string) => (s.startsWith("P") ? 10000 + +s.slice(1) : s.startsWith("L") ? 40000 + +s.slice(1) : s.startsWith("0") ? 20000 + +s : /^\d+$/.test(s) ? 30000 + +s : 0);
function listeEntry(doc: number): string | undefined {
  if (!liste) return;
  const i = liste.search(new RegExp(`"docID": ?${doc}\\b`)); if (i < 0) return;
  const a = liste.lastIndexOf("{", i), b = liste.indexOf("}", i);
  return a >= 0 && b > 0 ? liste.slice(a, b + 1) : undefined;
}
function fromListe(gaId: string, msr: Any) {
  const doc = docOf(gaId), e = doc ? listeEntry(doc) : undefined; if (!e) return;
  const o = JSON.parse(e), S = [{ url: LISTE_URL, accessed: "2026-11-23", title: "INTF New Testament Virtual Manuscript Room, manuscript list", quote: norm(e) }];
  const d: Any = {}; if (o.orig) d.text = String(o.orig);
  if (typeof o.origEarly === "number" && o.origEarly) d.notBefore = o.origEarly;
  if (typeof o.origLate === "number" && o.origLate) d.notAfter = o.origLate;
  if (Object.keys(d).length) add(list(msr, "dates"), { ...d, of: "writing", method: [{ category: "reported", name: "catalogue" }], statedBy: [{ name: "Institut für neutestamentliche Textforschung (INTF)", kind: "organisation", sources: S }], sources: S });
}
function fromNtvmr(gaId: string, msr: Any) {
  const doc = docOf(gaId), f = NTVMR && doc ? `${NTVMR}/${doc}.json` : undefined;
  if (!f || !existsSync(f)) return;
  const j = JSON.parse(readFileSync(f, "utf8")), m = j.manuscript ?? {}, url = NTVMR_META_URL(doc), acc = j.accessed ?? TODAY;
  const S = (quote: string) => [{ url, accessed: acc, title: "INTF New Testament Virtual Manuscript Room, manuscript metadata", quote: norm(quote) }];
  for (const sh of [m.shelfInstances?.shelfInstance ?? []].flat()) {
    const inst = sh?.institution ?? {}, hold: Any = {};
    if (inst.name) hold.repository = inst.name;
    if (inst.place) hold.settlement = inst.place;
    if (inst.country) hold.country = inst.country;
    if (sh.shelfNumber) hold.idno = [String(sh.shelfNumber)];
    if (sh.leavesDescription) hold.leaves = String(sh.leavesDescription);
    if (!hold.repository && !hold.idno) continue;
    hold.sources = S(String(sh.shelfNumber ?? inst.name));
    add(list(msr, "holdings"), hold);
  }
  for (const [surr, x] of Object.entries<Any>(j.surrogates ?? {})) {
    const rid = `ntvmr-${surr}`; if ((msr.reproductions ??= []).some((r: Any) => r.id === rid)) continue;
    if (!(x.attribution ?? []).some((t: string) => t.trim())) continue; // nothing quotable about this image set
    const owner = [...new Set((x.attribution ?? []).map((t: string) => norm(t.replace(/<br\s*\/?>/g, " ").replace(/<[^>]*>/g, " ")).replace(/©\s*/, "© ")).filter(Boolean))].join("; ");
    msr.reproductions.push({ id: rid, description: "Page images shown in the INTF New Testament Virtual Manuscript Room", coverage: `${x.pages} page images listed`, owner, where: `https://ntvmr.uni-muenster.de/manuscript-workspace?docID=${doc}`, sources: S(owner) });
  }
}

// ---------- archive-level facts ----------
function verify(s: Any) {
  const copy = COPIES[s.url]; if (!copy || !existsSync(copy)) return;
  const t = norm(readFileSync(copy, "utf8").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").replace(/(\p{Ll})-\s+(\p{Ll})/gu, "$1$2"));
  quotesChecked++;
  if (!t.includes(norm(s.quote))) problems.push(`quote not found in the saved copy of ${s.url}: ${s.quote}`);
}
function upstream(archive: string, path: string, rec: Any) {
  for (const u of UPSTREAM) {
    if (!u.archives.includes(archive) || (u.when && !u.when.test(path))) continue;
    const all = [...(u.people ?? []), ...(u.made ?? []), ...(u.madeFrom ?? []), ...(u.practices ?? []), ...(u.tools ?? []), ...(u.basedOn ?? []), ...(u.rights ? [u.rights] : [])];
    for (const x of all) { const so = x.source as Any; UPSTREAM_KEYS.add(`${so.url}\n${so.quote}`); verify(so); }
    for (const { source, ...p } of u.people ?? []) addPerson(rec, { ...p, sources: [source] });
    for (const { source, ...d } of u.made ?? []) add(list(rec, "made"), { ...d, sources: [source] });
    for (const { source, ...d } of u.madeFrom ?? []) add(list(rec, "madeFrom"), { ...d, sources: [source] });
    for (const { source, ...d } of u.practices ?? []) add(((rec.method ??= {}).practices ??= []), { ...d, sources: [source] });
    for (const { source, ...d } of u.tools ?? []) add(((rec.method ??= {}).tools ??= []), { ...d, sources: [source] });
    for (const { source, ...d } of u.basedOn ?? []) add(list(rec, "basedOn"), { ...d, sources: [source] });
    if (u.rights && !rec.rights) rec.rights = { statement: u.rights.statement, sources: [u.rights.source] };
  }
}

// ---------- run over every archive ----------
const archives = readdirSync(`${ROOT}archives`).filter((a) => existsSync(`${ROOT}archives/${a}/index.json`)).sort();
let files = 0;
for (const archive of archives) {
  const idx = JSON.parse(readFileSync(`${ROOT}archives/${archive}/index.json`, "utf8"));
  for (const item of idx.items) {
    const mid = manuscriptId(archive, item.id);
    const msr = ms.get(mid) ?? { id: mid }; ms.set(mid, msr);
    if (mid.startsWith("ga-") && !msr._liste) { fromListe(item.id, msr); fromNtvmr(item.id, msr); msr._liste = true; }
    for (const path of item.paths as string[]) {
      files++;
      const rec: Any = { id: transcriptionId(path), manuscript: mid, file: path };
      const header = readHeader(`${ROOT}${path}`);
      if (header && !OWN_HEADERS.has(archive)) {
        msFromHeader(path, archive, header, msr);
        fromHeader(path, archive, header, rec, msr);
        for (const q of collectQuotes(rec)) { quotesChecked++; if (!headerHaystacks(header).some((h) => h.includes(norm(q)))) problems.push(`${path}: quote not in header: ${q}`); }
      }
      upstream(archive, path, rec);
      tr.set(rec.id, rec);
    }
  }
}
function collectQuotes(o: any, path?: string): string[] {
  if (!o || typeof o !== "object") return [];
  if (Array.isArray(o)) return o.flatMap((x) => collectQuotes(x, path));
  if (typeof o.quote === "string" && typeof o.path === "string") return [o.quote];
  return Object.values(o).flatMap((x) => collectQuotes(x, path));
}
// manuscript facts in the headers are quoted too
for (const m of ms.values()) for (const s of collectSources(m)) if ("path" in s) {
  const header = readHeader(`${ROOT}${s.path}`); quotesChecked++;
  if (!headerHaystacks(header).some((h) => h.includes(norm(s.quote)))) problems.push(`${s.path}: quote not in header: ${s.quote}`);
}
function collectSources(o: any): Any[] {
  if (!o || typeof o !== "object") return [];
  if (Array.isArray(o)) return o.flatMap(collectSources);
  if (o.quote && (o.path || o.url)) return [o];
  return Object.values(o).flatMap(collectSources);
}

// ---------- keep hand-written entries from the files already there ----------
const ntvmrGiven = !!NTVMR, listeGiven = !!liste;
const handOnly = (x: Any) => { const ss = collectSources(x); return ss.length > 0 && ss.every((s) => !isManaged(s as Source, ntvmrGiven, listeGiven)); };
function keepHand(old: Any, cur: Any, top = true) {
  for (const [k, v] of Object.entries(old)) {
    if (top && ["id", "manuscript", "file"].includes(k)) continue;
    if (Array.isArray(v)) {
      const hand = v.filter((x) => typeof x === "object" && handOnly(x));
      if (!hand.length) continue;
      const arr = (cur[k] ??= []);
      for (const x of hand) if (!arr.some((y: Any) => JSON.stringify(y) === JSON.stringify(x))) arr.push(x);
    } else if (v && typeof v === "object" && !("sources" in v)) keepHand(v, (cur[k] ??= {}), false);
    else if (v && typeof v === "object" && cur[k] === undefined && handOnly(v)) cur[k] = v;
  }
}
const readYaml = (f: string) => (existsSync(f) ? (Bun.YAML.parse(readFileSync(f, "utf8")) as Any) : undefined);

// ---------- write ----------
const ORDER = ["id", "manuscript", "file", "title", "names", "identifiers", "form", "material", "languages", "holdings", "dates", "originPlaces", "provenance", "reproductions",
  "people", "made", "madeFrom", "published", "version", "revisions", "method", "basedOn", "baseText", "scope", "rights", "generatedBy",
  "practices", "guidelines", "tools", "encoding", "conventions",
  "name", "kind", "roles", "statement", "books", "generalPractice", "text", "code", "language", "scheme", "value", "repository", "settlement", "country", "idno", "part", "leaves",
  "label", "when", "notBefore", "notAfter", "from", "to", "calendar", "of", "method", "measurement", "statedBy", "publication", "reproduction", "description", "transcription", "url", "relation", "covers",
  "madeBy", "device", "lighting", "resolution", "coverage", "owner", "where", "type", "place", "agents", "entries", "n",
  "sources", "path", "locator", "title", "citation", "accessed", "quote"];
const rank = (k: string) => { const i = ORDER.indexOf(k); return i < 0 ? 999 : i; };
function tidy(o: any): any {
  if (Array.isArray(o)) return o.map(tidy);
  if (!o || typeof o !== "object") return o;
  const out: Any = {};
  for (const k of Object.keys(o).filter((k) => !k.startsWith("_")).sort((a, b) => rank(a) - rank(b))) {
    const v = tidy(o[k]);
    if (v === undefined || (Array.isArray(v) && !v.length) || (v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) continue;
    if (k === "roles" && Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out;
}
const HEAD = (what: string) => `# ${what} Written by scripts/records.ts; entries whose sources are all web pages it does not produce were written by hand and are kept.\n# Fields: docs/archive-records.md. Schema: schema/${what.startsWith("Manuscript") ? "manuscript" : "transcription"}.schema.json\n`;
function write(file: string, rec: Any, what: string) {
  const old = readYaml(`${ROOT}${file}`);
  if (old) keepHand(old, rec);
  const text = HEAD(what) + Bun.YAML.stringify(tidy(rec), null, 2).replace(/\n*$/, "\n");
  mkdirSync(dirname(`${ROOT}${file}`), { recursive: true });
  if (!existsSync(`${ROOT}${file}`) || readFileSync(`${ROOT}${file}`, "utf8") !== text) writeFileSync(`${ROOT}${file}`, text);
}
const wantedT = new Set<string>(), wantedM = new Set<string>();
for (const r of tr.values()) { const f = transcriptionPath(r.file); wantedT.add(f); write(f, r, "Transcription record: one transcription file."); }
for (const m of ms.values()) { const f = manuscriptPath(m.id); wantedM.add(f); write(f, m, "Manuscript record: the physical manuscript and its reproductions."); }
// remove records whose file or manuscript is gone
const walk = (d: string): string[] => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`])) : []);
for (const f of walk(`${ROOT}archives/transcriptions`)) if (!wantedT.has(f.slice(ROOT.length))) rmSync(f);
for (const f of walk(`${ROOT}archives/manuscripts`)) if (!wantedM.has(f.slice(ROOT.length))) rmSync(f);

console.log(`${tr.size} transcription records (${files} files), ${ms.size} manuscript records; ${quotesChecked} quotes checked${liste ? "" : "; no INTF catalogue (pass --evidence)"}${NTVMR ? "" : "; no NTVMR metadata (pass --ntvmr)"}`);
if (problems.length) { console.error([...new Set(problems)].slice(0, 60).join("\n")); console.error(`${problems.length} problems`); process.exit(1); }
