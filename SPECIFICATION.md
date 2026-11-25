# Specification of the compiled transcriptions

This is the only specification in this repository. It says which files to read, how to turn them into one compiled
transcription of each book, and how the output must record what made it. Nothing else instructs the work.

## Who does the work

Whatever model or program carries out this specification must identify itself in the output it writes: its exact name and
version (for a model, its exact model version; for a program, the program, its repository and the exact commit of its code,
and the runtime that ran it). It records only what it can itself report when it runs, and assumes nothing. Each output
also records that it was produced under this specification, with the SHA-256 hash of this file at the time.

## How the work is done

1. Read this file from top to bottom. Read nothing that is not an input under rule 1.
2. For each book in the book list, carry out rules 1 to 15 below exactly as written, in order, with every tie broken as
   stated, so the same inputs always give the same output. Nothing is random. The program in this repository does this with
   `bun run compile all` (or `bun run compile <book>`, for example `bun run compile Gen`).
3. Save the output of each book in `compilations/<section>-<number>-<book>/` (for example `compilations/ot-01-gen/`):
   `transcription.json`, `transcription.md`, `disagreements.json` and `stats.json`. `stats.json` holds the hash of the
   output, the hash of this file, and the self-identification of whatever did the work.
4. Run `bun run check`. It reads the output and takes about a second. If it fails, report what failed and change nothing by hand.

## Sections

| Section | Name | Language | Folders | Origin year | Half-life | Late after | Undated year |
|---|---|---|---|---|---|---|---|
| ot | Old Testament (Hebrew and Aramaic) | Hebrew and Aramaic | transcriptions/hebrew, transcriptions/greek-translation | -400 | 100 | 400 | 1500 |
| nt | New Testament (Greek) | Greek | transcriptions/greek | 100 | 100 | 400 | 1500 |

The origin year is the year taken for the original; a negative year is BC. Half-life, late after and undated year are used
by rule 3.

## Rules

1. **Inputs.** A book's inputs are the transcriptions listed in `transcriptions/manuscripts.json` whose file lies in one of
   its section's folders and holds at least one line of the book, taken folder by folder in the order of the Sections table,
   and by file path within a folder. These are ancient manuscripts in the language the book was written in:
   - Old Testament: the Leningrad Codex, the Samaritan Pentateuch manuscripts and the Dead Sea Scrolls, in Hebrew and
     Aramaic. The Leningrad Codex is read as written in its lines (the ketiv), not as its margin says to read (the qere); its
     accent marks are not read, and its vowel points are kept for display. Manuscripts of the Greek translation are inputs
     too, but are read only as rule 15 says.
   - New Testament: Greek continuous-text manuscripts, lectionaries (the book read in lessons) and the biblical text of
     catena manuscripts (the book cut into pieces between comments).
   No printed edition, translation (except as rule 15 says), quotation by a later writer or image is read. Each
   transcription gives the first hand of its manuscript; a word the transcriber marks as damaged, supplied or unread counts
   as lost.
2. **One manuscript, one voice.** Several transcriptions of one manuscript are one manuscript. Leaves of one manuscript that
   carry separate numbers are one manuscript (P64 with P67, P77 with P103).
3. **Proximity.** A manuscript copied nearer in time to the original counts more. Its proximity is
   T = min(1, 2^(-(year - origin year) / half-life)): every half-life after the origin year halves it. The year is the one
   given in `transcriptions/manuscripts.json` with its source: for the New Testament, the middle of the date range in the
   INTF catalogue; for the Old Testament, the date its holder or catalogue states (Leningrad Codex 1008, from its colophon;
   Chester Beatty Library MS 751 1225; the Dead Sea Scrolls 100 BC, the middle of the span stated for them, since no date for
   each scroll is held; Codex Sinaiticus 350; Codex Coislinianus 1 650). An undated manuscript is taken as written in the
   undated year. A manuscript written more than "late after" years after the origin year is a late copy; the others are early.
4. **Which transcription.** Where several transcriptions of one manuscript hold a line, the one with the most words in that
   line is read; a tie goes to the one that comes first in the order of rule 1.
5. **Alignment.** For each line, the manuscripts' words are lined up into columns, oldest manuscript first (then by name).
   Spellings that copyists used for the same word count as one word:
   - Greek: ει written for ι, doubled letters, a movable ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings
     are not compared (the manuscripts have none). Sacred names written short are written out, and so are numbers written
     as letters.
   - Hebrew and Aramaic: only the consonants are compared. Final letter forms count as the plain letters, and a ו or י
     inside a word (not its first or last letter), which copyists added or left out to mark a vowel, is not compared. Vowel
     points and accents are not compared (most of the manuscripts have none).
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
   copying slip and has no vote, unless two or more early manuscripts share it.
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
14. **Aramaic.** These parts of the Old Testament were written in Aramaic and are compiled by the same rules, with each of their
    words marked as Aramaic: Daniel 2:4 after the word ארמית ("in Aramaic") to 7:28; Ezra 4:8 to 6:18 and 7:12 to 7:26;
    Jeremiah 10:11; and the two words יגר שהדותא in Genesis 31:47.
