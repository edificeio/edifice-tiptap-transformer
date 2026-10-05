import { Response } from 'express';
import { TransformationFormat } from '../models/format.js';
import TableOrTemplate from '../models/TableOrTemplate.js';
import TableOrTemplateCell from '../models/TableOrTemplateCell.js';
import { parseStyleProperty, styleObjectToCss } from '../models/StyleCompat.js';
import {
  AuthenticatedRequest,
  ContentTransformerRequest,
  ContentTransformerResponse,
} from '../models/transformation-request.js';

import { generateText } from '@tiptap/core';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import {
  AttachmentTransformer,
  ConversationHistoryBody,
} from '@edifice.io/tiptap-extensions';
import { Alert } from '@edifice.io/tiptap-extensions/alert';
import { Attachment } from '@edifice.io/tiptap-extensions/attachment';
import { Audio } from '@edifice.io/tiptap-extensions/audio';
import { ConversationHistory } from '@edifice.io/tiptap-extensions/conversation-history';
import { FontSize } from '@edifice.io/tiptap-extensions/font-size';
import { CustomHeading } from '@edifice.io/tiptap-extensions/heading';
import { CustomHighlight } from '@edifice.io/tiptap-extensions/highlight';
import { Hyperlink } from '@edifice.io/tiptap-extensions/hyperlink';
import { Iframe } from '@edifice.io/tiptap-extensions/iframe';
import { Image } from '@edifice.io/tiptap-extensions/image';
import { InformationPane } from '@edifice.io/tiptap-extensions/information-pane';
import { LineHeight } from '@edifice.io/tiptap-extensions/line-height';
import { Linker } from '@edifice.io/tiptap-extensions/linker';
import { MathJax } from '@edifice.io/tiptap-extensions/mathjax';
import { Paragraph } from '@edifice.io/tiptap-extensions/paragraph';
import { Video } from '@edifice.io/tiptap-extensions/video';

import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Typography } from '@tiptap/extension-typography';
import { Underline } from '@tiptap/extension-underline';
import { StarterKit } from '@tiptap/starter-kit';
import {
  cleanHtmlCounter,
  cleanHtmlTimer,
  cleanJsonCounter,
  cleanJsonTimer,
  h2jCounter,
  h2jTimer,
  h2plainTextCounter,
  h2plainTextTimer,
  j2hCounter,
  j2hTimer,
  j2plainTextCounter,
  j2plainTextTimer,
  updateCounterAndTimer,
} from './metrics-controller.js';

