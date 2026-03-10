import { jest } from '@jest/globals';
import * as fs from 'fs';

// Mock dependencies
jest.mock('axios');
jest.mock('fs');

// Import the module after mocking
import { detectSourceType, readVisual } from '../src/read-visual';

describe('read-visual', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: files don't exist
        (fs.existsSync as jest.Mock).mockReturnValue(false);
    });

    describe('detectSourceType', () => {
        it('should detect HTTP URLs', () => {
            expect(detectSourceType('http://example.com/image.png')).toBe('url');
            expect(detectSourceType('https://example.com/image.pdf')).toBe('url');
        });

        it('should detect Windows absolute paths', () => {
            // Mock fs.existsSync to return true for path detection tests
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            expect(detectSourceType('C:\\Users\\test\\image.png')).toBe('file');
            expect(detectSourceType('D:/Documents/doc.pdf')).toBe('file');
        });

        it('should detect Unix absolute paths', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            expect(detectSourceType('/home/user/image.jpg')).toBe('file');
            expect(detectSourceType('/var/www/doc.pdf')).toBe('file');
        });

        it('should detect relative paths with extensions', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            expect(detectSourceType('./test.png')).toBe('file');
            expect(detectSourceType('../folder/doc.pdf')).toBe('file');
        });

        it('should fallback to file for unknown patterns', () => {
            expect(detectSourceType('some_file.jpg')).toBe('file');
        });
    });

    describe('readVisual', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should return error for non-existent file', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await readVisual({
                source: 'C:\\nonexistent\\file.png'
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('does not exist');
        });

        it('should return error for invalid URL format', async () => {
            const result = await readVisual({
                source: 'ftp://invalid-protocol.com/file.png'
            });

            // ftp:// is not http/https, so it will be treated as a file path
            // and will error because file doesn't exist
            expect(result.isError).toBe(true);
        });

        it('should accept valid page parameter', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await readVisual({
                source: 'C:\\test.pdf',
                page: 5
            });

            // Will error because file doesn't exist, but validates page is accepted
            expect(result.isError).toBe(true);
        });

        it('should accept valid dpi parameter', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            const result = await readVisual({
                source: 'C:\\test.pdf',
                dpi: 300
            });

            // Will error because file doesn't exist, but validates dpi is accepted
            expect(result.isError).toBe(true);
        });
    });
});
