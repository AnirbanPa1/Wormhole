import type {LibraryDocument} from '../../types/library';

function timestampFor(document: LibraryDocument): number {
  const value = Date.parse(document.lastReadAt ?? document.importedAt);
  return Number.isFinite(value) ? value : 0;
}

export function isDocumentComplete(document: LibraryDocument): boolean {
  return (
    Boolean(document.completedAt) ||
    (document.pageCount > 0 && document.currentPage >= document.pageCount - 1)
  );
}

export function sortDocumentsByReadingActivity(
  documents: LibraryDocument[],
): LibraryDocument[] {
  return [...documents].sort(
    (left, right) => timestampFor(right) - timestampFor(left),
  );
}

export function recordDocumentOpened(
  document: LibraryDocument,
  openedAt: string,
): LibraryDocument {
  return {...document, lastReadAt: openedAt};
}

export function recordReadingProgress(
  document: LibraryDocument,
  requestedPage: number,
  readAt: string,
): LibraryDocument {
  const lastPage = Math.max(0, document.pageCount - 1);
  const currentPage = Math.max(0, Math.min(requestedPage, lastPage));
  const reachedEnd = document.pageCount > 0 && currentPage >= lastPage;

  return {
    ...document,
    currentPage,
    lastReadAt: readAt,
    completedAt: reachedEnd ? document.completedAt ?? readAt : document.completedAt,
  };
}
