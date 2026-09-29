import {
  isDocumentComplete,
  recordDocumentOpened,
  recordReadingProgress,
  sortDocumentsByReadingActivity,
} from '../src/features/library/library-progress';
import type {LibraryDocument} from '../src/types/library';

function book(overrides: Partial<LibraryDocument> = {}): LibraryDocument {
  return {
    id: 'book',
    title: 'Book',
    localUri: 'file:///book.pdf',
    pageCount: 10,
    currentPage: 0,
    importedAt: '2026-01-01T00:00:00.000Z',
    size: null,
    ...overrides,
  };
}

describe('library reading progress', () => {
  it('records backward navigation as the current page', () => {
    const updated = recordReadingProgress(
      book({currentPage: 7}),
      3,
      '2026-02-01T00:00:00.000Z',
    );

    expect(updated.currentPage).toBe(3);
    expect(updated.lastReadAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('marks a book completed when its final page is reached', () => {
    const updated = recordReadingProgress(
      book(),
      9,
      '2026-02-01T00:00:00.000Z',
    );

    expect(isDocumentComplete(updated)).toBe(true);
    expect(updated.completedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('recognizes legacy progress already saved on the final page', () => {
    expect(isDocumentComplete(book({currentPage: 9}))).toBe(true);
  });

  it('keeps completion after revisiting an earlier page', () => {
    const updated = recordReadingProgress(
      book({completedAt: '2026-02-01T00:00:00.000Z'}),
      4,
      '2026-02-02T00:00:00.000Z',
    );

    expect(updated.currentPage).toBe(4);
    expect(updated.completedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('orders books by their latest reading activity', () => {
    const older = book({id: 'older', lastReadAt: '2026-02-01T00:00:00.000Z'});
    const latest = recordDocumentOpened(
      book({id: 'latest'}),
      '2026-02-02T00:00:00.000Z',
    );

    expect(sortDocumentsByReadingActivity([older, latest])).toEqual([
      latest,
      older,
    ]);
  });
});
