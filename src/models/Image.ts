import { Image } from '@edifice.io/tiptap-extensions/image';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { styleObjectToCss } from './StyleCompat.js';

// Legacy "smiley" image detection sets attrs.style to a plain object instead
// of a CSS string, which only v2's DOM engine stringified on its own — see
// StyleCompat.ts.
export default Image.extend({
  renderHTML(props: {
    node: ProseMirrorNode;
    HTMLAttributes: Record<string, unknown>;
  }) {
    const HTMLAttributes = {
      ...props.HTMLAttributes,
      style: styleObjectToCss(
        props.HTMLAttributes.style as
          | string
          | Record<string, string>
          | undefined,
      ),
    };
    // Non-null: this node always has a parent renderHTML to delegate to.
    return this.parent!({ ...props, HTMLAttributes });
  },
});
