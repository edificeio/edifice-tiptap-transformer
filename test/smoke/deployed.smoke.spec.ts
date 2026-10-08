/**
 * Opt-in smoke test against a DEPLOYED transformer instance (e.g. recette).
 * Not part of `pnpm test` / CI gate — this only checks that the deployed build
 * behaves the same as the local golden references, as a pre-release sanity check.
 *
 * Usage:
 *   TRANSFORMER_URL=https://recette-tiptap.ode.tools/transform \
 *   TRANSFORMER_BASIC_AUTH="rec-tiptap:$TRANSFORMER_TOKEN" \
 *   pnpm test:smoke
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSFORMER_URL = process.env.TRANSFORMER_URL;
const TRANSFORMER_BASIC_AUTH = process.env.TRANSFORMER_BASIC_AUTH;

const KITCHEN_SINK_HTML = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/kitchen-sink/full-document.html'),
  'utf-8',
);
const KITCHEN_SINK_GOLDEN = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../golden/kitchen-sink/full-document.json'),
    'utf-8',
  ),
);

// Skipped (not failed) when TRANSFORMER_URL isn't set, so this never runs by accident locally.
const describeIfConfigured = TRANSFORMER_URL ? describe : describe.skip;

describeIfConfigured('deployed transformer smoke test', () => {
  it('produces the same JSON as the local golden reference for the kitchen-sink document', async () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (TRANSFORMER_BASIC_AUTH) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(TRANSFORMER_BASIC_AUTH).toString('base64');
    }

    const response = await fetch(TRANSFORMER_URL as string, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        requestedFormats: ['json'],
        contentVersion: 0,
        htmlContent: KITCHEN_SINK_HTML,
      }),
    });

    expect(response.status).toEqual(200);
    const body = await response.json();
    expect(body.jsonContent).toEqual(KITCHEN_SINK_GOLDEN.json);
  });
});
