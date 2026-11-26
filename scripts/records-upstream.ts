// Facts about whole archives, stated on their own web pages or in papers about them, that the generator adds to every
// transcription record of that archive (scripts/records.ts). Each quote was copied from the page as read on the date given.
// "generalPractice" marks a fact that describes how the project usually works, not this file in particular.
import type { Source } from "./lib/records";

export type UpstreamFact = {
  archives: string[];
  /** Only for files whose path matches this. */
  when?: RegExp;
  people?: { name: string; kind?: "person" | "organisation" | "group"; roles?: string[]; statement?: string; generalPractice?: boolean; source: Source }[];
  made?: { text: string; from?: string | number; to?: string | number; when?: string | number; source: Source }[];
  madeFrom?: { kind: string; description: string; generalPractice?: boolean; source: Source }[];
  practices?: { kind: string; text: string; generalPractice?: boolean; source: Source }[];
  tools?: { text: string; source: Source }[];
  basedOn?: { name: string; url?: string; relation: string; description?: string; source: Source }[];
  rights?: { statement: string; source: Source };
};

const ECM: Omit<Source & { url: string }, "quote"> = {
  url: "https://pure-oai.bham.ac.uk/ws/files/120791797/2020_EarlyChristianity_EditioCriticaMaior.pdf", accessed: "2026-11-26",
  title: "The Editio Critica Maior of the Greek New Testament: twenty years of digital collaboration",
  citation: "H.A.G. Houghton, D.C. Parker, P. Robinson and K. Wachtel, Early Christianity 11 (2020), 97-117, https://doi.org/10.1628/ec-2020-0009",
};
const ecm = (quote: string): Source => ({ ...ECM, quote });
const edata = (id: number, quote: string): Source => ({ url: `https://edata.bham.ac.uk/${id}/`, accessed: "2026-11-26", title: "University of Birmingham eData Repository", quote });
const CNTR_TECH = (quote: string): Source => ({ url: "https://greekcntr.org/resources/technical.pdf", accessed: "2026-11-26", title: "CNTR Technical Reference", citation: "Alan Bunning, CNTR Technical Reference, August 24, 2026", quote });
const CNTR_README = (quote: string): Source => ({ url: "https://github.com/Center-for-New-Testament-Restoration/transcriptions/blob/4e743a41a4b2ca010ece53229cd272aa59b1efe6/README.md", accessed: "2026-11-02", quote });
const DSS_OTYPE = (quote: string): Source => ({ url: "https://github.com/ETCBC/dss/blob/0b7774a72b6d0e91712aa2156d2a1d354f1f5e6d/tf/2.0.5/otype.tf", accessed: "2026-11-22", quote });
const SP_README = (quote: string): Source => ({ url: "https://github.com/DT-UCPH/sp/blob/e8a120f2e92b6558fd39bbe72f830ded871a0a47/README.md", accessed: "2026-11-13", quote });
const ALEPPO_README = (quote: string): Source => ({ url: "https://github.com/MartijnNaaijer/aleppo/blob/db38ddc918fd5d6e47a118f24545bd925975a597/README.md", accessed: "2026-11-26", quote });
const NTVMR_LICENSE = (quote: string): Source => ({ url: "https://ntvmr.uni-muenster.de/community/license", accessed: "2026-11-26", quote });

const IGNTP_PRACTICE = [
  { kind: "independent-double-transcription", generalPractice: true, text: "Two independent initial transcriptions are made of each manuscript.", source: ecm("Both organizations observe the same practice of producing two independent initial transcriptions") },
  { kind: "reconciliation", generalPractice: true, text: "A third person, usually the transcription coordinator, reconciles the two with reference to the images of the manuscript and makes the final file.", source: ecm("these are reconciled by a third person (usually the transcription coordinator) with reference to the images of the manuscript, who creates a final file") },
];

