# Mark: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** Mark
- **Book:** Mark
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-02-mark`. It carries out rules 1 to 12 below exactly as written, in that
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

221 manuscripts, 238 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/0103.intf.txt`
- `transcriptions/greek/0104.intf.txt`
- `transcriptions/greek/011.intf.txt`
- `transcriptions/greek/0130.intf.txt`
- `transcriptions/greek/0131.intf.txt`
- `transcriptions/greek/0167.intf.txt`
- `transcriptions/greek/017.family-pi-mark.txt`
- `transcriptions/greek/017.intf.txt`
- `transcriptions/greek/0184.intf.txt`
- `transcriptions/greek/0187.intf.txt`
- `transcriptions/greek/0188.cntr.txt`
- `transcriptions/greek/0188.intf.txt`
- `transcriptions/greek/019.intf.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/0211.intf.txt`
- `transcriptions/greek/0213.intf.txt`
- `transcriptions/greek/0214.cntr.txt`
- `transcriptions/greek/0214.intf.txt`
- `transcriptions/greek/022.intf.txt`
- `transcriptions/greek/0233.intf.txt`
- `transcriptions/greek/0250.intf.txt`
- `transcriptions/greek/0274.intf.txt`
- `transcriptions/greek/0292.intf.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/0315.cntr.txt`
- `transcriptions/greek/032.cntr.txt`
- `transcriptions/greek/032.intf.txt`
- `transcriptions/greek/037.intf.txt`
- `transcriptions/greek/038.intf.txt`
- `transcriptions/greek/04.cntr.txt`
- `transcriptions/greek/04.intf.txt`
- `transcriptions/greek/041.family-pi-mark.txt`
- `transcriptions/greek/041.intf.txt`
- `transcriptions/greek/042.intf.txt`
- `transcriptions/greek/043.intf.txt`
- `transcriptions/greek/044.intf.txt`
- `transcriptions/greek/05.cntr.txt`
- `transcriptions/greek/05.intf.txt`
- `transcriptions/greek/055.intf.txt`
- `transcriptions/greek/059.cntr.txt`
- `transcriptions/greek/064.intf.txt`
- `transcriptions/greek/067.intf.txt`
- `transcriptions/greek/072.intf.txt`
- `transcriptions/greek/083.intf.txt`
- `transcriptions/greek/099.intf.txt`
- `transcriptions/greek/1.intf.txt`
- `transcriptions/greek/1009.intf.txt`
- `transcriptions/greek/1029.intf.txt`
- `transcriptions/greek/1047.intf.txt`
- `transcriptions/greek/105.intf.txt`
- `transcriptions/greek/1071.intf.txt`
- `transcriptions/greek/1079.family-pi-mark.txt`
- `transcriptions/greek/1082.intf.txt`
- `transcriptions/greek/1084.intf.txt`
- `transcriptions/greek/1093.intf.txt`
- `transcriptions/greek/1128.intf.txt`
- `transcriptions/greek/114.family-pi-mark.txt`
- `transcriptions/greek/1141.intf.txt`
- `transcriptions/greek/1159.family-pi-mark.txt`
- `transcriptions/greek/1160.intf.txt`
- `transcriptions/greek/117.intf.txt`
- `transcriptions/greek/118.intf.txt`
- `transcriptions/greek/1216.intf.txt`
- `transcriptions/greek/1219.family-pi-mark.txt`
- `transcriptions/greek/124.intf.txt`
- `transcriptions/greek/1241.intf.txt`
- `transcriptions/greek/1243.intf.txt`
- `transcriptions/greek/1253.intf.txt`
- `transcriptions/greek/1273.intf.txt`
- `transcriptions/greek/1279.intf.txt`
- `transcriptions/greek/1289.intf.txt`
- `transcriptions/greek/13.intf.txt`
- `transcriptions/greek/1302.intf.txt`
- `transcriptions/greek/131.intf.txt`
- `transcriptions/greek/1313.family-pi-mark.txt`
- `transcriptions/greek/1326.intf.txt`
- `transcriptions/greek/1337.intf.txt`
- `transcriptions/greek/1342.intf.txt`
- `transcriptions/greek/1346.family-pi-mark.txt`
- `transcriptions/greek/1354.family-pi-mark.txt`
- `transcriptions/greek/1396.intf.txt`
- `transcriptions/greek/1424.intf.txt`
- `transcriptions/greek/1446.intf.txt`
- `transcriptions/greek/1457.intf.txt`
- `transcriptions/greek/1495.intf.txt`
- `transcriptions/greek/1500.family-pi-mark.txt`
- `transcriptions/greek/1506.intf.txt`
- `transcriptions/greek/1515.intf.txt`
- `transcriptions/greek/152.intf.txt`
- `transcriptions/greek/1528.intf.txt`
- `transcriptions/greek/153.intf.txt`
- `transcriptions/greek/154.intf.txt`
- `transcriptions/greek/1542.intf.txt`
- `transcriptions/greek/1546.intf.txt`
- `transcriptions/greek/1555.intf.txt`
- `transcriptions/greek/157.intf.txt`
- `transcriptions/greek/1574.intf.txt`
- `transcriptions/greek/1579.intf.txt`
- `transcriptions/greek/1582.intf.txt`
- `transcriptions/greek/1593.intf.txt`
- `transcriptions/greek/16.intf.txt`
- `transcriptions/greek/1602.family-pi-mark.txt`
- `transcriptions/greek/1645.intf.txt`
- `transcriptions/greek/1654.intf.txt`
- `transcriptions/greek/1675.intf.txt`
- `transcriptions/greek/1689.intf.txt`
- `transcriptions/greek/1690.family-pi-mark.txt`
- `transcriptions/greek/174.intf.txt`
- `transcriptions/greek/176.intf.txt`
- `transcriptions/greek/178.family-pi-mark.txt`
- `transcriptions/greek/178.intf.txt`
- `transcriptions/greek/179.intf.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/1816.family-pi-mark.txt`
- `transcriptions/greek/184.intf.txt`
- `transcriptions/greek/191.intf.txt`
- `transcriptions/greek/205.intf.txt`
- `transcriptions/greek/209.intf.txt`
- `transcriptions/greek/2106.intf.txt`
- `transcriptions/greek/211.intf.txt`
- `transcriptions/greek/2148.intf.txt`
- `transcriptions/greek/2174.intf.txt`
- `transcriptions/greek/2193.intf.txt`
- `transcriptions/greek/2200.intf.txt`
- `transcriptions/greek/2206.intf.txt`
- `transcriptions/greek/222.intf.txt`
- `transcriptions/greek/2278.family-pi-mark.txt`
- `transcriptions/greek/229.family-pi-mark.txt`
- `transcriptions/greek/23.intf.txt`
- `transcriptions/greek/230.intf.txt`
- `transcriptions/greek/2404.family-pi-mark.txt`
- `transcriptions/greek/2411.family-pi-mark.txt`
- `transcriptions/greek/2411.intf.txt`
- `transcriptions/greek/2486.intf.txt`
- `transcriptions/greek/2487.intf.txt`
- `transcriptions/greek/2517.intf.txt`
- `transcriptions/greek/2537.intf.txt`
- `transcriptions/greek/2538.intf.txt`
- `transcriptions/greek/2542.intf.txt`
- `transcriptions/greek/26.intf.txt`
- `transcriptions/greek/2606.intf.txt`
- `transcriptions/greek/2607.intf.txt`
- `transcriptions/greek/261.intf.txt`
- `transcriptions/greek/2666.intf.txt`
- `transcriptions/greek/2680.intf.txt`
- `transcriptions/greek/2726.intf.txt`
- `transcriptions/greek/273.intf.txt`
- `transcriptions/greek/2737.intf.txt`
- `transcriptions/greek/2738.intf.txt`
- `transcriptions/greek/2744.intf.txt`
- `transcriptions/greek/2766.intf.txt`
- `transcriptions/greek/2786.intf.txt`
- `transcriptions/greek/28.intf.txt`
- `transcriptions/greek/2886.intf.txt`
- `transcriptions/greek/2900.intf.txt`
- `transcriptions/greek/3.intf.txt`
- `transcriptions/greek/304.intf.txt`
- `transcriptions/greek/33.intf.txt`
- `transcriptions/greek/346.intf.txt`
- `transcriptions/greek/348.intf.txt`
- `transcriptions/greek/349.intf.txt`
- `transcriptions/greek/35.intf.txt`
- `transcriptions/greek/351.intf.txt`
- `transcriptions/greek/372.intf.txt`
- `transcriptions/greek/377.intf.txt`
- `transcriptions/greek/382.intf.txt`
- `transcriptions/greek/389.family-pi-mark.txt`
- `transcriptions/greek/389.intf.txt`
- `transcriptions/greek/4.intf.txt`
- `transcriptions/greek/420.family-pi-mark.txt`
- `transcriptions/greek/427.intf.txt`
- `transcriptions/greek/472.intf.txt`
- `transcriptions/greek/489.family-pi-mark.txt`
- `transcriptions/greek/495.intf.txt`
- `transcriptions/greek/513.intf.txt`
- `transcriptions/greek/517.intf.txt`
- `transcriptions/greek/543.intf.txt`
- `transcriptions/greek/544.intf.txt`
- `transcriptions/greek/555.intf.txt`
- `transcriptions/greek/565.intf.txt`
- `transcriptions/greek/569.intf.txt`
- `transcriptions/greek/579.intf.txt`
- `transcriptions/greek/581.family-pi-mark.txt`
- `transcriptions/greek/590.intf.txt`
- `transcriptions/greek/595.intf.txt`
- `transcriptions/greek/61.intf.txt`
- `transcriptions/greek/652.family-pi-mark.txt`
- `transcriptions/greek/69.intf.txt`
- `transcriptions/greek/695.intf.txt`
- `transcriptions/greek/697.intf.txt`
- `transcriptions/greek/700.intf.txt`
- `transcriptions/greek/702.family-pi-mark.txt`
- `transcriptions/greek/706.intf.txt`
- `transcriptions/greek/713.intf.txt`
- `transcriptions/greek/716.intf.txt`
- `transcriptions/greek/719.intf.txt`
- `transcriptions/greek/728.intf.txt`
- `transcriptions/greek/732.intf.txt`
- `transcriptions/greek/733.intf.txt`
- `transcriptions/greek/740.intf.txt`
- `transcriptions/greek/752.intf.txt`
- `transcriptions/greek/766.intf.txt`
- `transcriptions/greek/780.intf.txt`
- `transcriptions/greek/788.intf.txt`
- `transcriptions/greek/79.intf.txt`
- `transcriptions/greek/791.intf.txt`
- `transcriptions/greek/792.intf.txt`
- `transcriptions/greek/796.family-pi-mark.txt`
- `transcriptions/greek/803.intf.txt`
- `transcriptions/greek/807.intf.txt`
- `transcriptions/greek/826.intf.txt`
- `transcriptions/greek/827.intf.txt`
- `transcriptions/greek/828.intf.txt`
- `transcriptions/greek/829.intf.txt`
- `transcriptions/greek/837.intf.txt`
- `transcriptions/greek/855.intf.txt`
- `transcriptions/greek/863.intf.txt`
- `transcriptions/greek/872.intf.txt`
- `transcriptions/greek/873.intf.txt`
- `transcriptions/greek/892.intf.txt`
- `transcriptions/greek/949.intf.txt`
- `transcriptions/greek/954.intf.txt`
- `transcriptions/greek/979.intf.txt`
- `transcriptions/greek/983.intf.txt`
- `transcriptions/greek/989.family-pi-mark.txt`
- `transcriptions/greek/992.family-pi-mark.txt`
- `transcriptions/greek/P137.cntr.txt`
- `transcriptions/greek/P137.intf.txt`
- `transcriptions/greek/P45.cntr.txt`
- `transcriptions/greek/P45.intf.txt`
- `transcriptions/greek/P84.intf.txt`
- `transcriptions/greek/P88.cntr.txt`
- `transcriptions/greek/P88.intf.txt`
