// PDF text-layer extraction powered by pdfjs-dist v3 (legacy CommonJS build).
//
// HOW IT WORKS IN REACT NATIVE
// ----------------------------
// pdfjs is a browser-targeted library. In a bare RN app (Hermes) there is no
// `window`, `document`, or `Worker`, so the real worker path cannot be used.
// pdfjs falls back to a "fake worker" that runs the worker code on the main JS
// thread. To make that work we pre-register the worker on `globalThis`
// (`globalThis.pdfjsWorker`). pdfjs checks `_mainThreadWorkerMessageHandler`
// (which reads `globalThis.pdfjsWorker`) at the very top of `_initialize()` and
// shortcuts past `window.location` / `new Worker` / `loadScript` entirely.
//
// The short-lived warnings about DOMMatrix/Path2D come from pdfjs attempting to
// polyfill canvas types at import time; they only affect *rendering* to a
// canvas, never the `getTextContent()` path used here, so they are safe to
// ignore.

import ReactNativeBlobUtil from 'react-native-blob-util';
import {
  ByteLengthQueuingStrategy as PolyfillByteLengthQueuingStrategy,
  CountQueuingStrategy as PolyfillCountQueuingStrategy,
  ReadableStream as PolyfillReadableStream,
  TransformStream as PolyfillTransformStream,
  WritableStream as PolyfillWritableStream,
} from 'web-streams-polyfill';
import type {
  TextLayer,
  TextLayerPage,
  WordBox,
} from '../types/text-layer';

// Hermes does not currently provide the WHATWG Streams globals used by
// pdfjs's message transport. Install the ponyfill on globalThis before either
// pdfjs bundle is required. This is JavaScript-only and needs no native build.
if (typeof globalThis !== 'undefined') {
  const runtime = globalThis as any;
  runtime.ReadableStream ??= PolyfillReadableStream;
  runtime.WritableStream ??= PolyfillWritableStream;
  runtime.TransformStream ??= PolyfillTransformStream;
  runtime.ByteLengthQueuingStrategy ??= PolyfillByteLengthQueuingStrategy;
  runtime.CountQueuingStrategy ??= PolyfillCountQueuingStrategy;
}

// Hermes does not expose DOMException in every React Native build. The
// pdf.worker compatibility bundle eagerly reads DOMException.prototype during
// module initialisation, before any document is opened, so provide the small
// Error-compatible surface it needs for the text-extraction path.
if (typeof globalThis !== 'undefined' && !(globalThis as any).DOMException) {
  class ReactNativeDOMException extends Error {
    code = 0;

    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  }

  (globalThis as any).DOMException = ReactNativeDOMException;
}

// Provide a minimal DOMMatrix polyfill before pdfjs loads. pdfjs-dist v3's
// legacy build accesses `DOMMatrix.prototype` during module initialisation;
// without this, Metro throws "Cannot read property 'prototype' of undefined".
if (typeof globalThis !== 'undefined' && !(globalThis as any).DOMMatrix) {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    translate(): this {
      return this;
    }
    scale(): this {
      return this;
    }
    multiply(): this {
      return this;
    }
    setTransform(): this {
      return this;
    }
  } as any;
}

// Use require() instead of import so the DOMMatrix polyfill above is evaluated
// before pdfjs's module initialisation code runs.
const PDFJSLib = require('pdfjs-dist/legacy/build/pdf.js');

// @ts-expect-error - pdfjs types reference `window`; the runtime value is what matters.
globalThis.pdfjsWorker = require('pdfjs-dist/legacy/build/pdf.worker.js');

const pdfjs = PDFJSLib as any;

export interface ExtractionProgress {
  pageIndex: number;
  pageCount: number;
}

export type ProgressCallback = (progress: ExtractionProgress) => void;

/**
 * Read a local file as raw bytes. `localUri` is a `file://` URI produced by
 * `keepLocalCopy`/document picker. react-native-blob-util's `ascii` encoding
 * returns an array of bytes, which is what pdfjs expects.
 */
