import { Table } from '@tiptap/extension-table';
import { mergeAttributes } from '@tiptap/core';

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
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const columnsWidth: string[] | undefined | null = HTMLAttributes[
      'template'
    ] as string[] | undefined | null;
    const tableAttrs = mergeAttributes(
      this.options.HTMLAttributes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      HTMLAttributes as any,
    );
    if (!columnsWidth || columnsWidth.length <= 0) {
      return ['table', tableAttrs, ['tbody', 0]];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columns: any[] = columnsWidth.map((width) => [
      'col',
      { width: width },
    ]);
    return [
      'table',
      tableAttrs,
      ['colgroup', {}].concat(columns),
      ['tbody', 0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
  },
});
