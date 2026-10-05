import { Express } from 'express';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KITCHEN_SINK_HTML = fs.readFileSync(
  path.resolve(__dirname, '../fixtures/kitchen-sink/full-document.html'),
  'utf-8',
);

// A single Express app for the whole file: buildApp() registers prom-client's
// default metrics on the process-wide registry, which throws on a 2nd registration.
const app: Express = buildApp();

describe('POST /transform — API contract used by fr.wseduc.transformer (web-utils client)', () => {
  it('converts htmlContent to json + plainText when requested (blog create/update flow)', async () => {
    const res = await request(app)
      .post('/transform')
      .send({
        requestedFormats: ['html', 'json', 'plainText'],
        contentVersion: 0,
        htmlContent: '<p>Bonjour <strong>le monde</strong></p>',
        jsonContent: null,
        additionalExtensionIds: [],
      })
      .expect(200);

    expect(res.body.jsonContent).toMatchObject({
      type: 'doc',
      content: [
        expect.objectContaining({
          type: 'paragraph',
        }),
      ],
    });
    expect(res.body.plainTextContent).toContain('Bonjour');
    expect(res.body.cleanHtml).toContain('<strong>le monde</strong>');
  });

  it('converts jsonContent back to html (json2html direction)', async () => {
    const res = await request(app)
      .post('/transform')
      .send({
        requestedFormats: ['html'],
        contentVersion: 0,
        htmlContent: null,
        jsonContent: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Contenu déjà stocké en JSON' }],
            },
          ],
        },
        additionalExtensionIds: [],
      })
      .expect(200);

    expect(res.body.htmlContent).toContain('Contenu déjà stocké en JSON');
  });

  it('rejects a request with neither htmlContent nor jsonContent', async () => {
    const res = await request(app)
      .post('/transform')
      .send({
        requestedFormats: ['html', 'json'],
        contentVersion: 0,
        htmlContent: null,
        jsonContent: null,
        additionalExtensionIds: [],
      })
      .expect(400);

    expect(res.body.error).toBeTruthy();
  });

  it('activates optional extensions via additionalExtensionIds (conversation-history)', async () => {
    const res = await request(app)
      .post('/transform')
      .send({
        requestedFormats: ['json'],
        contentVersion: 0,
        htmlContent:
          '<div class="conversation-history"><div class="conversation-history-body"><p>Ancien message</p></div></div>',
        jsonContent: null,
        additionalExtensionIds: ['conversation-history'],
      })
      .expect(200);

    const types = JSON.stringify(res.body.jsonContent);
    expect(types).toContain('converstationHistory');
  });

  it('handles a full kitchen-sink document without error', async () => {
    const res = await request(app)
      .post('/transform')
      .send({
        requestedFormats: ['html', 'json', 'plainText'],
        contentVersion: 0,
        htmlContent: KITCHEN_SINK_HTML,
        jsonContent: null,
        additionalExtensionIds: [],
      })
      .expect(200);

    expect(res.body.jsonContent.type).toEqual('doc');
    expect(res.body.jsonContent.content.length).toBeGreaterThan(0);
  });
});

describe('GET /healthcheck', () => {
  it('reports success when the extension set can round-trip a sample document', async () => {
    const res = await request(app).get('/healthcheck').expect(200);
    expect(res.body).toEqual({ success: true, message: 'ok' });
  });
});