export const UPSTREAM: UpstreamFact[] = [
  {
    archives: ["intf"],
    people: [{ name: "Trained undergraduate students in Münster", kind: "group", roles: ["trc"], generalPractice: true, statement: "The initial transcriptions are made by trained undergraduate students in Münster", source: ecm("The initial transcriptions are made by trained undergraduate students in Münster") }],
    practices: IGNTP_PRACTICE,
    rights: { statement: "Contributions are jointly owned by the Institut für neutestamentliche Textforschung and made available freely under the terms of the Creative Commons CC-BY license.", source: NTVMR_LICENSE("any contribution you make is jointly owned by The Institut für neutestamentliche Textforschung and understand it will be made available freely under the terms of the Creative Commons, CC-BY license.") },
  },
  {
    archives: ["igntp-john", "igntp-romans", "igntp-galatians", "igntp-ephesians", "igntp-2thessalonians", "family-pi-mark", "itsee-ga655", "zacynthius"],
    people: [{ name: "IGNTP contributors, including volunteers and postdoctoral scholars", kind: "group", roles: ["trc"], generalPractice: true, statement: "the IGNTP draws on a broader range of contributors, also including volunteers and postdoctoral scholars", source: ecm("the IGNTP draws on a broader range of contributors, also including volunteers and postdoctoral scholars") }],
    practices: IGNTP_PRACTICE,
  },
  { archives: ["igntp-romans"], made: [{ text: "Collection period: 1 June 2018 to 30 September 2023", from: "2018-06-01", to: "2023-09-30", source: edata(1111, "From To 1 June 2018 30 September 2023") }], tools: [{ text: "These transcriptions were all made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.", source: edata(1111, "These transcriptions were all made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.") }] },
  { archives: ["igntp-galatians"], made: [{ text: "Collection period: 1 September 2012 to 31 August 2020", from: "2012-09-01", to: "2020-08-31", source: edata(1107, "From To 1 September 2012 31 August 2020") }], tools: [{ text: "Most transcriptions were made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.", source: edata(1107, "Most transcriptions were made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.") }] },
  { archives: ["igntp-ephesians"], made: [{ text: "Collection period: 1 September 2017 to 31 August 2022", from: "2017-09-01", to: "2022-08-31", source: edata(1109, "From To 1 September 2017 31 August 2022") }], tools: [{ text: "These transcriptions were all made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.", source: edata(1109, "These transcriptions were all made in the Online Transcription Editor developed as part of the Workspace for Collaborative Editing.") }] },
  { archives: ["igntp-2thessalonians"], made: [{ text: "Collection period: 2013 to 2019", from: 2013, to: 2019, source: edata(510, "From To 2013 2019") }], tools: [{ text: "Transcriptions and Collations using the Workspace for Collaborative Editing (ITSEE, University of Birmingham)", source: edata(510, "Transcriptions and Collations using the Workspace for Collaborative Editing (ITSEE, University of Birmingham)") }] },
  { archives: ["itsee-ga655"], made: [{ text: "Collection period: October 2021 to February 2023", from: "2021-10", to: "2023-02", source: edata(1367, "From To October 2021 February 2023") }], tools: [{ text: "Data transcribed using the Online Transcription Editor", source: edata(1367, "Data transcribed using the Online Transcription Editor") }] },
  {
    archives: ["igntp-catena"], when: /ephesians/,
    made: [{ text: "Collection period: October 2020 to February 2023", from: "2020-10", to: "2023-02", source: edata(1100, "From To October 2020 February 2023") }],
    madeFrom: [{ kind: "images", description: "Data transcribed into Excel spreadsheets from digital images of manuscripts.", source: edata(1100, "Data transcribed into Excel spreadsheets from digital images of manuscripts.") }],
    tools: [{ text: "Data transcribed into Excel spreadsheets from digital images of manuscripts. Data converted by scripts into XML and HTML for online publication", source: edata(1100, "Data transcribed into Excel spreadsheets from digital images of manuscripts. Data processing and preparation activities: Data converted by scripts into XML and HTML for online publication") }],
  },
  { archives: ["igntp-catena"], when: /romans/, made: [{ text: "Collection period: 2019 to 2023", from: 2019, to: 2023, source: edata(1097, "From To 2019 2023") }] },
  {
    archives: ["cntr"],
    people: [{ name: "Alan Bunning", roles: ["cre"], statement: "Copyright © 2020-2026 by Alan Bunning.", source: CNTR_README("Copyright © 2020-2026 by Alan Bunning.") }],
    made: [{ text: "These electronic transcriptions have taken over a decade to create", source: CNTR_TECH("These electronic transcriptions have taken over a decade to create") }],
    practices: [
      { kind: "compared-with-other-transcriptions", generalPractice: true, text: "The transcriptions were compared with other transcriptions when possible.", source: CNTR_TECH("have been compared with other transcriptions when possible for improved accuracy.") },
      { kind: "checked-against-images", generalPractice: true, text: "Differences from other sources were resolved by examining images or publications of the manuscripts.", source: CNTR_TECH("Any differences between the CNTR transcriptions and these other sources were resolved by examining images or publications of the original extant manuscripts.") },
    ],
    tools: [{ text: "Generated directly from the CNTR database", source: CNTR_README("These transcriptions are generated directly from the CNTR database") }],
  },
  {
    archives: ["etcbc-dss"],
    people: [
      { name: "Martin G. Abegg, Jr.", roles: ["cre"], source: DSS_OTYPE("@createdBy=Martin G. Abegg, Jr., James E. Bowley, and Edward M. Cook") },
      { name: "James E. Bowley", roles: ["cre"], source: DSS_OTYPE("@createdBy=Martin G. Abegg, Jr., James E. Bowley, and Edward M. Cook") },
      { name: "Edward M. Cook", roles: ["cre"], source: DSS_OTYPE("@createdBy=Martin G. Abegg, Jr., James E. Bowley, and Edward M. Cook") },
      { name: "Jarod Jacobs", roles: ["mrk"], statement: "converted by", source: DSS_OTYPE("@convertedBy=Jarod Jacobs, Martijn Naaijer and Dirk Roorda") },
      { name: "Martijn Naaijer", roles: ["mrk"], statement: "converted by", source: DSS_OTYPE("@convertedBy=Jarod Jacobs, Martijn Naaijer and Dirk Roorda") },
      { name: "Dirk Roorda", roles: ["mrk"], statement: "converted by", source: DSS_OTYPE("@convertedBy=Jarod Jacobs, Martijn Naaijer and Dirk Roorda") },
    ],
    made: [{ text: "2015", when: 2015, source: DSS_OTYPE("@createdDate=2015") }],
    basedOn: [{ name: "Martin Abegg's data files", relation: "derived-from", description: "Martin Abegg's data files, personal communication", source: DSS_OTYPE("@source=Martin Abegg's data files, personal communication") }],
  },
  {
    archives: ["aleppo"],
    basedOn: [{ name: "מקרא על פי המסורה (Miqra according to the Masorah), on Hebrew Wikisource", url: "https://he.wikisource.org/", relation: "derived-from", description: "A Text-Fabric dataset of the Hebrew Bible according to the Aleppo Codex, in the edition מקרא על פי המסורה on Hebrew Wikisource", source: ALEPPO_README("A Text-Fabric dataset of the Hebrew Bible according to the Aleppo Codex, in the edition מקרא על פי המסורה on Hebrew Wikisource") }],
  },
  {
    archives: ["dt-ucph-sp"],
    people: [{ name: "Samaritanus project, Martin-Luther-Universität Halle-Wittenberg", kind: "organisation", roles: ["cre"], statement: "directed by Stefan Schorch", source: SP_README("The text was provided by the Samaritanus-project based at Martin-Luther-Universität Halle-Wittenberg, directed by Stefan Schorch") }],
    madeFrom: [{ kind: "other", description: "based on a transcription MS Dublin Chester Beatty Library 751 (Gen 1-Deut 32:36) + MS Garizim 1 (Deut 32:36b-34)", source: SP_README("is based on a transcription MS Dublin Chester Beatty Library 751 (Gen 1-Deut 32:36) + MS Garizim 1 (Deut 32:36b-34)") }],
  },
  {
    archives: ["tal-florentin-sp"],
    basedOn: [{ name: "Moshe Florentin and Abraham Tal, The Samaritan Pentateuch (Open Book Publishers, 2024)", url: "https://doi.org/10.11647/OBP.0415", relation: "derived-from", source: SP_README("From version 7.5.0, the dataset contains the readings of Moshe Florentin and Abraham Tal, The Samaritan Pentateuch") }],
  },
];

