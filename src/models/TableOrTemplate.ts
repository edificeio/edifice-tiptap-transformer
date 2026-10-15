import { Table } from '@tiptap/extension-table';
import type { DOMOutputSpecArray } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export default Table.extend({
  // transformer-only : parse old-format "templates" as tables
  addAttributes() {
    return {
      template: {
        default: null,
      },
    };
  },
  parseHTML() {
    return [
      // Table's default parseHTML
      { tag: 'table' },
      // transformer-only: parse old-format "templates" as tables
      {
        tag: 'div.row',
        getAttrs: (el: HTMLElement | string) => {
          // Check if columns are present. If not, ignore the template attribute.
          if (!el || typeof el === 'string') return false;
          const columns = el.querySelectorAll('.column.cell');
          if (!columns || columns.length <= 0) return false;
          // Otherwise, determine columns width.
          const template: string[] = [];
          for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            if (column.classList.contains('image-template')) {
              template.push('30%');
              template.push('70%');
              break;
            }
            if (column.classList.contains('three')) {
              template.push('25%');
            } else if (column.classList.contains('four')) {
              template.push('33.33%');
            } else if (column.classList.contains('six')) {
              template.push('50%');
            } else if (column.classList.contains('eight')) {
              template.push('66.66%');
            } else if (column.classList.contains('nine')) {
              template.push('75%');
            } else {
              template.push('');
            }
          }
          return {
            template,
          };
        },
      },
    ];
  },
  renderHTML(props: {
    node: ProseMirrorNode;
    HTMLAttributes: Record<string, unknown>;
  }) {
    const { HTMLAttributes } = props;
    const columnsWidth = HTMLAttributes['template'] as
      | string[]
      | undefined
      | null;
    if (!columnsWidth || columnsWidth.length <= 0) {
      // Not a legacy "template": delegate to Table's renderHTML, which computes the
      // colgroup/min-width styling from the node's cells (the v3 port used to skip
      // this call and lost that styling).
      return this.parent!(props);
    }
    // Legacy "template": same delegation, then swap Table's colgroup for ours.
    // Table's own output is always ['table', attrs, colgroup, ['tbody', 0]].
    const [tag, attrs, , tbody] = this.parent!(props) as [
      string,
      Record<string, unknown>,
      unknown,
      DOMOutputSpecArray,
    ];
    const columns: DOMOutputSpecArray[] = columnsWidth.map((width) => [
      'col',
      { width },
    ]);
    return [tag, attrs, ['colgroup', {}, ...columns], tbody] as const;
  },
});
