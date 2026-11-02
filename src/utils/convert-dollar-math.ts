import { JSONContent } from '@tiptap/core';

/**
 * v3's InlineMath only converts `$...$`/`$$...$$` into a math node via
 * live-typing input rules - ProseMirror's DOM parser has no concept of input
 * rules, so parsing an HTML string never triggers them. Content authored
 * outside a mounted editor (or pasted/imported) can still contain literal
 * dollar-delimited text, so it needs converting explicitly here.
 *
 * Two passes, in that order:
 * 1. `$$...$$` - the live editor's own inline-math shortcut (see
 *    `InlineMath`'s `addInputRules` in `@tiptap/extension-mathematics`; not
 *    exported, so the same pattern is mirrored here). Matched first so a
 *    double-dollar pair is never partially consumed by the looser
 *    single-dollar pass below (that pass requires only one `$` on each
 *    side, so it would otherwise treat the second `$` of a `$$` as the
 *    start of its own, bogus match).
 * 2. `$...$` - legacy single-dollar syntax (this app's old v2 editor).
 *    Rejects a `$` immediately preceded by a digit, optionally with one
 *    space (e.g. "5 $"), since that's a French currency suffix, not a math
 *    delimiter. Trade-off: legitimate math glued right after a digit (e.g.
 *    "1.$x+y$") won't convert either - the rarer case in practice.
 */
export function convertDollarMath(doc: JSONContent): JSONContent {
  return convertNode(doc);
}

// Lookbehind is safe here (unlike in the client-side extension, which avoids
// it for old WebKit support) since this only ever runs in Node.
const DOUBLE_DOLLAR_REGEX = /(?<!\$)\$\$([^$\n]+?)\$\$(?!\$)/g;
const SINGLE_DOLLAR_REGEX = /(?<!\d)(?<!\d )\$(?!\d+\$)(.+?)\$(?!\d)/g;

function convertNode(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const content = node.content.flatMap((child) =>
    child.type === 'text' && child.text
      ? splitTextNode(child)
      : convertNode(child),
  );
  return { ...node, content };
}

function splitTextNode(textNode: JSONContent): JSONContent[] {
  return splitByRegex(textNode, DOUBLE_DOLLAR_REGEX).flatMap((segment) =>
    segment.type === 'inlineMath'
      ? segment
      : splitByRegex(segment, SINGLE_DOLLAR_REGEX),
  );
}

function splitByRegex(textNode: JSONContent, regex: RegExp): JSONContent[] {
  const text = textNode.text as string;
  const segments: JSONContent[] = [];
  let lastIndex = 0;

  // Stateful (uses lastIndex) because of the `g` flag - reset before each
  // independent walk of this shared, module-level regex instance.
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, latex] = match;
    if (match.index > lastIndex) {
      segments.push({ ...textNode, text: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'inlineMath', attrs: { latex } });
    lastIndex = match.index + fullMatch.length;
  }

  if (segments.length === 0) return [textNode];
  if (lastIndex < text.length) {
    segments.push({ ...textNode, text: text.slice(lastIndex) });
  }
  return segments;
}
