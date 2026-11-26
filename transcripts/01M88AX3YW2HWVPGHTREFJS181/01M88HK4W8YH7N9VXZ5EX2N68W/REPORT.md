---
specification_id: 01M88AX3YW2HWVPGHTREFJS181
compilation_id: 01M88HK4W8YH7N9VXZ5EX2N68W
created_at: 2026-11-25T05:06:58.590Z
model_attribution:
  provider: "Google DeepMind"
  model_family: "Gemini 4"
  model_name: "Gemini 4 Neon"
  model_id: "gemini-4-neon"
  effort_level: "medium"
  harness: "Antigravity"
  engine: "scripts/compile.ts (Bun 1.4.4)"
  commit: "a6fd2bbaae31834d29545202110a07670b06441a"
method_summary: "Bayesian Dawid–Skene latent-class model with composite-likelihood dependence discounting, dating and scribal-correction priors, and 100-draw Beta posterior Monte Carlo uncertainty intervals."
disagreement_scale:
  min: 1
  max: 5
  description: "Model-chosen 1 (minor mechanical/orthographic slip) to 5 (unexplained major lexical divergence) scale."
disagreement_categories:
  - id: lexical_substitution
    label: "Lexical Substitution"
    description: "Witnesses attest different word(s) of equal word count at the same position (non-transposition)."
    count: 24486
  - id: omission
    label: "Omission"
    description: "Competing witness(es) omit word(s) present in the selected reading."
    count: 1437
  - id: addition
    label: "Addition"
    description: "Competing witness(es) include extra word(s) where the selected reading is empty."
    count: 1986
  - id: transposition
    label: "Transposition (Word Order)"
    description: "Witnesses attest the same words in a different sequence."
    count: 934
  - id: phrase_length_variation
    label: "Phrase & Length Variation"
    description: "Multi-word phrase differences where both the selected and competing readings are non-empty but differ in word count."
    count: 5791
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
    count: 84423
    app_places_count: 7875
  - id: grammatical_or_stylistic_nuance
    label: "Grammatical / Stylistic Nuance"
    level: 2
    level_label: "Low (2/5)"
    description: "Shared-stem inflectional/morphological variation, word-order transposition of identical words, or omission/addition of a common particle, conjunction, or article."
    local_confidence_effect: "Modestly reduces local phrasing certainty where witnesses split."
    corpus_authenticity_effect: "Positive: reflects expected scribal style and dialectal habits across independent lineages."
    count: 8425
    app_places_count: 3385
  - id: phonetic_or_confusable_form
    label: "Sound-Alike / Visually Confusable Form"
    level: 3
    level_label: "Moderate (3/5)"
    description: "A different word that sounds alike in Koine Greek or Biblical Hebrew pronunciation (itacism, vowel/guttural shift) or shares visually confusable letters."
    local_confidence_effect: "Reduces local confidence in the erring witness's reading while increasing overall confidence in the competing witness that lacks the phonetic error."
    corpus_authenticity_effect: "Positive: natural auditory/visual copying confusion increases confidence that the witness is an authentic human copy rather than a harmonized fabrication."
    count: 12007
    app_places_count: 5019
  - id: substantive_structural_variation
    label: "Substantive Phrase / Omission / Addition"
    level: 4
    level_label: "High (4/5)"
    description: "Omission or addition of content word(s) or a multi-word phrase difference with unequal word counts."
    local_confidence_effect: "Substantially lowers local certainty where early witnesses split; resolved by independent early witness weight rather than majority count."
    corpus_authenticity_effect: "Neutral: reflects genuine textual divergence across transmission streams."
    count: 77209
    app_places_count: 13758
  - id: unexplained_lexical_divergence
    label: "Unexplained Lexical Divergence"
    level: 5
    level_label: "Critical (5/5)"
    description: "An entirely different lexical item with no obvious orthographic, grammatical, or phonetic bridge to the selected reading (or an unresolved lacuna)."
    local_confidence_effect: "Strongly reduces local confidence unless settled by strong independent early witnesses."
    corpus_authenticity_effect: "Requires scrutiny: signals a deep textual or redactional split rather than a mechanical copying slip."
    count: 4976
    app_places_count: 4576
authenticity_signal: "56.1% of competing variant readings (104,855 of 187,040) are natural human copying phenomena (orthographic slips, grammatical/stylistic nuances, or sound-alike/visually confusable forms). While these locally widen uncertainty where witness coverage is sparse, their distribution across independent manuscripts strengthens overall confidence in authentic organic transmission—whereas artificial uniformity across millennia of physical decay and copying would be anomalous."
evidence_usage:
  dating: "Used to form an age-decay Beta prior averaged uniformly over documented [yearFrom, yearTo] ranges; wide ranges weaken prior strength; undocumented dates remain unknown with a diffuse prior (strength = 1)."
  provenance: "Place of origin/writing is undocumented for all manuscripts in the specification and is recorded explicitly as unknown without imputation."
  scientific_analysis: "Undocumented for all manuscripts in the specification and recorded explicitly as unknown."
  physical_and_scribal: "Observed scribal corrections (>1% rate across >=100 words) apply a bounded prior penalty up to 0.08; physical damage/lacunae never penalize credibility."
  textual_agreement: "Primary evidence learned via 5 rounds of line-level Dawid-Skene EM with geometric dependence discounting for late copies (>400 years after composition)."
totals:
  books: 66
  lines: 31195
  words: 444338
  variant_places: 34634
---

# Compilation Report (01M88HK4W8YH7N9VXZ5EX2N68W)

This compilation was produced under Open Lexis Transcription Specification `01M88AX3YW2HWVPGHTREFJS181`.

Bayesian Dawid–Skene latent-class model combining witness dating priors, scribal correction rates, dependence discounting for late copies, and line-level Expectation–Maximization to estimate originality probabilities and 90% credible intervals.
