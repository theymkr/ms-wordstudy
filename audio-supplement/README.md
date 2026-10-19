# Incremental US recordings

`build.js` first extracts the seven original archive parts. The existing final
`scripts/mobile-menu-build.cjs` stage calls a separate audio overlay, which
then copies `files/` into `public/audio-pilot/`, extends the original immutable app
mapping and catalog manifest, and recalculates the displayed counts and remaining
CSV. Generated `public/` must not be committed. The original archives and
`build.js` are unchanged; no authentication or sync source is rewritten.

`manifest.json` records only downloaded, source-verified recordings. It includes
the exact app number/word/meaning, American pronunciation evidence, creator,
individual license, original download URL and SHA-256, conversion and app-file
SHA-256. Original Ogg files remain in `originals/`; MP3 conversion is for iPhone
compatibility, with the same source license. No TTS or British recordings are
included. Source description/category checks are provenance checks, not a claim
of a human listening review.

`runs/` retains finite-batch outcomes and the next position. Recalculate the
remaining set from fresh main and deployed `quizData`/`usAudioFiles` before each
run; never use the request-time count as the current count. `verification/`
separately records app playback and production checks. URL discovery, downloading,
local decoding, app playback and deployment verification are separate stages.

## Continuing after 2026-10-18

- All 640 originally missing rows (number 7 through 2941) have first-pass
  source-review records. This is NOT acquisition completion: 637 remain missing.
  Do not repeat the completed exact-title scans. The 298-row deferred-host
  provenance scan is complete, not acquisition. The eight earlier rate-limited
  rows (funeral 386 through actually 478) also have provenance reviews: seven
  supported, comedy still lacks native-language evidence. Next attempt a finite
  supported-candidate acquisition batch only after the recorded host cooldown.
  Whisper noun/verb share a pronunciation; actually has accepted US reductions.
  No download, decode, new playback or mapping was claimed for this review.
  Preserve all unresolved rows and cooldowns. See the latest run's next phase.
  The first second-pass batch reviewed 40 deferred candidates (joke 481 through
  muse 1069): 31 have native-English recorder evidence plus file-specific US
  descriptions; nine still lack recorder/native-language evidence. This is not
  audio verification or acquisition. Reuse the speaker audit rather than repeat
  profile searches. Neskaya's own nonstandard-accent warning requires file-by-file
  review; hydrogen's raw page names Muke, while hit's raw page names no recorder.
  The second provenance batch reviewed 40 candidates (strenuous 1075 through
  deceive 1316): 30 have supporting provenance and ten remain unresolved,
  including refer's third-party rights hold. Mikemoral redirects to Chaetodipus,
  whose profile declares native English. Controversy's exact recorder is
  SneverdleSnavis, not Sylvanmoon. Recall's final-stressed variant may cover both
  app senses; initial stress alone cannot cover the verb. No media was acquired.
  The third provenance batch reviewed 40 candidates (manuscript 1327 through
  repent 1535): 36 have supporting provenance; four remain unresolved.
  Whomping Walrus explicitly identifies as a native US-English speaker, and
  epidemic's exact file explicitly says native American-English recording.
  Creed's recorder lacks native-language evidence. No download or playback claim;
  the original media-host cooldown and existing browser blocker remain in place.
  The fourth provenance batch reviewed 40 candidates (fluid 1538 through
  device 1787): 26 have supporting provenance; 14 remain unresolved.
  Paul2520 describes human Midwestern recording but native-language evidence
  remains pending. Laboratory has unresolved Gbeebani/Ganj account links.
  Amaze lacks native-human provenance; neither TTS nor non-native status is
  established. No audio was downloaded, decoded, newly played or mapped.
  The fifth provenance batch reviewed 40 candidates (rejoice 1790 through
  compromise 2014): 28 have supporting provenance; 12 remain unresolved.
  Mx. Granger explicitly declares native American English; yearn is own-work CC0.
  Behavior and donation lack native-language evidence. Reserve and compromise
  each have matching noun/verb pronunciations; vehicle permits variants with
  and without /h/. No new download, decode, playback or mapping was claimed.
  The sixth provenance batch reviewed 40 candidates (antiquity 2026 through
  prejudice 2262): 30 have supporting provenance; 10 remain unresolved.
  Reproduce's recorder Mountainmage lacks native-language evidence. Principle's
  raw description explicitly names EncycloPetey despite the blank Author field.
  Revenge noun/verb share final stress; reproduce needs the full verb, not produce.
  No new audio download, decode, playback or mapping was claimed.
  The seventh provenance batch reviewed 40 candidates (side 2264 through
  mixture 2480): 27 have supporting provenance; 13 remain unresolved.
  The New Mikemoral resolves to Chaetodipus; preserve original attribution.
  Simplificationalizer declares native English; anarchy's US evidence remains
  tied to its exact New Jersey file link. Toll's recorder declares native American
  English on the primary profile linked from Commons. Exempt adjective and verb
  share a pronunciation. No new download, decode, playback or mapping was claimed.
  The eighth provenance batch reviewed the final 18 deferred-host candidates
  (solitude 2484 through sir 2941): 8 have supporting provenance; 10 remain unresolved.
  Sacred and zoo descriptions name their recorders despite machine-assumed
  author fields, but native-language evidence is missing. Video's recorder also
  remains unverified. Burnt must not be replaced by burned. No media was acquired.
  The second batch added no recordings: 19 Commons US candidates are deferred,
  including absent which also needs adjective/verb stress review; four Lingua
  Libre candidates lack dialect evidence, and 17 exact Ogg titles were missing.
  Candidate metadata is not a download or playback verification.
