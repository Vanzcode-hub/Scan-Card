const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const fs = require('fs');

async function testOCR() {
    let imageBuffer = fs.readFileSync('C:\\Users\\durge\\.gemini\\antigravity\\brain\\fab1ef01-7942-4f79-8c5d-17fc1804c5d4\\media__1775624575926.jpg');

    let result = await Tesseract.recognize(imageBuffer, 'eng');

    fs.writeFileSync('bbox.json', JSON.stringify({
        lines: result.data.lines.slice(0, 3).map(l => ({ text: l.text, confidence: l.confidence, bbox: l.bbox })),
        words: result.data.words.slice(0, 5).map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox, baseline: w.baseline }))
    }, null, 2));
}

testOCR();
