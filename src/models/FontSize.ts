import { FontSize } from '@edifice.io/tiptap-extensions/font-size';
import { parseStyleProperty } from './StyleCompat.js';

// v3 bug: parseHTML falls back to element.style.fontSize, which is "" (not
// null) for an unset property under happy-dom — see StyleCompat.ts.
export default FontSize.extend({
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: parseStyleProperty('font-size'),
            renderHTML: (attributes: { fontSize?: string }) =>
              !attributes.fontSize
                ? {}
                : { style: `font-size: ${attributes.fontSize}` },
          },
        },
      },
    ];
  },
});
