
import React, { useState, useCallback, useEffect } from 'react';
import { AppStatus, PresetPrompt, HistoryItem } from './types';
import { editImageWithGemini, analyzeImageScene } from './services/geminiService';
import { Button } from './components/Button';
import { ImageUploader } from './components/ImageUploader';

const PRESETS: PresetPrompt[] = [
  {
    id: 'window-punch',
    label: 'Punched Windows',
    description: 'Make window views transparent.',
    text: 'Edit this image: Locate all window glass. Replace ONLY the view seen through the windows with solid pure green #00FF00. Do not change the window frames, curtains, or any interior items.'
  },
  {
    id: 'remove-bg',
    label: 'Punched Background',
    description: 'Transparent background around subject.',
    text: 'Edit this image: Identify the main subject in the foreground. Replace the entire background behind them with solid pure green #00FF00. Keep the subject exactly as they are.'
  }
];

const processImageTransparency = async (
  base64Str: string, 
  targetWidth?: number, 
  targetHeight?: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      tempCtx.drawImage(img, 0, 0);
      const imageData = tempCtx.getImageData(0, 0, w, h);
      const data = imageData.data;

      const minGreen = 40; 
      const dominanceThreshold = 10;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const isGreen = g > r + dominanceThreshold && g > b + dominanceThreshold && g > minGreen;

        if (isGreen) {
          data[i + 3] = 0; 
        }
      }
      
      tempCtx.putImageData(imageData, 0, 0);

      const resize = (canvas: HTMLCanvasElement): string => {
         if (targetWidth && targetHeight && (targetWidth !== w || targetHeight !== h)) {
             const finalCanvas = document.createElement('canvas');
             finalCanvas.width = targetWidth;
             finalCanvas.height = targetHeight;
             const finalCtx = finalCanvas.getContext('2d');
             if (!finalCtx) return canvas.toDataURL();
             finalCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);
             return finalCanvas.toDataURL('image/png');
         }
         return canvas.toDataURL('image/png');
      };

      resolve(resize(tempCanvas));
    };
    img.onerror = () => reject(new Error('Failed to process mask transparency'));
    img.src = base64Str;
  });
};

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [originalDims, setOriginalDims] = useState<{w: number, h: number} | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/png');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(PRESETS[0].text);
  const [usePro, setUsePro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [fullViewImage, setFullViewImage] = useState<string | null>(null);

  const handleImageSelect = useCallback(async (base64: string, type: string) => {
    const img = new Image();
    img.onload = () => setOriginalDims({ w: img.width, h: img.height });
    img.src = base64;

    setSourceImage(base64);
    setMimeType(type);
    setGeneratedImage(null);
    setStatus(AppStatus.IDLE);
    setError(null);
    setAnalysis(null);

    try {
      const result = await analyzeImageScene(base64, type);
      setAnalysis(result);
    } catch (e) {
      console.warn("Analysis failed", e);
    }
  }, []);

  const handleGenerate = async () => {
    if (!sourceImage) return;

    setStatus(AppStatus.PROCESSING);
    setError(null);
    setGeneratedImage(null);

    try {
      const resultBase64 = await editImageWithGemini(sourceImage, mimeType, prompt, usePro);
      const finalImage = await processImageTransparency(resultBase64, originalDims?.w, originalDims?.h);

      setGeneratedImage(finalImage);
      setHistory(prev => [{
        id: Date.now().toString(),
        timestamp: Date.now(),
        original: sourceImage,
        generated: finalImage,
        promptUsed: prompt,
        thumbnail: finalImage
      }, ...prev].slice(0, 10));
      setStatus(AppStatus.SUCCESS);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to process image.");
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans flex flex-col relative">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">AlphaPunch <span className="text-indigo-500">v2</span></h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Precision Transparency & Window Masking</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10">
              <button 
                onClick={() => setUsePro(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${!usePro ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Standard
              </button>
              <button 
                onClick={() => setUsePro(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${usePro ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'text-slate-400 hover:text-white'}`}
              >
                Pro Quality
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main UI */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Input Image</h2>
            <ImageUploader onImageSelected={handleImageSelect} currentImage={sourceImage} />
            
            {analysis && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Scene Analysis</p>
                <p className="text-[11px] text-slate-400 leading-relaxed italic">"{analysis}"</p>
              </div>
            )}
          </section>

          <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Select Mode</h2>
            <div className="space-y-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setPrompt(preset.text)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    prompt === preset.text
                      ? 'bg-indigo-600/10 border-indigo-500/50 text-white ring-1 ring-indigo-500/20'
                      : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'
                  }`}
                >
                  <div className="font-bold text-sm">{preset.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/5">
              <Button 
                onClick={handleGenerate} 
                disabled={!sourceImage || status === AppStatus.PROCESSING}
                isLoading={status === AppStatus.PROCESSING}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-900/20"
              >
                PUNCH ALPHA
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs leading-relaxed">
                <div className="font-bold mb-1">Error Occurred:</div>
                {error}
              </div>
            )}
          </section>
        </div>

        {/* Center: Main Viewport */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="flex-1 bg-black/40 border border-white/5 rounded-[40px] overflow-hidden relative shadow-inner min-h-[600px] flex items-center justify-center group/main">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            
            <div className="z-10 w-full h-full flex items-center justify-center p-8">
              {status === AppStatus.PROCESSING ? (
                <div className="text-center space-y-6">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">Processing Mask</p>
                    <p className="text-slate-500 text-[10px]">Gemini is analyzing pixels...</p>
                  </div>
                </div>
              ) : generatedImage ? (
                <div className="relative group max-w-full max-h-full">
                  <div className="absolute -inset-4 bg-indigo-600/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src={generatedImage} 
                    alt="Punched Result" 
                    onClick={() => setFullViewImage(generatedImage)}
                    className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-[#0a0a0a] ring-1 ring-white/10 cursor-zoom-in hover:scale-[1.01] transition-transform duration-300"
                  />
                  <div className="absolute top-4 right-4 flex space-x-2">
                    <button 
                      onClick={() => setFullViewImage(generatedImage)}
                      className="bg-black/50 backdrop-blur-md text-white p-2 rounded-xl hover:bg-indigo-600 transition-colors"
                      title="Phóng to"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = generatedImage!;
                        link.download = `alphapunch-${Date.now()}.png`;
                        link.click();
                      }}
                      className="bg-white text-black px-4 py-2 rounded-xl text-xs font-black shadow-xl hover:bg-slate-200 transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>DOWNLOAD PNG</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-white/[0.02] border border-white/5 rounded-full mx-auto flex items-center justify-center">
                    <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 text-sm font-medium">Waiting for input...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar: History */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 h-full flex flex-col shadow-2xl">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">History</h2>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <div className="w-px h-12 bg-white/20 mb-4"></div>
                  <p className="text-[10px] uppercase font-bold tracking-tighter">No Cuts</p>
                </div>
              ) : (
                history.map((item) => (
                  <div 
                    key={item.id}
                    className="group relative aspect-square bg-black border border-white/5 rounded-2xl overflow-hidden cursor-pointer hover:border-indigo-500 transition-all shadow-lg"
                  >
                    <img 
                      src={item.thumbnail} 
                      alt="History" 
                      onClick={() => {
                        setSourceImage(item.original);
                        setGeneratedImage(item.generated);
                        setStatus(AppStatus.SUCCESS);
                      }}
                      className="w-full h-full object-contain bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-[#0a0a0a]" 
                    />
                    <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setFullViewImage(item.generated)}
                        className="bg-black/60 p-1.5 rounded-lg text-white hover:bg-indigo-600"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </button>
                    </div>
                    <div 
                      onClick={() => {
                        setSourceImage(item.original);
                        setGeneratedImage(item.generated);
                        setStatus(AppStatus.SUCCESS);
                      }}
                      className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all pointer-events-none"
                    >
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-white/5 text-center">
        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-mono">
          Powered by Gemini 2.5 & 3 Models • Advanced Chroma Keying Engine • 2024
        </p>
      </footer>

      {/* Full View Modal Overlay */}
      {fullViewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-300"
          onClick={() => setFullViewImage(null)}
        >
          <div className="absolute top-6 right-8 flex items-center space-x-4">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = fullViewImage;
                link.download = `alphapunch-full-${Date.now()}.png`;
                link.click();
              }}
              className="bg-white text-black px-6 py-2.5 rounded-full text-xs font-black shadow-2xl hover:bg-slate-200 transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>LUƯ VỀ MÁY</span>
            </button>
            <button 
              className="p-3 bg-white/10 hover:bg-red-500 rounded-full text-white transition-all shadow-xl border border-white/10"
              onClick={() => setFullViewImage(null)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div 
            className="w-[90vw] h-[85vh] relative flex items-center justify-center p-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Checkerboard Background for Alpha Preview */}
            <div className="absolute inset-0 rounded-[40px] opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '40px 40px', backgroundPosition: '0 0, 0 20px, 20px -20px, -20px 0px' }}></div>
            
            <img 
              src={fullViewImage} 
              alt="Full Detail" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_100px_rgba(0,0,0,1)] ring-1 ring-white/10 z-10"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
