/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-documents/picker', () => ({
  errorCodes: {OPERATION_CANCELED: 'OPERATION_CANCELED'},
  isErrorWithCode: () => false,
  keepLocalCopy: jest.fn(),
  pick: jest.fn(),
  types: {pdf: 'application/pdf'},
}));

jest.mock('react-native-pdf-light', () => ({
  PdfUtil: {getPageCount: jest.fn()},
  PdfView: () => null,
}));

jest.mock('react-native-pdf-light/Zoom', () => ({
  ZoomPdfView: () => null,
}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/pdf-text-extractor.service', () => ({
  extractTextLayerPage: jest.fn(),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    asset: jest.fn().mockReturnValue('bundle-assets://dictionary.json'),
    dirs: {MainBundleDir: '/bundle'},
    readFile: jest.fn().mockResolvedValue(
      '{"meta":{"source":"test","home":"","license":"","words":0},"words":{}}',
    ),
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
