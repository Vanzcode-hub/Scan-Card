import React, { useState } from 'react';
import { BillUploader } from './components/BillUploader';
import { PFDashboard } from './components/PFDashboard';
import { analyzeBill, BillData } from './services/gemini';
import { Zap, Info, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [billData, setBillData] = useState<BillData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTheory, setShowTheory] = useState(false);

  const handleUpload = async (base64: string, mimeType: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analyzeBill(base64, mimeType);
      setBillData(data);
    } catch (err: any) {
      setError(err?.message || "Something went wrong while analyzing the bill.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-bg flex flex-col">
      {/* Glassmorphism Header */}
      <header id="main-header" className="glass-header px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-linear-to-br from-accent to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
            <Zap className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-text leading-tight">ElectraPF <span className="text-accent underline decoration-accent/20 decoration-4 underline-offset-4">Pulse</span></h1>
            <span className="text-[10px] text-text-dim uppercase tracking-[4px] font-light">Intelligent Power Analytics</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 bg-accent-soft rounded-full border border-accent/10 transition-transform hover:scale-105 cursor-default">
            <span className="text-[10px] text-accent uppercase tracking-[1.5px] font-bold">Assistant Core</span>
          </div>
          <div className="px-4 py-1.5 bg-success/5 rounded-full border border-success/10 flex items-center gap-2 transition-transform hover:scale-105 cursor-default">
             <div className="pulsing-dot" />
             <span className="text-[10px] text-success uppercase tracking-[1.5px] font-black">Live</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 py-16">
        <div className="max-w-[80%] mx-auto">
          {/* Uploader Section */}
          <BillUploader onUpload={handleUpload} isLoading={isLoading} />
          
          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-md mx-auto mt-8 p-4 bg-error/5 border border-error/20 rounded-xl text-center text-error text-[10px] uppercase tracking-[2px] font-bold"
            >
              [CRITICAL ERROR] {error}
            </motion.div>
          )}

          {/* Theory / Guide Section */}
          <div id="theory-wrapper" className="max-w-3xl mx-auto px-4 mt-12">
            <div id="theory-card" className="panel border-none shadow-none bg-transparent">
              <button 
                id="toggle-theory"
                onClick={() => setShowTheory(!showTheory)}
                className="w-full flex items-center justify-center gap-4 group transition-all"
              >
                <div className="h-px bg-border flex-1" />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-white hover:shadow-sm border border-transparent hover:border-border/40 transition-all">
                  <Info className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
                  <span className="text-[10px] uppercase tracking-[2px] font-black text-text-dim group-hover:text-text">{showTheory ? "Hide Logic Layers" : "Technical Concept Guide"}</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform text-text-dim group-hover:text-text", showTheory ? "rotate-180" : "")} />
                </div>
                <div className="h-px bg-border flex-1" />
              </button>
              
              <AnimatePresence>
                {showTheory && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
                        <h4 className="text-[10px] font-bold text-error uppercase mb-2 tracking-widest">Lagging (Inductive)</h4>
                        <p className="text-[11px] text-text-dim leading-relaxed">
                          Voltage peaks before current. Common in motors and coils. Electricity is delayed by magnetic fields.
                        </p>
                      </div>
                      <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                        <h4 className="text-[10px] font-bold text-success uppercase mb-2 tracking-widest">Leading (Capacitive)</h4>
                        <p className="text-[11px] text-text-dim leading-relaxed">
                          Current peaks before voltage. Usually seen in systems with capacitor banks.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <AnimatePresence>
            {billData && !isLoading && (
              <PFDashboard data={billData} />
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer id="main-footer" className="py-16 border-t border-border/40 text-center bg-white/30">
        <p className="text-text-dim text-[10px] uppercase font-bold tracking-[6px] opacity-60">
          INTELLIGENCE LAYER • ANALYTICS ENGINE 2026
        </p>
      </footer>
    </div>
  );
}
