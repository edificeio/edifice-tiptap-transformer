/**
 * Test-only helper: normalizes cosmetic HTML string differences between the
 * actual (v3) output and the v2 golden reference before comparing them.
 *
 * v2's @tiptap/html rendered HTML through `zeed-dom` (a lenient, custom-built DOM lib);
 * v3's `@tiptap/html/server` renders through `happy-dom` (a spec-compliant DOM) — a
 * deliberate upstream change, confirmed by reading both packages' source directly. The
 * extensions producing these strings are unchanged between versions; only the DOM engine
 * underneath them is, which accounts for every difference normalized here:
 * - whitespace/trailing `;` inside `style="..."` attributes: happy-dom's CSSOM
 *   canonicalizes style text differently than zeed-dom did (e.g. "text-align:center"
 *   vs v2's "text-align: center", or an added/missing trailing `;`) — but some of our
 *   own extensions (e.g. TableOrTemplateCell) hardcode a trailing `;` that's identical
 *   and correct in both versions, so this strips ALL style-internal whitespace/trailing
 *   `;` from BOTH sides before comparing, sidestepping that ambiguity entirely.
 * - boolean attributes serialized as `attr="true"` instead of the bare `attr` v2
 *   produced (e.g. video's `controls`)
 * - `attr="false"` rendered at all instead of omitted, as v2 did (e.g. video's
 *   `data-document-is-captation` when unset)
 * - literal `'` where v2 always emitted the `&apos;` entity
 * - `colspan="1"`/`rowspan="1"` on table cells: present or omitted depending on the exact
 *   @tiptap/extension-table patch version (these are the HTML defaults either way, so
 *   omitting them changes nothing) — stripped from both sides to avoid chasing every patch
 */
const BOOLEAN_TRUE_ATTRIBUTES = ['controls', 'allowfullscreen'];
const OMIT_WHEN_FALSE_ATTRIBUTES = ['data-document-is-captation'];
const DEFAULT_VALUED_ATTRIBUTES = [
  { name: 'colspan', defaultValue: '1' },
  { name: 'rowspan', defaultValue: '1' },
];

export function normalizeHtml(html: string): string {
  let normalized = html.replace(
    /style="([^"]*)"/g,
    (_match, styleValue: string) =>
      `style="${styleValue.replace(/\s*([:;])\s*/g, '$1').replace(/;$/, '')}"`,
  );
  for (const attr of BOOLEAN_TRUE_ATTRIBUTES) {
    normalized = normalized.replace(
      new RegExp(`\\s${attr}="true"`, 'g'),
      ` ${attr}`,
    );
  }
  for (const attr of OMIT_WHEN_FALSE_ATTRIBUTES) {
    normalized = normalized.replace(new RegExp(`\\s${attr}="false"`, 'g'), '');
  }
  for (const { name, defaultValue } of DEFAULT_VALUED_ATTRIBUTES) {
    normalized = normalized.replace(
      new RegExp(`\\s${name}="${defaultValue}"`, 'g'),
      '',
    );
  }
  normalized = normalized.replace(/'/g, '&apos;');
  return normalized;
}
