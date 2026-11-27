# Method of this compiler

This is the statistical method implemented in `scripts/compile.ts` for specifications under `specifications/<specification-id>/` (such as `specifications/01M8FFNQR7EFXPE9T897SEYWXC.yaml`; older ones are single files such as `specifications/01M88AX3YW2HWVPGHTREFJS181.yaml`). The specification does not prescribe a single model; another compiler may choose differently. Each compilation records its full method description in `manifest.json` and every book's `<teiHeader>`.

## Words used here

- **Manuscript:** a surviving handwritten copy, whole or in pieces.
- **Transcription:** the letters of one manuscript, typed. Only the first hand (the original copyist) is read.
- **Line:** a numbered unit of a book, written chapter:line.
- **Filled-in text:** words that an edition prints for a part of a manuscript that is lost, taken from some other source (another
  manuscript, an old photograph, or the editor's own choice). It is not the manuscript's own text.
- **Reading:** what one manuscript has at one point of a line: a word, several words, or nothing.
- **Place:** a stretch of a line where the manuscripts do not all have the same reading.
- **Reliability:** the chance that a manuscript has the original reading at a point where we can check it.
- **Probability:** how likely a reading is to be what the author wrote, given the evidence and this model.
- **Uncertainty range:** the span within which the probability lies in 90 of 100 runs of the model with the
  reliabilities drawn from what the evidence allows (the 5th to the 95th percentile).

## 1. Which transcriptions are read

For each target book of the specification, only the primary XML files its `sources` list names are read (strict allowlist). For a specification folder that list is `sources.json` (path and commit only), and each file and its catalog are read as they are in the git commit recorded for it. Several transcriptions of one manuscript are consolidated into one witness; for each line the one with the most words is read (ties broken by specification listing order). Leaves of one manuscript that carry separate numbers are one witness (P64 with P67, P77 with P103). Only the first hand (original copyist) is read; damaged, supplied, or unread words are treated as lacunae (for words an edition fills in for lost parts, see section 5). Translations into other languages are never read.

## 2. Lining up the words

For each line, the words of all its manuscripts are lined up into columns, oldest manuscript first, by a standard
global alignment (Needleman and Wunsch, 1970). Spellings that copyists used for the same word are compared as one word:

- Greek: ει written for ι, doubled letters, a movable ν, and the final σ of ουτως, αχρις, μεχρις. Accents and breathings are
  not compared (the manuscripts have none). Sacred names written short are written out, and so are numbers written as letters.
- Hebrew and Aramaic: only the consonants; final letter forms count as the plain letters; a ו or י inside a word, which
  copyists added or left out to mark a vowel, is not compared.

These are spelling habits, not differences of wording, so they are shown but not weighed. Each printed word is spelled as in
the oldest manuscript that has it.

A lectionary, a catena or a scroll may give only part of a line, so where it has no word it counts as lost, not as leaving the
word out. Where a manuscript has a lacuna inside a place, it counts for a reading only if the words it keeps fit exactly one
reading.

Neighbouring columns where the manuscripts differ are grouped into one place, and two places at most two columns apart that
share a word (a word moved) are joined. A column where a single manuscript alone differs, and all the others agree, is not made
a place: its difference is shown with that manuscript, and the probability of the word printed there is still estimated.

## 3. How likely each reading is: the model

The model is a latent-class model of independent errors (Dawid and Skene, 1979), fitted by Bayesian methods (Gelman and
others, 2013).

**What it assumes.** At any point of the text, the author wrote one reading. It is either one of the readings the
manuscripts show there, or one of 10 other readings that no surviving manuscript kept; before looking at the manuscripts,
each of these candidates is equally likely. Each manuscript m copied the original reading with probability q_m, its
reliability. Otherwise it has one of the other candidates, each equally likely. The number 10 is this compiler's assumption
about how many different wrong readings a copyist could plausibly have made at one point; it makes agreement in error rare,
as it is in practice. A word that one manuscript alone has is then exactly as likely to be original as that manuscript is
reliable.

**Bayes' rule.** For each possible original r, the chance of seeing what the manuscripts have is the product, over the
manuscripts, of q_m (if m has r) or (1 − q_m) / (N − 1) (if m has something else), where N is the number of candidates (the
readings seen plus 10). The probability of r is that product divided by the sum of the products for all candidates. The 10
unseen candidates are reported together as the chance that the original is in no manuscript we hold.

**Copies that depend on each other.** Many late copies descend from the same exemplars, so their agreement is not
independent evidence. Copies made within 400 years of the original count fully. Late copies that share a reading count as
one source: the most reliable counts in full, the next half, the next a quarter, and so on, so that any number of late copies
sharing a reading never count as more than two independent ones. This is a weighted (composite) likelihood (Varin, Reid and
Firth, 2011).

**Dates and the prior.** Before any agreement is measured, an older copy is expected to be more reliable. The expected
reliability of a copy made t years after the original is 0.5 + 0.45 × 2^(−t / 100): 0.95 at the time of the original,
falling halfway toward 0.5 every 100 years. The original is taken as written in 400 BC for the Old Testament and AD 100 for
the New Testament. A manuscript's date is the range its source archive gives (`yearFrom` to `yearTo` in the inventory); the expected
reliability is averaged over the whole range, so a wide range gives a vaguer expectation. This expectation is a Beta
distribution whose weight equals 4 observations when the range is 100 years or less, and less for wider ranges (4 × 100 /
width). Where the archive gives no range, the date is unknown: the expectation is set for the year 1500 with a weight of
only 1, so that the evidence of agreement decides.

**Learning each manuscript's reliability from agreement.** Reliability is then learned from how often each manuscript agrees
with what the other manuscripts make likely, by repeated estimation (the expectation–maximisation method of Dempster, Laird
and Rubin, 1977, as used by Dawid and Skene). For each line where a manuscript and at least one other have words, the line
counts as one observation: the average, over that line's points, of the probability (given all the manuscripts there) that
the manuscript's reading is the original. A point that only one manuscript has is not used, so no manuscript confirms itself. Counting lines rather than single words allows for
errors coming in clusters (Kish, 1965). The prior and these observations combine as Beta(prior weight × expected reliability +
agreements, prior weight × (1 − expected reliability) + disagreements). Five rounds are run.

**Uncertainty.** The model is run 100 times, each time drawing every manuscript's reliability from its Beta distribution
(a fixed seed, so every run of the program gives the same numbers). Each reading's probability is reported as the middle
(median) of those runs, with the 5th and 95th percentiles as its uncertainty range. A reading supported by one manuscript whose
reliability is measured on few lines has a wide range; a reading supported by many independent early copies has a narrow one.

**Choice.** At each place the reading with the highest probability (with the reliabilities at their estimates) is printed. A
tie goes to the reading with the oldest manuscript, then the most manuscripts, then alphabetical order. The probability that
the original is lost from every surviving manuscript is reported at each place too.

## 4. The evidence and what is unknown

| Kind of evidence | Used | Where it comes from |
|---|---|---|
| Date range and margin of error | yes, in the prior | the source archive's range in the inventory; unknown where none is given |
| Method of dating | shown | the source archive's statement; the INTF catalogue does not state its method for each manuscript |
| Scientific dating (such as carbon dating) | unknown for every manuscript held | no archive record gives one |
| Place of writing | unknown for every manuscript held | no archive record gives one |
| Condition, corrections and errors | through agreement only | corrections are not read (first hand only); errors lower the measured agreement |
| Agreement with the other manuscripts | yes, the main evidence | measured as above |

Unknown facts are never filled in. Where a fact would have raised or lowered a manuscript's expected reliability, its absence
leaves the prior weak, so the estimate rests on measured agreement and its uncertainty range stays wide where that is thin.

## 5. Filled-in text for lost parts

Some transcriptions are of editions that print a complete text and fill in the parts of the manuscript that are lost. Where the
transcription marks such words (TEI `<supplied>`, as in the Aleppo Codex and Samaritan Pentateuch MS Nablus 6 files), the
compiler treats them as follows, which is how this method gives them weight, as the specification asks ("marked as such and given
weight accordingly"):

- **Not the manuscript's own text.** A filled-in word is never counted as a reading of the manuscript. That manuscript is
  lacunose (unreadable or lost) at that point, exactly as if the words were missing, and, as with any lacuna, this does not lower
  its reliability.
- **No vote of its own.** The filled-in words get a weight of zero. The reason is that they are a copy of something else:
  usually of manuscripts the edition names or only describes ("closely related Tiberian manuscripts"), which are either already
  in the specification as witnesses (so counting the copy would count them twice) or not in it at all (so the copy would bring in
  a manuscript the specification excludes). The edition's stated source is also too vague, or lacks a date, for the model to give
  it a reliability of its own.
- **Always shown.** The compilation records, for every line that has filled-in text, which manuscript it is, the filled-in words
  and the edition's stated source (a `<note type="filled-in">` in the line, with `corresp` naming the witness and `source` the
  stated source), and, for each witness, how many lines and words of the book are filled in. A line that only filled-in text
  covers is listed as uncovered. The reading page labels these lines.
- **Where nothing marks them.** A transcription that fills in text without marking it cannot be treated this way. Such cases are
  recorded in the source archive's catalog entry (for example MS Nablus 6, where the edition says a few small gaps were filled from other
  manuscripts and not marked).

