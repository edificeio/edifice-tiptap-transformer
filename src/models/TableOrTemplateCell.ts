import { TableCell } from '@edifice.io/tiptap-extensions/table-cell';
import { getStyleProperty, mergeAttributes } from '@tiptap/core';

export default TableCell
  // WB-2568: old-format documents store text-align as style="text-align:XXX" on the <td>
  // itself; move it into a nested <p> instead, matching what the editor produces today.
  .extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        // Same v3 "" vs null bug as Color/FontSize/etc — see StyleCompat.ts.
        backgroundColor: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            getStyleProperty(element, 'background-color'),
          renderHTML: (attributes: { backgroundColor?: string }) =>
            !attributes.backgroundColor
              ? {}
              : { style: `background-color: ${attributes.backgroundColor}` },
        },
        'data-text-align': { default: null },
      };
    },
    parseHTML() {
      try {
        return [
          {
            // Simplified from 'td[style]:not(:where(> p))': happy-dom doesn't support :where()
            tag: 'td[style]',
            getAttrs: (node: HTMLElement) => {
              // Skip if the td already has a direct <p> child (aligned content already nested)
              if (node.querySelector(':scope > p')) return false;
              const textAlign = node.style.textAlign;
              if (
                ['left', 'right', 'center', 'justify'].findIndex(
                  (value) => value === textAlign,
                ) >= 0
              ) {
                return mergeAttributes(this.options.HTMLAttributes, {
                  'data-text-align': textAlign,
                });
              }
              return false;
            },
            //consuming: false,
            //skip: true,
          },
          // Non-null: the catch below handles the (never actually hit) case where it isn't.
          ...(this.parent!() ?? []),
        ];
      } catch {
        return this.parent?.();
      }
    },

    renderHTML(params) {
      const { HTMLAttributes } = params;
      const textAlign = HTMLAttributes?.['data-text-align'];
      if (textAlign) {
        const paragraphAttrs = { style: `text-align: ${textAlign};` };
        const cellAttrs = mergeAttributes(
          this.options.HTMLAttributes,
          HTMLAttributes,
          { 'data-text-align': undefined },
        );
        return ['td', cellAttrs, ['p', paragraphAttrs, 0]];
      }
      // This line keeps the transpiler happy
      if (!this.parent) {
        return [
          'td',
          mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
          0,
        ];
      }
      return this.parent({
        ...params,
        HTMLAttributes: { ...HTMLAttributes, 'data-text-align': undefined },
      });
    },
  })
  // Also parse old-format "cell column" divs as cells
  .extend({
    parseHTML() {
      return this.parent?.()?.concat([{ tag: '.cell.column' }]);
    },
  });
