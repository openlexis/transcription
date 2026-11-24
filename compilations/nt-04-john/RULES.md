# John: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** John
- **Book:** John
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-04-john`. It carries out rules 1 to 13 below exactly as written, in that
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

251 manuscripts, 328 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.igntp-john.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/0101.igntp-john.txt`
- `transcriptions/greek/0105.igntp-john.txt`
- `transcriptions/greek/0109.igntp-john.txt`
- `transcriptions/greek/011.igntp-john.txt`
- `transcriptions/greek/0127.igntp-john.txt`
- `transcriptions/greek/013.igntp-john.txt`
- `transcriptions/greek/0141.igntp-john.txt`
- `transcriptions/greek/0145.igntp-john.txt`
- `transcriptions/greek/0162.cntr.txt`
- `transcriptions/greek/0162.igntp-john.txt`
- `transcriptions/greek/0162.intf.txt`
- `transcriptions/greek/017.igntp-john.txt`
- `transcriptions/greek/019.igntp-john.txt`
- `transcriptions/greek/019.intf.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.igntp-john.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/021.igntp-john.txt`
- `transcriptions/greek/0210.igntp-john.txt`
- `transcriptions/greek/0211.igntp-john.txt`
- `transcriptions/greek/0216.igntp-john.txt`
- `transcriptions/greek/0217.igntp-john.txt`
- `transcriptions/greek/0218.igntp-john.txt`
- `transcriptions/greek/022.igntp-john.txt`
- `transcriptions/greek/0233.igntp-john.txt`
- `transcriptions/greek/0234.igntp-john.txt`
- `transcriptions/greek/0238.igntp-john.txt`
- `transcriptions/greek/024.igntp-john.txt`
- `transcriptions/greek/024.intf.txt`
- `transcriptions/greek/0256.igntp-john.txt`
- `transcriptions/greek/0258.cntr.txt`
- `transcriptions/greek/026.igntp-john.txt`
- `transcriptions/greek/0260.igntp-john.txt`
- `transcriptions/greek/0264.igntp-john.txt`
- `transcriptions/greek/0268.igntp-john.txt`
- `transcriptions/greek/028.igntp-john.txt`
- `transcriptions/greek/0286.igntp-john.txt`
- `transcriptions/greek/029.cntr.txt`
- `transcriptions/greek/029.igntp-john.txt`
- `transcriptions/greek/0290.igntp-john.txt`
- `transcriptions/greek/0299.igntp-john.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.igntp-john.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/030.igntp-john.txt`
- `transcriptions/greek/0301.igntp-john.txt`
- `transcriptions/greek/0302.igntp-john.txt`
- `transcriptions/greek/0306.igntp-john.txt`
- `transcriptions/greek/0309.igntp-john.txt`
- `transcriptions/greek/0309.intf.txt`
- `transcriptions/greek/031.igntp-john.txt`
- `transcriptions/greek/032.cntr.txt`
- `transcriptions/greek/032.igntp-john.txt`
- `transcriptions/greek/0323.cntr.txt`
- `transcriptions/greek/033.igntp-john.txt`
- `transcriptions/greek/034.igntp-john.txt`
- `transcriptions/greek/036.igntp-john.txt`
- `transcriptions/greek/036.intf.txt`
- `transcriptions/greek/037.igntp-john.txt`
- `transcriptions/greek/037.intf.txt`
- `transcriptions/greek/038.igntp-john.txt`
- `transcriptions/greek/038.intf.txt`
- `transcriptions/greek/039.igntp-john.txt`
- `transcriptions/greek/04.cntr.txt`
- `transcriptions/greek/04.igntp-john.txt`
- `transcriptions/greek/04.intf.txt`
- `transcriptions/greek/041.igntp-john.txt`
- `transcriptions/greek/044.igntp-john.txt`
- `transcriptions/greek/045.igntp-john.txt`
- `transcriptions/greek/047.igntp-john.txt`
- `transcriptions/greek/05.cntr.txt`
- `transcriptions/greek/05.igntp-john.txt`
- `transcriptions/greek/05.intf.txt`
- `transcriptions/greek/050.igntp-john.txt`
- `transcriptions/greek/050.intf.txt`
- `transcriptions/greek/054.igntp-john.txt`
- `transcriptions/greek/060.igntp-john.txt`
- `transcriptions/greek/063.igntp-john.txt`
- `transcriptions/greek/065.igntp-john.txt`
- `transcriptions/greek/068.igntp-john.txt`
- `transcriptions/greek/07.igntp-john.txt`
- `transcriptions/greek/070.igntp-john.txt`
- `transcriptions/greek/078.igntp-john.txt`
- `transcriptions/greek/083.igntp-john.txt`
- `transcriptions/greek/086.igntp-john.txt`
- `transcriptions/greek/087.igntp-john.txt`
- `transcriptions/greek/09.igntp-john.txt`
- `transcriptions/greek/091.igntp-john.txt`
- `transcriptions/greek/1.igntp-john.txt`
- `transcriptions/greek/1009.igntp-john.txt`
- `transcriptions/greek/1010.igntp-john.txt`
- `transcriptions/greek/1014.igntp-john.txt`
- `transcriptions/greek/1029.igntp-john.txt`
- `transcriptions/greek/1071.igntp-john.txt`
- `transcriptions/greek/1073.igntp-john.txt`
- `transcriptions/greek/1079.igntp-john.txt`
- `transcriptions/greek/109.igntp-john.txt`
- `transcriptions/greek/1093.igntp-john.txt`
- `transcriptions/greek/1128.igntp-john.txt`
- `transcriptions/greek/118.igntp-john.txt`
- `transcriptions/greek/1192.igntp-john.txt`
- `transcriptions/greek/1194.igntp-john.txt`
- `transcriptions/greek/1203.igntp-john.txt`
- `transcriptions/greek/1210.igntp-john.txt`
- `transcriptions/greek/1212.igntp-john.txt`
- `transcriptions/greek/1216.igntp-john.txt`
- `transcriptions/greek/1219.igntp-john.txt`
- `transcriptions/greek/1230.igntp-john.txt`
- `transcriptions/greek/124.igntp-john.txt`
- `transcriptions/greek/1241.igntp-john.txt`
- `transcriptions/greek/1242.igntp-john.txt`
- `transcriptions/greek/1243.igntp-john.txt`
- `transcriptions/greek/1253.igntp-john.txt`
- `transcriptions/greek/1278.igntp-john.txt`
- `transcriptions/greek/1293.igntp-john.txt`
- `transcriptions/greek/13.igntp-john.txt`
- `transcriptions/greek/13.intf.txt`
- `transcriptions/greek/131.igntp-john.txt`
- `transcriptions/greek/1319.igntp-john.txt`
- `transcriptions/greek/1320.igntp-john.txt`
- `transcriptions/greek/1321.igntp-john.txt`
- `transcriptions/greek/1344.igntp-john.txt`
- `transcriptions/greek/138.igntp-john.txt`
- `transcriptions/greek/1424.igntp-john.txt`
- `transcriptions/greek/1463.igntp-john.txt`
- `transcriptions/greek/1505.igntp-john.txt`
- `transcriptions/greek/1514.igntp-john.txt`
- `transcriptions/greek/1519.igntp-john.txt`
- `transcriptions/greek/1546.igntp-john.txt`
- `transcriptions/greek/1561.igntp-john.txt`
- `transcriptions/greek/157.igntp-john.txt`
- `transcriptions/greek/1571.igntp-john.txt`
- `transcriptions/greek/1582.igntp-john.txt`
- `transcriptions/greek/1654.igntp-john.txt`
- `transcriptions/greek/168.igntp-john.txt`
- `transcriptions/greek/1689.igntp-john.txt`
- `transcriptions/greek/173.igntp-john.txt`
- `transcriptions/greek/1788.igntp-john.txt`
- `transcriptions/greek/1797.igntp-john.txt`
- `transcriptions/greek/18.igntp-john.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/2.igntp-john.txt`
- `transcriptions/greek/205.igntp-john.txt`
- `transcriptions/greek/209.igntp-john.txt`
- `transcriptions/greek/2106.igntp-john.txt`
- `transcriptions/greek/213.igntp-john.txt`
- `transcriptions/greek/2192.igntp-john.txt`
- `transcriptions/greek/2193.igntp-john.txt`
- `transcriptions/greek/22.igntp-john.txt`
- `transcriptions/greek/2223.igntp-john.txt`
- `transcriptions/greek/226.igntp-john.txt`
- `transcriptions/greek/2372.igntp-john.txt`
- `transcriptions/greek/2411.igntp-john.txt`
- `transcriptions/greek/249.igntp-john.txt`
- `transcriptions/greek/2561.igntp-john.txt`
- `transcriptions/greek/2575.igntp-john.txt`
- `transcriptions/greek/2585.igntp-john.txt`
- `transcriptions/greek/2615.igntp-john.txt`
- `transcriptions/greek/265.igntp-john.txt`
- `transcriptions/greek/2680.igntp-john.txt`
- `transcriptions/greek/27.igntp-john.txt`
- `transcriptions/greek/2713.igntp-john.txt`
- `transcriptions/greek/2718.igntp-john.txt`
- `transcriptions/greek/2766.igntp-john.txt`
- `transcriptions/greek/2768.igntp-john.txt`
- `transcriptions/greek/2786.igntp-john.txt`
- `transcriptions/greek/2790.igntp-john.txt`
- `transcriptions/greek/2886.igntp-john.txt`
- `transcriptions/greek/295.igntp-john.txt`
- `transcriptions/greek/317.igntp-john.txt`
- `transcriptions/greek/33.igntp-john.txt`
- `transcriptions/greek/33.intf.txt`
- `transcriptions/greek/333.igntp-john.txt`
- `transcriptions/greek/346.igntp-john.txt`
- `transcriptions/greek/35.igntp-john.txt`
- `transcriptions/greek/357.igntp-john.txt`
- `transcriptions/greek/377.igntp-john.txt`
- `transcriptions/greek/382.igntp-john.txt`
- `transcriptions/greek/397.igntp-john.txt`
- `transcriptions/greek/423.igntp-john.txt`
- `transcriptions/greek/430.igntp-john.txt`
- `transcriptions/greek/461.igntp-john.txt`
- `transcriptions/greek/475.igntp-john.txt`
- `transcriptions/greek/543.igntp-john.txt`
- `transcriptions/greek/544.igntp-john.txt`
- `transcriptions/greek/565.igntp-john.txt`
- `transcriptions/greek/579.igntp-john.txt`
- `transcriptions/greek/597.igntp-john.txt`
- `transcriptions/greek/69.igntp-john.txt`
- `transcriptions/greek/69.intf.txt`
- `transcriptions/greek/7.igntp-john.txt`
- `transcriptions/greek/732.igntp-john.txt`
- `transcriptions/greek/788.igntp-john.txt`
- `transcriptions/greek/792.igntp-john.txt`
- `transcriptions/greek/799.igntp-john.txt`
- `transcriptions/greek/8.igntp-john.txt`
- `transcriptions/greek/807.igntp-john.txt`
- `transcriptions/greek/821.igntp-john.txt`
- `transcriptions/greek/826.igntp-john.txt`
- `transcriptions/greek/828.igntp-john.txt`
- `transcriptions/greek/841.igntp-john.txt`
- `transcriptions/greek/865.igntp-john.txt`
- `transcriptions/greek/869.igntp-john.txt`
- `transcriptions/greek/872.igntp-john.txt`
- `transcriptions/greek/884.igntp-john.txt`
- `transcriptions/greek/892.igntp-john.txt`
- `transcriptions/greek/9.igntp-john.txt`
- `transcriptions/greek/983.igntp-john.txt`
- `transcriptions/greek/992.igntp-john.txt`
- `transcriptions/greek/994.igntp-john.txt`
- `transcriptions/greek/L1000.igntp-john.txt`
- `transcriptions/greek/L1073.igntp-john.txt`
- `transcriptions/greek/L1075.igntp-john.txt`
- `transcriptions/greek/L1076.igntp-john.txt`
- `transcriptions/greek/L1077.igntp-john.txt`
- `transcriptions/greek/L1082.igntp-john.txt`
- `transcriptions/greek/L1086.igntp-john.txt`
- `transcriptions/greek/L1091.igntp-john.txt`
- `transcriptions/greek/L1096.igntp-john.txt`
- `transcriptions/greek/L1100.igntp-john.txt`
- `transcriptions/greek/L141.igntp-john.txt`
- `transcriptions/greek/L1552.igntp-john.txt`
- `transcriptions/greek/L1692.igntp-john.txt`
- `transcriptions/greek/L17.igntp-john.txt`
- `transcriptions/greek/L2005.intf.txt`
- `transcriptions/greek/L252.igntp-john.txt`
- `transcriptions/greek/L253.igntp-john.txt`
- `transcriptions/greek/L32.igntp-john.txt`
- `transcriptions/greek/L329.igntp-john.txt`
- `transcriptions/greek/L335.igntp-john.txt`
- `transcriptions/greek/L387.igntp-john.txt`
- `transcriptions/greek/L425.igntp-john.txt`
- `transcriptions/greek/L5.igntp-john.txt`
- `transcriptions/greek/L60.igntp-john.txt`
- `transcriptions/greek/L638.igntp-john.txt`
- `transcriptions/greek/L640.igntp-john.txt`
- `transcriptions/greek/L663.igntp-john.txt`
- `transcriptions/greek/L704.igntp-john.txt`
- `transcriptions/greek/L735.igntp-john.txt`
- `transcriptions/greek/L770.igntp-john.txt`
- `transcriptions/greek/L847.igntp-john.txt`
- `transcriptions/greek/P106.cntr.txt`
- `transcriptions/greek/P106.igntp-john.txt`
- `transcriptions/greek/P106.intf.txt`
- `transcriptions/greek/P107.cntr.txt`
- `transcriptions/greek/P107.igntp-john.txt`
- `transcriptions/greek/P107.intf.txt`
- `transcriptions/greek/P108.cntr.txt`
- `transcriptions/greek/P108.igntp-john.txt`
- `transcriptions/greek/P108.intf.txt`
- `transcriptions/greek/P109.cntr.txt`
- `transcriptions/greek/P109.igntp-john.txt`
- `transcriptions/greek/P109.intf.txt`
- `transcriptions/greek/P119.cntr.txt`
- `transcriptions/greek/P119.igntp-john.txt`
- `transcriptions/greek/P119.intf.txt`
- `transcriptions/greek/P120.cntr.txt`
- `transcriptions/greek/P120.igntp-john.txt`
- `transcriptions/greek/P120.intf.txt`
- `transcriptions/greek/P121.cntr.txt`
- `transcriptions/greek/P121.igntp-john.txt`
- `transcriptions/greek/P121.intf.txt`
- `transcriptions/greek/P122.cntr.txt`
- `transcriptions/greek/P122.igntp-john.txt`
- `transcriptions/greek/P122.intf.txt`
- `transcriptions/greek/P128.igntp-john.txt`
- `transcriptions/greek/P128.intf.txt`
- `transcriptions/greek/P134.cntr.txt`
- `transcriptions/greek/P134.intf.txt`
- `transcriptions/greek/P2.igntp-john.txt`
- `transcriptions/greek/P2.intf.txt`
- `transcriptions/greek/P22.cntr.txt`
- `transcriptions/greek/P22.igntp-john.txt`
- `transcriptions/greek/P22.intf.txt`
- `transcriptions/greek/P28.cntr.txt`
- `transcriptions/greek/P28.igntp-john.txt`
- `transcriptions/greek/P28.intf.txt`
- `transcriptions/greek/P36.igntp-john.txt`
- `transcriptions/greek/P36.intf.txt`
- `transcriptions/greek/P39.cntr.txt`
- `transcriptions/greek/P39.igntp-john.txt`
- `transcriptions/greek/P39.intf.txt`
- `transcriptions/greek/P44.igntp-john.txt`
- `transcriptions/greek/P44.intf.txt`
- `transcriptions/greek/P45.cntr.txt`
- `transcriptions/greek/P45.igntp-john.txt`
- `transcriptions/greek/P45.intf.txt`
- `transcriptions/greek/P5.cntr.txt`
- `transcriptions/greek/P5.igntp-john.txt`
- `transcriptions/greek/P5.intf.txt`
- `transcriptions/greek/P52.cntr.txt`
- `transcriptions/greek/P52.igntp-john.txt`
- `transcriptions/greek/P52.intf.txt`
- `transcriptions/greek/P55.igntp-john.txt`
- `transcriptions/greek/P55.intf.txt`
- `transcriptions/greek/P59.igntp-john.txt`
- `transcriptions/greek/P59.intf.txt`
- `transcriptions/greek/P6.cntr.txt`
- `transcriptions/greek/P6.igntp-john.txt`
- `transcriptions/greek/P6.intf.txt`
- `transcriptions/greek/P60.igntp-john.txt`
- `transcriptions/greek/P60.intf.txt`
- `transcriptions/greek/P63.igntp-john.txt`
- `transcriptions/greek/P63.intf.txt`
- `transcriptions/greek/P66.cntr.txt`
- `transcriptions/greek/P66.igntp-john.txt`
- `transcriptions/greek/P66.intf.txt`
- `transcriptions/greek/P75.cntr.txt`
- `transcriptions/greek/P75.igntp-john.txt`
- `transcriptions/greek/P75.intf.txt`
- `transcriptions/greek/P76.igntp-john.txt`
- `transcriptions/greek/P76.intf.txt`
- `transcriptions/greek/P80.igntp-john.txt`
- `transcriptions/greek/P80.intf.txt`
- `transcriptions/greek/P84.igntp-john.txt`
- `transcriptions/greek/P84.intf.txt`
- `transcriptions/greek/P90.cntr.txt`
- `transcriptions/greek/P90.igntp-john.txt`
- `transcriptions/greek/P90.intf.txt`
- `transcriptions/greek/P93.igntp-john.txt`
- `transcriptions/greek/P93.intf.txt`
- `transcriptions/greek/P95.cntr.txt`
- `transcriptions/greek/P95.igntp-john.txt`
- `transcriptions/greek/P95.intf.txt`
