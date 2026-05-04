import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, Camera, File as FileIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface BillUploaderProps {
  onUpload: (base64: string, mimeType: string) => void;
  isLoading: boolean;
}

export const BillUploader: React.FC<BillUploaderProps> = ({ onUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPreview({
          url: base64,
          type: file.type,
          name: file.name
        });
        const base64Clean = base64.split(',')[1];
        onUpload(base64Clean, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div 
        id="uploader-container"
        className={cn(
          "panel relative group transition-all duration-300",
          dragActive ? "border-accent bg-accent/5 scale-[1.01]" : "",
          isLoading ? "pointer-events-none opacity-50" : ""
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="panel-header">
           <Upload className="w-4 h-4" />
           01. Bill Intake Interface
        </div>
        <div className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-[32px] m-8 bg-white transition-all duration-300",
          dragActive ? "border-accent bg-accent/5 scale-[1.01]" : "hover:border-accent/40 hover:bg-accent/[0.02]"
        )}>
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-16"
              >
                <div className="mb-10 w-24 h-24 rounded-[32px] bg-accent-soft flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-sm">
                  <Upload className="w-10 h-10 text-accent" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-display font-extrabold text-text mb-3 text-center tracking-tight">
                  Drop your bill document here
                </h3>
                <p className="text-[13px] font-sans text-text-dim mb-10 text-center max-w-sm leading-relaxed opacity-80">
                  Support for JPEGs, PNGs, and Multi-page PDFs. Use your camera for high-accuracy local scanning.
                </p>
                <button 
                  id="browse-button"
                  onClick={() => inputRef.current?.click()}
                  className="btn-premium flex items-center gap-3"
                >
                  <Camera className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Select or Scan Bill
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative w-full max-w-md py-4"
              >
                <div className="flex flex-col items-center">
                  {preview.type === 'application/pdf' ? (
                    <div className="w-40 h-52 bg-bg/50 border border-border flex flex-col items-center justify-center p-4 text-center rounded-lg shadow-sm">
                      <FileIcon className="w-12 h-12 text-accent mb-3" strokeWidth={1} />
                      <span className="text-[10px] font-mono text-text truncate w-full">{preview.name}</span>
                      <span className="text-[9px] text-text-dim uppercase mt-2 tracking-widest font-bold">PDF DOCUMENT</span>
                    </div>
                  ) : (
                    <img src={preview.url} alt="Bill preview" className="rounded-lg shadow-lg w-full h-auto max-h-[300px] object-contain bg-surface border border-border" />
                  )}
                </div>
                
                <button 
                  id="clear-button"
                  onClick={() => setPreview(null)}
                  className="absolute top-6 right-2 p-1.5 bg-surface rounded-full border border-border shadow-sm hover:bg-error/10 hover:text-error transition-colors z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                {isLoading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-2xl border border-white/20 shadow-2xl">
                    <div className="relative">
                      <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                      <div className="absolute inset-0 blur-xl bg-accent/20 animate-pulse"></div>
                    </div>
                    <p className="font-display font-black text-accent text-sm tracking-widest uppercase">Analyzing Pulse...</p>
                    <p className="text-[10px] text-text-dim mt-2 font-mono uppercase tracking-tighter">AI Vector Extraction in Progress</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-auto">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="w-full px-8 py-4 flex items-center justify-between border-t border-border/40 hover:bg-bg/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <h3 className="text-[10px] uppercase font-black text-accent tracking-[2px]">System Diagnostics</h3>
            </div>
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform text-text-dim group-hover:text-text", showLogs ? "rotate-180" : "")} />
          </button>
          
          <AnimatePresence>
            {showLogs && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-bg/20"
              >
                <div className="px-8 pb-6 pt-2">
                  <p className="font-mono text-[10px] text-text-dim leading-[1.8] opacity-70">
                    <span className="text-accent/60">[SYSTEM]</span> Multi-format bridge initialized...<br />
                    <span className="text-accent/60">[SENSOR]</span> Camera capture module: ACTIVE<br />
                    <span className="text-accent/60">[PARSER]</span> Cloud-native extraction: READY
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <input 
          ref={inputRef}
          type="file" 
          className="hidden" 
          accept="image/*,application/pdf"
          capture="environment"
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
