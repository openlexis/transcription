# Matthew: rules of the compiled transcription

This file is the only instruction for this compilation. It says which files to read, how to turn them into one compiled
transcription, and who does the work. The output is saved in this folder, next to this file.

- **Name:** Matthew
- **Book:** Matt
- **Model:** Grok Bot
- **Language:** Greek
- **Origin year:** 100
- **Half-life:** 100
- **Late after:** 400
- **Undated year:** 1500

## How the model does the work

1. Read this file from top to bottom. Read nothing that is not listed under Inputs.
2. Run `bun run compile compilations/nt-01-matt`. It carries out rules 1 to 12 below exactly as written, in that
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

183 manuscripts, 208 transcriptions:

- `transcriptions/greek/01.cntr.txt`
- `transcriptions/greek/01.intf.txt`
- `transcriptions/greek/01.sinaiticus-project.txt`
- `transcriptions/greek/0102.intf.txt`
- `transcriptions/greek/0136.intf.txt`
- `transcriptions/greek/0160.cntr.txt`
- `transcriptions/greek/017.intf.txt`
- `transcriptions/greek/0170.intf.txt`
- `transcriptions/greek/0171.cntr.txt`
- `transcriptions/greek/019.intf.txt`
- `transcriptions/greek/02.cntr.txt`
- `transcriptions/greek/02.intf.txt`
- `transcriptions/greek/0204.intf.txt`
- `transcriptions/greek/0231.cntr.txt`
- `transcriptions/greek/0231.intf.txt`
- `transcriptions/greek/0233.intf.txt`
- `transcriptions/greek/024.intf.txt`
- `transcriptions/greek/0242.cntr.txt`
- `transcriptions/greek/0250.intf.txt`
- `transcriptions/greek/0281.intf.txt`
- `transcriptions/greek/03.cntr.txt`
- `transcriptions/greek/03.intf.txt`
- `transcriptions/greek/032.cntr.txt`
- `transcriptions/greek/032.intf.txt`
- `transcriptions/greek/0324.intf.txt`
- `transcriptions/greek/033.intf.txt`
- `transcriptions/greek/035.intf.txt`
- `transcriptions/greek/038.intf.txt`
- `transcriptions/greek/04.cntr.txt`
- `transcriptions/greek/04.intf.txt`
- `transcriptions/greek/041.intf.txt`
- `transcriptions/greek/042.intf.txt`
- `transcriptions/greek/043.intf.txt`
- `transcriptions/greek/05.cntr.txt`
- `transcriptions/greek/05.intf.txt`
- `transcriptions/greek/058.cntr.txt`
- `transcriptions/greek/071.intf.txt`
- `transcriptions/greek/073.intf.txt`
- `transcriptions/greek/085.intf.txt`
- `transcriptions/greek/1.intf.txt`
- `transcriptions/greek/1043.intf.txt`
- `transcriptions/greek/1047.intf.txt`
- `transcriptions/greek/1063.intf.txt`
- `transcriptions/greek/1093.intf.txt`
- `transcriptions/greek/1110.intf.txt`
- `transcriptions/greek/1129.intf.txt`
- `transcriptions/greek/118.intf.txt`
- `transcriptions/greek/1190.intf.txt`
- `transcriptions/greek/1192.intf.txt`
- `transcriptions/greek/1194.intf.txt`
- `transcriptions/greek/124.intf.txt`
- `transcriptions/greek/1241.intf.txt`
- `transcriptions/greek/1273.intf.txt`
- `transcriptions/greek/1279.intf.txt`
- `transcriptions/greek/1289.intf.txt`
- `transcriptions/greek/1295.intf.txt`
- `transcriptions/greek/13.intf.txt`
- `transcriptions/greek/130.intf.txt`
- `transcriptions/greek/1306.intf.txt`
- `transcriptions/greek/1342.intf.txt`
- `transcriptions/greek/1372.intf.txt`
- `transcriptions/greek/1414.intf.txt`
- `transcriptions/greek/1421.intf.txt`
- `transcriptions/greek/1424.intf.txt`
- `transcriptions/greek/1446.intf.txt`
- `transcriptions/greek/1451.intf.txt`
- `transcriptions/greek/1455.intf.txt`
- `transcriptions/greek/150.intf.txt`
- `transcriptions/greek/1502.intf.txt`
- `transcriptions/greek/1515.intf.txt`
- `transcriptions/greek/1528.intf.txt`
- `transcriptions/greek/1534.intf.txt`
- `transcriptions/greek/157.intf.txt`
- `transcriptions/greek/1574.intf.txt`
- `transcriptions/greek/1579.intf.txt`
- `transcriptions/greek/1582.intf.txt`
- `transcriptions/greek/16.intf.txt`
- `transcriptions/greek/1604.intf.txt`
- `transcriptions/greek/163.intf.txt`
- `transcriptions/greek/1661.intf.txt`
- `transcriptions/greek/1675.intf.txt`
- `transcriptions/greek/1689.intf.txt`
- `transcriptions/greek/174.intf.txt`
- `transcriptions/greek/1780.intf.txt`
- `transcriptions/greek/18.intf.txt`
- `transcriptions/greek/1823.intf.txt`
- `transcriptions/greek/184.intf.txt`
- `transcriptions/greek/191.intf.txt`
- `transcriptions/greek/205.intf.txt`
- `transcriptions/greek/209.intf.txt`
- `transcriptions/greek/2188.intf.txt`
- `transcriptions/greek/2190.intf.txt`
- `transcriptions/greek/2193.intf.txt`
- `transcriptions/greek/22.intf.txt`
- `transcriptions/greek/222.intf.txt`
- `transcriptions/greek/230.intf.txt`
- `transcriptions/greek/233.intf.txt`
- `transcriptions/greek/2522.intf.txt`
- `transcriptions/greek/2551.intf.txt`
- `transcriptions/greek/2583.intf.txt`
- `transcriptions/greek/2586.intf.txt`
- `transcriptions/greek/2589.intf.txt`
- `transcriptions/greek/2597.intf.txt`
- `transcriptions/greek/2607.intf.txt`
- `transcriptions/greek/2676.intf.txt`
- `transcriptions/greek/2680.intf.txt`
- `transcriptions/greek/2726.intf.txt`
- `transcriptions/greek/273.intf.txt`
- `transcriptions/greek/2737.intf.txt`
- `transcriptions/greek/2756.intf.txt`
- `transcriptions/greek/2766.intf.txt`
- `transcriptions/greek/2784.intf.txt`
- `transcriptions/greek/2786.intf.txt`
- `transcriptions/greek/279.intf.txt`
- `transcriptions/greek/2831.intf.txt`
- `transcriptions/greek/2886.intf.txt`
- `transcriptions/greek/295.intf.txt`
- `transcriptions/greek/310.intf.txt`
- `transcriptions/greek/33.intf.txt`
- `transcriptions/greek/333.intf.txt`
- `transcriptions/greek/335.intf.txt`
- `transcriptions/greek/346.intf.txt`
- `transcriptions/greek/348.intf.txt`
- `transcriptions/greek/35.intf.txt`
- `transcriptions/greek/362.intf.txt`
- `transcriptions/greek/372.intf.txt`
- `transcriptions/greek/38.intf.txt`
- `transcriptions/greek/4.intf.txt`
- `transcriptions/greek/423.intf.txt`
- `transcriptions/greek/509.intf.txt`
- `transcriptions/greek/517.intf.txt`
- `transcriptions/greek/543.intf.txt`
- `transcriptions/greek/544.intf.txt`
- `transcriptions/greek/555.intf.txt`
- `transcriptions/greek/565.intf.txt`
- `transcriptions/greek/579.intf.txt`
- `transcriptions/greek/59.intf.txt`
- `transcriptions/greek/61.intf.txt`
- `transcriptions/greek/67.intf.txt`
- `transcriptions/greek/687.intf.txt`
- `transcriptions/greek/69.intf.txt`
- `transcriptions/greek/700.intf.txt`
- `transcriptions/greek/709.intf.txt`
- `transcriptions/greek/723.intf.txt`
- `transcriptions/greek/735.intf.txt`
- `transcriptions/greek/738.intf.txt`
- `transcriptions/greek/740.intf.txt`
- `transcriptions/greek/749.intf.txt`
- `transcriptions/greek/751.intf.txt`
- `transcriptions/greek/788.intf.txt`
- `transcriptions/greek/79.intf.txt`
- `transcriptions/greek/792.intf.txt`
- `transcriptions/greek/807.intf.txt`
- `transcriptions/greek/822.intf.txt`
- `transcriptions/greek/826.intf.txt`
- `transcriptions/greek/828.intf.txt`
- `transcriptions/greek/829.intf.txt`
- `transcriptions/greek/837.intf.txt`
- `transcriptions/greek/842.intf.txt`
- `transcriptions/greek/863.intf.txt`
- `transcriptions/greek/866.intf.txt`
- `transcriptions/greek/892.intf.txt`
- `transcriptions/greek/895.intf.txt`
- `transcriptions/greek/930.intf.txt`
- `transcriptions/greek/954.intf.txt`
- `transcriptions/greek/976.intf.txt`
- `transcriptions/greek/983.intf.txt`
- `transcriptions/greek/P1.cntr.txt`
- `transcriptions/greek/P1.intf.txt`
- `transcriptions/greek/P101.cntr.txt`
- `transcriptions/greek/P101.intf.txt`
- `transcriptions/greek/P102.cntr.txt`
- `transcriptions/greek/P102.intf.txt`
- `transcriptions/greek/P103.intf.txt`
- `transcriptions/greek/P104.cntr.txt`
- `transcriptions/greek/P104.intf.txt`
- `transcriptions/greek/P105.intf.txt`
- `transcriptions/greek/P110.cntr.txt`
- `transcriptions/greek/P110.intf.txt`
- `transcriptions/greek/P19.cntr.txt`
- `transcriptions/greek/P19.intf.txt`
- `transcriptions/greek/P21.cntr.txt`
- `transcriptions/greek/P21.intf.txt`
- `transcriptions/greek/P25.cntr.txt`
- `transcriptions/greek/P25.intf.txt`
- `transcriptions/greek/P35.cntr.txt`
- `transcriptions/greek/P35.intf.txt`
- `transcriptions/greek/P37.cntr.txt`
- `transcriptions/greek/P37.intf.txt`
- `transcriptions/greek/P44.intf.txt`
- `transcriptions/greek/P45.cntr.txt`
- `transcriptions/greek/P45.intf.txt`
- `transcriptions/greek/P53.cntr.txt`
- `transcriptions/greek/P53.intf.txt`
- `transcriptions/greek/P62.intf.txt`
- `transcriptions/greek/P64.cntr.txt`
- `transcriptions/greek/P64.intf.txt`
- `transcriptions/greek/P70.cntr.txt`
- `transcriptions/greek/P70.intf.txt`
- `transcriptions/greek/P71.cntr.txt`
- `transcriptions/greek/P71.intf.txt`
- `transcriptions/greek/P73.intf.txt`
- `transcriptions/greek/P77.cntr.txt`
- `transcriptions/greek/P77.intf.txt`
- `transcriptions/greek/P83.intf.txt`
- `transcriptions/greek/P86.cntr.txt`
- `transcriptions/greek/P86.intf.txt`
- `transcriptions/greek/P96.intf.txt`
