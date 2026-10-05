import { CustomHeading } from '@edifice.io/tiptap-extensions/heading';

// The published package renamed this node to 'customHeading' to avoid
// colliding with v3 StarterKit's now-bundled 'heading'. Pinning the name
// back to 'heading' keeps the JSON schema unchanged for stored content.
export default CustomHeading.extend({ name: 'heading' });
