/**
 * (Re)generates test/golden/ from the HTML fixtures in test/fixtures/, using whatever
 * code is currently checked out.
 *
 * ⚠️ This repo is on the v3 branch: running this unfiltered overwrites the v2 golden
 * references with v3 output. Always filter to the one fixture you're adding/changing
 * (see test/README.md).
 *
 * Usage:
 *   pnpm test:golden:capture                  # every fixture (dangerous on this branch)
 *   pnpm test:golden:capture legacy/my-case    # only fixtures whose path contains this
 */
import { generateHTML, generateJSON } from '@tiptap/html/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXTENSIONS } from '../src/controllers/transformation-controller.js';
import { findHtmlFixtures } from '../test/fixture-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../test/fixtures');
const GOLDEN_DIR = path.resolve(__dirname, '../test/golden');

function captureGolden(fixturePath: string) {
  const sourceHtml = fs.readFileSync(fixturePath, 'utf-8');
  const json = generateJSON(sourceHtml, EXTENSIONS);
  const htmlFromJson = generateHTML(json, EXTENSIONS);

  const relativePath = path.relative(FIXTURES_DIR, fixturePath);
  const goldenPath = path.join(
    GOLDEN_DIR,
    relativePath.replace(/\.html$/, '.json'),
  );
  fs.mkdirSync(path.dirname(goldenPath), { recursive: true });
  fs.writeFileSync(
    goldenPath,
    JSON.stringify({ sourceHtml, json, htmlFromJson }, null, 2) + '\n',
  );
  console.log(`captured golden: ${path.relative(process.cwd(), goldenPath)}`);
}

const filter = process.argv[2];
const fixtures = findHtmlFixtures(FIXTURES_DIR).filter(
  (fixturePath) => !filter || fixturePath.includes(filter),
);
if (fixtures.length === 0) {
  console.error(
    filter
      ? `No fixture path contains "${filter}" under ${FIXTURES_DIR}`
      : `No fixtures found under ${FIXTURES_DIR}`,
  );
  process.exit(1);
}
fixtures.forEach(captureGolden);
console.log(`\n${fixtures.length} golden file(s) captured under ${GOLDEN_DIR}`);
