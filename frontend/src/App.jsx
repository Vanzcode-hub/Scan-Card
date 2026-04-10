import { useState, useRef } from 'react';

function App() {
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Awaiting upload');
  const [statusClass, setStatusClass] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    company: '',
    designation: '',
    email: '',
    phone: '',
    aadhaarNumber: '',
    panNumber: '',
    dob: '',
    gender: ''
  });
  const [cardType, setCardType] = useState('Business');
  const [isDragOver, setIsDragOver] = useState(false);
  const [animatedFields, setAnimatedFields] = useState({});
  const [showQualityPopup, setShowQualityPopup] = useState(false);

  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const autoCropImage = (file) => {
    return new Promise((resolve) => {
      if (!window.cv || !window.cv.Mat) {
        return resolve(file);
      }
      setStatus('Detecting edges & cropping...');
      const img = new Image();
      img.onload = () => {
        try {
          const cv = window.cv;
          let src = cv.imread(img);
          let dst = new cv.Mat();
          cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
          cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
          cv.Canny(dst, dst, 75, 200, 3, false);
          
          let contours = new cv.MatVector();
          let hierarchy = new cv.Mat();
          cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
          
          let maxArea = 0, maxContourIndex = -1;
          for (let i = 0; i < contours.size(); ++i) {
            let area = cv.contourArea(contours.get(i));
            if (area > maxArea) { maxArea = area; maxContourIndex = i; }
          }
          
          if (maxContourIndex !== -1) {
            let cnt = contours.get(maxContourIndex);
            let tmp = new cv.Mat();
            cv.approxPolyDP(cnt, tmp, 0.02 * cv.arcLength(cnt, true), true);
            
            if (tmp.rows === 4) {
              let corners = [];
              for(let i = 0; i < 4; i++) corners.push({x: tmp.data32S[i*2], y: tmp.data32S[i*2+1]});
              corners.sort((a,b) => a.y - b.y);
              let top = corners.slice(0, 2).sort((a,b) => a.x - b.x);
              let bottom = corners.slice(2, 4).sort((a,b) => a.x - b.x);
              let tl = top[0], tr = top[1], bl = bottom[0], br = bottom[1];
              
              let widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
              let widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
              let maxWidth = Math.max(widthA, widthB);
              
              let heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
              let heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
              let maxHeight = Math.max(heightA, heightB);
              
              let finalW = maxWidth, finalH = maxHeight;
              if (finalH > finalW) {
                 finalW = maxHeight; finalH = maxWidth;
                 [tl, tr, br, bl] = [bl, tl, tr, br];
              }

              let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
              let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, finalW, 0, finalW, finalH, 0, finalH]);
              
              let M = cv.getPerspectiveTransform(srcTri, dstTri);
              let warped = new cv.Mat();
              cv.warpPerspective(src, warped, M, new cv.Size(finalW, finalH), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
              
              const canvas = document.createElement('canvas');
              cv.imshow(canvas, warped);
              canvas.toBlob((blob) => {
                if(blob) {
                  const cropped = new File([blob], file.name || "cropped.png", { type: "image/png" });
                  warped.delete(); M.delete(); srcTri.delete(); dstTri.delete();
                  src.delete(); dst.delete(); contours.delete(); hierarchy.delete(); tmp.delete();
                  resolve(cropped);
                } else resolve(file);
              }, 'image/png');
              return;
            }
            tmp.delete();
          }
          src.delete(); dst.delete(); contours.delete(); hierarchy.delete();
          resolve(file);
        } catch { resolve(file); }
      };
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const detectBlur = (file) => {
    return new Promise((resolve) => {
      if (!window.cv || !window.cv.Mat) return resolve(false);

      const img = new Image();
      img.onload = () => {
        try {
          const cv = window.cv;
          let src = cv.imread(img);
          let gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          
          let laplacian = new cv.Mat();
          cv.Laplacian(gray, laplacian, cv.CV_64F);
          
          let mean = new cv.Mat();
          let stddev = new cv.Mat();
          cv.meanStdDev(laplacian, mean, stddev);
          
          const variance = stddev.data64F[0] * stddev.data64F[0];
          console.log("Image Blur Variance:", variance);
          
          // Threshold: < 100 is typically blurry. Adjusting to 150 for business cards.
          const isBlurry = variance < 150;
          
          src.delete(); gray.delete(); laplacian.delete(); mean.delete(); stddev.delete();
          resolve(isBlurry);
        } catch (e) {
          console.error("Blur detection error:", e);
          resolve(false);
        }
      };
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files) => {
    const file = files[0];
    const isDoc = file.name.match(/\.(pdf|docx?)$/i);
    if (!file || (!file.type.startsWith('image/') && !isDoc)) {
      alert('Please upload an image file (JPG, PNG) or document (PDF, DOCX).');
      return;
    }

    if (file.type.startsWith('image/')) {
        // Step 1: Detect Blur
        setStatus('Checking image quality...');
        const isBlurry = await detectBlur(file);
        if (isBlurry) {
            setShowQualityPopup(true);
            setStatus('Upload halted');
            return;
        }

      const croppedFile = await autoCropImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview({ type: 'image', data: e.target.result });
      };
      reader.readAsDataURL(croppedFile);
      processImageLocally(croppedFile);
    } else {
      setPreview({ type: 'document', data: file.name });
      processImageLocally(file);
    }
  };

  const setAndAnimate = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value || '' }));
    if (value) {
      setAnimatedFields((prev) => ({ ...prev, [key]: false }));
      setTimeout(() => {
        setAnimatedFields((prev) => ({ ...prev, [key]: true }));
      }, 50);
    }
  };

  const processImageLocally = async (file) => {
    setIsProcessing(true);
    setStatus('Processing offline...');
    setStatusClass('');

    const data = new FormData();
    data.append('card', file);

    try {
      const response = await fetch('http://localhost:3000/api/scan-card', {
        method: 'POST',
        body: data,
      });

      if (!response.ok) {
        throw new Error('Local Server Error');
      }

      const result = await response.json();

      if (result.success && result.data) {
        if (result.lowQuality) {
            setStatus('Low Quality Image Detected');
            setStatusClass('error');
            setTimeout(() => {
                alert('⚠️ Low Quality Detected: The image appears blurry or poor quality. Please re-upload a clearer image for better results.');
                resetUI();
            }, 100);
            return;
        }

        setCardType(result.data.cardType || 'Business');
        
        const extractedKeys = ['full_name', 'company', 'designation', 'email', 'phone', 'aadhaarNumber', 'panNumber', 'dob', 'gender'];
        extractedKeys.forEach(key => {
            if (result.data[key]) {
                setAndAnimate(key, result.data[key]);
            }
        });
        
        setStatus(`Extraction Complete (${result.data.cardType || 'Business'})`);
        setStatusClass('success');
      } else {
        throw new Error('Extraction failed');
      }
    } catch (error) {
      console.error('Error scanning card:', error);
      alert(
        'Failed to process image locally. Make sure the Node.js backend is running on port 3000.'
      );
      setStatus('Scan Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUI = (e) => {
    if (e) e.stopPropagation();
    setPreview(null);
    setIsProcessing(false);
    setStatus('Awaiting upload');
    setStatusClass('');
    setFormData({ full_name: '', company: '', designation: '', email: '', phone: '', aadhaarNumber: '', panNumber: '', dob: '', gender: '' });
    setCardType('Business');
    setAnimatedFields({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Data saved to local secure vault!');
  };

  return (
    <>
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>

      {showQualityPopup && (
          <div className="quality-popup-overlay">
              <div className="liquid-glass-card">
                  <div className="popup-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                  </div>
                  <h3>Low Quality Image</h3>
                  <p>The image appears blurry or low quality. Please upload a clear business card image for accurate extraction.</p>
                  <button className="reupload-btn" onClick={() => { setShowQualityPopup(false); resetUI(); }}>
                      Re-upload
                  </button>
              </div>
          </div>
      )}

      <main className="app-container">
        <header className="app-header">
          <h1>
            <span className="brand-dark">Business Card</span> <span className="brand-blue">Scanner</span>
          </h1>
          <p className="brand-green">by <span className="brand-see">SEE</span><span className="brand-hyphen">-</span><span className="brand-tech">TECH</span> Solutions Pvt Ltd</p>
        </header>

        <section className="card-upload-section">
          {(!preview || isProcessing) && (
            <div
              id="drop-zone"
              className={`drop-zone ${isDragOver ? 'dragover' : ''} ${
                isProcessing ? 'hidden' : ''
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDragEnter={handleDragOver}
              onClick={() => fileInputRef.current.click()}
            >
              <div className={`drop-content ${isProcessing ? 'hidden' : ''}`}>
                <div className="upload-icon">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
                <span className="upload-title">Drop image or document</span>
                <span className="upload-subtitle">
                  or click to browse (.jpg, .png, .pdf, .docx)
                </span>
                <input
                  type="file"
                  id="file-input"
                  accept="image/*,application/pdf,.doc,.docx"
                  hidden
                  ref={fileInputRef}
                  onChange={handleFileInput}
                />
              </div>

              {isProcessing && (
                <div id="loading-state" className="loading-state">
                  <div className="spinner"></div>
                  <span className="pulse-text">
                    Initializing local Tesseract engine...
                  </span>
                </div>
              )}
            </div>
          )}

          {preview && !isProcessing && (
            <div
              id="image-preview-container"
              className="image-preview-container"
            >
              {preview.type === 'document' ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span style={{ marginTop: '1rem', fontWeight: 500, color: 'var(--text-primary)' }}>{preview.data}</span>
                </div>
              ) : (
                <img id="image-preview" src={preview.data} alt="Business Card Preview" />
              )}
              <button id="reset-btn" className="reset-btn" onClick={resetUI}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </section>

        <section className="form-section">
          <div className="form-header">
            <h2>Extracted Data</h2>
            <div className={`status-indicator ${statusClass}`}>{status}</div>
          </div>

          <form id="contact-form" className="glass-form" onSubmit={handleSubmit}>
            {(cardType === 'Business' || formData.full_name) && (
             <div className="form-group row">
               <div className="input-wrapper" style={{ width: '100%' }}>
                 <label htmlFor="full_name">Full Name</label>
                 <input
                   type="text" id="full_name" placeholder="John Doe"
                   value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                   className={animatedFields.full_name ? 'field-populated' : ''}
                 />
               </div>
             </div>
            )}

            {cardType === 'Business' && (
             <>
               <div className="form-group row">
                 <div className="input-wrapper" style={{ width: '100%' }}>
                   <label htmlFor="company">Company</label>
                   <input
                     type="text" id="company" placeholder="Acme Corp"
                     value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                     className={animatedFields.company ? 'field-populated' : ''}
                   />
                 </div>
               </div>
               <div className="form-group row">
                 <div className="input-wrapper" style={{ width: '100%' }}>
                   <label htmlFor="designation">Designation</label>
                   <input
                     type="text" id="designation" placeholder="Manager"
                     value={formData.designation} onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                     className={animatedFields.designation ? 'field-populated' : ''}
                   />
                 </div>
               </div>
               <div className="form-group">
                 <label htmlFor="email">Email Address</label>
                 <input
                   type="email" id="email" placeholder="john@example.com"
                   value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                   className={animatedFields.email ? 'field-populated' : ''}
                 />
               </div>
               <div className="form-group">
                 <label htmlFor="phone">Phone Number</label>
                 <input
                   type="tel" id="phone" placeholder="+1 (555) 000-0000"
                   value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                   className={animatedFields.phone ? 'field-populated' : ''}
                 />
               </div>
             </>
            )}

            {cardType === 'Aadhaar' && (
              <>
               <div className="form-group">
                 <label htmlFor="aadhaarNumber">Aadhaar Number</label>
                 <input
                   type="text" id="aadhaarNumber" placeholder="0000 0000 0000"
                   value={formData.aadhaarNumber} onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                   className={animatedFields.aadhaarNumber ? 'field-populated' : ''}
                 />
               </div>
               <div className="form-group row">
                 <div className="input-wrapper">
                   <label htmlFor="dob">Date of Birth</label>
                   <input
                     type="text" id="dob" placeholder="DD/MM/YYYY"
                     value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                     className={animatedFields.dob ? 'field-populated' : ''}
                   />
                 </div>
                 <div className="input-wrapper">
                   <label htmlFor="gender">Gender</label>
                   <input
                     type="text" id="gender" placeholder="MALE / FEMALE"
                     value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                     className={animatedFields.gender ? 'field-populated' : ''}
                   />
                 </div>
               </div>
              </>
            )}

            {cardType === 'PAN' && (
              <>
               <div className="form-group">
                 <label htmlFor="panNumber">PAN Number</label>
                 <input
                   type="text" id="panNumber" placeholder="ABCDE1234F"
                   value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                   className={animatedFields.panNumber ? 'field-populated' : ''}
                 />
               </div>
               <div className="form-group row">
                 <div className="input-wrapper">
                   <label htmlFor="dob">Date of Birth</label>
                   <input
                     type="text" id="dob" placeholder="DD/MM/YYYY"
                     value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                     className={animatedFields.dob ? 'field-populated' : ''}
                   />
                 </div>
                 <div className="input-wrapper">
                 </div>
               </div>
              </>
            )}

            <div className="form-actions">
              <button type="submit" className="primary-btn">
                Save to Local Vault
              </button>
            </div>
          </form>
        </section>
      </main>
    </>
  );
}

export default App;
