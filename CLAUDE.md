# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (HMR)
npm run build     # production build
npm run preview   # preview production build
npm run lint      # ESLint
```

No test suite exists.

## Architecture

Single-file React 19 SPA (`src/App.jsx`) — no router, no state management library. Everything (components, logic, audio, data) lives in that one file.

### Screen flow

```
loading → login → xml_load → select → game
```

The `screen` state string drives top-level routing via early returns at the bottom of `SpaceTyping` (the root component). Screens are implemented as separate sub-components (`LoginScreen`, `XmlLoadScreen`, `LevelSelect`) except `game`, which renders inline.

### Level data

Levels come from a user-supplied XML file dropped at the `xml_load` screen. `parseXML()` converts it to level objects:

```xml
<filter level_name="…" min_score_pct="0.6" mission_size="8">
  <allowed_chars>a s d f …</allowed_chars>   <!-- space-separated chars -->
  <required_chars>f j</required_chars>
  <matches><word>…</word>…</matches>
  <pseudo_words><word>…</word>…</pseudo_words>
</filter>
```

The XML is generated externally by `python filter_words.py wordlist.csv filters.txt output.xml`. If a level has no words, `genPseudo()` generates pseudo-words client-side.

### Persistence

Player progress (name, unlocked level index, best scores per level) is stored in a single cookie `space_typing_v3` (90-day expiry). No backend.

### Scoring

- Per-word score: `word.length × 20 − errors × 5 + speed_bonus` (speed bonus: 20 pts < 3 s, 10 pts < 6 s)
- Level passes when `totalScore ≥ maxScore × level.minPct`
- On pass: next level unlocks; `phase` transitions `playing → launching → passed`
- On fail: `phase` transitions `playing → crashing → failed`

### Keyboard

Swiss-French QWERTZ layout, hardcoded in `KEYBOARD_ROWS`. `level.newKeys` (Set) highlights newly introduced keys in green; `level.chars` (Set) shows all allowed keys. `BUMP_KEYS` = `{f, j}` renders the tactile dot.

### Audio

All sound is generated via the Web Audio API (`getCtx` lazily creates the `AudioContext`). Five sound effects (`sfxCorrect`, `sfxWrong`, `sfxWordDone`, `sfxLaunch`, `sfxCrash`) and continuous ambient drone (`startAmbient`) — no audio files. `mutedRef` is a ref (not state) to avoid stale closures in the `keydown` handler.
