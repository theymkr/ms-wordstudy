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

- The first 40 originally missing rows (number 7 through 478) were processed.
  Continue at number 481 with a new finite batch, preserving unresolved earlier rows.
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
