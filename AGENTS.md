# Repository Guidelines

## Project Structure & Module Organization

Source lives in `src/`, with `index.ts` orchestrating OpenAI + ElevenLabs calls and helper modules (`prompt.ts`, `tts.ts`, `voices.ts`, `lunarcrush.ts`) covering prompt design and audio handling. Generated assets, transcripts, and stitched audio belong in `out/`; keep only reusable templates under version control. Secrets load from `.env` (see Environment notes). Avoid placing builds or temporary files outside these directories.

## Build, Test, and Development Commands

- `npm install` — install TypeScript and client SDK dependencies.
- `npx tsx src/index.ts` — run the end-to-end pipeline

## Coding Style & Naming Conventions

Use 2-space indentation, trailing commas, and single quotes only when template literals are not required. Stick to camelCase for variables/functions, PascalCase for exported types/classes, and SCREAMING_SNAKE_CASE for env keys. Embrace the strict TypeScript defaults (no `any`, explicit return types). Keep modules cohesive: separate data templates, model lookups, and I/O utilities into their existing files. Inline comments are reserved for non-obvious API behaviors or workarounds.
