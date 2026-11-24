// Writes the rule file of each compilation: compilations/<corpus>-<nn>-<book>/RULES.md, for the Greek New Testament (nt),
// the Hebrew Bible (heb) and the Greek Old Testament (lxx). The rules are the same for every book of a corpus; the inputs are
// the transcriptions of that corpus's folder that hold the book. Run it after a new import.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { HEB_BOOKS, LXX_BOOKS, NT_BOOKS } from "../src/text";

const ROOT = new URL("..", import.meta.url).pathname;
const MODEL = "Grok Bot";
const cat = JSON.parse(readFileSync(`${ROOT}transcriptions/manuscripts.json`, "utf8")) as { manuscripts: { siglum: string; transcriptions: { file: string }[] }[] };
const files = cat.manuscripts.flatMap((m) => m.transcriptions.map((t) => t.file));
const has = new Map<string, Set<string>>();
for (const f of files) {
  const corpus = f.split("/")[1];
  const books = new Set(readFileSync(`${ROOT}${f}`, "utf8").split("\n").map((l) => l.split(" ")[0]).filter(Boolean));
  for (const b of books) { const k = `${corpus}/${b}`; (has.get(k) ?? has.set(k, new Set()).get(k)!).add(f); }
}
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

type Corpus = {
  prefix: string; folder: string; language: string; origin: number; books: { id: string; name: string; n: number }[];
  what: string; dates: string; holders: string; spelling: string; extra: string;
};
const CORPORA: Corpus[] = [
  {
    prefix: "nt", folder: "greek", language: "Greek", origin: 100, books: NT_BOOKS,
    what: "ancient manuscripts in Greek, the language the book was written in: continuous-text manuscripts, lectionaries (the book read in lessons) and the biblical text of catena manuscripts (the book cut into pieces between comments)",
    dates: "the middle of the date range in the INTF catalogue",
    holders: "Codex Sinaiticus Project, Codex Zacynthius project, IGNTP and ITSEE files, INTF, CNTR",
    spelling: "Spellings that copyists used for the same word count as one word: ει written for ι, doubled letters, a movable\n   ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings are not compared (the manuscripts have none).\n   Sacred names written short are written out, and so are numbers written as letters.",
    extra: "Leaves of one manuscript that carry separate numbers are one manuscript (P64 with P67,\n   P77 with P103).",
  },
  {
    prefix: "heb", folder: "hebrew", language: "Hebrew", origin: -400, books: HEB_BOOKS.map((b) => ({ id: b.id, name: b.name, n: b.n })),
    what: "ancient manuscripts in Hebrew (and the Aramaic parts written in it): the Leningrad Codex, the Samaritan Pentateuch\n   manuscripts and the Dead Sea Scrolls. The Leningrad Codex is read as written in its lines (the ketiv), not as its margin\n   says to read (the qere); its accent marks are not read, its vowel points are kept for display",
    dates: "the date its holder or catalogue states (Leningrad Codex: 1008, from its colophon; Chester Beatty Library MS 751: 1225;\n   the Dead Sea Scrolls: 100 BC, the middle of the span stated for them, since no date for each scroll is held)",
    holders: "UXLC, the Samaritan Pentateuch data, the Dead Sea Scrolls data",
    spelling: "Only the consonants are compared. Final letter forms count as the plain letters, and a ו or י inside a word\n   (not its first or last letter), which copyists added or left out to mark a vowel, is not compared. Vowel points\n   and accents are not compared (most of the manuscripts have none).",
    extra: "",
  },
  {
    prefix: "lxx", folder: "greek-ot", language: "Greek", origin: -150, books: LXX_BOOKS.map((b) => ({ id: b.id, name: b.name, n: b.i })),
    what: "ancient manuscripts of the Greek translation (Codex Sinaiticus, Codex Coislinianus 1, Rahlfs 46)",
    dates: "the date its holder or catalogue states (Codex Sinaiticus: 350; Codex Coislinianus 1: 650)",
    holders: "Codex Sinaiticus Project, INTF",
    spelling: "Spellings that copyists used for the same word count as one word: ει written for ι, doubled letters, a movable\n   ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings are not compared (the manuscripts have none).\n   Sacred names written short are written out, and so are numbers written as letters.",
    extra: "",
  },
];

