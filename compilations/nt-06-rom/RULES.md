# Romans: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** Romans
- **Book:** Rom
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-06-rom`. It carries out rules 1 to 13 below exactly as written, in that
   order, with every tie broken as stated, so the same inputs always give the same output. Nothing in it is random.
3. Run `bun run check` (it reads the output only and takes about a second). If it fails, report what failed and change nothing by hand.
4. Save the output in this folder: `transcription.json`, `transcription.md`, `disagreements.json` and `stats.json`.
   `stats.json` holds the hash of the output, so a second run can be compared with the first.

## Rules

1. **Inputs.** Read only the transcriptions listed under Inputs: ancient manuscripts in Greek, the language the book was written in: continuous-text manuscripts, lectionaries (the book read in lessons) and the biblical text of catena manuscripts (the book cut into pieces between comments).
   No printed edition, translation, quotation by a later writer or image is read. Each transcription gives the first hand of
   its manuscript; a word the transcriber marks as damaged, supplied or unread counts as lost.
2. **One manuscript, one voice.** Leaves of one manuscript that carry separate numbers are one manuscript (P64 with P67,
   P77 with P103). Several transcriptions of one manuscript are one manuscript.
3. **Proximity.** A manuscript copied nearer in time to the original counts more. Its proximity is
   T = min(1, 2^(-(year - origin year) / half-life)): every 100 years after the year 100 halve it. The year is
   the middle of the date range in the INTF catalogue; an undated manuscript is taken as written in 1500. A manuscript written more than
   400 years after the origin year (after 500) is a late copy.
4. **Which transcription.** Where several transcriptions of one manuscript hold a line, the one with the most words in that
   line is read; a tie goes to the one listed first under Inputs for that manuscript (the holder order: Codex Sinaiticus Project, Codex Zacynthius project, IGNTP and ITSEE files, INTF, CNTR).
5. **Alignment.** For each line, the manuscripts' words are lined up into columns, oldest manuscript first (then by
   name). Spellings that copyists used for the same word count as one word: ει written for ι, doubled letters, a movable
   ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings are not compared (the manuscripts have none).
   Sacred names written short are written out, and so are numbers written as letters.
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
   copying slip and has no vote, unless two or more early manuscripts (up to 500) share it.
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
to the holder's file it came from, and to the holder's page images where a viewer exists (`transcriptions/manuscripts.json`).

## Inputs

167 manuscripts, 207 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.igntp-romans.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/010.igntp-romans.txt`
- `transcriptions/greek/012.igntp-romans.txt`
- `transcriptions/greek/0150.igntp-romans.txt`
- `transcriptions/greek/0172.igntp-romans.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.igntp-romans.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/020.igntp-romans.txt`
- `transcriptions/greek/0209.igntp-romans.txt`
- `transcriptions/greek/0209.intf.txt`
- `transcriptions/greek/0219.cntr.txt`
- `transcriptions/greek/0219.igntp-romans.txt`
- `transcriptions/greek/0219.intf.txt`
- `transcriptions/greek/0220.cntr.txt`
- `transcriptions/greek/0220.igntp-romans.txt`
- `transcriptions/greek/0220.intf.txt`
- `transcriptions/greek/0221.cntr.txt`
- `transcriptions/greek/0221.igntp-romans.txt`
- `transcriptions/greek/025.igntp-romans.txt`
- `transcriptions/greek/0278.igntp-romans.txt`
- `transcriptions/greek/0285.igntp-romans.txt`
- `transcriptions/greek/0289.igntp-romans.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.igntp-romans.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/0311.igntp-romans.txt`
- `transcriptions/greek/0319.igntp-romans.txt`
- `transcriptions/greek/04.cntr.txt`
- `transcriptions/greek/04.igntp-romans.txt`
- `transcriptions/greek/04.intf.txt`
- `transcriptions/greek/044.igntp-romans.txt`
- `transcriptions/greek/048.igntp-romans.txt`
- `transcriptions/greek/048.intf.txt`
- `transcriptions/greek/049.igntp-romans.txt`
- `transcriptions/greek/06.igntp-romans.txt`
- `transcriptions/greek/1.igntp-romans.txt`
- `transcriptions/greek/103.igntp-romans.txt`
- `transcriptions/greek/104.igntp-romans.txt`
- `transcriptions/greek/1069.igntp-romans.txt`
- `transcriptions/greek/1108.igntp-romans.txt`
- `transcriptions/greek/1115.igntp-romans.txt`
- `transcriptions/greek/1175.igntp-romans.txt`
- `transcriptions/greek/1241.igntp-romans.txt`
- `transcriptions/greek/1243.igntp-romans.txt`
- `transcriptions/greek/1297.igntp-romans.txt`
- `transcriptions/greek/1319.igntp-romans.txt`
- `transcriptions/greek/1359.igntp-romans.txt`
- `transcriptions/greek/1505.igntp-romans.txt`
- `transcriptions/greek/1506.igntp-romans.txt`
- `transcriptions/greek/1524.igntp-romans.txt`
- `transcriptions/greek/1573.igntp-romans.txt`
- `transcriptions/greek/1611.igntp-romans.txt`
- `transcriptions/greek/1617.igntp-romans.txt`
- `transcriptions/greek/1718.igntp-romans.txt`
- `transcriptions/greek/1729.igntp-romans.txt`
- `transcriptions/greek/1739.igntp-romans.txt`
- `transcriptions/greek/1739.intf.txt`
- `transcriptions/greek/1751.igntp-romans.txt`
- `transcriptions/greek/1798.igntp-romans.txt`
- `transcriptions/greek/18.igntp-romans.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/1834.igntp-romans.txt`
- `transcriptions/greek/1837.igntp-romans.txt`
- `transcriptions/greek/1838.igntp-romans.txt`
- `transcriptions/greek/1846.igntp-romans.txt`
- `transcriptions/greek/1852.igntp-romans.txt`
- `transcriptions/greek/1862.igntp-catena.txt`
- `transcriptions/greek/1875.igntp-romans.txt`
- `transcriptions/greek/1877.igntp-romans.txt`
- `transcriptions/greek/1881.igntp-romans.txt`
- `transcriptions/greek/1881.intf.txt`
- `transcriptions/greek/1886.igntp-romans.txt`
- `transcriptions/greek/1893.igntp-romans.txt`
- `transcriptions/greek/1908.igntp-romans.txt`
- `transcriptions/greek/1909.igntp-romans.txt`
- `transcriptions/greek/1912.igntp-romans.txt`
- `transcriptions/greek/1935.igntp-romans.txt`
- `transcriptions/greek/1942.igntp-romans.txt`
- `transcriptions/greek/1947.igntp-romans.txt`
- `transcriptions/greek/1950.igntp-romans.txt`
- `transcriptions/greek/1959.igntp-romans.txt`
- `transcriptions/greek/1961.igntp-romans.txt`
- `transcriptions/greek/1962.igntp-romans.txt`
- `transcriptions/greek/1963.igntp-romans.txt`
- `transcriptions/greek/1969.igntp-romans.txt`
- `transcriptions/greek/1973.igntp-romans.txt`
- `transcriptions/greek/1985.igntp-romans.txt`
- `transcriptions/greek/1987.igntp-romans.txt`
- `transcriptions/greek/1991.igntp-romans.txt`
- `transcriptions/greek/1995.igntp-romans.txt`
- `transcriptions/greek/1996.igntp-romans.txt`
- `transcriptions/greek/1999.igntp-romans.txt`
- `transcriptions/greek/2000.igntp-romans.txt`
- `transcriptions/greek/2006.igntp-romans.txt`
- `transcriptions/greek/2012.igntp-romans.txt`
- `transcriptions/greek/206.igntp-romans.txt`
- `transcriptions/greek/2102.igntp-romans.txt`
- `transcriptions/greek/2105.igntp-romans.txt`
- `transcriptions/greek/2110.igntp-romans.txt`
- `transcriptions/greek/2127.igntp-romans.txt`
- `transcriptions/greek/218.igntp-romans.txt`
- `transcriptions/greek/2197.igntp-romans.txt`
- `transcriptions/greek/2200.igntp-romans.txt`
- `transcriptions/greek/2344.igntp-romans.txt`
- `transcriptions/greek/2344.intf.txt`
- `transcriptions/greek/2352.igntp-romans.txt`
- `transcriptions/greek/2374.intf.txt`
- `transcriptions/greek/2400.igntp-romans.txt`
- `transcriptions/greek/2464.igntp-romans.txt`
- `transcriptions/greek/2495.igntp-romans.txt`
- `transcriptions/greek/2516.igntp-romans.txt`
- `transcriptions/greek/2523.igntp-romans.txt`
- `transcriptions/greek/2544.igntp-romans.txt`
- `transcriptions/greek/256.igntp-romans.txt`
- `transcriptions/greek/2576.igntp-romans.txt`
- `transcriptions/greek/263.igntp-romans.txt`
- `transcriptions/greek/2659.igntp-romans.txt`
- `transcriptions/greek/2685.igntp-romans.txt`
- `transcriptions/greek/2853.igntp-romans.txt`
- `transcriptions/greek/2936.igntp-romans.txt`
- `transcriptions/greek/3.igntp-romans.txt`
- `transcriptions/greek/319.intf.txt`
- `transcriptions/greek/326.igntp-romans.txt`
- `transcriptions/greek/33.igntp-romans.txt`
- `transcriptions/greek/33.intf.txt`
- `transcriptions/greek/330.igntp-romans.txt`
- `transcriptions/greek/35.igntp-romans.txt`
- `transcriptions/greek/363.igntp-romans.txt`
- `transcriptions/greek/365.igntp-romans.txt`
- `transcriptions/greek/38.igntp-romans.txt`
- `transcriptions/greek/398.igntp-romans.txt`
- `transcriptions/greek/400.igntp-romans.txt`
- `transcriptions/greek/421.igntp-romans.txt`
- `transcriptions/greek/424.igntp-romans.txt`
- `transcriptions/greek/43.igntp-romans.txt`
- `transcriptions/greek/43.intf.txt`
- `transcriptions/greek/436.igntp-romans.txt`
- `transcriptions/greek/441.igntp-romans.txt`
- `transcriptions/greek/451.igntp-romans.txt`
- `transcriptions/greek/453.intf.txt`
- `transcriptions/greek/455.igntp-romans.txt`
- `transcriptions/greek/459.igntp-romans.txt`
- `transcriptions/greek/467.igntp-romans.txt`
- `transcriptions/greek/5.igntp-romans.txt`
- `transcriptions/greek/6.igntp-romans.txt`
- `transcriptions/greek/6.intf.txt`
- `transcriptions/greek/606.igntp-romans.txt`
- `transcriptions/greek/608.igntp-romans.txt`
- `transcriptions/greek/61.igntp-romans.txt`
- `transcriptions/greek/621.igntp-romans.txt`
- `transcriptions/greek/623.igntp-romans.txt`
- `transcriptions/greek/629.igntp-romans.txt`
- `transcriptions/greek/630.igntp-romans.txt`
- `transcriptions/greek/69.igntp-romans.txt`
- `transcriptions/greek/808.intf.txt`
- `transcriptions/greek/81.igntp-romans.txt`
- `transcriptions/greek/88.igntp-romans.txt`
- `transcriptions/greek/886.igntp-romans.txt`
- `transcriptions/greek/90.igntp-romans.txt`
- `transcriptions/greek/915.igntp-romans.txt`
- `transcriptions/greek/L1126.igntp-romans.txt`
- `transcriptions/greek/L1159.igntp-romans.txt`
- `transcriptions/greek/L1178.igntp-romans.txt`
- `transcriptions/greek/L1188.igntp-romans.txt`
- `transcriptions/greek/L1281.intf.txt`
- `transcriptions/greek/L1298.igntp-romans.txt`
- `transcriptions/greek/L1440.igntp-romans.txt`
- `transcriptions/greek/L156.igntp-romans.txt`
- `transcriptions/greek/L169.igntp-romans.txt`
- `transcriptions/greek/L2010.igntp-romans.txt`
- `transcriptions/greek/L2058.igntp-romans.txt`
- `transcriptions/greek/L23.igntp-romans.txt`
- `transcriptions/greek/L587.igntp-romans.txt`
- `transcriptions/greek/L60.igntp-romans.txt`
- `transcriptions/greek/L809.igntp-romans.txt`
- `transcriptions/greek/P10.igntp-romans.txt`
- `transcriptions/greek/P10.intf.txt`
- `transcriptions/greek/P113.cntr.txt`
- `transcriptions/greek/P113.igntp-romans.txt`
- `transcriptions/greek/P113.intf.txt`
- `transcriptions/greek/P118.cntr.txt`
- `transcriptions/greek/P118.igntp-romans.txt`
- `transcriptions/greek/P118.intf.txt`
- `transcriptions/greek/P131.cntr.txt`
- `transcriptions/greek/P131.igntp-romans.txt`
- `transcriptions/greek/P131.intf.txt`
- `transcriptions/greek/P26.igntp-romans.txt`
- `transcriptions/greek/P26.intf.txt`
- `transcriptions/greek/P27.cntr.txt`
- `transcriptions/greek/P27.igntp-romans.txt`
- `transcriptions/greek/P27.intf.txt`
- `transcriptions/greek/P31.igntp-romans.txt`
- `transcriptions/greek/P31.intf.txt`
- `transcriptions/greek/P40.cntr.txt`
- `transcriptions/greek/P40.igntp-romans.txt`
- `transcriptions/greek/P40.intf.txt`
- `transcriptions/greek/P46.cntr.txt`
- `transcriptions/greek/P46.igntp-romans.txt`
- `transcriptions/greek/P46.intf.txt`
- `transcriptions/greek/P61.igntp-romans.txt`
- `transcriptions/greek/P61.intf.txt`
- `transcriptions/greek/P94.igntp-romans.txt`
- `transcriptions/greek/P94.intf.txt`
