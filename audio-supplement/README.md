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

- The first 320 originally missing rows (number 7 through 1689) were reviewed.
  Continue at number 1690 (oracle), preserving unresolved earlier rows.
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
