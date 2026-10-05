import { TableCell } from '@edifice.io/tiptap-extensions/table-cell';
import { getStyleProperty, mergeAttributes } from '@tiptap/core';

export default TableCell
  /* transformer-only : WB-2568, preserve text-align attributes found on <td> in old-format documents.
   *
   * This extension moves the `style="text-align:XXX;"` attribute from the <td> to a nested <p> inside the <td>.
   * Known issue : when an <td> has no child except a text-node, the text-node will be wrapped in another <p>
   * and the final result will be `<td><p style="text-align:XXX;"><p>text node</p></p></td>`
   */
  .extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        // The package's own `backgroundColor` falls back to `element.style.backgroundColor`,
        // which happy-dom (v3) resolves to "" (not undefined) for an unset property, turning
        // its `default: null` into "" for every cell that has no background color set.
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
            // Simplified from 'td[style]:not(:where(> p))' — happy-dom doesn't support :where()
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
  /*
   * transformer-only : parse old-format "cell column" as cells
   */
  .extend({
    parseHTML() {
      return this.parent?.()?.concat([{ tag: '.cell.column' }]);
    },
  });