export const EXTENSIONS = [
  // v3's StarterKit now bundles `heading`, `underline` and `link` by default (none of
  // which it did in v2), silently duplicating/shadowing the custom Paragraph/Heading/
  // Underline/Hyperlink below. Disabled to keep the exact same schema/parsing as v2.
  StarterKit.configure({
    paragraph: false,
    heading: false,
    underline: false,
    link: false,
  }),
  Paragraph,
  CustomHighlight.configure({
    multicolor: true,
  }),
  Underline,
  TextStyle,
  // Color/FontFamily/FontSize/LineHeight all fall back to `element.style.<prop>` when
  // nothing is found, which happy-dom (v3) resolves to "" instead of undefined for an
  // unset CSS property — turning every *other* textStyle attribute's `null` default into
  // "" as soon as a span has any style at all. Re-declaring parseHTML with the safe
  // getStyleProperty()-only helper (src/models/StyleCompat.ts) fixes this.
  Color.extend({
    addGlobalAttributes() {
      return [
        {
          types: ['textStyle'],
          attributes: {
            color: {
              default: null,
              parseHTML: parseStyleProperty('color'),
              renderHTML: (attributes: { color?: string }) =>
                !attributes.color
                  ? {}
                  : { style: `color: ${attributes.color}` },
            },
          },
        },
      ];
    },
  }),
  Subscript,
  Superscript,
  TableOrTemplate,
  TableRow,
  TableHeader,
  TableOrTemplateCell,
  TextAlign.configure({
    types: ['heading', 'paragraph', 'custom-image', 'video', 'audio', 'iframe'],
  }),
  // The published package renamed this node's internal name to 'customHeading' (to dodge
  // v3 StarterKit's now-bundled 'heading' — see above), which would otherwise change the
  // JSON schema and break every already-stored document containing a heading. Pinning the
  // name back to 'heading' keeps the exact same schema as v2, with zero migration needed.
  CustomHeading.extend({ name: 'heading' }).configure({
    levels: [1, 2],
  }),
  Typography,
  // Same "" vs null fallback bug as Color above — see StyleCompat.ts.
  FontSize.extend({
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
  }),
  LineHeight.extend({
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
  }),
  Iframe,
  Hyperlink,
  // Same "" vs null fallback bug as Color above — see StyleCompat.ts.
  FontFamily.extend({
    addGlobalAttributes() {
      return [
        {
          types: ['textStyle'],
          attributes: {
            fontFamily: {
              default: null,
              parseHTML: parseStyleProperty('font-family'),
              renderHTML: (attributes: { fontFamily?: string }) =>
                !attributes.fontFamily
                  ? {}
                  : { style: `font-family: ${attributes.fontFamily}` },
            },
          },
        },
      ];
    },
  }),
  MathJax,
  Alert,
  Video,
  Audio,
  Linker,
  // The legacy "smiley" image detection sets `attrs.style` to a plain object (not a CSS
  // string), which only zeed-dom (v2) stringified on its own — see StyleCompat.ts.
  Image.extend({
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
  }),
  Attachment,
  AttachmentTransformer,
  InformationPane,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ADDITIONAL_EXTENSIONS = new Map<string, any[] | any>([
  ['conversation-history', [ConversationHistory, ConversationHistoryBody]],
]);

export function transformController(
  req: AuthenticatedRequest,
  res: Response,
  serviceVersion: number,
): Promise<void> {
  const data: ContentTransformerRequest = req.body as ContentTransformerRequest;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let extensions: any[] = [...EXTENSIONS];
  if (
    data.additionalExtensionIds !== null &&
    data.additionalExtensionIds !== undefined &&
    data.additionalExtensionIds.length > 0
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const additionalExtensions: any[] = [];
    data.additionalExtensionIds.forEach((extensionId) => {
      const extTmp = ADDITIONAL_EXTENSIONS.get(extensionId);
      if (extTmp) {
        if (Array.isArray(extTmp)) {
          additionalExtensions.push(...extTmp);
        } else {
          additionalExtensions.push(extTmp);
        }
      }
    });
    extensions = [...extensions, ...additionalExtensions];
  }
  let generatedHtmlContent;
  let generatedJsonContent;
  let plainTextContent;
  let cleanHtml;
  let cleanJson;
  if (!data.htmlContent && !data.jsonContent) {
    res.status(400);
    res.json({ error: 'No specified content to transform.' });
    return Promise.resolve();
  } else {
    if (data.requestedFormats.includes(TransformationFormat.HTML)) {
      // Transforming content to HTML
      if (data.jsonContent != null) {
        const start = Date.now();
        generatedHtmlContent = generateHTML(data.jsonContent, extensions);
        updateCounterAndTimer(start, j2hCounter, j2hTimer);
      }
      // Cleaning HTML content
      if (data.htmlContent != null) {
        const start = Date.now();
        cleanHtml = generateHTML(
          generateJSON(data.htmlContent, extensions),
          extensions,
        );
        updateCounterAndTimer(start, cleanHtmlCounter, cleanHtmlTimer);
      }
    }
    if (data.requestedFormats.includes(TransformationFormat.JSON)) {
      // Transforming content to JSON
      if (data.htmlContent != null) {
        const start = Date.now();
        generatedJsonContent = generateJSON(data.htmlContent, extensions);
        updateCounterAndTimer(start, h2jCounter, h2jTimer);
      }
      // Cleaning JSON content
      if (data.jsonContent != null) {
        const start = Date.now();
        cleanJson = generateJSON(
          generateHTML(data.jsonContent, extensions),
          extensions,
        );
        updateCounterAndTimer(start, cleanJsonCounter, cleanJsonTimer);
      }
    }
    // Transforming content to PLAIN TEXT
    if (data.requestedFormats.includes(TransformationFormat.PLAINTEXT)) {
      if (data.jsonContent != null) {
        const start = Date.now();
        plainTextContent = generateText(data.jsonContent, extensions);
        updateCounterAndTimer(start, j2plainTextCounter, j2plainTextTimer);
      } else if (data.htmlContent != null) {
        const start = Date.now();
        if (generatedJsonContent != null) {
          plainTextContent = generateText(generatedJsonContent, extensions);
        } else {
          plainTextContent = generateText(
            generateJSON(data.htmlContent, extensions),
            extensions,
          );
        }
        updateCounterAndTimer(start, h2plainTextCounter, h2plainTextTimer);
      }
    }
    const response: ContentTransformerResponse = {
      contentVersion: serviceVersion,
      htmlContent: generatedHtmlContent,
      jsonContent: generatedJsonContent,
      plainTextContent: plainTextContent,
      cleanHtml: cleanHtml,
      cleanJson: cleanJson,
    } as ContentTransformerResponse;
    res.json(response);
    return Promise.resolve();
  }
}

export function healthCheck(res: Response) {
  let result: { success: boolean; message: string } = {
    success: true,
    message: 'ok',
  };
  let resCode = 200;
  try {
    generateJSON(SAMPLE_HTML, EXTENSIONS);
  } catch (e) {
    console.error(`msg="Cannot generate json"`);
    console.error(e);
    resCode = 500;
    result = { success: false, message: 'cannot.generate.json' };
  }
  if (resCode === 200) {
    try {
      generateHTML(SAMPLE_JSON, EXTENSIONS);
    } catch (e) {
      console.error(`msg="Cannot generate json"`);
      console.error(e);
      resCode = 500;
      result = { success: false, message: 'cannot.generate.html' };
    }
  }
  res.status(resCode);
  res.json(result);
}

const SAMPLE_JSON = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: {
        textAlign: 'left',
      },
      content: [
        {
          type: 'text',
          text: 'Le lorem ipsum est, en imprimerie, une suite de mots sans signification utilisée à titre provisoire pour calibrer une mise en page',
        },
      ],
    },
  ],
};

const SAMPLE_HTML = '<div>Hello world</div>';
