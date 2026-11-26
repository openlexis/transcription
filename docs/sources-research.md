# Source research, book by book

This file records, for every book, the original-language transcriptions found, which were already in `src/`, which were added, and what could not be obtained. Counts are the number of source items in the book's newest set (`src/sets/latest.json`), before and after this round (an item held by two institutions counts twice, as in the sets).

Research date: 2026-11-25.

## Added in this round

| Holder folder | Manuscript | Files | Books | License | Source |
|---|---|---|---|---|---|
| `src/aleppo/` | Aleppo Codex (A), about 930 | 39 TEI files, `A.<Book>.xml` (converted from Text-Fabric) | all 39 OT books; surviving pages in 27 | CC BY-SA 4.0 | https://github.com/MartijnNaaijer/aleppo (commit db38ddc) |
| `src/tal-florentin-sp/` | Samaritan Pentateuch MS Nablus 6, 1204 | `Nablus6.xml` (converted from JSON) | Gen to Deut | CC BY-NC 4.0 | https://github.com/DT-UCPH/sp, `scripts/tal_florentin/results/tf_verses.json` (commit e8a120f), from Florentin and Tal 2024, https://doi.org/10.11647/OBP.0415 |
| `src/itsee-ga655/` | Minuscule 655, 11th/12th century | 4 TEI files, unchanged | Matt, Mark, Luke, John | CC BY-NC-SA | https://doi.org/10.25500/edata.bham.00001367 |
| `src/zacynthius/` (added to the existing catalog) | Lectionary 299 (upper text of Codex Zacynthius), about 1180 | `L299.xml`, unchanged | Matt, Mark, Luke, John | CC BY 4.0 | https://doi.org/10.25500/edata.bham.00000430 |
| `src/intf/` (added to the existing catalog) | 0296, 238, 1278, L23, L587, L809, L1178, L1825, L2010 | 9 TEI files, unchanged | 1 John, Mark, Acts | CC BY 4.0 | NTVMR `transcript/get` (published transcriptions) |

## Per book

| Book | Before | After | Added | Notes |
|---|---|---|---|---|
| Genesis | 28 | 30 | Aleppo Codex (A) (`aleppo:A`); Samaritan Pentateuch MS Nablus 6 (`tal-florentin-sp:Nablus6`) | Aleppo: no surviving pages; all 1533 lines are filled in by the edition (marked supplied). Nablus 6: Gen 1:1 to 3:24 is from other manuscripts in the edition (marked supplied) |
| Exodus | 42 | 44 | Aleppo Codex (A) (`aleppo:A`); Samaritan Pentateuch MS Nablus 6 (`tal-florentin-sp:Nablus6`) | Aleppo: 3 lines on surviving pages, 1206 lines filled in by the edition (marked supplied) |
| Leviticus | 19 | 21 | Aleppo Codex (A) (`aleppo:A`); Samaritan Pentateuch MS Nablus 6 (`tal-florentin-sp:Nablus6`) | Aleppo: no surviving pages; all 859 lines are filled in by the edition (marked supplied) |
| Numbers | 13 | 15 | Aleppo Codex (A) (`aleppo:A`); Samaritan Pentateuch MS Nablus 6 (`tal-florentin-sp:Nablus6`) | Aleppo: no surviving pages; all 1288 lines are filled in by the edition (marked supplied) |
| Deuteronomy | 65 | 67 | Aleppo Codex (A) (`aleppo:A`); Samaritan Pentateuch MS Nablus 6 (`tal-florentin-sp:Nablus6`) | Aleppo: 224 lines on surviving pages, 731 lines filled in by the edition (marked supplied) |
| Joshua | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 656 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| Judges | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 618 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| 1 Samuel | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 811 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| 2 Samuel | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 695 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| 1 Kings | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 817 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| 2 Kings | 2 | 3 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 600 lines on surviving pages, 119 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below) |
| Isaiah | 23 | 24 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 1291 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Jeremiah | 7 | 8 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 1278 lines on surviving pages, 86 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Ezekiel | 8 | 9 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 1273 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Hosea | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 197 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Joel | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 73 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Amos | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 129 lines on surviving pages, 17 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Obadiah | 3 | 4 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 21 lines are filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Jonah | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 48 lines are filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Micah | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 50 lines on surviving pages, 55 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Nahum | 3 | 4 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 47 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Habakkuk | 3 | 4 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 56 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Zephaniah | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 53 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Haggai | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 38 lines are filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Zechariah | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 74 lines on surviving pages, 137 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| Malachi | 3 | 4 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 55 lines on surviving pages, 0 lines filled in by the edition (marked supplied). Cairo Codex of the Prophets: page scans only (see below). Babylonian Codex of the Prophets (St Petersburg, Evr. I B 3): no digital text found |
| 1 Chronicles | 1 | 2 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 943 lines on surviving pages, 0 lines filled in by the edition (marked supplied) |
| 2 Chronicles | 2 | 3 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 822 lines on surviving pages, 0 lines filled in by the edition (marked supplied) |
| Psalms | 39 | 40 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 2357 lines on surviving pages, 170 lines filled in by the edition (marked supplied) |
| Job | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 1070 lines on surviving pages, 0 lines filled in by the edition (marked supplied) |
| Proverbs | 4 | 5 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 915 lines on surviving pages, 0 lines filled in by the edition (marked supplied) |
| Ruth | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 85 lines on surviving pages, 0 lines filled in by the edition (marked supplied) |
| Song of Songs | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: 45 lines on surviving pages, 72 lines filled in by the edition (marked supplied) |
| Ecclesiastes | 3 | 4 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 222 lines are filled in by the edition (marked supplied) |
| Lamentations | 5 | 6 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 154 lines are filled in by the edition (marked supplied) |
| Esther | 1 | 2 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 167 lines are filled in by the edition (marked supplied) |
| Daniel | 9 | 10 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 357 lines are filled in by the edition (marked supplied) |
| Ezra | 2 | 3 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 280 lines are filled in by the edition (marked supplied) |
| Nehemiah | 1 | 2 | Aleppo Codex (A) (`aleppo:A`) | Aleppo: no surviving pages; all 405 lines are filled in by the edition (marked supplied) |
| Matthew | 328 | 330 | Minuscule 655 (`itsee-ga655:655`); Lectionary 299 (`zacynthius:L299`) |  |
| Mark | 380 | 384 | INTF 1278 (`intf:1278`); INTF 238 (`intf:238`); Minuscule 655 (`itsee-ga655:655`); Lectionary 299 (`zacynthius:L299`) |  |
| Luke | 115 | 117 | Minuscule 655 (`itsee-ga655:655`); Lectionary 299 (`zacynthius:L299`) |  |
| John | 457 | 459 | Minuscule 655 (`itsee-ga655:655`); Lectionary 299 (`zacynthius:L299`) |  |
| Acts | 422 | 428 | INTF L1178 (`intf:L1178`); INTF L1825 (`intf:L1825`); INTF L2010 (`intf:L2010`); INTF L23 (`intf:L23`); INTF L587 (`intf:L587`); INTF L809 (`intf:L809`) |  |
| Romans | 588 | 588 | none found |  |
| 1 Corinthians | 67 | 67 | none found |  |
| 2 Corinthians | 58 | 58 | none found |  |
| Galatians | 662 | 662 | none found |  |
| Ephesians | 579 | 579 | none found |  |
| Philippians | 48 | 48 | none found |  |
| Colossians | 69 | 69 | none found |  |
| 1 Thessalonians | 185 | 185 | none found |  |
| 2 Thessalonians | 508 | 508 | none found |  |
| 1 Timothy | 64 | 64 | none found |  |
| 2 Timothy | 35 | 35 | none found |  |
| Titus | 45 | 45 | none found |  |
| Philemon | 43 | 43 | none found |  |
| Hebrews | 80 | 80 | none found |  |
| James | 48 | 48 | none found |  |
| 1 Peter | 43 | 43 | none found |  |
| 2 Peter | 44 | 44 | none found |  |
| 1 John | 92 | 93 | INTF 0296 (`intf:0296`) |  |
| 2 John | 87 | 87 | none found |  |
| 3 John | 149 | 149 | none found |  |
| Jude | 383 | 383 | none found |  |
| Revelation | 122 | 122 | none found |  |

