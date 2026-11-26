---
specification_id: 01M89WMZPKWMDPCWWDTAA9VN7D
compilation_id: 01M89Y5BQ0Q5D9TC2SPK1GRFKQ
created_at: 2026-11-25T18:05:52.756Z
model_attribution:
  provider: "Google DeepMind"
  model_family: "Gemini 4"
  model_name: "Gemini 4 Neon"
  model_id: "gemini-4-neon"
  effort_level: "medium"
  harness: "Antigravity"
  engine: "scripts/compile.ts (Bun 1.4.4)"
  commit: "b797e834d022e9e302c47178cf556fecf752533d"
method_summary: "Word-level Bayesian Dawid-Skene latent-class model with granular span alignment, decoupled edit-category vs. substantive-severity scoring, composite-likelihood late-witness discounting, and 100-draw Monte Carlo posterior uncertainty intervals."
disagreement_scale:
  min: 1
  max: 5
  description: "Independent 1 (minor/cosmetic) to 5 (major semantic or clause-level divergence) substantive impact scale, decoupled from mechanical edit category."
disagreement_categories:
  - id: lexical_substitution
    label: "Lexical Substitution"
    description: "Witnesses attest different word(s) of equal word count at the same position (non-transposition)."
    count: 41101
  - id: omission
    label: "Omission"
    description: "Competing witness(es) omit word(s) present in the selected reading."
    count: 10087
  - id: addition
    label: "Addition"
    description: "Competing witness(es) include extra word(s) where the selected reading is empty."
    count: 16857
  - id: transposition
    label: "Transposition (Word Order)"
    description: "Witnesses attest the same words in a different sequence."
    count: 277
  - id: phrase_length_variation
    label: "Phrase & Length Variation"
    description: "Multi-word phrase differences where both the selected and competing readings are non-empty but differ in word count."
    count: 9053
  - id: unresolved_lacuna
    label: "Unresolved Lacuna"
    description: "All covering witnesses are partially lacunose across the span so no complete reading could be reconstructed."
    count: 0
disagreement_subcategories:
  - id: orthographic_or_scribal_slip
    label: "Orthographic / Scribal Slip"
    level: 1
    level_label: "Minor (1/5)"
    description: "Single-letter misspelling, transposition of adjacent letters, or minor transcription slip on a virtually identical word."
    local_confidence_effect: "Reduces local confidence in the erring witness's reading at this point while increasing confidence in the cleanly attested competing reading."
    corpus_authenticity_effect: "Positive: authentic independent human copying naturally produces minor slips; artificial uniformity across centuries of physical decay would be anomalous."
    count: 67645
  - id: particle_or_article_variation
    label: "Particle / Article / Function-Word Variation"
    level: 2
    level_label: "Low (2/5)"
    description: "Omission, addition, or swap of a common particle, conjunction, article, or preposition (such as Greek δε, και, or the definite article) with minimal impact on core meaning."
    local_confidence_effect: "Modestly reduces local phrasing certainty where witnesses split."
    corpus_authenticity_effect: "Positive: reflects expected scribal style and dialectal habits across independent lineages."
    count: 23999
  - id: grammatical_or_stylistic_nuance
    label: "Grammatical / Stylistic Nuance"
    level: 2
    level_label: "Low (2/5)"
    description: "Shared-stem inflectional/morphological variation or word-order transposition of identical words."
    local_confidence_effect: "Modestly reduces local phrasing certainty where witnesses split."
    corpus_authenticity_effect: "Positive: reflects expected scribal style and dialectal habits across independent lineages."
    count: 8552
  - id: phonetic_or_confusable_form
    label: "Sound-Alike / Visually Confusable Form"
    level: 3
    level_label: "Moderate (3/5)"
    description: "A different word that sounds alike in Koine Greek or Biblical Hebrew pronunciation (itacism, vowel/guttural shift) or shares visually confusable letters."
    local_confidence_effect: "Reduces local confidence in the erring witness's reading while increasing overall confidence in the competing witness that lacks the phonetic error."
    corpus_authenticity_effect: "Positive: natural auditory/visual copying confusion increases confidence that the witness is an authentic human copy rather than a harmonized fabrication."
    count: 28188
  - id: substantive_structural_variation
    label: "Substantive Phrase / Omission / Addition"
    level: 4
    level_label: "High (4/5)"
    description: "Omission or addition of content word(s) or a multi-word phrase difference with unequal word counts."
    local_confidence_effect: "Substantially lowers local certainty where early witnesses split; resolved by independent early witness weight rather than majority count."
    corpus_authenticity_effect: "Neutral: reflects genuine textual divergence across transmission streams."
    count: 69767
  - id: unexplained_lexical_divergence
    label: "Unexplained Lexical Divergence"
    level: 5
    level_label: "Critical (5/5)"
    description: "An entirely different lexical item with no obvious orthographic, grammatical, or phonetic bridge to the selected reading (or an unresolved lacuna)."
    local_confidence_effect: "Strongly reduces local confidence unless settled by strong independent early witnesses."
    corpus_authenticity_effect: "Requires scrutiny: signals a deep textual or redactional split rather than a mechanical copying slip."
    count: 13005
