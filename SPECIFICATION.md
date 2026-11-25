# Specification

This is the only specification in this repository. Its identifier is the ULID
01M88AX3YW2HWVPGHTREFJS181.

A [ULID](https://github.com/ulid/spec) is a 26-character identifier. The first characters mark the time it was
made, so folders named with ULIDs sort from earlier to later; the rest are random, so two will not be the same. It uses
digits and letters, leaving out I, L, O and U so they are not mistaken for one another.

## Goal

Produce the text of each book of the Bible as its original authors wrote it, in its original language, from all
available manuscripts in that language that were copied in or near the era of the original. Each book's original
language is the one it was written in, as recorded for that book in `transcriptions/books.json`.

## Evidence

Use only the transcriptions of those manuscripts held in this repository and the documented facts about each manuscript
that its holders give, as recorded in `transcriptions/manuscripts.json`: its date as a range with its margin of error and
the method of dating (for example carbon dating, handwriting style or a colophon), where it was written, any scientific
dating, its condition, its corrections and errors, and how it agrees with the other manuscripts. Where a fact is not given,
treat it as unknown; never invent a value. Printed editions, translations into other languages, modern reconstructions and
images are not evidence for this work.

The file `transcriptions/manuscripts.json` is part of this specification: it is the list of manuscripts, the facts
recorded about them, and the transcription files this work may read. The books themselves are listed in
`transcriptions/books.json`.

## The transcription files

Each transcription is a file in the folder `transcriptions/`, with no subfolders. Files are named
`{manuscript}.{holder}.xml`. The manuscript is its usual identifier (for example 01, P1, L, 4Q2). The holder is the short
name given in `transcriptions/manuscripts.json` (for example intf, uxlc). If one manuscript and one holder give more than
one file, a further part is added from the holder's own name for the file:
`{manuscript}.{holder}.{part}.xml` (for example `L.uxlc.Genesis.xml`).

Where a holder publishes TEI XML, that file is stored as they published it, unchanged. Where a holder publishes XML that
is not TEI, that XML is stored unchanged, and the inventory says what format it is. Where a holder publishes no XML, the
inventory says so, and the file is a TEI P5 document, which is the closest scholarly standard for a transcription of a
single manuscript.

## When the manuscripts disagree

The surviving manuscripts do not always have the same words. They are also not all equally close to the original: they
were copied at different times, some nearer the place of origin than others, and they differ in condition and in how often
they slip. A sound account of the original text therefore cannot be a simple majority of manuscripts. It needs a
statistical model: a stated way of using the documented evidence to estimate, for each reading, how likely it is to be
what the author wrote, and to give that estimate with an uncertainty range. A reading is the words one manuscript has at
one point, or the absence of words there. Thin or uneven evidence, and unknown facts, should produce a wide range. Many
early independent copies that agree should produce a narrow one. Unknown facts stay unknown and are never filled in; they
widen the range. This specification does not prescribe the model. The output must use one, and must describe it.

## What the output must contain

The output is the compiled text of every book, together with the evidence and the method, as follows.

By the compiled text is meant the words chosen as the original, in the original language, book by book, line by line. A
line is the numbered unit of a book, written as chapter:line. For every word of that text, the output lists which
manuscripts have that word, which have a different word (and what they have), and which are lost or unread at that point.

At every place where the manuscripts do not all agree — a place being one stretch of a line where their readings differ —
the output states each reading, which manuscripts have it, and how the readings differ.

For each reading it states the model's estimate of how likely that reading is to be the original, and an uncertainty range
for that estimate. It also states the documented facts used for each manuscript (its date range and how it was dated, and
the other facts listed under Evidence) and which of those facts were unknown.

It describes, in plain words, the statistical model that was used: what it is, why it was chosen, what it assumes, and how
it uses each kind of evidence listed under Evidence.

The model that made the non-deterministic judgments — the choice of readings and the estimates — identifies itself by its
exact name and version. A program that only copies, formats or repeats a fixed procedure is not required to identify
itself.

It states that the work was done under this specification, and gives this specification's ULID.

## Output format

The output is written in TEI P5 XML, the standard for encoding a text and the places where its witnesses differ. See the
[TEI Guidelines, chapter 13, Critical Apparatus](https://tei-c.org/release/doc/tei-p5-doc/en/html/TC.html). Each place of
disagreement is an `app`. The reading printed as the compiled text is the `lem`. Every reading, including that one, is a
`rdg` with `wit` listing the manuscripts that have it. The manuscripts themselves are listed in `listWit`.

The estimate for each reading is recorded with the `certainty` element in
[chapter 22](https://tei-c.org/release/doc/tei-p5-doc/en/html/CE.html): its `degree` is a probability from 0 to 1. The
Guidelines do not define a field for an uncertainty range, so that range is stated in a note on the same reading.

The description of the model, the model's name and version, this specification's ULID and the compilation's ULID go in
the TEI header.

Each compilation is one output and has its own ULID. It is filed under
`outputs/<this specification's ULID>/<the compilation's ULID>/`. Both names are the full ULID, so the folders sort by the
time each was made. That compilation folder holds a TEI file for each book and a single record file. The record file
lists the book files, states the model's name and version, states the compilation's ULID, and states that the work was
done under this specification, giving this specification's ULID.