async function readFileBytes(localUri: string): Promise<Uint8Array> {
  const clean = localUri.replace(/^file:/, '').replace(/^\/\//, '');
  const path = clean.startsWith('/') ? clean : `/${clean}`;
  const bytes = await ReactNativeBlobUtil.fs.readFile(path, 'ascii');

  if (bytes instanceof Uint8Array) {
    return bytes;
  }

  // The native module's codegen contract returns an ordinary JS array for
  // `ascii`; it does not cross the bridge as a Uint8Array.
  if (
    Array.isArray(bytes) &&
    bytes.every(
      value => Number.isInteger(value) && value >= -128 && value <= 255,
    )
  ) {
    // Android sends its native signed bytes as -128..127. Uint8Array.from()
    // wraps those values back to their original 0..255 binary representation.
    return Uint8Array.from(bytes);
  }

  throw new Error('PDF reader returned an unsupported file-byte format.');
}

/**
 * Split a line of positioned text into individual word boxes.
 *
 * pdfjs returns one item per text *run* (usually a whole line). Each run has a
 * bottom-left origin and a total width. We convert the origin to a top-left
 * coordinate and distribute the run width across the words it contains,
 * proportionally to each word's character count (spaces break words apart).
 * Coordinates are normalized to a 0..1 range relative to the page so the
 * overlay can scale to any rendered size.
 */
function lineToWordBoxes(
  str: string,
  transform: number[],
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): WordBox[] {
  const words: WordBox[] = [];
  const text = str.trim();
  if (!text) {
    return words;
  }

  const totalChars = text.length;
  if (pageWidth <= 0 || pageHeight <= 0 || totalChars === 0) {
    return words;
  }

  const left = transform[4] ?? 0;
  const bottom = transform[5] ?? 0;
  const normalizedHeight = Math.max(height, 1) / pageHeight;

  // Walk the string, tracking each token (word or whitespace) and how many
  // characters precede it so we can place it along the line width.
  const tokenRegex = /(\S+\s*)/g;
  let consumed = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[1];
    const tokenChars = token.length;
    if (tokenChars === 0) {
      continue;
    }

    const fractionStart = consumed / totalChars;
    consumed += tokenChars;
    const fractionEnd = consumed / totalChars;

    const word = token.trim();
    if (!word) {
      continue;
    }

    const wordLeft = left + fractionStart * width;
    const wordWidth = (fractionEnd - fractionStart) * width;

    // pdf origin is bottom-left; convert to top-left normalised coordinates.
    const normTop = 1 - (bottom + height) / pageHeight;
    const normLeft = wordLeft / pageWidth;
    const normWidth = Math.max(wordWidth / pageWidth, 1 / pageWidth);

    words.push({
      text: word,
      x: normLeft,
      y: normTop,
      width: normWidth,
      height: normalizedHeight,
    });
  }

  return words;
}

async function extractPage(
  page: any,
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
): Promise<TextLayerPage> {
  const textContent = await page.getTextContent();
  const words: WordBox[] = [];

  for (const item of textContent.items ?? []) {
    if (!item || typeof item.str !== 'string' || !item.str.trim()) {
      continue;
    }
    const transform = Array.isArray(item.transform)
      ? item.transform
      : ([1, 0, 0, 1, 0, 0] as number[]);
    const boxes = lineToWordBoxes(
      item.str,
      transform,
      item.width || 0,
      item.height || 0,
      pageWidth,
      pageHeight,
    );
    for (const box of boxes) {
      words.push(box);
    }
  }

  return {
    pageIndex,
    words,
    pageWidth,
    pageHeight,
    hasText: words.length > 0,
  };
}

/**
 * Extract the full text layer (word coordinates per page) for a local PDF.
 * Triggers the manuaal "Analyze" flow; runs entirely on-device and offline.
 */
export async function extractTextLayer(
  localUri: string,
  documentId: string,
  onProgress?: ProgressCallback,
): Promise<TextLayer> {
  const data = await readFileBytes(localUri);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const pages: TextLayerPage[] = [];

  try {
    const pageCount = doc.numPages;
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
      const page = await doc.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const pageHeight = viewport.height;

      const extracted = await extractPage(
        page,
        pageIndex - 1,
        pageWidth,
        pageHeight,
      );
      pages.push(extracted);

      if (onProgress) {
        onProgress({ pageIndex: pageIndex - 1, pageCount });
      }
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }

  return {
    documentId,
    pages,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Extract one zero-based PDF page for the capture-style dictionary flow.
 * Keeping this separate from full-book extraction makes entering word-selection
 * mode quick and lets callers merge the page into their existing cache.
 */
export async function extractTextLayerPage(
  localUri: string,
  documentId: string,
  pageIndex: number,
): Promise<TextLayer> {
  const data = await readFileBytes(localUri);
  const loadingTask = pdfjs.getDocument({data});
  const doc = await loadingTask.promise;

  try {
    if (pageIndex < 0 || pageIndex >= doc.numPages) {
      throw new Error('The selected PDF page is out of range.');
    }

    const pdfPage = await doc.getPage(pageIndex + 1);
    const viewport = pdfPage.getViewport({scale: 1});
    const extracted = await extractPage(
      pdfPage,
      pageIndex,
      viewport.width,
      viewport.height,
    );

    return {
      documentId,
      pages: [extracted],
      extractedAt: new Date().toISOString(),
    };
  } finally {
    await doc.destroy().catch(() => undefined);
  }
}

export function findWordAt(
  layer: TextLayer,
  pageIndex: number,
  normalizedX: number,
  normalizedY: number,
): WordBox | null {
  const page = layer.pages.find(candidate => candidate.pageIndex === pageIndex);
  if (!page || !page.hasText || !page.words) {
    return null;
  }

  // Small tolerance so taps near a word still select it.
  const tolerance = 0.012;
  let best: { box: WordBox; dx: number } | null = null;

  for (const word of page.words) {
    const inside =
      normalizedX >= word.x - tolerance &&
      normalizedX <= word.x + word.width + tolerance &&
      normalizedY >= word.y - tolerance &&
      normalizedY <= word.y + word.height + tolerance;

    if (inside) {
      const dx = Math.min(
        Math.abs(normalizedX - word.x),
        Math.abs(normalizedX - (word.x + word.width)),
      );
      if (!best || dx < best.dx) {
        best = { box: word, dx };
      }
    }
  }

  return best ? best.box : null;
}