15. **The Greek translation, only where the original is missing.** The lines of an Old Testament book are the lines its Hebrew
    and Aramaic manuscripts have. A line where no Hebrew or Aramaic manuscript has any word is taken from the Greek
    manuscripts among its inputs, compiled among themselves by rules 1 to 13 with the Greek spellings of rule 5 and weighted by
    proximity in the same way, and every word of it is marked as from a translation. Greek is never compared or mixed with
    Hebrew or Aramaic in one line. The Greek lines are filed under the Hebrew line numbers they stand for (2 Kingdoms is
    2 Samuel; 2 Esdras 1 to 10 is Ezra, 11 to 23 is Nehemiah); books where the Greek numbers or orders the lines differently
    (Psalms, Proverbs, Jeremiah, Joel, Malachi, Esther) have no Greek inputs.

## Citations

Every printed word lists the manuscripts that read it. Each manuscript links to its transcription file in this repository,
to the holder's file it came from, and to the holder's page images where a viewer exists (`transcriptions/manuscripts.json`).

## Books

| Section | Number | Book | Name |
|---|---|---|---|
| ot | 1 | Gen | Genesis |
| ot | 2 | Exod | Exodus |
| ot | 3 | Lev | Leviticus |
| ot | 4 | Num | Numbers |
| ot | 5 | Deut | Deuteronomy |
| ot | 6 | Josh | Joshua |
| ot | 7 | Judg | Judges |
| ot | 8 | 1Sam | 1 Samuel |
| ot | 9 | 2Sam | 2 Samuel |
| ot | 10 | 1Kgs | 1 Kings |
| ot | 11 | 2Kgs | 2 Kings |
| ot | 12 | Isa | Isaiah |
| ot | 13 | Jer | Jeremiah |
| ot | 14 | Ezek | Ezekiel |
| ot | 15 | Hos | Hosea |
| ot | 16 | Joel | Joel |
| ot | 17 | Amos | Amos |
| ot | 18 | Obad | Obadiah |
| ot | 19 | Jonah | Jonah |
| ot | 20 | Mic | Micah |
| ot | 21 | Nah | Nahum |
| ot | 22 | Hab | Habakkuk |
| ot | 23 | Zeph | Zephaniah |
| ot | 24 | Hag | Haggai |
| ot | 25 | Zech | Zechariah |
| ot | 26 | Mal | Malachi |
| ot | 27 | 1Chr | 1 Chronicles |
| ot | 28 | 2Chr | 2 Chronicles |
| ot | 29 | Ps | Psalms |
| ot | 30 | Job | Job |
| ot | 31 | Prov | Proverbs |
| ot | 32 | Ruth | Ruth |
| ot | 33 | Song | Song of Songs |
| ot | 34 | Eccl | Ecclesiastes |
| ot | 35 | Lam | Lamentations |
| ot | 36 | Esth | Esther |
| ot | 37 | Dan | Daniel |
| ot | 38 | Ezra | Ezra |
| ot | 39 | Neh | Nehemiah |
| nt | 1 | Matt | Matthew |
| nt | 2 | Mark | Mark |
| nt | 3 | Luke | Luke |
| nt | 4 | John | John |
| nt | 5 | Acts | Acts |
| nt | 6 | Rom | Romans |
| nt | 7 | 1Cor | 1 Corinthians |
| nt | 8 | 2Cor | 2 Corinthians |
| nt | 9 | Gal | Galatians |
| nt | 10 | Eph | Ephesians |
| nt | 11 | Phil | Philippians |
| nt | 12 | Col | Colossians |
| nt | 13 | 1Thess | 1 Thessalonians |
| nt | 14 | 2Thess | 2 Thessalonians |
| nt | 15 | 1Tim | 1 Timothy |
| nt | 16 | 2Tim | 2 Timothy |
| nt | 17 | Titus | Titus |
| nt | 18 | Phlm | Philemon |
| nt | 19 | Heb | Hebrews |
| nt | 20 | Jas | James |
| nt | 21 | 1Pet | 1 Peter |
| nt | 22 | 2Pet | 2 Peter |
| nt | 23 | 1John | 1 John |
| nt | 24 | 2John | 2 John |
| nt | 25 | 3John | 3 John |
| nt | 26 | Jude | Jude |
| nt | 27 | Rev | Revelation |
