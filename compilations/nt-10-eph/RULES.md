# Ephesians: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** Ephesians
- **Book:** Eph
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-10-eph`. It carries out rules 1 to 12 below exactly as written, in that
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

146 manuscripts, 166 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.igntp-ephesians.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/010.igntp-ephesians.txt`
- `transcriptions/greek/012.igntp-ephesians.txt`
- `transcriptions/greek/0142.igntp-ephesians.txt`
- `transcriptions/greek/0150.igntp-ephesians.txt`
- `transcriptions/greek/0151.igntp-ephesians.txt`
- `transcriptions/greek/0159.igntp-ephesians.txt`
- `transcriptions/greek/016.igntp-ephesians.txt`
- `transcriptions/greek/018.igntp-ephesians.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.igntp-ephesians.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/020.igntp-ephesians.txt`
- `transcriptions/greek/0230.cntr.txt`
- `transcriptions/greek/0230.igntp-ephesians.txt`
- `transcriptions/greek/025.igntp-ephesians.txt`
- `transcriptions/greek/0278.igntp-ephesians.txt`
- `transcriptions/greek/0285.igntp-ephesians.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.igntp-ephesians.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/0319.igntp-ephesians.txt`
- `transcriptions/greek/0320.igntp-ephesians.txt`
- `transcriptions/greek/04.cntr.txt`
- `transcriptions/greek/04.igntp-ephesians.txt`
- `transcriptions/greek/04.intf.txt`
- `transcriptions/greek/044.igntp-ephesians.txt`
- `transcriptions/greek/048.igntp-ephesians.txt`
- `transcriptions/greek/049.igntp-ephesians.txt`
- `transcriptions/greek/056.igntp-ephesians.txt`
- `transcriptions/greek/06.igntp-ephesians.txt`
- `transcriptions/greek/075.igntp-ephesians.txt`
- `transcriptions/greek/082.igntp-ephesians.txt`
- `transcriptions/greek/1.igntp-ephesians.txt`
- `transcriptions/greek/102.igntp-ephesians.txt`
- `transcriptions/greek/104.igntp-ephesians.txt`
- `transcriptions/greek/1069.igntp-ephesians.txt`
- `transcriptions/greek/1108.igntp-ephesians.txt`
- `transcriptions/greek/1115.igntp-ephesians.txt`
- `transcriptions/greek/1127.igntp-ephesians.txt`
- `transcriptions/greek/1175.igntp-ephesians.txt`
- `transcriptions/greek/1240.igntp-ephesians.txt`
- `transcriptions/greek/1241.igntp-ephesians.txt`
- `transcriptions/greek/1245.igntp-ephesians.txt`
- `transcriptions/greek/1311.igntp-ephesians.txt`
- `transcriptions/greek/1319.igntp-ephesians.txt`
- `transcriptions/greek/1398.igntp-ephesians.txt`
- `transcriptions/greek/1490.igntp-ephesians.txt`
- `transcriptions/greek/1505.igntp-ephesians.txt`
- `transcriptions/greek/1509.igntp-ephesians.txt`
- `transcriptions/greek/1573.igntp-ephesians.txt`
- `transcriptions/greek/1611.igntp-ephesians.txt`
- `transcriptions/greek/1617.igntp-ephesians.txt`
- `transcriptions/greek/1678.igntp-ephesians.txt`
- `transcriptions/greek/1718.igntp-ephesians.txt`
- `transcriptions/greek/1721.igntp-ephesians.txt`
- `transcriptions/greek/1729.igntp-ephesians.txt`
- `transcriptions/greek/1739.igntp-ephesians.txt`
- `transcriptions/greek/1751.igntp-ephesians.txt`
- `transcriptions/greek/177.igntp-ephesians.txt`
- `transcriptions/greek/18.igntp-ephesians.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/181.igntp-ephesians.txt`
- `transcriptions/greek/1831.igntp-ephesians.txt`
- `transcriptions/greek/1834.igntp-ephesians.txt`
- `transcriptions/greek/1836.igntp-ephesians.txt`
- `transcriptions/greek/1837.igntp-ephesians.txt`
- `transcriptions/greek/1838.igntp-ephesians.txt`
- `transcriptions/greek/1840.igntp-ephesians.txt`
- `transcriptions/greek/1851.igntp-ephesians.txt`
- `transcriptions/greek/1860.igntp-ephesians.txt`
- `transcriptions/greek/1877.igntp-ephesians.txt`
- `transcriptions/greek/1881.igntp-ephesians.txt`
- `transcriptions/greek/1886.igntp-ephesians.txt`
- `transcriptions/greek/1893.igntp-ephesians.txt`
- `transcriptions/greek/1908.igntp-ephesians.txt`
- `transcriptions/greek/1910.igntp-ephesians.txt`
- `transcriptions/greek/1912.igntp-ephesians.txt`
- `transcriptions/greek/1913.igntp-ephesians.txt`
- `transcriptions/greek/1918.igntp-ephesians.txt`
- `transcriptions/greek/1939.igntp-ephesians.txt`
- `transcriptions/greek/1942.igntp-ephesians.txt`
- `transcriptions/greek/1959.igntp-ephesians.txt`
- `transcriptions/greek/1962.igntp-ephesians.txt`
- `transcriptions/greek/1963.igntp-ephesians.txt`
- `transcriptions/greek/1985.igntp-ephesians.txt`
- `transcriptions/greek/1987.igntp-ephesians.txt`
- `transcriptions/greek/1991.igntp-ephesians.txt`
- `transcriptions/greek/1996.igntp-ephesians.txt`
- `transcriptions/greek/1999.igntp-ephesians.txt`
- `transcriptions/greek/2004.igntp-ephesians.txt`
- `transcriptions/greek/2005.igntp-ephesians.txt`
- `transcriptions/greek/2008.igntp-ephesians.txt`
- `transcriptions/greek/2011.igntp-ephesians.txt`
- `transcriptions/greek/2012.igntp-ephesians.txt`
- `transcriptions/greek/203.igntp-ephesians.txt`
- `transcriptions/greek/2127.igntp-ephesians.txt`
- `transcriptions/greek/2138.igntp-ephesians.txt`
- `transcriptions/greek/218.igntp-ephesians.txt`
- `transcriptions/greek/2180.igntp-ephesians.txt`
- `transcriptions/greek/2243.igntp-ephesians.txt`
- `transcriptions/greek/2344.igntp-ephesians.txt`
- `transcriptions/greek/2352.igntp-ephesians.txt`
- `transcriptions/greek/2400.igntp-ephesians.txt`
- `transcriptions/greek/2464.igntp-ephesians.txt`
- `transcriptions/greek/2492.igntp-ephesians.txt`
- `transcriptions/greek/2495.igntp-ephesians.txt`
- `transcriptions/greek/2516.igntp-ephesians.txt`
- `transcriptions/greek/2523.igntp-ephesians.txt`
- `transcriptions/greek/2544.igntp-ephesians.txt`
- `transcriptions/greek/256.igntp-ephesians.txt`
- `transcriptions/greek/2576.igntp-ephesians.txt`
- `transcriptions/greek/263.igntp-ephesians.txt`
- `transcriptions/greek/2805.igntp-ephesians.txt`
- `transcriptions/greek/2834.igntp-ephesians.txt`
- `transcriptions/greek/2853.igntp-ephesians.txt`
- `transcriptions/greek/2865.igntp-ephesians.txt`
- `transcriptions/greek/296.igntp-ephesians.txt`
- `transcriptions/greek/322.igntp-ephesians.txt`
- `transcriptions/greek/326.igntp-ephesians.txt`
- `transcriptions/greek/33.igntp-ephesians.txt`
- `transcriptions/greek/330.igntp-ephesians.txt`
- `transcriptions/greek/337.igntp-ephesians.txt`
- `transcriptions/greek/35.igntp-ephesians.txt`
- `transcriptions/greek/363.igntp-ephesians.txt`
- `transcriptions/greek/365.igntp-ephesians.txt`
- `transcriptions/greek/38.igntp-ephesians.txt`
- `transcriptions/greek/383.igntp-ephesians.txt`
- `transcriptions/greek/398.igntp-ephesians.txt`
- `transcriptions/greek/424.igntp-ephesians.txt`
- `transcriptions/greek/436.igntp-ephesians.txt`
- `transcriptions/greek/442.igntp-ephesians.txt`
- `transcriptions/greek/451.igntp-ephesians.txt`
- `transcriptions/greek/459.igntp-ephesians.txt`
- `transcriptions/greek/462.igntp-ephesians.txt`
- `transcriptions/greek/467.igntp-ephesians.txt`
- `transcriptions/greek/506.igntp-ephesians.txt`
- `transcriptions/greek/6.igntp-ephesians.txt`
- `transcriptions/greek/6.intf.txt`
- `transcriptions/greek/606.igntp-ephesians.txt`
- `transcriptions/greek/61.igntp-ephesians.txt`
- `transcriptions/greek/629.igntp-ephesians.txt`
- `transcriptions/greek/636.igntp-ephesians.txt`
- `transcriptions/greek/664.igntp-ephesians.txt`
- `transcriptions/greek/665.igntp-ephesians.txt`
- `transcriptions/greek/69.igntp-ephesians.txt`
- `transcriptions/greek/81.igntp-ephesians.txt`
- `transcriptions/greek/88.igntp-ephesians.txt`
- `transcriptions/greek/915.igntp-ephesians.txt`
- `transcriptions/greek/93.igntp-ephesians.txt`
- `transcriptions/greek/94.igntp-ephesians.txt`
- `transcriptions/greek/P132.cntr.txt`
- `transcriptions/greek/P132.igntp-ephesians.txt`
- `transcriptions/greek/P132.intf.txt`
- `transcriptions/greek/P46.cntr.txt`
- `transcriptions/greek/P46.igntp-ephesians.txt`
- `transcriptions/greek/P46.intf.txt`
- `transcriptions/greek/P49.cntr.txt`
- `transcriptions/greek/P49.igntp-ephesians.txt`
- `transcriptions/greek/P49.intf.txt`
- `transcriptions/greek/P92.cntr.txt`
- `transcriptions/greek/P92.igntp-ephesians.txt`
- `transcriptions/greek/P92.intf.txt`
