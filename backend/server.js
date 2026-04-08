const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Jimp = require('jimp');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Set up Multer for memory storage, as we don't need to save files permanently for the POC
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Levenshtein Matrix Algorithm
function levenshteinDistance(a, b) {
    const matrix = [];
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

// Extraction algorithms using Context and Validation rules
function extractDataFromText(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let full_name = '';
    let company = '';
    let designation = '';
    let email = '';
    let phone = '';
    let conf = { full_name: 0.0, company: 0.0, designation: 0.0, email: 0.0, phone: 0.0 };

    // 1. Extract Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    for (let line of lines) {
        if (line.includes('@')) {
            let eLine = line.replace(/^(e-?mail|e|b|m|email id|email)[:\s-]*/i, '').trim();
            eLine = eLine.replace(/\s*@\s*/g, '@');
            eLine = eLine.replace(/\s+(in|com|net|org|co|us|uk|io)$/i, '.$1');
            let parts = eLine.split('@');
            if (parts.length === 2) {
                parts[0] = parts[0].replace(/\s+/g, '.');
                parts[1] = parts[1].replace(/\s+/g, '');
                eLine = parts.join('@');
            }
            const match = eLine.match(emailRegex);
            if (match) { 
                email = match[0]; 
                conf.email = 0.95; 
            } else { 
                email = eLine.replace(/[^a-zA-Z0-9._%+-@]/g, ''); 
                conf.email = 0.6;
            }
            break;
        }
    }

    // 2. Extract Phone
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5}|\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}|\d{4}[-.\s]?\d{4}[-.\s]?\d{2}|\d{10})(?!\d)/g;
    let textForPhone = text.replace(/(\d{4}[-.\s]?\d{4})[oO]/g, '$10');
    let phoneMatches = textForPhone.match(phoneRegex);
    if (phoneMatches) {
        phone = phoneMatches[0].trim();
        conf.phone = 0.95;
    }

    // 3. Contextual Name, Title, and Company extraction based on clusters
    const titleKeywords = ['manager', 'director', 'president', 'ceo', 'cfo', 'cto', 'founder', 'owner', 'head', 'vp', 'executive', 'engineer', 'developer', 'consultant', 'architect', 'supervisor', 'specialist', 'officer', 'representative', 'lead'];
    const companyKeywords = ['ltd', 'inc', 'solutions', 'technologies', 'tech', 'group', 'corp', 'company', 'co', 'pvt', 'private'];
    
    let nameFound = false;

    // First scan to find Designation natively
    for (let line of lines) {
        const lowerLine = line.toLowerCase();
        let isTitle = titleKeywords.some(kw => lowerLine.includes(kw));
        if (isTitle && !designation) {
            designation = line.replace(/[^a-zA-Z\s.\-&]/g, '').trim();
            conf.designation = 0.9;
        }
    }

    for (let line of lines) {
        if (line.match(emailRegex) || line.includes('@') || line.match(phoneRegex)) continue;
        if (line.length < 4 || line.length > 35) continue;
        
        const lowerLine = line.toLowerCase();
        let isTitle = titleKeywords.some(kw => lowerLine.includes(kw));
        
        // Find Name
        if (!nameFound && !isTitle) {
            let clean = line.replace(/[^a-zA-Z\s.\-]/g, '').replace(/\s+/g, ' ').trim();
            let words = clean.split(' ');
            const validSuffixes = ['jr', 'sr', 'md', 'phd', 'cpa', 'ii', 'iii', 'iv'];
            
            while (words.length >= 2) {
                const last = words[words.length - 1];
                if (last.length <= 2 && !validSuffixes.includes(last.toLowerCase()) && !last.includes('.')) {
                    words.pop();
                } else {
                    break;
                }
            }
            
            full_name = words.join(' ');
            nameFound = true;
            conf.full_name = 0.85;
            continue;
        }

        // Find Company
        if (nameFound && !isTitle) {
            let potentialCompany = line.replace(/[^a-zA-Z0-9\s.\-&,]/g, '').trim();
            if (potentialCompany.length < 3) continue;
            
            if (companyKeywords.some(kw => potentialCompany.toLowerCase().includes(kw))) {
                company = potentialCompany;
                conf.company = 0.9;
                break;
            }
            
            if (!company) {
                company = potentialCompany;
                conf.company = 0.5;
            }
        }
    }

    // 4. Validation & Error Correction Layer (Fuzzy Logic)
    let emailDomain = '';
    if (email) {
        const domainParts = email.split('@')[1].split('.');
        emailDomain = domainParts[0].toLowerCase();
    }

    if (company && emailDomain) {
        let cleanCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Example: emailDomain = seetechsolutions, cleanCompany = seetech
        // Or if OCR failed: cleanCompany = seciech
        
        // If the domain contains the OCR company exactly, bump confidence
        if (emailDomain.includes(cleanCompany)) {
            conf.company = 0.95;
        } else {
            // Apply Levenshtein distance check if it didn't match perfectly
            let distance = levenshteinDistance(emailDomain, cleanCompany);
            let similarity = 1 - (distance / Math.max(emailDomain.length, cleanCompany.length));
            
            // If it's a typo mismatch, correct it via Ground Truth override
            if (similarity > 0.3 && similarity < 1.0) {
                 // The domain is the ground truth. We build a clean string.
                 let fixed = emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1);
                 
                 // If original company had 'solutions' etc, preserve it in the fix
                 let originalTokens = company.split(' ');
                 if (originalTokens.length > 1) {
                     fixed = fixed + ' ' + originalTokens.slice(1).join(' ');
                 }
                 
                 company = fixed;
                 conf.company = 0.99; // Highly confident because cross-validated!
            }
        }
    }

    // Assign generic fallback confidence values if fields exist
    if (full_name && conf.full_name === 0.0) conf.full_name = 0.6;
    if (company && conf.company === 0.0) conf.company = 0.4;
    
    // Evaluate if it's Aadhaar/PAN based on ID traits to maintain backward compatibility smoothly
    const rawTextLower = text.toLowerCase();
    if (rawTextLower.includes('income tax department') || text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/)) {
        return { cardType: 'PAN', panNumber: (text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/) || [])[0], rawText: text };
    }

    // Return the specified Target JSON Output format exactly as requested:
    return {
       full_name,
       company,
       designation,
       email,
       phone,
       confidence: conf
    };
}

