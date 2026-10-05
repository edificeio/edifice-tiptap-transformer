import { Color } from '@tiptap/extension-color';
import { parseStyleProperty } from './StyleCompat.js';

// v3 bug: parseHTML falls back to element.style.color, which is "" (not null)
// for an unset property under happy-dom — see StyleCompat.ts.
export default Color.extend({
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          color: {
            default: null,
            parseHTML: parseStyleProperty('color'),
            renderHTML: (attributes: { color?: string }) =>
              !attributes.color ? {} : { style: `color: ${attributes.color}` },
          },
        },
      },
    ];
  },
});
