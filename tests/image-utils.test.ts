import { jest } from '@jest/globals';
import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('axios');
jest.mock('sharp');
jest.mock('fs');
jest.mock('path');

// Define mock types
type MockedSharp = {
  metadata: jest.Mock;
  resize: jest.Mock;
  toBuffer: jest.Mock;
  toFormat: jest.Mock;
  toFile: jest.Mock;
};

// Import the functions to test
import {
  extractImageFromUrl
} from '../src/image-utils';

describe('Image Processing Functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup default mocks
    (axios.get as jest.Mock).mockImplementation(() => {
      throw new Error('Network error');
    });
    
    // Create a mock sharp instance with properly typed methods
    const mockSharpInstance: MockedSharp = {
      // @ts-ignore - Ignore type error for mockResolvedValue
      metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
      resize: jest.fn().mockReturnThis(),
      // @ts-ignore - Ignore type error for mockResolvedValue
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
      toFormat: jest.fn().mockReturnThis(),
      // @ts-ignore - Ignore type error for mockResolvedValue
      toFile: jest.fn().mockResolvedValue(undefined)
    };
    
    ((sharp as unknown) as jest.Mock).mockImplementation(() => mockSharpInstance);
    
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  describe('extractImageFromUrl', () => {
    it('should validate URL format', async () => {
      const result = await extractImageFromUrl({
        url: 'invalid-url',
        resize: true,
        max_width: 800,
        max_height: 800
      });

      expect(result.content[0].text).toContain('Error: URL must start with http://');
    });

    it('should handle network errors', async () => {
      const result = await extractImageFromUrl({
        url: 'https://untrusted-domain.com/image.jpg',
        resize: true,
        max_width: 800,
        max_height: 800
      });

      expect(result.content[0].text).toContain('Error: Network error');
    });
  });

}); 