## Checked and not added, with reasons

- **Cairo Codex of the Prophets** (Joshua to Malachi). The CSIC site (https://biblioteca.cchs.csic.es/Codice-Profetas-Cairo/en/) offers no text, only the printed 1979 to 1988 edition of Pérez Castro and team as page scans on SIMURG (one PDF per volume; the text layer is unusable Latin-script OCR). Digital.CSIC lists each volume only as `accesoRestringido.pdf` (restricted access) and blocked automated access. A test with Tesseract Hebrew OCR on a Jeremiah page misread roughly a third of the words (for example לְהוָה for יְהוָה), which would show up as false variants, so no Cairo text was added. The scans of volumes I to VII are saved outside the repository. Licenses: site texts and the edition CC BY-ND 4.0; site CC BY-NC-SA 4.0; photographs © CSIC.
- **Babylonian (St Petersburg) Codex of the Prophets, Evr. I B 3**. No digital transcription found. IHBMR (https://ihbmr.com/manuscripts/P) gives only folio ranges and images; Strack's 1876 edition is a facsimile (images).
- **Cairo Genizah** (Friedberg Genizah Project, Cambridge Taylor-Schechter). The Friedberg portal needs an account; Cambridge Digital Library gives images and catalog descriptions, not transcriptions of the biblical fragments. Nothing added.
- **Nash Papyrus** (Cambridge, MS Or. 233). Cambridge Digital Library has images and a catalog record but no transcription. Nothing added.
- **Masada, Naḥal Ḥever, Murabba'at, Wadi Sdeir**. Already present in `src/etcbc-dss/` (Mas1 to Mas1f, Mur1 to Mur4, Mur88 (the Minor Prophets scroll), Murx, XHev/Se 2, 3, 5, Sdeir1). 8HevXIIgr is Greek and is skipped.
- **Other Dead Sea Scroll sources**. No openly downloadable transcription beyond the ETCBC/CACCHT data was found.
- **near-Aleppo (bdenckla, MAM)**. This is the same edition (מקרא על פי המסורה) that the Aleppo dataset is made from, so it is covered by `src/aleppo/`.
- **Other Hebrew codices** (Damascus Crown, Sassoon Codex, Washington Pentateuch and others in IHBMR). Images and folio ranges only.
- **INTF NTVMR**. The catalog lists 686 Greek documents with transcriptions; 660 were already present and 9 were added. 14 have no published transcription, only working copies by individual users or projects (P129, P130, 07, 045, 0171, 180, 236, 1210, 1349, 2372, 2713, 2793, 2860, and the published file for 1777 has only a heading). 110, 309 and 606 are published but name their book only as `XXX`, so their lines cannot be placed without guessing.
- **CNTR**. The repository has no commits since the pinned one (4e743a4).
- **Codex Sinaiticus, Vaticanus, Alexandrinus, Bezae, Washingtonianus, P45, P46, P66, P75** and other early papyri were already present (INTF, CNTR, IGNTP, Codex Sinaiticus Project).
- **ITSEE eData**. Other transcription sets there are Latin or Coptic (not original language), or already present.
