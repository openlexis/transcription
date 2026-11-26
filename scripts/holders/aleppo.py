#!/usr/bin/env python3
"""Converts the Aleppo Codex Text-Fabric dataset (github.com/MartijnNaaijer/aleppo, tf/1.0) to TEI P5, one file per book.

Usage: python3 scripts/holders/aleppo.py <path to a clone of the aleppo repository> <commit>

Only lines on a surviving page of the codex (feature aleppo_extant = 1) are the codex's own text. Lines in lost parts,
where the edition gives the text of closely related Tiberian manuscripts, are wrapped in <supplied reason="lost">
naming that source; lines known from an old photograph name the photograph. Words are the written words (ketiv),
split at spaces and maqaf, as in the Leningrad Codex reader.
"""
import json, os, re, sys
from xml.sax.saxutils import escape
from tf.fabric import Fabric

repo, commit = sys.argv[1], sys.argv[2]
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "src", "aleppo")
os.makedirs(OUT, exist_ok=True)

# BHSA Latin book names -> OSIS ids and UXLC file names (scripts/lib/text.ts HEB_BOOKS)
BOOKS = [("Genesis","Gen","Genesis"),("Exodus","Exod","Exodus"),("Leviticus","Lev","Leviticus"),("Numeri","Num","Numbers"),
 ("Deuteronomium","Deut","Deuteronomy"),("Josua","Josh","Joshua"),("Judices","Judg","Judges"),("Samuel_I","1Sam","Samuel_1"),
 ("Samuel_II","2Sam","Samuel_2"),("Reges_I","1Kgs","Kings_1"),("Reges_II","2Kgs","Kings_2"),("Jesaia","Isa","Isaiah"),
 ("Jeremia","Jer","Jeremiah"),("Ezechiel","Ezek","Ezekiel"),("Hosea","Hos","Hosea"),("Joel","Joel","Joel"),("Amos","Amos","Amos"),
 ("Obadia","Obad","Obadiah"),("Jona","Jonah","Jonah"),("Micha","Mic","Micah"),("Nahum","Nah","Nahum"),("Habakuk","Hab","Habakkuk"),
 ("Zephania","Zeph","Zephaniah"),("Haggai","Hag","Haggai"),("Sacharia","Zech","Zechariah"),("Maleachi","Mal","Malachi"),
 ("Chronica_I","1Chr","Chronicles_1"),("Chronica_II","2Chr","Chronicles_2"),("Psalmi","Ps","Psalms"),("Iob","Job","Job"),
 ("Proverbia","Prov","Proverbs"),("Ruth","Ruth","Ruth"),("Canticum","Song","Song_of_Songs"),("Ecclesiastes","Eccl","Ecclesiastes"),
 ("Threni","Lam","Lamentations"),("Esther","Esth","Esther"),("Daniel","Dan","Daniel"),("Esra","Ezra","Ezra"),("Nehemia","Neh","Nehemiah")]

TF = Fabric(locations=os.path.join(repo, "tf", "1.0"), silent="deep")
A = TF.load("otype book chapter verse g_word_utf8 trailer_utf8 aleppo_extant aleppo_page aleppo_photo", silent="deep")
F, L, T = A.F, A.L, A.T

LOST_SRC = "the edition's text from closely related Tiberian manuscripts, where the codex is lost (the dataset's feature aleppo_extant)"
LICENSE = "CC BY-SA 4.0 (the dataset's README and feature headers; attribution: \"מקרא על פי המסורה\", he.wikisource.org)"
SRC_URL = f"https://github.com/MartijnNaaijer/aleppo/tree/{commit}"

def graphic_words(verse):
    """Join BHSA segments into written words; split at whitespace and maqaf."""
    out, cur = [], ""
    for w in L.d(verse, "word"):
        cur += F.g_word_utf8.v(w) or ""
        tr = F.trailer_utf8.v(w) or ""
        if tr and re.search(r"[\s\u05BE\u05C3\u05C0]|[ספ]", tr):
            out.append(cur); cur = ""
    if cur: out.append(cur)
    return [x for x in out if re.search(r"[\u05D0-\u05EA]", x)]

BOOK_NODE = {F.book.v(b): b for b in F.otype.s("book")}
stats = {}
for latin, osis, fname in BOOKS:
    bnode = BOOK_NODE[latin]
    rows, extant_lines, lost_lines, words_extant, words_lost, last_page = [], 0, 0, 0, 0, None
    for v in L.d(bnode, "verse"):
        ch, vs = F.chapter.v(L.u(v, "chapter")[0]), F.verse.v(v)
        ref = f"{osis} {ch}:{vs}"
        ws = graphic_words(v)
        inner = "".join(f"<w>{escape(x)}</w>" for x in ws)
        if F.aleppo_extant.v(v):
            extant_lines += 1; words_extant += len(ws)
            for page in (F.aleppo_page.v(v) or "").split():
                if page != last_page:
                    rows.append(f'<pb n="{escape(page)}"/>'); last_page = page
            rows.append(f'<ab n="{ref}">{inner}</ab>')
        else:
            lost_lines += 1; words_lost += len(ws)
            photo = F.aleppo_photo.v(v)
            src = f"lost page known from an old photograph: {photo}" if photo else LOST_SRC
            rows.append(f'<ab n="{ref}"><supplied reason="lost" source="{escape(src, {chr(34): "&quot;"})}">{inner}</supplied></ab>')
    head = f"""<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader>
<fileDesc>
<titleStmt><title>Aleppo Codex, {escape(fname.replace('_', ' '))}</title></titleStmt>
<publicationStmt><p>{escape(LICENSE)}</p><p>The holder publishes this transcription as Text-Fabric data, not XML. This file is a TEI P5 transcription made from that data, which is the closest scholarly standard for a transcription of a single manuscript.</p><p>Only lines on a surviving page of the codex are the codex's own text; pb gives the codex page (leaf:side, side a is the recto) from the dataset's feature aleppo_page. Text that the edition fills in for lost pages is marked with supplied (reason="lost"), naming the edition's stated source.</p></publicationStmt>
<sourceDesc><p>{SRC_URL}</p></sourceDesc>
</fileDesc>
</teiHeader>
<text xml:lang="hbo">
<body>
"""
    path = os.path.join(OUT, f"A.{fname}.xml")
    with open(path, "w", encoding="utf8") as f:
        f.write(head + "\n".join(rows) + "\n</body>\n</text>\n</TEI>\n")
    stats[osis] = {"file": f"src/aleppo/A.{fname}.xml", "extantLines": extant_lines, "lostLines": lost_lines, "extantWords": words_extant, "lostWords": words_lost}

json.dump(stats, open(os.environ.get("STATS", "/dev/null"), "w"), indent=1)
print(json.dumps({k: (v["extantLines"], v["lostLines"]) for k, v in stats.items()}))
