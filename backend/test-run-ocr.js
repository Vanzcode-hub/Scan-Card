const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs');

async function testOCR() {
    const rawBuffer = fs.readFileSync('C:\\Users\\durge\\.gemini\\antigravity\\brain\\fab1ef01-7942-4f79-8c5d-17fc1804c5d4\\media__1775624575926.jpg');
    
    // Pass 1: Jimp pre-process
    let img = await Jimp.read(rawBuffer);
    
    // We noticed 0 degree gave pseudo-readable text. It could be that the image natively is horizontal, but text is rotated 90 inside the camera exif.
    // Actually, let's just grayscale, increase contrast, and try 0 degree.
    img.greyscale().contrast(0.4).normalize();
    
    let buf = await img.getBufferAsync(Jimp.MIME_PNG);
    let result = await Tesseract.recognize(buf, 'eng');
    console.log("=== ENHANCED 0 DEGREE ===");
    console.log(result.data.text);
    
    // Pass 2: Rotate 90
    img.rotate(90);
    buf = await img.getBufferAsync(Jimp.MIME_PNG);
    result = await Tesseract.recognize(buf, 'eng');
    console.log("=== ENHANCED 90 DEGREE ===");
    console.log(result.data.text);
    
    // Pass 3: Rotate 270 (which is -90)
    img.rotate(180); // Rotate another 180 makes it 270
    buf = await img.getBufferAsync(Jimp.MIME_PNG);
    result = await Tesseract.recognize(buf, 'eng');
    console.log("=== ENHANCED 270 DEGREE ===");
    console.log(result.data.text);
}

testOCR();
