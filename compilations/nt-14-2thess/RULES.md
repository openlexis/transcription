# 2 Thessalonians: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** 2 Thessalonians
- **Book:** 2Thess
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-14-2thess`. It carries out rules 1 to 12 below exactly as written, in that
   order, with every tie broken as stated, so the same inputs always give the same output. Nothing in it is random.
3. Run `bun run check` (it reads the output only and takes about a second). If it fails, report what failed and change nothing by hand.
4. Save the output in this folder: `transcription.json`, `transcription.md`, `disagreements.json` and `stats.json`.
   `stats.json` holds the hash of the output, so a second run can be compared with the first.

## Rules

1. **Inputs.** Read only the transcriptions listed under Inputs: ancient manuscripts in Greek, the language the book was written in.
   No printed edition, translation, quotation or image is read. Each transcription gives the first hand of its manuscript;
   a word the transcriber marks as damaged, supplied or unread counts as lost.
2. **One manuscript, one voice.** Leaves of one manuscript that carry separate numbers are one manuscript (P64 with P67,
   P77 with P103). Several transcriptions of one manuscript are one manuscript.
3. **Proximity.** A manuscript copied nearer in time to the original counts more. Its proximity is
   T = min(1, 2^(-(year - origin year) / half-life)): every 100 years after the year 100 halve it. The year is the middle of
   the date range in the INTF catalogue; an undated manuscript is taken as written in 1500. A manuscript written more than
   400 years after the origin year (after 500) is a late copy.
4. **Which transcription.** Where several transcriptions of one manuscript hold a line, the one with the most words in that
   line is read; a tie goes to the one listed first under Inputs for that manuscript (the holder order: Codex Sinaiticus
   Project, Codex Zacynthius project, IGNTP and ITSEE files, INTF, CNTR).
5. **Alignment.** For each line, the manuscripts' words are lined up into columns, oldest manuscript first (then by
   number). Spellings that copyists used for the same word count as one word: ει written for ι, doubled letters, a movable
   ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings are not compared (the manuscripts have none).
   Sacred names written short are written out, and so are numbers written as letters.
6. **Places.** A column where the manuscripts that cover it do not all read the same is a variant. Neighbouring variant
   columns are one place. Two places at most two columns apart that share a word (a word moved) are one place, with the
   columns between them. A manuscript that has a lacuna anywhere in a place does not vote there. A manuscript that has
   a line covers every column of it; where it has no word in a column and no lacuna, it reads that the word is absent.
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
    least 0.01, and settled below that. Each printed form is spelled as in the oldest manuscript that reads it (then by number).
    A line that no manuscript covers is listed as not covered and is not filled from any other source.

## Citations

Every printed word lists the manuscripts that read it. Each manuscript links to its transcription file in this repository,
to the holder's file it came from, and to the holder's page images where a viewer exists (`transcriptions/manuscripts.json`).

## Inputs

154 manuscripts, 186 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.igntp-2thessalonians.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/010.igntp-2thessalonians.txt`
- `transcriptions/greek/0111.igntp-2thessalonians.txt`
- `transcriptions/greek/012.igntp-2thessalonians.txt`
- `transcriptions/greek/0142.igntp-2thessalonians.txt`
- `transcriptions/greek/0150.igntp-2thessalonians.txt`
- `transcriptions/greek/0151.igntp-2thessalonians.txt`
- `transcriptions/greek/016.igntp-2thessalonians.txt`
- `transcriptions/greek/018.igntp-2thessalonians.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.igntp-2thessalonians.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/020.igntp-2thessalonians.txt`
- `transcriptions/greek/025.igntp-2thessalonians.txt`
- `transcriptions/greek/0278.igntp-2thessalonians.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.igntp-2thessalonians.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/044.igntp-2thessalonians.txt`
- `transcriptions/greek/056.igntp-2thessalonians.txt`
- `transcriptions/greek/06.igntp-2thessalonians.txt`
- `transcriptions/greek/075.igntp-2thessalonians.txt`
- `transcriptions/greek/1.intf.txt`
- `transcriptions/greek/103.igntp-2thessalonians.txt`
- `transcriptions/greek/104.igntp-2thessalonians.txt`
- `transcriptions/greek/1101.igntp-2thessalonians.txt`
- `transcriptions/greek/1101.intf.txt`
- `transcriptions/greek/1115.igntp-2thessalonians.txt`
- `transcriptions/greek/1127.igntp-2thessalonians.txt`
- `transcriptions/greek/1127.intf.txt`
- `transcriptions/greek/1175.intf.txt`
- `transcriptions/greek/1241.igntp-2thessalonians.txt`
- `transcriptions/greek/131.igntp-2thessalonians.txt`
- `transcriptions/greek/1311.igntp-2thessalonians.txt`
- `transcriptions/greek/1352.igntp-2thessalonians.txt`
- `transcriptions/greek/1354.igntp-2thessalonians.txt`
- `transcriptions/greek/1390.igntp-2thessalonians.txt`
- `transcriptions/greek/1398.igntp-2thessalonians.txt`
- `transcriptions/greek/1409.igntp-2thessalonians.txt`
- `transcriptions/greek/141.intf.txt`
- `transcriptions/greek/142.igntp-2thessalonians.txt`
- `transcriptions/greek/1448.igntp-2thessalonians.txt`
- `transcriptions/greek/1456.igntp-2thessalonians.txt`
- `transcriptions/greek/1524.igntp-2thessalonians.txt`
- `transcriptions/greek/1573.igntp-2thessalonians.txt`
- `transcriptions/greek/1573.intf.txt`
- `transcriptions/greek/1609.igntp-2thessalonians.txt`
- `transcriptions/greek/1611.intf.txt`
- `transcriptions/greek/1661.igntp-2thessalonians.txt`
- `transcriptions/greek/1678.igntp-2thessalonians.txt`
- `transcriptions/greek/1725.intf.txt`
- `transcriptions/greek/1729.igntp-2thessalonians.txt`
- `transcriptions/greek/1729.intf.txt`
- `transcriptions/greek/1739.igntp-2thessalonians.txt`
- `transcriptions/greek/1751.igntp-2thessalonians.txt`
- `transcriptions/greek/1798.igntp-2thessalonians.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/1830.igntp-2thessalonians.txt`
- `transcriptions/greek/1838.igntp-2thessalonians.txt`
- `transcriptions/greek/1838.intf.txt`
- `transcriptions/greek/1845.igntp-2thessalonians.txt`
- `transcriptions/greek/1867.igntp-2thessalonians.txt`
- `transcriptions/greek/1881.igntp-2thessalonians.txt`
- `transcriptions/greek/1890.igntp-2thessalonians.txt`
- `transcriptions/greek/1899.igntp-2thessalonians.txt`
- `transcriptions/greek/1908.igntp-2thessalonians.txt`
- `transcriptions/greek/1910.igntp-2thessalonians.txt`
- `transcriptions/greek/1912.igntp-2thessalonians.txt`
- `transcriptions/greek/1918.igntp-2thessalonians.txt`
- `transcriptions/greek/1935.igntp-2thessalonians.txt`
- `transcriptions/greek/1942.igntp-2thessalonians.txt`
- `transcriptions/greek/1943.igntp-2thessalonians.txt`
- `transcriptions/greek/1945.igntp-2thessalonians.txt`
- `transcriptions/greek/1947.igntp-2thessalonians.txt`
- `transcriptions/greek/1950.igntp-2thessalonians.txt`
- `transcriptions/greek/1961.igntp-2thessalonians.txt`
- `transcriptions/greek/1962.igntp-2thessalonians.txt`
- `transcriptions/greek/1969.igntp-2thessalonians.txt`
- `transcriptions/greek/1973.igntp-2thessalonians.txt`
- `transcriptions/greek/1976.igntp-2thessalonians.txt`
- `transcriptions/greek/1977.igntp-2thessalonians.txt`
- `transcriptions/greek/1984.igntp-2thessalonians.txt`
- `transcriptions/greek/1985.igntp-2thessalonians.txt`
- `transcriptions/greek/1987.igntp-2thessalonians.txt`
- `transcriptions/greek/1991.igntp-2thessalonians.txt`
- `transcriptions/greek/1995.igntp-2thessalonians.txt`
- `transcriptions/greek/2000.igntp-2thessalonians.txt`
- `transcriptions/greek/2002.igntp-2thessalonians.txt`
- `transcriptions/greek/2003.igntp-2thessalonians.txt`
- `transcriptions/greek/2004.igntp-2thessalonians.txt`
- `transcriptions/greek/2005.igntp-2thessalonians.txt`
- `transcriptions/greek/203.igntp-2thessalonians.txt`
- `transcriptions/greek/2102.igntp-2thessalonians.txt`
- `transcriptions/greek/2104.igntp-2thessalonians.txt`
- `transcriptions/greek/2105.igntp-2thessalonians.txt`
- `transcriptions/greek/2127.igntp-2thessalonians.txt`
- `transcriptions/greek/2138.igntp-2thessalonians.txt`
- `transcriptions/greek/218.igntp-2thessalonians.txt`
- `transcriptions/greek/218.intf.txt`
- `transcriptions/greek/2197.igntp-2thessalonians.txt`
- `transcriptions/greek/2248.igntp-2thessalonians.txt`
- `transcriptions/greek/2298.igntp-2thessalonians.txt`
- `transcriptions/greek/2400.igntp-2thessalonians.txt`
- `transcriptions/greek/2464.igntp-2thessalonians.txt`
- `transcriptions/greek/2482.igntp-2thessalonians.txt`
- `transcriptions/greek/2492.igntp-2thessalonians.txt`
- `transcriptions/greek/2516.igntp-2thessalonians.txt`
- `transcriptions/greek/2523.igntp-2thessalonians.txt`
- `transcriptions/greek/254.igntp-2thessalonians.txt`
- `transcriptions/greek/2544.igntp-2thessalonians.txt`
- `transcriptions/greek/2558.igntp-2thessalonians.txt`
- `transcriptions/greek/256.igntp-2thessalonians.txt`
- `transcriptions/greek/2576.igntp-2thessalonians.txt`
- `transcriptions/greek/2625.igntp-2thessalonians.txt`
- `transcriptions/greek/263.igntp-2thessalonians.txt`
- `transcriptions/greek/2674.igntp-2thessalonians.txt`
- `transcriptions/greek/2736.igntp-2thessalonians.txt`
- `transcriptions/greek/2772.igntp-2thessalonians.txt`
- `transcriptions/greek/2805.igntp-2thessalonians.txt`
- `transcriptions/greek/3.intf.txt`
- `transcriptions/greek/33.igntp-2thessalonians.txt`
- `transcriptions/greek/33.intf.txt`
- `transcriptions/greek/330.igntp-2thessalonians.txt`
- `transcriptions/greek/35.igntp-2thessalonians.txt`
- `transcriptions/greek/365.igntp-2thessalonians.txt`
- `transcriptions/greek/38.igntp-2thessalonians.txt`
- `transcriptions/greek/38.intf.txt`
- `transcriptions/greek/384.igntp-2thessalonians.txt`
- `transcriptions/greek/425.igntp-2thessalonians.txt`
- `transcriptions/greek/425.intf.txt`
- `transcriptions/greek/43.intf.txt`
- `transcriptions/greek/436.igntp-2thessalonians.txt`
- `transcriptions/greek/442.igntp-2thessalonians.txt`
- `transcriptions/greek/442.intf.txt`
- `transcriptions/greek/451.igntp-2thessalonians.txt`
- `transcriptions/greek/451.intf.txt`
- `transcriptions/greek/454.igntp-2thessalonians.txt`
- `transcriptions/greek/454.intf.txt`
- `transcriptions/greek/455.igntp-2thessalonians.txt`
- `transcriptions/greek/459.igntp-2thessalonians.txt`
- `transcriptions/greek/459.intf.txt`
- `transcriptions/greek/460.intf.txt`
- `transcriptions/greek/467.intf.txt`
- `transcriptions/greek/5.intf.txt`
- `transcriptions/greek/506.igntp-2thessalonians.txt`
- `transcriptions/greek/506.intf.txt`
- `transcriptions/greek/51.intf.txt`
- `transcriptions/greek/517.igntp-2thessalonians.txt`
- `transcriptions/greek/582.igntp-2thessalonians.txt`
- `transcriptions/greek/582.intf.txt`
- `transcriptions/greek/6.igntp-2thessalonians.txt`
- `transcriptions/greek/6.intf.txt`
- `transcriptions/greek/606.igntp-2thessalonians.txt`
- `transcriptions/greek/608.igntp-2thessalonians.txt`
- `transcriptions/greek/61.igntp-2thessalonians.txt`
- `transcriptions/greek/61.intf.txt`
- `transcriptions/greek/620.igntp-2thessalonians.txt`
- `transcriptions/greek/620.intf.txt`
- `transcriptions/greek/623.intf.txt`
- `transcriptions/greek/629.igntp-2thessalonians.txt`
- `transcriptions/greek/629.intf.txt`
- `transcriptions/greek/630.igntp-2thessalonians.txt`
- `transcriptions/greek/676.intf.txt`
- `transcriptions/greek/69.intf.txt`
- `transcriptions/greek/720.igntp-2thessalonians.txt`
- `transcriptions/greek/81.igntp-2thessalonians.txt`
- `transcriptions/greek/858.igntp-2thessalonians.txt`
- `transcriptions/greek/88.igntp-2thessalonians.txt`
- `transcriptions/greek/886.igntp-2thessalonians.txt`
- `transcriptions/greek/90.igntp-2thessalonians.txt`
- `transcriptions/greek/90.intf.txt`
- `transcriptions/greek/91.intf.txt`
- `transcriptions/greek/915.igntp-2thessalonians.txt`
- `transcriptions/greek/915.intf.txt`
- `transcriptions/greek/93.intf.txt`
- `transcriptions/greek/941.igntp-2thessalonians.txt`
- `transcriptions/greek/999.igntp-2thessalonians.txt`
- `transcriptions/greek/P30.cntr.txt`
- `transcriptions/greek/P30.igntp-2thessalonians.txt`
- `transcriptions/greek/P30.intf.txt`
- `transcriptions/greek/P92.cntr.txt`
- `transcriptions/greek/P92.igntp-2thessalonians.txt`
- `transcriptions/greek/P92.intf.txt`
