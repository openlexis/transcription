# Ezekiel: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** Ezekiel
- **Book:** Ezek
- **Model:** Grok Bot
- **Language:** Hebrew and Aramaic
- **Origin year:** -400
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/ot-14-ezek`. It carries out rules 1 to 15 below exactly as written, in that
   order, with every tie broken as stated, so the same inputs always give the same output. Nothing in it is random.
3. Run `bun run check` (it reads the output only and takes about a second). If it fails, report what failed and change nothing by hand.
4. Save the output in this folder: `transcription.json`, `transcription.md`, `disagreements.json` and `stats.json`.
   `stats.json` holds the hash of the output, so a second run can be compared with the first.

## Rules

1. **Inputs.** Read only the transcriptions listed under Inputs: ancient manuscripts in Hebrew and Aramaic, the languages the book was written in: the Leningrad Codex, the
   Samaritan Pentateuch manuscripts and the Dead Sea Scrolls. The Leningrad Codex is read as written in its lines (the ketiv),
   not as its margin says to read (the qere); its accent marks are not read, its vowel points are kept for display.
   Manuscripts of the Greek translation are listed too, but are read only as rule 15 says.
   No printed edition, translation, quotation by a later writer or image is read. Each transcription gives the first hand of
   its manuscript; a word the transcriber marks as damaged, supplied or unread counts as lost.
2. **One manuscript, one voice.** Several transcriptions of one manuscript are one manuscript.
3. **Proximity.** A manuscript copied nearer in time to the original counts more. Its proximity is
   T = min(1, 2^(-(year - origin year) / half-life)): every 100 years after the year 400 BC halve it. The year is
   the date its holder or catalogue states (Leningrad Codex: 1008, from its colophon; Chester Beatty Library MS 751: 1225;
   the Dead Sea Scrolls: 100 BC, the middle of the span stated for them, since no date for each scroll is held; Greek translation:
   Codex Sinaiticus 350, Codex Coislinianus 1 650); an undated manuscript is taken as written in 1500. A manuscript written more than
   400 years after the origin year (after 0) is a late copy.
4. **Which transcription.** Where several transcriptions of one manuscript hold a line, the one with the most words in that
   line is read; a tie goes to the one listed first under Inputs for that manuscript (the holder order: UXLC, the Samaritan Pentateuch data, the Dead Sea Scrolls data, Codex Sinaiticus Project, INTF).
5. **Alignment.** For each line, the manuscripts' words are lined up into columns, oldest manuscript first (then by
   name). Only the consonants are compared. Final letter forms count as the plain letters, and a ו or י inside a word
   (not its first or last letter), which copyists added or left out to mark a vowel, is not compared. Vowel points
   and accents are not compared (most of the manuscripts have none). Lines taken from the Greek translation (rule 15) are
   compared as Greek: ει written for ι, doubled letters and a movable ν count as one spelling.
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
   copying slip and has no vote, unless two or more early manuscripts (up to 0) share it.
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
14. **Aramaic.** These parts were written in Aramaic and are compiled by the same rules, with each of their words marked as
    Aramaic: Daniel 2:4 after the word ארמית ("in Aramaic") to 7:28; Ezra 4:8 to 6:18 and 7:12 to 7:26; Jeremiah 10:11;
    and the two words יגר שהדותא in Genesis 31:47.
15. **The Greek translation, only where the original is missing.** The lines of the book are the lines the Hebrew and Aramaic
    manuscripts have. A line where no Hebrew or Aramaic manuscript has any word is taken from the Greek manuscripts listed
    under Inputs, compiled among themselves by rules 1 to 13 and weighted by proximity in the same way, and every word of it
    is marked as from a translation. Greek is never compared or mixed with Hebrew or Aramaic in one line. The Greek lines are
    filed under the Hebrew line numbers they stand for (2 Kingdoms is 2 Samuel; 2 Esdras 1 to 10 is Ezra, 11 to 23 is
    Nehemiah); books where the Greek numbers or orders the lines differently (Psalms, Proverbs, Jeremiah, Joel, Malachi,
    Esther) have no Greek inputs.

## Citations

Every printed word lists the manuscripts that read it. Each manuscript links to its transcription file in this repository,
to the holder's file it came from, and to the holder's page images where a viewer exists (`transcriptions/manuscripts.json`).

## Inputs

8 manuscripts, 8 transcriptions:

- `transcriptions/hebrew/11Q4.etcbc-dss.txt`
- `transcriptions/hebrew/1Q9.etcbc-dss.txt`
- `transcriptions/hebrew/3Q1.etcbc-dss.txt`
- `transcriptions/hebrew/4Q73.etcbc-dss.txt`
- `transcriptions/hebrew/4Q74.etcbc-dss.txt`
- `transcriptions/hebrew/4Q75.etcbc-dss.txt`
- `transcriptions/hebrew/L.uxlc.txt`
- `transcriptions/hebrew/Mas1d.etcbc-dss.txt`
