import { getStyleProperty } from '@tiptap/core';

/**
 * Fixes a bug shared by Color / FontFamily / LineHeight in TipTap v3: their parseHTML
 * falls back to `element.style.<prop>` when `getStyleProperty()` finds nothing, but that
 * fallback returns `""` (not `undefined`) for an unset CSS property under happy-dom — so
 * the attribute's JSON `default: null` is never applied, and content ends up with `""`
 * instead of `null` for every unrelated textStyle attribute. `getStyleProperty()` alone
 * already returns `null` correctly, so simply drop the buggy fallback.
 */
export function parseStyleProperty(cssProperty: string) {
  return (element: HTMLElement) => getStyleProperty(element, cssProperty);
}

/**
 * v2's @tiptap/html used zeed-dom, a lenient custom DOM lib that accepted a plain JS
 * object (e.g. `{ width: '1.5em', fontSize: '16px' }`) as a "style" attribute value and
 * stringified it itself. v3 switched to happy-dom, a spec-compliant DOM where assigning a
 * non-string to `style.cssText` doesn't do that — so an extension that (like the custom
 * Image extension's legacy "smiley" detection) sets `attrs.style` to an object instead of
 * a CSS string now silently renders `style=""` instead of the actual styling. Stringify it
 * ourselves wherever this can happen, converting camelCase keys to kebab-case to match the
 * CSS property names zeed-dom produced.
 */
export function styleObjectToCss(
  style: string | Record<string, string | number> | undefined,
): string | undefined {
  if (!style || typeof style === 'string') return style;
  return Object.entries(style)
    .map(
      ([property, value]) =>
        `${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value}`,
    )
    .join('; ');
}
