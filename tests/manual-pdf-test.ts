#!/usr/bin/env ts-node
/**
 * Manual PDF test script - bypasses Jest to test actual functionality
 * Run with: npx ts-node tests/manual-pdf-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    extractPdfFromFile,
    extractPdfFromBase64,
    ExtractPdfFromFileParams,
    ExtractPdfFromBase64Params
} from '../src/pdf-utils';

const testPdfPath = path.join(__dirname, '..', 'tmp', 'test_pdf.pdf');

async function runTests() {
    console.log('=== PDF Manual Test Suite ===\n');

    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;

    // Check if test PDF exists
    if (!fs.existsSync(testPdfPath)) {
        console.error(`❌ Test PDF not found at: ${testPdfPath}`);
        console.log('Please ensure test_pdf.pdf exists in the tmp directory.');
        process.exit(1);
    }

    console.log(`✓ Found test PDF at: ${testPdfPath}\n`);

    // Test 1: Extract first page from PDF
    console.log('Test 1: Extract first page from PDF file');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: testPdfPath,
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromFile(params);

        if (result.isError) {
            console.error(`  ❌ FAILED: ${result.content[0].type === 'text' ? result.content[0].text : 'Unknown error'}`);
            failedTests++;
        } else {
            const textContent = result.content.find(c => c.type === 'text');
            const imageContent = result.content.find(c => c.type === 'image');

            if (!textContent || !imageContent) {
                console.error('  ❌ FAILED: Missing text or image content');
                failedTests++;
            } else {
                const metadata = JSON.parse((textContent as any).text);
                console.log(`  ✓ PASSED`);
                console.log(`    - Source: ${metadata.source}`);
                console.log(`    - Page: ${metadata.page}`);
                console.log(`    - Total pages: ${metadata.totalPages}`);
                console.log(`    - DPI: ${metadata.dpi}`);
                console.log(`    - Image format: PNG`);
                console.log(`    - Image data length: ${(imageContent as any).data?.length || 0} chars`);
                passedTests++;
            }
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 2: Handle non-existent file
    console.log('Test 2: Handle non-existent file');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: '/path/to/nonexistent.pdf',
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromFile(params);

        if (result.isError && result.content[0].type === 'text' && result.content[0].text.includes('does not exist')) {
            console.log('  ✓ PASSED: Correctly handled non-existent file');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Should have returned error for non-existent file');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 3: Handle invalid page number (0)
    console.log('Test 3: Handle invalid page number (page 0)');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: testPdfPath,
            page: 0,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromFile(params);

        if (result.isError && result.content[0].type === 'text' && result.content[0].text.includes('out of range')) {
            console.log('  ✓ PASSED: Correctly rejected page 0');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Should have returned "out of range" error');
            if (result.content[0].type === 'text') {
                console.error(`    Got: ${result.content[0].text}`);
            }
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 4: Handle page number too high
    console.log('Test 4: Handle page number too high (page 9999)');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: testPdfPath,
            page: 9999,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromFile(params);

        if (result.isError && result.content[0].type === 'text' && result.content[0].text.includes('out of range')) {
            console.log('  ✓ PASSED: Correctly rejected page 9999');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Should have returned "out of range" error');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 5: Extract with focus_xyxy cropping
    console.log('Test 5: Extract with focus_xyxy cropping');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: testPdfPath,
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512,
            focus_xyxy: [0.25, 0.25, 0.75, 0.75]
        };

        const result = await extractPdfFromFile(params);

        if (!result.isError && result.content.find(c => c.type === 'image')) {
            console.log('  ✓ PASSED: Successfully extracted with focus_xyxy');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Could not extract with focus_xyxy');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 6: Extract with focal_point cropping
    console.log('Test 6: Extract with focal_point cropping');
    try {
        const params: ExtractPdfFromFileParams = {
            file_path: testPdfPath,
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512,
            focal_point: [0.5, 0.5, 256, 256]
        };

        const result = await extractPdfFromFile(params);

        if (!result.isError && result.content.find(c => c.type === 'image')) {
            console.log('  ✓ PASSED: Successfully extracted with focal_point');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Could not extract with focal_point');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 7: Extract from base64
    console.log('Test 7: Extract from base64-encoded PDF');
    try {
        const pdfBuffer = fs.readFileSync(testPdfPath);
        const base64 = pdfBuffer.toString('base64');

        const params: ExtractPdfFromBase64Params = {
            base64,
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromBase64(params);

        if (!result.isError && result.content.find(c => c.type === 'image')) {
            console.log('  ✓ PASSED: Successfully extracted from base64');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Could not extract from base64');
            if (result.isError && result.content[0].type === 'text') {
                console.error(`    Error: ${result.content[0].text}`);
            }
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 8: Handle invalid base64
    console.log('Test 8: Handle invalid base64 string');
    try {
        const params: ExtractPdfFromBase64Params = {
            base64: 'not-valid-base64!!!',
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromBase64(params);

        if (result.isError && result.content[0].type === 'text' && result.content[0].text.toLowerCase().includes('invalid base64')) {
            console.log('  ✓ PASSED: Correctly rejected invalid base64');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Should have returned "Invalid base64" error');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Test 9: Handle empty base64
    console.log('Test 9: Handle empty base64 string');
    try {
        const params: ExtractPdfFromBase64Params = {
            base64: '',
            page: 1,
            resize: true,
            max_width: 512,
            max_height: 512
        };

        const result = await extractPdfFromBase64(params);

        if (result.isError && result.content[0].type === 'text' && result.content[0].text.toLowerCase().includes('invalid base64')) {
            console.log('  ✓ PASSED: Correctly rejected empty base64');
            passedTests++;
        } else {
            console.error('  ❌ FAILED: Should have returned "Invalid base64" error');
            failedTests++;
        }
    } catch (error) {
        console.error(`  ❌ FAILED: ${error instanceof Error ? error.message : String(error)}`);
        failedTests++;
    }
    console.log();

    // Summary
    console.log('=== Test Summary ===');
    console.log(`Total: ${passedTests + failedTests + skippedTests}`);
    console.log(`✓ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⊘ Skipped: ${skippedTests}`);

    if (failedTests > 0) {
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});
