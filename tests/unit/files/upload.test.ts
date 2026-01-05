/**
 * File upload handling tests
 */

import { describe, it, expect, jest } from '@jest/globals';
import type { ApiMethods } from '../../../src/api';

const baseMessage = {
  chat: { id: 42 },
  message_id: 100,
} as const;

describe('handleFileUpload', () => {
  it('downloads and saves document uploads', async () => {
    const { handleFileUpload } = require('../../../src/features/files/commands');

    const api = {
      getFile: jest.fn<() => Promise<{ file_path: string }>>().mockResolvedValue({ file_path: 'docs/file.txt' }),
      downloadFile: jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from('abc')),
      sendChatAction: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      sendMessage: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    } as unknown as ApiMethods;

    const fileService = {
      saveFile: jest.fn().mockReturnValue({
        id: 'file123',
        fileName: 'file.txt',
        fileSize: 3,
      }),
    };

    const message = {
      ...baseMessage,
      document: {
        file_id: 'abc123',
        file_name: 'file.txt',
        mime_type: 'text/plain',
      },
    };

    await handleFileUpload(api, message, fileService);

    expect(api.getFile).toHaveBeenCalledWith('abc123');
    expect(api.downloadFile).toHaveBeenCalledWith('docs/file.txt');
    expect(fileService.saveFile).toHaveBeenCalledWith(
      '42',
      'file.txt',
      expect.any(Buffer),
      'text/plain'
    );
    expect(api.sendMessage).toHaveBeenCalled();
  });

  it('downloads and saves photo uploads', async () => {
    const { handleFileUpload } = require('../../../src/features/files/commands');

    const api = {
      getFile: jest.fn<() => Promise<{ file_path: string }>>().mockResolvedValue({ file_path: 'photos/photo.jpg' }),
      downloadFile: jest.fn<() => Promise<Buffer>>().mockResolvedValue(Buffer.from('photo')),
      sendChatAction: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      sendMessage: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
    } as unknown as ApiMethods;

    const fileService = {
      saveFile: jest.fn().mockReturnValue({
        id: 'photo123',
        fileName: 'photo_100.jpg',
        fileSize: 5,
      }),
    };

    const message = {
      ...baseMessage,
      photo: [
        { file_id: 'small', file_size: 100 },
        { file_id: 'large', file_size: 200 },
      ],
    };

    await handleFileUpload(api, message, fileService);

    expect(api.getFile).toHaveBeenCalledWith('large');
    expect(api.downloadFile).toHaveBeenCalledWith('photos/photo.jpg');
    expect(fileService.saveFile).toHaveBeenCalled();
  });
});
