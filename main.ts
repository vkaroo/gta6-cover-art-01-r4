// Sunset Cover Studio — the program that hands this entry in (Node 22, standard library only).
//
// It copies the app and the screenshots that sit beside this file into an output
// directory, then writes the dossier the judge reads with the kit's vendored library.
// The output directory is MAKEFUN_OUTPUT_DIR when the environment sets it (the grader
// hands in an empty writable /output); when it is not set, the program falls back to a
// fresh directory under the operating system's temp area. It never writes into the
// repository itself, because the grader mounts the repository read-only.
//
// Before the dossier is written, the program builds it twice from the same copied
// tree and compares the two results as plain strings. A dossier must be byte-for-byte
// reproducible: if the two builds ever differ, the run fails loudly here instead of
// handing in a dossier the scorer would refuse. The comparison is a string
// comparison — a string has no .equals method, and calling one would crash the run.

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir =
  process.env.MAKEFUN_OUTPUT_DIR ??
  mkdtempSync(join(tmpdir(), 'sunset-cover-studio-'));
const DOSSIER_CAP_BYTES = 1572864; // 1.5 MiB, the scorer's dossier cap
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function renderDossier(): string {
  const bytes = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  return textDecoder.decode(bytes);
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), {
    recursive: true,
  });
}

// Verify the copy before the dossier is built from it: the entry is useless
// if the app or a screenshot never landed in the output directory, and a
// missing file should fail the run here instead of the grader.
if (!existsSync(join(outDir, 'app', 'index.html'))) {
  throw new Error('output is missing app/index.html after the copy');
}
const shotFiles = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots')).filter((name) => !name.startsWith('.'))
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`output holds ${shotFiles.length} screenshots, expected 3 or 4`);
}
const appBytes = (() => {
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else total += statSync(full).size;
    }
  };
  walk(join(outDir, 'app'));
  return total;
})();
console.log(
  `copied app/ (${appBytes} bytes) and ${shotFiles.length} screenshots to ${outDir}`,
);

const firstBuild = renderDossier();
const secondBuild = renderDossier();
if (firstBuild !== secondBuild) {
  throw new Error('dossier is not deterministic: two builds of the same tree differ');
}
const dossierBytes = textEncoder.encode(firstBuild);
if (dossierBytes.length > DOSSIER_CAP_BYTES) {
  throw new Error(
    `dossier is ${dossierBytes.length} bytes, over the 1.5 MiB cap`,
  );
}
writeFileSync(join(outDir, 'dossier.json'), firstBuild);
console.log(`wrote ${join(outDir, 'dossier.json')} (${dossierBytes.length} bytes)`);