app.post('/api/scan-card', upload.single('card'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        console.log(`Received file: ${req.file.originalname}, processing offline...`);

        let text = '';
        const mimeType = req.file.mimetype;
        const originalName = req.file.originalname.toLowerCase();

        if (mimeType.startsWith('image/')) {
            console.log('Processing Image with Orientation Detection Layer...');
            let originalImageBuffer = req.file.buffer;
            let currentImage = await Jimp.read(originalImageBuffer);
            
            let bestScore = -1;
            let bestText = '';
            let bestAngle = 0;

            const scoreText = (txt) => {
                 let s = 0;
                 if (txt.includes('@')) s += 15;
                 if (txt.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\d{5}[-.\s]?\d{5})/)) s += 10;
                 // Add 1 point for every standard readable English corporate word length found
                 let words = txt.split(/\s+/);
                 let validWords = words.filter(w => /^[a-zA-Z]{4,15}$/.test(w)).length;
                 s += validWords;
                 return s;
            };

            // Test 0, 90, 180, and 270 orientations
            for (let i = 0; i < 4; i++) {
                let angle = i * 90;
                let testImg = currentImage.clone();
                if (angle > 0) testImg.rotate(angle);
                let testBuffer = await testImg.getBufferAsync(Jimp.MIME_PNG);
                
                console.log(`Running OCR Pre-Test at ${angle}° orientation...`);
                let result = await Tesseract.recognize(testBuffer, 'eng');
                let score = scoreText(result.data.text);
                console.log(`>> Computed Confidence Score for ${angle}°: ${score}`);
                
                if (score > bestScore) {
                     bestScore = score;
                     bestText = result.data.text;
                     bestAngle = angle;
                }
            }
            
            console.log(`Selected Upright Orientation: ${bestAngle}° | Normalizing Image Workflow.`);
            text = bestText;
            
        } else if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
            console.log('Processing as PDF with pdf-parse...');
            const result = await pdfParse(req.file.buffer);
            text = result.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
            console.log('Processing as DOCX with mammoth...');
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
        } else {
             return res.status(400).json({ error: 'Unsupported file type. Please upload JPG, PNG, PDF, or DOCX.' });
        }

        console.log('--- Raw Extraction Text ---');
        console.log(text);
        console.log('--------------------');

        const extractedData = extractDataFromText(text);

        res.json({
            success: true,
            data: extractedData
        });
    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'An error occurred during file processing.' });
    }
});

app.listen(port, () => {
    console.log(`[Offline OCR Service] API running fully locally at http://localhost:${port}`);
});