const written = new Set<string>();
for (const C of CORPORA) for (const B of C.books) {
  const inputs = [...(has.get(`${C.folder}/${B.id}`) ?? [])].sort(order);
  if (!inputs.length) continue;
  const id = `${C.prefix}-${String(B.n).padStart(2, "0")}-${B.id.toLowerCase()}`;
  written.add(id);
  const dir = `${ROOT}compilations/${id}`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ms = new Set(inputs.map((f) => f.replace(/^.*\//, "").replace(/\.[^.]+\.txt$/, "")));
  const late = C.origin + 400, era = (y: number) => (y < 0 ? `${-y} BC` : `${y}`);
  writeFileSync(`${dir}/RULES.md`, `# ${B.name}: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** ${B.name}
- **Book:** ${B.id}
- **Model:** ${MODEL}
- **Language:** ${C.language}
- **Origin year:** ${C.origin}
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run \`bun run compile compilations/${id}\`. It carries out rules 1 to 13 below exactly as written, in that
   order, with every tie broken as stated, so the same inputs always give the same output. Nothing in it is random.
3. Run \`bun run check\` (it reads the output only and takes about a second). If it fails, report what failed and change nothing by hand.
4. Save the output in this folder: \`transcription.json\`, \`transcription.md\`, \`disagreements.json\` and \`stats.json\`.
   \`stats.json\` holds the hash of the output, so a second run can be compared with the first.

## Rules

1. **Inputs.** Read only the transcriptions listed under Inputs: ${C.what}.
   No printed edition, translation, quotation by a later writer or image is read. Each transcription gives the first hand of
   its manuscript; a word the transcriber marks as damaged, supplied or unread counts as lost.
2. **One manuscript, one voice.** ${C.extra ? C.extra + " " : ""}Several transcriptions of one manuscript are one manuscript.
3. **Proximity.** A manuscript copied nearer in time to the original counts more. Its proximity is
   T = min(1, 2^(-(year - origin year) / half-life)): every 100 years after the year ${era(C.origin)} halve it. The year is
   ${C.dates}; an undated manuscript is taken as written in 1500. A manuscript written more than
   400 years after the origin year (after ${era(late)}) is a late copy.
4. **Which transcription.** Where several transcriptions of one manuscript hold a line, the one with the most words in that
   line is read; a tie goes to the one listed first under Inputs for that manuscript (the holder order: ${C.holders}).
5. **Alignment.** For each line, the manuscripts' words are lined up into columns, oldest manuscript first (then by
   name). ${C.spelling}
6. **Places.** A column where the manuscripts that cover it do not all read the same is a variant. Neighbouring variant
   columns are one place. Two places at most two columns apart that share a word (a word moved) are one place, with the
   columns between them. A manuscript that has a line covers every column of it; where it has no word in a column and no
   lacuna, it reads that the word is absent. A manuscript with a lacuna in a place votes there only where the words it keeps
   agree with exactly one complete reading, and then for that reading.
7. **Readings.** At each place, each manuscript reads its whole run of words across the place. The compiled transcription
   always prints, at a place, a reading that some manuscript has whole.
8. **Singular readings.** A reading found in one manuscript alone, where another reading has two or more, has no vote. It is
   still listed with its manuscript.
9. **Eye-skips.** A shorter reading that equals a longer one with one run of words left out, where the copyist's eye could
   have jumped between like words (the same word, or the same last three letters, at the start or end of the run), is a
   copying slip and has no vote, unless two or more early manuscripts (up to ${era(late)}) share it.
10. **Votes.** Each voting manuscript's vote is its proximity divided by the greatest proximity among the voting manuscripts
    at that place. Early manuscripts that share a reading add their votes. Late copies that share a reading vote as one witness
    of the copy they share: the strongest counts in full, the next a half, the next a quarter, and so on.
11. **Choice.** The reading with the highest score is printed. A tie goes to the reading with the earliest manuscript, then the
    one with the most manuscripts, then the words in alphabetical order. Its confidence is its score divided by the sum of all
    scores at the place. A word that every covering manuscript reads alike has confidence 1.
12. **Labels.** Each place gets a type, comparing the printed reading with the next strongest: omission, addition, word order,
    substitution, or mixed (lost text where no complete reading is left). Its weight is the next strongest reading's share of the
    votes. Its severity is high where the confidence is under 0.6, medium where the weight is at least 0.1, low where it is at
    least 0.01, and settled below that. Each printed form is spelled as in the oldest manuscript that reads it (then by name).
    A line that no manuscript covers is listed as not covered and is not filled from any other source.
13. **Pieces of a line.** A lectionary, a catena or a scroll may give only part of a line (a lesson can start or stop
    inside it; a catena quotes a piece before each comment; a scroll is mostly fragments). Such a manuscript never reads that a
    word is absent: a word it does not have counts as lost, and rule 6 decides whether it votes.

## Citations

Every printed word lists the manuscripts that read it. Each manuscript links to its transcription file in this repository,
to the holder's file it came from, and to the holder's page images where a viewer exists (\`transcriptions/manuscripts.json\`).

## Inputs

${ms.size} manuscripts, ${inputs.length} transcriptions:

${inputs.map((f) => `- \`${f}\``).join("\n")}
`);
  console.log(`${id}: ${ms.size} manuscripts, ${inputs.length} transcriptions`);
}
for (const d of readdirSync(`${ROOT}compilations`)) if (!written.has(d)) { rmSync(`${ROOT}compilations/${d}`, { recursive: true }); console.log(`removed ${d}`); }
