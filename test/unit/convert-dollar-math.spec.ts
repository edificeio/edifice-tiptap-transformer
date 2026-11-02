import { JSONContent } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { convertDollarMath } from '../../src/utils/convert-dollar-math.js';

function paragraph(content: JSONContent[]): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

describe('convertDollarMath', () => {
  it('splits a single $...$ equation in the middle of a text node', () => {
    const doc = paragraph([
      { type: 'text', text: 'Energy: $E=mc^2$ at rest.' },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'Energy: ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: ' at rest.' },
      ]),
    );
  });

  it('handles an equation at the very start of the text (no leading text node)', () => {
    const doc = paragraph([{ type: 'text', text: '$E=mc^2$ at rest.' }]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: ' at rest.' },
      ]),
    );
  });

  it('handles an equation at the very end of the text (no trailing text node)', () => {
    const doc = paragraph([{ type: 'text', text: 'Rest energy: $E=mc^2$' }]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'Rest energy: ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
      ]),
    );
  });

  it('handles multiple equations in the same text node', () => {
    const doc = paragraph([{ type: 'text', text: '$a=1$ and $b=2$.' }]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'inlineMath', attrs: { latex: 'a=1' } },
        { type: 'text', text: ' and ' },
        { type: 'inlineMath', attrs: { latex: 'b=2' } },
        { type: 'text', text: '.' },
      ]),
    );
  });

  it('leaves text with no $...$ unchanged', () => {
    const doc = paragraph([{ type: 'text', text: 'No maths here.' }]);

    expect(convertDollarMath(doc)).toEqual(doc);
  });

  it('preserves marks on the surrounding text segments', () => {
    const doc = paragraph([
      {
        type: 'text',
        marks: [{ type: 'bold' }],
        text: 'bold $E=mc^2$ text',
      },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', marks: [{ type: 'bold' }], text: ' text' },
      ]),
    );
  });

  it('recurses into nested content (e.g. inside a table cell)', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '$x^2$' }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(convertDollarMath(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableCell',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'inlineMath', attrs: { latex: 'x^2' } }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('does not treat a lone, unpaired $ as math', () => {
    const doc = paragraph([{ type: 'text', text: 'Price: $5 only.' }]);

    expect(convertDollarMath(doc)).toEqual(doc);
  });

  it('converts a $$...$$ equation to clean latex, with no orphan $ left over', () => {
    const doc = paragraph([
      { type: 'text', text: 'Energy: $$E=mc^2$$ at rest.' },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'Energy: ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: ' at rest.' },
      ]),
    );
  });

  it('does not treat two unrelated currency amounts ("5 $ ... 10 $") as an equation', () => {
    const doc = paragraph([
      { type: 'text', text: 'The book costs 5 $ instead of 10 $ today.' },
    ]);

    expect(convertDollarMath(doc)).toEqual(doc);
  });

  it('does not treat currency amounts without a space ("5$ ... 10$") as an equation', () => {
    const doc = paragraph([
      { type: 'text', text: 'The book costs 5$ instead of 10$ today.' },
    ]);

    expect(convertDollarMath(doc)).toEqual(doc);
  });

  it('ignores currency amounts but still converts a real equation in the same text', () => {
    const doc = paragraph([
      {
        type: 'text',
        text: 'It costs 5 $ instead of 10 $, see $E=mc^2$.',
      },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'It costs 5 $ instead of 10 $, see ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: '.' },
      ]),
    );
  });

  it('ignores a currency amount that comes after a real equation', () => {
    const doc = paragraph([
      { type: 'text', text: 'See $E=mc^2$, it costs 5 $ to print.' },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'See ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: ', it costs 5 $ to print.' },
      ]),
    );
  });

  it('does not treat a single, unpaired currency amount as math', () => {
    const doc = paragraph([{ type: 'text', text: 'It costs 5 $ to print.' }]);

    expect(convertDollarMath(doc)).toEqual(doc);
  });

  it('handles multiple $$...$$ equations in the same text node', () => {
    const doc = paragraph([{ type: 'text', text: '$$a=1$$ and $$b=2$$.' }]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'inlineMath', attrs: { latex: 'a=1' } },
        { type: 'text', text: ' and ' },
        { type: 'inlineMath', attrs: { latex: 'b=2' } },
        { type: 'text', text: '.' },
      ]),
    );
  });

  it('combines a $$...$$ equation with an unrelated currency amount in the same text', () => {
    const doc = paragraph([
      {
        type: 'text',
        text: 'The formula $$E=mc^2$$ costs 5 $ to print.',
      },
    ]);

    expect(convertDollarMath(doc)).toEqual(
      paragraph([
        { type: 'text', text: 'The formula ' },
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: ' costs 5 $ to print.' },
      ]),
    );
  });
});
