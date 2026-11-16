// NOVA DRIFT — best-game-01 entry program (Node 22, standard library only).
//
// It hands the game in: copies this repository's game/ (the playable game as
// plain static files) and screenshots/ (four JPEG renders of the game running)
// to the output directory, then writes dossier.json there with the kit's
// vendored buildDossier, the summary the judge reads. The grader runs it in
// a fresh container with /output writable; outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json). Only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse: at most
// 4 screenshots, each at most 256 KiB; game/ at most 993 files and 48 MiB in
// all, no path under game/ over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn(repoDir: string, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(repoDir, 'screenshots'))) {
    cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), {
      recursive: true,
    });
  }
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
}

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
handIn(repoDir, outDir);
