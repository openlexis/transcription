# Specification

This is the only specification in this repository.

## Goal

Produce the text of each book of the Bible as its original authors wrote it, in its original language (Hebrew and
Aramaic for the Old Testament, Greek for the New Testament), from all available manuscripts in that language that were
copied in or near the era of the original.

## Evidence

Use only the transcriptions of those manuscripts held in this repository and the documented facts about each manuscript
that its holders give, as recorded in `transcriptions/manuscripts.json`: its date as a range with its margin of error and
the method of dating (for example carbon dating, handwriting style or a colophon), where it was written, any scientific
dating, its condition, its corrections and errors, and how it agrees with the other manuscripts. Where a fact is not given,
treat it as unknown; never invent a value. Printed editions, translations into other languages, modern reconstructions and
images are not evidence for this work.

## Confidence

Estimate how likely each reading is to be the original with a sound statistical model built from that evidence. State the
estimate with its uncertainty, and let the uncertainty reflect how much evidence there is and what is unknown.

## What the output must contain

1. The compiled text of every book, every word with the manuscripts that read it.
2. The evidence for every reading: which manuscripts have it, which differ and how, and the facts about each manuscript that
   bore on the estimate.
3. The method: what statistical model was chosen, why, what it assumes, and how each kind of evidence entered it.
4. Who did the work: whatever model or program compiles identifies itself with its exact name and version (for a model,
   its exact model version; for a program, the program, its repository, the exact commit of its code and the runtime). It
   records only what it can itself report when it runs.
5. A statement that the work was done under this specification, with the SHA-256 hash of this file.

Each compilation is one output artifact holding the text, the evidence and the method, filed under
`outputs/<first 12 characters of this file's SHA-256>/<compiler>/`.
