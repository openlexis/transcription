#!/usr/bin/env python3
"""Converts the Hebrew running text of MS Nablus 6, as printed by Tal and Florentin (2024) and extracted by the CACCHT
Samaritan Pentateuch project (DT-UCPH/sp, scripts/tal_florentin/results/tf_verses.json), to TEI P5.

Usage: python3 scripts/holders/nablus6.py <tf_verses.json>

The edition (Introduction, section 4.1.2.2) fills the manuscript's lost beginning from other manuscripts: Gen 1:1-11 from
St Petersburg P. 177, and Gen 1:12 to 3:24 from Cambridge University Library Add 714. Those lines are wrapped in
<supplied reason="lost"> naming that source. Leaves of MS Nablus 6 now held elsewhere (Oxford, Turin, London, Princeton)
are the manuscript's own text. The edition says it filled a few small lacunae from Add 714 and the Abisha scroll without
marking them; those cannot be marked here.
"""
import json, os, sys
from xml.sax.saxutils import escape

d = json.load(open(sys.argv[1], encoding="utf8"))
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "src", "tal-florentin-sp")
os.makedirs(OUT, exist_ok=True)
OSIS = {"Genesis": "Gen", "Exodus": "Exod", "Leviticus": "Lev", "Numbers": "Num", "Deuteronomy": "Deut"}
LIC = "CC BY-NC 4.0 (the edition's copyright page and the dataset's README and LICENSE)"
SRC = "https://github.com/DT-UCPH/sp/blob/e8a120f2e92b6558fd39bbe72f830ded871a0a47/scripts/tal_florentin/results/tf_verses.json"

def supplied_source(book, ch, vs):
    if book != "Gen": return None
    if ch == 1 and vs <= 11: return "another manuscript, St Petersburg P. 177 (the edition's Introduction, section 4.1.2.2)"
    if ch <= 3: return "another manuscript, Cambridge University Library Add 714, copied 1219 CE (the edition's Introduction, section 4.1.2.2)"
    return None

rows, lines, words, slines, swords, books = [], 0, 0, 0, 0, []
for key, ws in d.items():
    name, ref = key.rsplit(" ", 1)
    book = OSIS[name]; ch, vs = map(int, ref.split(":"))
    if book not in books: books.append(book)
    inner = "".join(f"<w>{escape(w)}</w>" for w in ws)
    src = supplied_source(book, ch, vs)
    if src:
        slines += 1; swords += len(ws)
        rows.append(f'<ab n="{book} {ch}:{vs}"><supplied reason="lost" source="{escape(src)}">{inner}</supplied></ab>')
    else:
        lines += 1; words += len(ws)
        rows.append(f'<ab n="{book} {ch}:{vs}">{inner}</ab>')

head = f"""<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
<fileDesc>
<titleStmt><title>Samaritan Pentateuch, MS Nablus 6</title></titleStmt>
<publicationStmt><p>{escape(LIC)}</p><p>The text is the Hebrew running text of Moshe Florentin and Abraham Tal, The Samaritan Pentateuch: An English Translation with a Parallel Annotated Hebrew Text (Open Book Publishers, 2024, https://doi.org/10.11647/OBP.0415), which presents MS Nablus 6 diplomatically, as extracted by the CACCHT Samaritan Pentateuch project. The holder publishes it as JSON, not XML; this file is a TEI P5 transcription made from that data.</p><p>Text the edition takes from other manuscripts for the lost beginning (Gen 1:1 to 3:24) is marked with supplied (reason="lost"), naming the edition's stated source. The edition says it filled a few small lacunae from Cambridge Add 714 and the Abisha scroll without marking them; they are not marked here either.</p></publicationStmt>
<sourceDesc><p>{SRC}</p></sourceDesc>
</fileDesc>
</teiHeader>
<text xml:lang="hbo">
<body>
"""
open(os.path.join(OUT, "Nablus6.xml"), "w", encoding="utf8").write(head + "\n".join(rows) + "\n</body>\n</text>\n</TEI>\n")
print(json.dumps({"books": books, "lines": lines, "words": words, "suppliedLines": slines, "suppliedWords": swords}))
