// Letters and keys. Every rule here is named in the RULES.md of each compilation.

/** Greek letters only: no accents or breathings, lower case, every sigma written σ. */
export const skel = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[ςϲ]/g, "σ").replace(/[^α-ωϛϟ]/g, "");

/** The spelling key: spellings that copyists used for the same word fold together (ει for ι, doubled letters, movable nu,
 * and the final sigma of ουτως, αχρις, μεχρις). Two words with one key are one reading. */
export const greekKey = (w: string) => {
  let x = w.replace(/ει/g, "ι").replace(/(.)\1/g, "$1");
  if (x.length > 3 && /[ει]ν$/.test(x)) x = x.slice(0, -1);
  return x.replace(/^(ουτω|αχρι|μεχρι)σ$/, "$1");
};
/** Hebrew key: the consonants only. */
export const hebrewKey = (w: string) => w.replace(/[^\u05D0-\u05EA]/g, "");
/** The form shown on the site: final sigma restored. */
export const showGreek = (w: string) => w.replace(/σ$/, "ς");

/** Sacred names written short in the manuscripts, written out. */
const NOMINA: Record<string, string> = { ισ: "ιησουσ", ιυ: "ιησου", ιν: "ιησουν", χσ: "χριστοσ", χυ: "χριστου", χν: "χριστον", χε: "χριστε", χω: "χριστω", θσ: "θεοσ", θυ: "θεου", θν: "θεον", θε: "θεε", θω: "θεω", κσ: "κυριοσ", κυ: "κυριου", κν: "κυριον", κε: "κυριε", κω: "κυριω", υσ: "υιοσ", υυ: "υιου", υν: "υιον", υω: "υιω", υε: "υιε", υι: "υιοι", υων: "υιων", υισ: "υιοισ", πηρ: "πατηρ", πρσ: "πατροσ", πρι: "πατρι", πρα: "πατερα", πρεσ: "πατερεσ", πρων: "πατερων", πρασ: "πατερασ", πρασιν: "πατρασιν", μηρ: "μητηρ", μρσ: "μητροσ", μρι: "μητρι", μρα: "μητερα", σηρ: "σωτηρ", σρσ: "σταυροσ", σρν: "σταυρον", σρυ: "σταυρου", σρω: "σταυρω", δαδ: "δαυειδ", ιηλμ: "ιερουσαλημ", ιλημ: "ιερουσαλημ", ισηλ: "ισραηλ", ιηλ: "ισραηλ", ισλ: "ισραηλ" };
const NOMINA_MORE: Record<string, string> = { πνα: "πνευμα", πνασι: "πνευμασι", πνασιν: "πνευμασιν", πντα: "πνευματα", πντι: "πνευματι", πνοσ: "πνευματοσ", πνσι: "πνευμασι", ιησ: "ιησουσ", ιηυ: "ιησου", ιην: "ιησουν", ιησυ: "ιησου", χρσ: "χριστοσ", χρυ: "χριστου", χρν: "χριστον", περ: "πατερ", πρ: "πατερ", στρου: "σταυρου", στρυ: "σταυρου", στρν: "σταυρον", στρω: "σταυρω", σρου: "σταυρου", υιυ: "υιου", υιν: "υιον", ουρου: "ουρανου", ουρον: "ουρανον", χρω: "χριστω", χρε: "χριστε", ιηι: "ιησου", ιη: "ιησου", ανε: "ανθρωπε", ουνω: "ουρανω", ουνου: "ουρανου", ουνοισ: "ουρανοισ", ουνον: "ουρανον", πνι: "πνευματι", πνσ: "πνευματοσ", πνατα: "πνευματα", στσ: "σταυροσ", στν: "σταυρον", στυ: "σταυρου", στω: "σταυρω" };
export function sacred(s: string): string {
  if (NOMINA_MORE[s]) return NOMINA_MORE[s];
  if (NOMINA[s]) return NOMINA[s];
  let m;
  if ((m = s.match(/^πν(ικ|ατ|α|ι|σ|ων|ασι)(.*)$/))) return "πνευματ" + ({ ικ: "ικ", ατ: "", α: "", ι: "ι", σ: "οσ", ων: "ων", ασι: "ασι" } as Record<string, string>)[m[1]] + m[2];
  if ((m = s.match(/^ανο(.*)$/))) return "ανθρωπο" + m[1];
  if ((m = s.match(/^αν([ωε].*)$/))) return "ανθρωπ" + m[1];
  if ((m = s.match(/^ουν(.*)$/))) return "ουραν" + m[1];
  return s;
}

/** Numbers written as letters, written out as words. */
const NUM: Record<string, number> = { α: 1, β: 2, γ: 3, δ: 4, ε: 5, ϛ: 6, σ: 6, ζ: 7, η: 8, θ: 9, ι: 10, κ: 20, λ: 30, μ: 40, ν: 50, ξ: 60, ο: 70, π: 80, ϟ: 90, ρ: 100, τ: 300, υ: 400, φ: 500, χ: 600, ψ: 700, ω: 800 };
const UNITS = ["", "εισ", "δυο", "τρεισ", "τεσσαρεσ", "πεντε", "εξ", "επτα", "οκτω", "εννεα"];
const TENS = ["", "δεκα", "εικοσι", "τριακοντα", "τεσσερακοντα", "πεντηκοντα", "εξηκοντα", "εβδομηκοντα", "ογδοηκοντα", "ενενηκοντα"];
const HUNDREDS = ["", "εκατον", "διακοσιοι", "τριακοσιοι", "τετρακοσιοι", "πεντακοσιοι", "εξακοσιοι", "επτακοσιοι", "οκτακοσιοι", "ενακοσιοι"];
export function numeral(letters: string): string[] | undefined {
  let n = 0;
  for (const c of letters) { const v = NUM[c]; if (v === undefined) return undefined; n += v; }
  if (!n || n >= 1000) return undefined;
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  if (n === 11) return ["ενδεκα"];
  if (n === 12) return ["δωδεκα"];
  return [HUNDREDS[h], TENS[t], UNITS[u]].filter(Boolean);
}

export const NT_BOOKS = [
  ["Matt", "Matthew"], ["Mark", "Mark"], ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"], ["Rom", "Romans"], ["1Cor", "1 Corinthians"], ["2Cor", "2 Corinthians"],
  ["Gal", "Galatians"], ["Eph", "Ephesians"], ["Phil", "Philippians"], ["Col", "Colossians"], ["1Thess", "1 Thessalonians"], ["2Thess", "2 Thessalonians"], ["1Tim", "1 Timothy"], ["2Tim", "2 Timothy"],
  ["Titus", "Titus"], ["Phlm", "Philemon"], ["Heb", "Hebrews"], ["Jas", "James"], ["1Pet", "1 Peter"], ["2Pet", "2 Peter"], ["1John", "1 John"], ["2John", "2 John"], ["3John", "3 John"], ["Jude", "Jude"], ["Rev", "Revelation"],
].map(([id, name], i) => ({ id, name, n: i + 1 }));