- The third batch added no recordings: 17 US candidates are deferred, six
  Lingua Libre candidates lack dialect evidence, and 17 rows need other sources.
  The entire original WimsEdu Mary index (4,876 entries) was checked against the
  current missing set: zero exact matches. See `source-audits/`; do not download
  the unchanged 313 MB archive or retry its broken index links again.
- The fourth batch added no recordings: 21 US candidates are deferred (summon
  also needs the app's mixed-POS meaning reviewed), one Lingua Libre candidate
  lacks dialect evidence, and 18 rows need other sources. The original Shtooka
  Emmanuel index (986 entries) also has zero exact matches in the current missing
  set. Its coverage audit is complete; do not download the full archive again.
- The fifth batch added no recordings: 22 US candidates are deferred, three
  Lingua Libre candidates lack dialect evidence, and 14 rows need other sources.
  One candidate was rejected: `En-us-diplomacy.ogg` resolves to a Canadian English
  recording (`En-ca-diplomacy.oga`). Always inspect the resolved source URL and
  dialect metadata; an `En-us` title alone is not sufficient.
- The sixth batch added no recordings: 21 US candidates are deferred, one
  Lingua Libre candidate lacks dialect evidence, and 17 rows need other sources.
  `En-us-colloquial.ogg` resolves to Canadian `En-ca-colloquial.oga` and was
  rejected; no exact OGA/WAV/MP3 US alternative was found. The app requires the
  verb pronunciation of complicate, while narrate allows multiple US stresses.
- The seventh batch added no recordings: 26 US candidates are deferred, three
  Lingua Libre candidates lack dialect evidence, and 11 rows need other sources.
  Sage's herb/wise-person/wise-adjective senses share a pronunciation; juvenile
  has multiple US vowel variants. These reference checks do not replace playback.
  Forvo lists US speakers for venerable/juvenile, but MP3 download requires
  registration and its current terms restrict systematic reuse. Do not create an
  account, scrape player media, or assume historical Creative Commons licensing.
- The eighth batch added no recordings: 22 US metadata candidates remain
  unverified (extract and forbear also require POS/stress evidence), two Lingua
  Libre candidates lack dialect evidence, and 16 rows need other sources.
  Extract/abstract combine distinct pronunciations in one app entry; do not count
  an ambiguous single clip as full coverage. No word data was changed.
  New corpus reviews are recorded: Mozilla's US subset has hosting conditions
  and no established exact-word workflow; UCSB's conversation corpus is BY-ND,
  so isolated-word cropping permission is not established. Neither was downloaded.
- The ninth batch added no recordings: 20 rows have US metadata candidates
  (outlook/invert need POS verification and mock lacks a named recorder), three
  Lingua Libre rows lack dialect evidence, and 17 rows need other sources.
  Outlook's OGA candidate explicitly says verb; a separate Ogg candidate was found
  but noun stress is not yet verified. Never map the verb clip to the app noun.
  CMU ARCTIC is a promising independent human-recording source (BDL/SLT US only),
  but its official index returned 502. Respect its separate retry time in the run
  record; exclude included synthetic voices and Canadian/Scottish recordings.
- The tenth batch added no recordings: 21 US metadata candidates remain
  unverified, three Lingua Libre rows lack dialect evidence, and 15 rows need
  other sources. Discern was rejected because its recorder explicitly says
  they are not a native speaker; a US category alone is insufficient.
  Incline has different noun/verb stresses, supplement has different noun/verb
  final vowels, and recreation must match the leisure sense rather than creating
  again. Do not count one ambiguous clip as all senses of a mixed-POS app row.
- The eleventh batch added no recordings: 22 rows have US metadata candidates
  (astray still requires rights-holder permission evidence), four Lingua Libre
  rows lack dialect evidence, and 14 rows need other sources. Inherent has a new
  NaomiAmethyst candidate explicitly linked as General American; that label must
  not be attributed to the previous Simplificationalizer recording. Contrast needs
  noun/verb stress coverage. Ally allows an initial-stressed verb variant, but a
  final-stressed clip alone cannot cover the noun. The previous browser socket
  permission blocker was not retried or bypassed; no new playback was claimed.
- The twelfth batch added no recordings: 22 US metadata candidates remain
  unverified, three Lingua Libre rows lack dialect evidence, and 15 rows need
  suitable alternatives. Discharge needs both noun/verb stresses; overlook needs
  verb stress. Wodencafe's US-labelled discard file is linked under the noun and
  was not selected for the app verb. US IPA on rural/historian pages does not
  establish the dialect of the separate Arlo Barnes recordings. Existing host
  cooldowns and browser permission restrictions were respected without retries.
- The thirteenth batch added no recordings: 23 rows have US metadata candidates
  (lament needs rights-holder permission evidence), one Lingua Libre row lacks
  dialect evidence, and 16 rows need other sources. Principle's description names
  EncycloPetey despite its blank machine-readable author field. Correspond has
  explicit California-English metadata. Stable's shared dialect IPA does not
  verify its separate audio candidate. Futile/miniature pronunciation references
  were recorded without treating a single vowel or syllable count as dialect proof.
- The fourteenth batch added no recordings: 21 rows have US metadata candidates,
  three Lingua Libre rows lack dialect evidence, and 16 need other sources.
  Anarchy's exact Simplificationalizer and Wodencafe files are linked as New Jersey
  and Texas audio; this is not native-speaker, download or playback verification.
  Torment's US verb also allows initial stress in OAAD, but a final-stressed clip
  alone cannot cover the noun. Repose noun and verb share a pronunciation. Defense
  must match the protection/legal sense, not just sporting stress. Draft's linked
  US clip is titled draught and was not selected as an exact-spelling recording.
- The fifteenth batch added no recordings: 23 rows have US metadata candidates
  (idealist needs rights-holder permission evidence), four Lingua Libre rows lack
  dialect evidence, and 13 need other sources. Patent's New Jersey label belongs
  to Simplificationalizer's file, not Arlo Barnes's. A verified short-a patent clip
  may cover the app's noun/verb/adjective senses; a long-a clip requires sense review.
  Affect needs verb stress and must not be replaced with effect. Simultaneous has
  multiple dictionary-supported US variants. Host cooldowns and the known browser
  permission blocker were respected; no new download or playback was claimed.
- The sixteenth batch added no recordings: 19 rows have US metadata candidates
  (this/knock/thing/story need recorder provenance), five Lingua Libre rows lack
  dialect evidence, and 16 need other sources. Raw PD-self pages do not establish
  who recorded the audio. Piano must match the instrument noun, not the musical
  direction. Up's adjective/adverb pronunciations match despite different POS
  labels; crayon allows multiple US syllable patterns. Rose's US file link could
  not be resolved, so that dialect label was not assigned to an unrelated file.
- Three recordings passed source, download, full decode and actual browser
  playback checks: feather (331), stripe (404), atom (449).
- Eight original download attempts returned HTTP 429. Respect the host cooldown
  in the latest run record. Stop further downloads from that host on a new 429;
  retain `Retry-After` if provided, use a longer cooldown on recurrence, and never
  change hosts/parameters to evade the limit. Do source review on other public
  sources while a download host is cooling down.
- Eleven Lingua Libre candidates remain uncounted because English/CC0 metadata
  does not establish US pronunciation. Seventeen exact En-us Ogg/WAV lookups
  returned no file: use different sources rather than repeat those same lookups.
- `envelope / envelop` needs both different words/pronunciations handled correctly;
  do not credit one recording as the entire entry. The Wiktionary API returned
  403 for photographer: do not retry the same blocked endpoint.
- Never alter account, login, score, or personal word-list data. Browser tests use
  an isolated auth-free fixture of the app HTML with cloud requests disabled.

## Verification

Run `node build.js`, then `node tests/audio-supplement.cjs` with `PLAYWRIGHT_PATH`
and `CHROME_PATH` set if needed. This uses real HTML audio playback and verifies
three `playing`/`ended` events per recording, no device TTS fallback, no score
changes, correct counts, and no page errors. For production, set `AUDIO_BASE_URL`
and `AUDIO_HTML_PATH` to a freshly fetched production HTML file: the fixture retains
production HTML/audio mappings and loads real production audio, while disabling
account calls. Independently check production asset hashes, word-list equality,
the Vercel deployment state, and main before declaring site verification.