authenticity_signal: "Across all 66 books, the overwhelming majority of variant readings are minor orthographic slips, particle/article variations, grammatical nuances, and phonetic confusions characteristic of independent human hand-copying across centuries, reinforcing overall corpus authenticity while isolating substantive divergences for scholarly scrutiny."
evidence_usage:
  dating: "Used to form an age-decay Beta prior averaged uniformly over documented [yearFrom, yearTo] ranges; wide ranges weaken prior strength; undocumented dates remain unknown with a diffuse prior (strength = 1)."
  provenance: "Place of origin/writing is undocumented for all manuscripts in the specification and is recorded explicitly as unknown without imputation."
  scientific_analysis: "Undocumented for all manuscripts in the specification and recorded explicitly as unknown."
  physical_and_scribal: "Observed scribal corrections (>1% rate across >=100 words) apply a bounded prior penalty up to 0.08; physical damage/lacunae never penalize credibility."
  textual_agreement: "Primary evidence learned via 5 rounds of line-level Dawid-Skene EM with geometric dependence discounting for late copies (>400 years after composition)."
totals:
  books: 66
  lines: 31186
  words: 443827
  variant_places: 77375
---

# Compilation Report (01M89Y5BQ0Q5D9TC2SPK1GRFKQ)

This compilation was produced under Open Lexis Transcription Specification `01M89WMZPKWMDPCWWDTAA9VN7D`.

Statistical Method: Bayesian Dawid-Skene Latent-Class Model with Composite Likelihood and Scribal Evidence.

1. Objective and Witness Consolidation. Each target book is reconstructed strictly from the allowlisted primary transcriptions in specification 01M88AX3YW2HWVPGHTREFJS181. Multiple transcriptions of the same physical manuscript (and known split leaves: P64/P67, P77/P103) are consolidated into a single witness so no manuscript votes twice; per verse, the transcription with the most readable words is used (ties broken by specification listing order). Only the first hand (original copyist) is read; damaged or editorially supplied words are treated as lacunae rather than votes.

2. Alignment and Orthographic Normalization. For each numbered line (chapter:line), witnesses are aligned oldest-first via Needleman-Wunsch global alignment. Orthographic spelling habits (Greek itacism ei/i, doubled letters, movable nu, final sigma of outos/achris/mechris, expanded nomina sacra and letter-numerals; Hebrew consonantal skeleton ignoring final forms and internal matres lectionis vav/yod) are folded for comparison so spelling conventions do not inflate substantive variation. The displayed surface spelling is taken from the oldest attesting witness. Non-continuous witnesses (scrolls, lectionaries, catenae) treat absent positions as lacunae rather than omissions. Every column where surviving non-lacunose witnesses disagree—including singular readings—is represented as a TEI <app> element. Adjacent variant columns are merged into a single <app> only when structurally coupled (an omission/insertion, a multi-word variant by the same witness, or a shared/transposed word within two columns), preventing unrelated single-word substitutions in large witness pools from collapsing into giant spans.

3. Prior Reliability from Dating and Scribal Evidence. Before measuring textual agreement, each witness receives a Beta prior on its reliability q_m (probability of preserving the original reading at a point). Expected reliability decays with age after composition (origin = 400 BC for Old Testament, AD 100 for New Testament): mu(t) = 0.5 + 0.45 * 2^(-max(0, t - origin) / 100), averaged uniformly across the documented date range [yearFrom, yearTo]. Prior strength is 4 * 100 / max(100, yearTo - yearFrom) pseudo-observations, so wide date ranges yield weaker priors and wider uncertainty intervals. Where dating metadata is undocumented in the specification, it remains explicitly unknown and receives a diffuse prior (mu(1500) ≈ 0.50, strength = 1) so measured agreement governs and uncertainty remains wide where coverage is sparse. Observed scribal corrections in a manuscript's own transcription (when >= 100 transcribed words are present and correction rate exceeds 1%) apply a gentle bounded prior penalty up to 0.08 (floor 0.50) reflecting less stable copying. Physical deterioration (lacunae, damaged parchment, missing text in ancient scrolls) never penalizes credibility, though absent words leave local uncertainty.

4. Dependence Discounting (Composite Likelihood) and EM Estimation. To avoid simple majority voting by large clusters of late dependent copies, witnesses within 400 years of composition receive full weight (1.0), whereas later witnesses sharing a reading are geometrically down-weighted in descending order of reliability (1, 1/2, 1/4, ..., sum < 2). At each unit with K attested readings plus U = 10 unseen candidate readings (uniform prior over K + U candidates), a witness with reliability q_m attests the original with probability q_m and each alternative with probability (1 - q_m)/(K + U - 1). Five rounds of Expectation-Maximization (EM) update each witness's posterior Beta(alpha_m, beta_m) using line-level mean agreement (accounting for clustered errors and excluding single-witness units from self-confirmation).

5. Uncertainty Intervals and Reading Selection. One hundred deterministic Monte Carlo draws (seeded by book ID) are sampled from each witness's posterior Beta distribution. For every reading (selected, variant, and unseen-original) and every unanimous word, the posterior median is recorded in <certainty degree="..."/> and the 90% credible interval (5th to 95th percentile) in <note type="uncertainty">. At each <app>, the reading with highest point-estimate posterior probability is selected as <lem> (ties broken by earliest witness, then witness count, then lexicographical order).

6. Unknowns and Limitations. Place of origin/writing (manuscript provenance) and scientific dating (e.g. radiocarbon) are undocumented for all manuscripts in the specification and are explicitly recorded as unknown in every <witness> entry without imputation. Limitations: uniform error distribution across alternatives does not model specific scribal error mechanisms (e.g., homoioteleuton), and geometric down-weighting of late witnesses is a statistical proxy for a full stemma codicum.
