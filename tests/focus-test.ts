import sharp from 'sharp';
import { extractImageFromBase64 } from '../src/image-utils';

async function testFocus() {
    // Create a 100x100 solid color image
    const initialBuffer = await sharp({
        create: {
            width: 100,
            height: 100,
            channels: 3,
            background: { r: 255, g: 0, b: 0 }
        }
    }).png().toBuffer();

    const base64 = initialBuffer.toString('base64');

    // Test 1: focus_xyxy (pixels)
    // 10, 10, 60, 60 -> width 50, height 50
    console.log('Testing focus_xyxy (pixels)...');
    const res1 = await extractImageFromBase64({
        base64,
        mime_type: 'image/png',
        resize: false,
        max_width: 1000,
        max_height: 1000,
        focus_xyxy: [10, 10, 60, 60]
    });
    const meta1 = JSON.parse((res1.content[0] as any).text);
    console.log(`Expected 50x50, Got: ${meta1.width}x${meta1.height}`);
    if (meta1.width !== 50 || meta1.height !== 50) throw new Error("Test 1 failed");

    // Test 2: focus_xyxy (ratio)
    // 0.1, 0.1, 0.6, 0.6 -> width 50, height 50
    console.log('Testing focus_xyxy (ratio)...');
    const res2 = await extractImageFromBase64({
        base64,
        mime_type: 'image/png',
        resize: false,
        max_width: 1000,
        max_height: 1000,
        focus_xyxy: [0.1, 0.1, 0.6, 0.6]
    });
    const meta2 = JSON.parse((res2.content[0] as any).text);
    console.log(`Expected 50x50, Got: ${meta2.width}x${meta2.height}`);
    if (meta2.width !== 50 || meta2.height !== 50) throw new Error("Test 2 failed");

    // Test 3: focal_point (pixels)
    // Center 50,50, half 20,20 -> 40x40 box
    console.log('Testing focal_point (pixels)...');
    const res3 = await extractImageFromBase64({
        base64,
        mime_type: 'image/png',
        resize: false,
        max_width: 1000,
        max_height: 1000,
        focal_point: [50, 50, 20, 20]
    });
    const meta3 = JSON.parse((res3.content[0] as any).text);
    console.log(`Expected 40x40, Got: ${meta3.width}x${meta3.height}`);
    if (meta3.width !== 40 || meta3.height !== 40) throw new Error("Test 3 failed");

    // Test 4: focal_point (ratio)
    // Center 0.5, 0.5, half 0.2, 0.2 -> 0.4*100 = 40x40
    console.log('Testing focal_point (ratio)...');
    const res4 = await extractImageFromBase64({
        base64,
        mime_type: 'image/png',
        resize: false,
        max_width: 1000,
        max_height: 1000,
        focal_point: [0.5, 0.5, 0.2, 0.2]
    });
    const meta4 = JSON.parse((res4.content[0] as any).text);
    console.log(`Expected 40x40, Got: ${meta4.width}x${meta4.height}`);
    if (meta4.width !== 40 || meta4.height !== 40) throw new Error("Test 4 failed");

    console.log('All tests passed!');
}

testFocus().catch(console.error);