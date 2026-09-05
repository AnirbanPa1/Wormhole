export type LibraryDocument = {
  id: string;
  title: string;
  localUri: string;
  pageCount: number;
  currentPage: number;
  importedAt: string;
  size: number | null;
  hasTextLayer?: boolean;
};
