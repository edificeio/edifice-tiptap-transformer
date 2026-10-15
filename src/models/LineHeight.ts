import { LineHeight } from '@edifice.io/tiptap-extensions/line-height';
import { parseStyleProperty } from './StyleCompat.js';

// v3 bug: parseHTML falls back to element.style.lineHeight, which is "" (not
// null) for an unset property under happy-dom — see StyleCompat.ts.
export default LineHeight.extend({
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: parseStyleProperty('line-height'),
            renderHTML: (attributes: { lineHeight?: string }) =>
              !attributes.lineHeight
                ? {}
                : { style: `line-height: ${attributes.lineHeight}` },
          },
        },
      },
    ];
  },
});
