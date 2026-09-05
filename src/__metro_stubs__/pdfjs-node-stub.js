/* global globalThis */

// Metro stub for Node.js-only modules that pdfjs-dist's legacy build references
// statically. These are only ever `require`d inside Node-specific code paths
// (Node stream readers, canvas polyfills, network loading) that React Native
// never reaches — but Metro still needs to *resolve* them at bundle time, so we
// redirect them here.

const noop = function noop() {};

// Minimal DOMMatrix polyfill — pdfjs-dist accesses `.prototype` on DOMMatrix
// during module initialisation. A bare `undefined` causes
// "Cannot read property 'prototype' of undefined". This stub is only exercised
// in code paths (canvas rendering, shading patterns) that React Native never
// reaches for text extraction, but the prototype access happens eagerly.
class DOMMatrix {
  constructor() {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
  }
  translate() {
    return this;
  }
  scale() {
    return this;
  }
  multiply() {
    return this;
  }
  setTransform() {
    return this;
  }
}

module.exports = {
  readFile: noop,
  readFileSync: noop,
  createReadStream: noop,
  lstat: noop,
  stat: noop,
  existsSync: noop,
};

module.exports.DOMMatrix = DOMMatrix;
module.exports.Canvas = undefined;
module.exports.CanvasRenderingContext2D = undefined;

// Ensure globalThis.DOMMatrix exists so pdfjs can reference its prototype
// even though checkDOMMatrix returns early in React Native (isNodeJS = false).
if (typeof globalThis !== 'undefined' && !globalThis.DOMMatrix) {
  globalThis.DOMMatrix = DOMMatrix;
}
