#!/usr/bin/env bun
/**
 * Compiles immutable, ULID-identified source set snapshots in `archives/sets/<ULID>.json`
 * from the per-institution catalogs in `archives/<institution>/index.json`.
 *
 * Each book (Gen..Rev) and each institution (intf, uxlc, etc.) gets an immutable
 * snapshot file keyed by a 26-character ULID and content hash (sha256).
 *
 * - If a snapshot with the exact same kind, key, and sha256 already exists, its
 *   ULID is preserved (idempotent).
 * - If new sources are added or changed, a fresh ULID is minted while older
 *   snapshots remain untouched so existing specifications stay pinned forever.
 *
 * Usage:
 *   bun run sets
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const SETS_DIR = `${ROOT}archives/sets`;

// Crockford Base32 ULID generator (monotonic within the same millisecond)
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
let lastTime = 0;
let lastRand = new Uint8Array(10);

export function ulid(): string {
  const now = Date.now();
  let t = now;
  const timeChars = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    timeChars[i] = CROCKFORD[t % 32];
    t = Math.floor(t / 32);
  }
  if (now === lastTime) {
    // Increment 80-bit random component monotonically
    for (let i = 9; i >= 0; i--) {
      if (lastRand[i] < 255) {
        lastRand[i]++;
        break;
      }
      lastRand[i] = 0;
    }
  } else {
    lastTime = now;
    lastRand = new Uint8Array(randomBytes(10));
  }
  // Encode 80 bits (10 bytes) into 16 base32 chars
  let bits = 0;
  let val = 0;
  const randChars: string[] = [];
  for (const byte of lastRand) {
    val = (val << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      randChars.push(CROCKFORD[(val >>> bits) & 31]);
    }
  }
  return timeChars.join("") + randChars.slice(0, 16).join("");
}

export interface BookMeta {
  id: string;
  name: string;
  section: "Old Testament" | "New Testament";
  number: number;
  language: string;
}

export const CANONICAL_BOOKS: BookMeta[] = [
  { id: "Gen", name: "Genesis", section: "Old Testament", number: 1, language: "Hebrew and Aramaic" },
  { id: "Exod", name: "Exodus", section: "Old Testament", number: 2, language: "Hebrew" },
  { id: "Lev", name: "Leviticus", section: "Old Testament", number: 3, language: "Hebrew" },
  { id: "Num", name: "Numbers", section: "Old Testament", number: 4, language: "Hebrew" },
  { id: "Deut", name: "Deuteronomy", section: "Old Testament", number: 5, language: "Hebrew" },
  { id: "Josh", name: "Joshua", section: "Old Testament", number: 6, language: "Hebrew" },
  { id: "Judg", name: "Judges", section: "Old Testament", number: 7, language: "Hebrew" },
  { id: "1Sam", name: "1 Samuel", section: "Old Testament", number: 8, language: "Hebrew" },
  { id: "2Sam", name: "2 Samuel", section: "Old Testament", number: 9, language: "Hebrew" },
  { id: "1Kgs", name: "1 Kings", section: "Old Testament", number: 10, language: "Hebrew" },
  { id: "2Kgs", name: "2 Kings", section: "Old Testament", number: 11, language: "Hebrew" },
  { id: "Isa", name: "Isaiah", section: "Old Testament", number: 12, language: "Hebrew" },
  { id: "Jer", name: "Jeremiah", section: "Old Testament", number: 13, language: "Hebrew and Aramaic" },
  { id: "Ezek", name: "Ezekiel", section: "Old Testament", number: 14, language: "Hebrew" },
  { id: "Hos", name: "Hosea", section: "Old Testament", number: 15, language: "Hebrew" },
  { id: "Joel", name: "Joel", section: "Old Testament", number: 16, language: "Hebrew" },
  { id: "Amos", name: "Amos", section: "Old Testament", number: 17, language: "Hebrew" },
  { id: "Obad", name: "Obadiah", section: "Old Testament", number: 18, language: "Hebrew" },
  { id: "Jonah", name: "Jonah", section: "Old Testament", number: 19, language: "Hebrew" },
  { id: "Mic", name: "Micah", section: "Old Testament", number: 20, language: "Hebrew" },
  { id: "Nah", name: "Nahum", section: "Old Testament", number: 21, language: "Hebrew" },
  { id: "Hab", name: "Habakkuk", section: "Old Testament", number: 22, language: "Hebrew" },
  { id: "Zeph", name: "Zephaniah", section: "Old Testament", number: 23, language: "Hebrew" },
  { id: "Hag", name: "Haggai", section: "Old Testament", number: 24, language: "Hebrew" },
  { id: "Zech", name: "Zechariah", section: "Old Testament", number: 25, language: "Hebrew" },
  { id: "Mal", name: "Malachi", section: "Old Testament", number: 26, language: "Hebrew" },
  { id: "1Chr", name: "1 Chronicles", section: "Old Testament", number: 27, language: "Hebrew" },
  { id: "2Chr", name: "2 Chronicles", section: "Old Testament", number: 28, language: "Hebrew" },
  { id: "Ps", name: "Psalms", section: "Old Testament", number: 29, language: "Hebrew" },
  { id: "Job", name: "Job", section: "Old Testament", number: 30, language: "Hebrew" },
  { id: "Prov", name: "Proverbs", section: "Old Testament", number: 31, language: "Hebrew" },
  { id: "Ruth", name: "Ruth", section: "Old Testament", number: 32, language: "Hebrew" },
  { id: "Song", name: "Song of Songs", section: "Old Testament", number: 33, language: "Hebrew" },
  { id: "Eccl", name: "Ecclesiastes", section: "Old Testament", number: 34, language: "Hebrew" },
  { id: "Lam", name: "Lamentations", section: "Old Testament", number: 35, language: "Hebrew" },
  { id: "Esth", name: "Esther", section: "Old Testament", number: 36, language: "Hebrew" },
  { id: "Dan", name: "Daniel", section: "Old Testament", number: 37, language: "Hebrew and Aramaic" },
  { id: "Ezra", name: "Ezra", section: "Old Testament", number: 38, language: "Hebrew and Aramaic" },
  { id: "Neh", name: "Nehemiah", section: "Old Testament", number: 39, language: "Hebrew" },
  { id: "Matt", name: "Matthew", section: "New Testament", number: 1, language: "Greek" },
  { id: "Mark", name: "Mark", section: "New Testament", number: 2, language: "Greek" },
  { id: "Luke", name: "Luke", section: "New Testament", number: 3, language: "Greek" },
  { id: "John", name: "John", section: "New Testament", number: 4, language: "Greek" },
  { id: "Acts", name: "Acts", section: "New Testament", number: 5, language: "Greek" },
  { id: "Rom", name: "Romans", section: "New Testament", number: 6, language: "Greek" },
  { id: "1Cor", name: "1 Corinthians", section: "New Testament", number: 7, language: "Greek" },
  { id: "2Cor", name: "2 Corinthians", section: "New Testament", number: 8, language: "Greek" },
  { id: "Gal", name: "Galatians", section: "New Testament", number: 9, language: "Greek" },
  { id: "Eph", name: "Ephesians", section: "New Testament", number: 10, language: "Greek" },
  { id: "Phil", name: "Philippians", section: "New Testament", number: 11, language: "Greek" },
  { id: "Col", name: "Colossians", section: "New Testament", number: 12, language: "Greek" },
  { id: "1Thess", name: "1 Thessalonians", section: "New Testament", number: 13, language: "Greek" },
  { id: "2Thess", name: "2 Thessalonians", section: "New Testament", number: 14, language: "Greek" },
  { id: "1Tim", name: "1 Timothy", section: "New Testament", number: 15, language: "Greek" },
  { id: "2Tim", name: "2 Timothy", section: "New Testament", number: 16, language: "Greek" },
  { id: "Titus", name: "Titus", section: "New Testament", number: 17, language: "Greek" },
  { id: "Phlm", name: "Philemon", section: "New Testament", number: 18, language: "Greek" },
  { id: "Heb", name: "Hebrews", section: "New Testament", number: 19, language: "Greek" },
  { id: "Jas", name: "James", section: "New Testament", number: 20, language: "Greek" },
  { id: "1Pet", name: "1 Peter", section: "New Testament", number: 21, language: "Greek" },
  { id: "2Pet", name: "2 Peter", section: "New Testament", number: 22, language: "Greek" },
  { id: "1John", name: "1 John", section: "New Testament", number: 23, language: "Greek" },
  { id: "2John", name: "2 John", section: "New Testament", number: 24, language: "Greek" },
  { id: "3John", name: "3 John", section: "New Testament", number: 25, language: "Greek" },
  { id: "Jude", name: "Jude", section: "New Testament", number: 26, language: "Greek" },
  { id: "Rev", name: "Revelation", section: "New Testament", number: 27, language: "Greek" },
];

export interface SourceSet {
  id: string;
  kind: "book" | "institution";
  key: string;
  name: string;
  section?: string;
  number?: number;
  language?: string;
  sha256: string;
  sources: Record<string, string[]>;
}

const hashSources = (kind: string, key: string, sources: Record<string, string[]>) =>
  createHash("sha256").update(JSON.stringify({ kind, key, sources })).digest("hex");

if (import.meta.main) {
  mkdirSync(SETS_DIR, { recursive: true });

  // Load existing immutable snapshots so identical content reuses the same ULID
  const existingByHash = new Map<string, SourceSet>();
  for (const f of readdirSync(SETS_DIR)) {
    if (!f.endsWith(".json") || f === "latest.json") continue;
    const s = JSON.parse(readFileSync(`${SETS_DIR}/${f}`, "utf8")) as SourceSet;
    existingByHash.set(`${s.kind}:${s.key}:${s.sha256}`, s);
  }

  // Scan all institution catalogs in archives/<institution>/index.json
  const instDirs = readdirSync(`${ROOT}archives`, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "sets" && existsSync(`${ROOT}archives/${d.name}/index.json`))
    .map((d) => d.name)
    .sort();

  const bookSources = new Map<string, Record<string, string[]>>();
  for (const b of CANONICAL_BOOKS) bookSources.set(b.id, {});

  const instSets: { id: string; name: string; sources: Record<string, string[]> }[] = [];

  for (const instId of instDirs) {
    const idx = JSON.parse(readFileSync(`${ROOT}archives/${instId}/index.json`, "utf8")) as {
      institution: { id: string; name: string };
      items: { id: string; targets?: string[] }[];
    };
    const allIds = idx.items.map((x) => x.id).sort();
    instSets.push({ id: instId, name: idx.institution.name, sources: { [instId]: allIds } });

    for (const item of idx.items) {
      for (const bookId of item.targets ?? []) {
        const map = bookSources.get(bookId);
        if (!map) continue;
        (map[instId] ??= []).push(item.id);
      }
    }
  }

  // Sort every institution's IDs inside each book map
  for (const map of bookSources.values()) {
    for (const k of Object.keys(map)) map[k].sort();
  }

  const latest = { books: {} as Record<string, string>, institutions: {} as Record<string, string> };
  let created = 0;
  let reused = 0;

  function ensureSet(
    kind: "book" | "institution",
    key: string,
    meta: { name: string; section?: string; number?: number; language?: string },
    sources: Record<string, string[]>
  ): string {
    // Canonical sorted key order
    const ordered: Record<string, string[]> = {};
    for (const k of Object.keys(sources).sort()) ordered[k] = sources[k];
    const sha256 = hashSources(kind, key, ordered);
    const hit = existingByHash.get(`${kind}:${key}:${sha256}`);
    if (hit) {
      reused++;
      return hit.id;
    }
    const id = ulid();
    const record: SourceSet = {
      id,
      kind,
      key,
      name: meta.name,
      ...(meta.section ? { section: meta.section } : {}),
      ...(meta.number !== undefined ? { number: meta.number } : {}),
      ...(meta.language ? { language: meta.language } : {}),
      sha256,
      sources: ordered,
    };
    writeFileSync(`${SETS_DIR}/${id}.json`, JSON.stringify(record, null, 2) + "\n", "utf8");
    created++;
    return id;
  }

  for (const b of CANONICAL_BOOKS) {
    const id = ensureSet(
      "book",
      b.id,
      { name: b.name, section: b.section, number: b.number, language: b.language },
      bookSources.get(b.id)!
    );
    latest.books[b.id] = id;
  }

  for (const inst of instSets) {
    const id = ensureSet("institution", inst.id, { name: inst.name }, inst.sources);
    latest.institutions[inst.id] = id;
  }

  writeFileSync(`${SETS_DIR}/latest.json`, JSON.stringify(latest, null, 2) + "\n", "utf8");
  console.log(`Source sets: ${created} minted, ${reused} unchanged (${CANONICAL_BOOKS.length} books, ${instSets.length} institutions).`);
}
