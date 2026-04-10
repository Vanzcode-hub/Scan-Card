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

// Health check route
app.get('/', (req, res) => {
    res.send('OCR Backend is running!');
});

// Generic OCR Post-Processing Utilities
function splitCamelCase(text) {
    if (!text) return '';
    // Insert space before capital letters that follow a lowercase letter or number
    return text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
}

function toTitleCase(text) {
    if (!text) return '';
    const meaningfulShorts = ['BD', 'HR', 'IT', 'VP', 'MD', 'CEO', 'CTO', 'CFO', 'COO', 'GM', 'DR', 'AVP', 'SVP', 'DGM'];
    return text.split(' ').map(word => {
        const clean = word.replace(/[^a-zA-Z]/g, '');
        if (meaningfulShorts.includes(clean.toUpperCase())) {
            // Preserve the original symbols but capitalize the abbreviation
            return word.toUpperCase();
        }
        // If it's already uppercase acronym (2-3 letters), keep it
        if (clean.length >= 2 && clean.length <= 3 && clean === clean.toUpperCase() && clean.match(/^[A-Z]+$/)) {
            return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

function isMeaningfulWord(word) {
    if (!word) return false;
    // Allow common separators and punctuation found in designations
    if (['-', '&', '|', '/', '\\', '(', ')', ','].includes(word.trim())) return true;
    
    const cleanWord = word.replace(/[^a-zA-Z]/g, '');
    if (!cleanWord) return false;

    const meaningfulShorts = ['BD', 'HR', 'IT', 'VP', 'MD', 'CEO', 'CTO', 'CFO', 'COO', 'GM', 'DR', 'AVP', 'SVP', 'DGM'];
    
    // Keep if in known meaningful abbreviations list
    if (meaningfulShorts.includes(cleanWord.toUpperCase())) return true;
    
    // Keep if it's 2-3 letters and ALL CAPS (likely an acronym/abbreviation)
    if (cleanWord.length >= 2 && cleanWord.length <= 3 && cleanWord === cleanWord.toUpperCase()) {
        return true;
    }

    // Remove random lowercase short words (e.g., "po", "ee")
    if (cleanWord.length < 3) return false;
    
    // Word should have at least one vowel to be readable (heuristic for longer noise)
    if (!/[aeiouyAEIOUY]/.test(cleanWord) && cleanWord.length > 3) return false;
    return true;
}

function cleanNoise(text) {
    if (!text) return '';
    const words = text.split(/\s+/);
    const cleanedWords = words.filter(word => {
        // Remove words with too many numbers or symbols
        const lettersCount = (word.match(/[a-zA-Z]/g) || []).length;
        if (lettersCount / word.length < 0.5 && word.length > 2) return false;
        return isMeaningfulWord(word);
    });
    return cleanedWords.join(' ').trim();
}

function extractCompanyFromEmail(email) {
    if (!email || !email.includes('@')) return '';
    const domain = email.split('@')[1];
    const companyPart = domain.split('.')[0];
    if (['gmail', 'yahoo', 'outlook', 'hotmail', 'icloud', 'live', 'aol', 'mail'].includes(companyPart.toLowerCase())) {
        return '';
    }
    // Capitalize domain part
    return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
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

    // 3. Name, Title, and Company extraction based on clusters
    const titleKeywords = ['manager', 'director', 'president', 'ceo', 'cfo', 'cto', 'founder', 'owner', 'head', 'vp', 'executive', 'engineer', 'developer', 'consultant', 'architect', 'supervisor', 'specialist', 'officer', 'representative', 'lead'];
    
    let nameFound = false;

    // Designation extraction
    for (let line of lines) {
        const lowerLine = line.toLowerCase();
        let isTitle = titleKeywords.some(kw => lowerLine.includes(kw));
        if (isTitle && !designation) {
            // Inclusive regex to allow symbols found in full designations
            let potentialDesignation = line.replace(/[^a-zA-Z0-9\s.\-&/|(),]/g, '').trim();
            designation = toTitleCase(cleanNoise(potentialDesignation));
            if (designation) conf.designation = 0.9;
        }
    }

    for (let line of lines) {
        if (line.match(emailRegex) || line.includes('@') || line.match(phoneRegex)) continue;
        if (line.length < 4 || line.length > 50) continue;
        
        const lowerLine = line.toLowerCase();
        let isTitle = titleKeywords.some(kw => lowerLine.includes(kw));
        
        // Find Name
        if (!nameFound && !isTitle) {
            let cleanLine = line.replace(/[^a-zA-Z\s.\-]/g, '').trim();
            if (cleanLine.length < 3) continue;

            let words = cleanLine.split(/\s+/).map(w => splitCamelCase(w));
            let fullNameCandidate = words.join(' ');
            fullNameCandidate = cleanNoise(fullNameCandidate);
            
            if (fullNameCandidate && fullNameCandidate.split(' ').length >= 1) {
                full_name = toTitleCase(fullNameCandidate);
                nameFound = true;
                conf.full_name = 0.85;
                continue;
            }
        }

        // Find Company (Legacy OCR fallback)
        if (nameFound && !isTitle && !company) {
            let potentialCompany = line.replace(/[^a-zA-Z0-9\s.\-&,]/g, '').trim();
            potentialCompany = toTitleCase(cleanNoise(potentialCompany));
            if (potentialCompany.length > 3) {
                company = potentialCompany;
                conf.company = 0.5;
            }
        }
    }

    // 4. Validation & Error Correction Layer (Fuzzy Logic & Email Source of Truth)
    const companyFromEmail = extractCompanyFromEmail(email);
    if (companyFromEmail) {
        // Domain is the source of truth if OCR company is noisy or consistent
        if (!company || company.toLowerCase().includes(companyFromEmail.toLowerCase()) || companyFromEmail.toLowerCase().includes(company.toLowerCase().replace(/\s+/g, ''))) {
            company = companyFromEmail;
            conf.company = 0.99;
        } else {
            // If they are vastly different, still trust email domain if it's a solid company name
            company = companyFromEmail;
            conf.company = 0.95;
        }
    }

    // Assign generic fallback confidence values if fields exist
    if (full_name && conf.full_name === 0.0) conf.full_name = 0.6;
    if (company && conf.company === 0.0) conf.company = 0.4;
    
    // Evaluate if it's Aadhaar/PAN based on ID traits to maintain backward compatibility smoothly
    const rawTextLower = text.toLowerCase();
    if (rawTextLower.includes('income tax department') || text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/)) {
        const panMatch = text.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
        const panNumber = panMatch ? panMatch[0] : '';
        
        // Attempt to extract name for PAN - usually on line 3 or 4
        const panLines = lines.filter(l => !l.toLowerCase().includes('income tax') && !l.toLowerCase().includes('permanent account number') && !l.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/));
        let panName = panLines.length > 0 ? toTitleCase(cleanNoise(panLines[0])) : '';
        
        return { 
            cardType: 'PAN', 
            panNumber, 
            full_name: panName,
            rawText: text 
        };
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
        let bestScore = 100; // Default high for non-image files (PDF/DOCX are usually high quality text)
        const mimeType = req.file.mimetype;
        const originalName = req.file.originalname.toLowerCase();

        if (mimeType.startsWith('image/')) {
            console.log('Processing Image with Orientation Detection Layer...');
            let originalImageBuffer = req.file.buffer;
            let currentImage = await Jimp.read(originalImageBuffer);
            
            bestScore = -1;
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

        // Quality Check: If no name is found or score is extremely low, flag as low quality
        let isLowQuality = false;
        if (!extractedData.full_name && bestScore < 10) {
            isLowQuality = true;
        } else if (bestScore < 5) {
            isLowQuality = true;
        }

        res.json({
            success: true,
            data: extractedData,
            lowQuality: isLowQuality
        });
    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'An error occurred during file processing.' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[Offline OCR Service] API running on http://0.0.0.0:${port}`);
});
