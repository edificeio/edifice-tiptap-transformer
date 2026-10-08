import { FontFamily } from '@tiptap/extension-font-family';
import { parseStyleProperty } from './StyleCompat.js';

// v3 bug: parseHTML falls back to element.style.fontFamily, which is "" (not
// null) for an unset property under happy-dom — see StyleCompat.ts.
export default FontFamily.extend({
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: parseStyleProperty('font-family'),
            renderHTML: (attributes: { fontFamily?: string }) =>
              !attributes.fontFamily
                ? {}
                : { style: `font-family: ${attributes.fontFamily}` },
          },
        },
      },
    ];
  },
});