/** Local copies of the pages above, used to check each quote when the generator runs (when present). */
export const COPIES: Record<string, string> = {
  [ECM.url]: "/workspace/transcription-research/web2/ecm.txt",
  "https://greekcntr.org/resources/technical.pdf": "/workspace/transcription-research/web/cntr_tech.txt",
  "https://ntvmr.uni-muenster.de/community/license": "/workspace/transcription-research/web/ntvmr_license.html",
  "https://github.com/MartijnNaaijer/aleppo/blob/db38ddc918fd5d6e47a118f24545bd925975a597/README.md": "/workspace/transcription-research/web/aleppo_readme.html",
  "https://github.com/Center-for-New-Testament-Restoration/transcriptions/blob/4e743a41a4b2ca010ece53229cd272aa59b1efe6/README.md": "/workspace/evidence/sources/cntr-01/2026-10-01/README.md",
  "https://github.com/ETCBC/dss/blob/0b7774a72b6d0e91712aa2156d2a1d354f1f5e6d/tf/2.0.5/otype.tf": "/workspace/evidence/sources/dss/2026-11-10/tf/2.0.5/otype.tf",
  "https://github.com/DT-UCPH/sp/blob/e8a120f2e92b6558fd39bbe72f830ded871a0a47/README.md": "/workspace/evidence/sources/sp/2026-11-13/README.md",
  ...Object.fromEntries([1111, 1107, 1109, 510, 1367, 1100, 1097].map((n) => [`https://edata.bham.ac.uk/${n}/`, `/workspace/transcription-research/web/edata${n}.html`])),
};
