export interface WordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextLayerPage {
  pageIndex: number;
  words: WordBox[];
  pageWidth: number;
  pageHeight: number;
  hasText: boolean;
}

export interface TextLayer {
  documentId: string;
  pages: TextLayerPage[];
  extractedAt: string;
}

export interface AbstractPositionedTextItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}
