import { getStyleProperty } from '@tiptap/core';

/**
 * TipTap v3 bug (Color/FontFamily/FontSize/LineHeight): when an attribute isn't found,
 * their parseHTML falls back to `element.style.<prop>`, which happy-dom (v3's DOM) returns
 * as `""` instead of `undefined` for an unset CSS property — so the attribute's `default:
 * null` never applies. `getStyleProperty()` alone already returns `null` correctly, so we
 * drop the buggy fallback.
 */
export function parseStyleProperty(cssProperty: string) {
  return (element: HTMLElement) => getStyleProperty(element, cssProperty);
}

/**
 * v2's DOM engine (zeed-dom) accepted a plain JS object (e.g. `{ fontSize: '16px' }`) as a
 * "style" value and stringified it for us. v3's DOM engine (happy-dom) doesn't, so an
 * extension that sets `attrs.style` to an object (e.g. the legacy "smiley" image detection)
 * now renders `style=""` instead of the actual styling. We stringify it ourselves here.
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