## 6. Why this is a sound method, and its limits

The Dawid and Skene model is the standard way to combine several fallible sources when the truth is unknown and the reliability
of each source must be learned from their agreement; it is used for medical diagnosis, survey coding and crowd labelling.
Bayesian estimation with stated priors and posterior intervals is standard practice (Gelman and others, 2013), and the weighted
likelihood is an accepted way to keep dependent observations from being counted as independent (Varin, Reid and Firth, 2011).

Its limits: errors are taken as equally likely to land on any alternative, which ignores that some changes (such as a
skipped repeat) are commoner than others; the weighting of late copies is a simple stand-in for their family tree; and the
probabilities are only as good as the transcriptions and the archives' dates.

## The Aramaic parts

These parts of the Old Testament are in Aramaic and are compiled the same way, with each of their words marked as Aramaic:
Daniel 2:4 after the word ארמית ("in Aramaic") to 7:28; Ezra 4:8 to 6:18 and 7:12 to 7:26; Jeremiah 10:11; and the two words
יגר שהדותא in Genesis 31:47.

## References

- Dawid, A. P., and Skene, A. M. (1979). Maximum likelihood estimation of observer error-rates using the EM algorithm.
  Journal of the Royal Statistical Society, Series C (Applied Statistics), 28(1), 20–28.
- Dempster, A. P., Laird, N. M., and Rubin, D. B. (1977). Maximum likelihood from incomplete data via the EM algorithm.
  Journal of the Royal Statistical Society, Series B, 39(1), 1–38.
- Gelman, A., Carlin, J. B., Stern, H. S., Dunson, D. B., Vehtari, A., and Rubin, D. B. (2013). Bayesian Data Analysis,
  third edition. CRC Press.
- Kish, L. (1965). Survey Sampling. Wiley.
- Needleman, S. B., and Wunsch, C. D. (1970). A general method applicable to the search for similarities in the amino acid
  sequence of two proteins. Journal of Molecular Biology, 48(3), 443–453.
- Varin, C., Reid, N., and Firth, D. (2011). An overview of composite likelihood methods. Statistica Sinica, 21(1), 5–42.
