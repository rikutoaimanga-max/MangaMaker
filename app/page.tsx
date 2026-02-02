'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Image as ImageIcon, Plus, BookOpen, Layers, Paintbrush, Loader2, X, Download, Maximize2 } from 'lucide-react';
import { getAllImages, getImage } from '@/lib/db';
import { generateMangaPrompts, generatePromptsFromScript, generateImage } from '@/lib/gemini';
import { generateImageFal } from '@/lib/fal';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export default function Workspace() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [falApiKey, setFalApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState('2:3');
  const [outputFormat, setOutputFormat] = useState('png');

  const [provider, setProvider] = useState<'gemini' | 'fal'>('gemini');
  const [inputMode, setInputMode] = useState<'idea' | 'script'>('idea'); // New state
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [availableImages, setAvailableImages] = useState<{ id: string; url: string; name: string }[]>([]);
  // const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]); // Removed
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const downloadImage = (url: string, filename: string) => {
    saveAs(url, filename);
  };

  const downloadAllImages = async () => {
    const zip = new JSZip();
    let count = 0;

    generatedImages.forEach((imgUrl, idx) => {
      const base64Data = imgUrl.split(',')[1];
      zip.file(`MangaPage_${idx + 1}.png`, base64Data, { base64: true });
      count++;
    });

    if (count === 0) return;

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "manga_pages.zip");
  };

  // Initial Data Load
  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key');
    if (key) setApiKey(key);

    const falKey = localStorage.getItem('fal_api_key');
    if (falKey) setFalApiKey(falKey);

    if (!key && !falKey) {
      router.push('/settings');
      return;
    }

    const loadImages = async () => {
      const imgs = await getAllImages();
      const urls = imgs.map(img => ({
        id: img.id,
        url: URL.createObjectURL(img.data),
        name: img.name
      })).reverse();
      setAvailableImages(urls);
    };
    // const loadCharacters = async () => {
    //   const chars = await getAllCharacters();
    //   setAvailableCharacters(chars.reverse());
    // };
    loadImages();
    // loadCharacters();

    // Clean up URLs
    return () => availableImages.forEach(img => URL.revokeObjectURL(img.url));
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    // Check keys
    if (provider === 'gemini' && !apiKey) {
      setError('Gemini API Keyが設定されていません');
      return;
    }
    if (provider === 'fal' && !falApiKey) {
      setError('Fal.ai API Keyが設定されていません');
      return;
    }

    setIsGenerating(true);
    setError('');
    setStatusMessage('ストーリーから構成を考えています...');
    setGeneratedImages([]);

    try {
      // Get Blob data for selected images
      const selectedBlobs = await Promise.all(
        selectedImageIds.map(async id => {
          const record = await getImage(id);
          return record ? { data: record.data, type: record.type } : null;
        })
      );
      const validImages = selectedBlobs.filter(item => item !== null) as { data: Blob; type: string }[];

      // 1. Generate Prompts for each page (Always use Gemini for this as it's text/multimodal logic)
      if (!apiKey) {
        throw new Error("プロンプト生成にはGemini API Keyが必要です。設定画面でGemini API Keyを設定してください。");
      }

      let prompts: string[] = [];
      if (inputMode === 'script') {
        // Script Mode: Use the new strict script splitting logic
        prompts = await generatePromptsFromScript(apiKey, prompt, pageCount);
      } else {
        // Idea Mode: Use original logic
        prompts = await generateMangaPrompts(apiKey, prompt, pageCount, validImages);
      }

      setStatusMessage('漫画を描いています...');

      const newImages: string[] = [];
      // 2. Generate Image for each prompt
      for (let i = 0; i < prompts.length; i++) {
        setStatusMessage(`漫画を描いています... (${i + 1}/${prompts.length}枚目)`);

        let imagePrompt = prompts[i];

        // Setup strict consistency for non-multimodal providers
        if (validImages.length > 0) {
          imagePrompt += `\n\n[System Instruction]: Use the attached images as strict character references. Maintain character consistency throughout the page.`;
        }

        let base64Image = "";
        if (provider === 'fal') {
          base64Image = await generateImageFal(falApiKey, imagePrompt, { aspectRatio });
        } else {
          base64Image = await generateImage(apiKey, imagePrompt, validImages, { aspectRatio });
        }

        const imageUrl = `data:image/png;base64,${base64Image}`;
        newImages.push(imageUrl);
        setGeneratedImages([...newImages]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '生成中にエラーが発生しました');
      console.error(err);
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-6 animate-in fade-in zoom-in-95 duration-500 p-6">
      {/* Input Panel */}
      <div className="w-1/3 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-gradient">
            <Sparkles className="text-indigo-400" />
            漫画を作る
          </h1>
          <p className="text-sm text-gray-300 mt-2">
            AIと共に、あなたの想像を形にしましょう。
          </p>
        </div>

        <div className="space-y-6 glass-card p-6 rounded-2xl">
          <div className="space-y-3 pb-3 border-b border-white/10">
            <label className="text-sm font-semibold text-white">生成エンジン</label>
            <div className="flex bg-white/5 rounded-xl p-1">
              <button
                onClick={() => setProvider('gemini')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                  provider === 'gemini' ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                )}
              >
                Gemini API
              </button>
              <button
                onClick={() => setProvider('fal')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                  provider === 'fal' ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
                )}
              >
                fal API
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">
                {inputMode === 'idea' ? 'ストーリー・アイデア' : '脚本・スクリプト'}
              </label>
              <div className="flex bg-white/5 rounded-lg p-0.5">
                <button
                  onClick={() => setInputMode('idea')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    inputMode === 'idea' ? "bg-indigo-500 text-white shadow" : "text-gray-400 hover:text-white"
                  )}
                >
                  アイデア
                </button>
                <button
                  onClick={() => setInputMode('script')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    inputMode === 'script' ? "bg-indigo-500 text-white shadow" : "text-gray-400 hover:text-white"
                  )}
                >
                  脚本
                </button>
              </div>
            </div>
            <textarea
              className="flex min-h-[120px] w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white shadow-inner placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 resize-y transition-all"
              placeholder={inputMode === 'idea'
                ? "例: サイバーパンクな東京で、猫型アンドロイドと少年が出会う冒険活劇..."
                : "例: \nシーン1: 教室\nA: 「おはよう」\nB: 「おはよう」\n(窓の外を見るB)\n..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-white flex justify-between">
              ページ数 <span className="text-indigo-400 font-bold">{pageCount}</span>
            </label>
            <input
              type="range"
              min="1"
              max="4"
              value={pageCount}
              onChange={(e) => setPageCount(parseInt(e.target.value))}
              className="w-full accent-indigo-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>1枚</span>
              <span>4枚</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-white">アスペクト比</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <option value="1:1" className="bg-gray-800">1:1 (正方形)</option>
                <option value="2:3" className="bg-gray-800">2:3 (縦長)</option>
                <option value="3:2" className="bg-gray-800">3:2 (横長)</option>
                <option value="9:16" className="bg-gray-800">9:16 (スマホ)</option>
                <option value="16:9" className="bg-gray-800">16:9 (ワイド)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">出力形式</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <option value="png" className="bg-gray-800">PNG</option>
              <option value="jpg" className="bg-gray-800">JPG</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-white flex items-center justify-between">
              <span>参照画像 (オプション)</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">{selectedImageIds.length}枚選択中</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {availableImages.slice(0, 8).map(img => {
                const selectedIndex = selectedImageIds.indexOf(img.id);
                const isSelected = selectedIndex !== -1;
                return (
                  <div
                    key={img.id}
                    onClick={() => toggleImageSelection(img.id)}
                    className={cn(
                      "aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 relative group",
                      isSelected
                        ? "border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                        : "border-white/5 hover:border-white/20 hover:scale-[1.02]"
                    )}
                  >
                    <img src={img.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="ref" />
                    <div className={cn(
                      "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200",
                      isSelected ? "opacity-100 backdrop-blur-[2px]" : "opacity-0 group-hover:opacity-100"
                    )}>
                      {isSelected ? (
                        <div className="w-8 h-8 bg-indigo-500 text-white rounded-full flex items-center justify-center font-bold shadow-lg animate-in zoom-in spin-in-180 duration-300">
                          {selectedIndex + 1}
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center">
                          <Plus size={16} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => router.push('/assets')}
                className="aspect-square rounded-xl border-2 border-dashed border-white/20 flex flex-col gap-2 items-center justify-center hover:bg-white/5 hover:border-white/40 transition-all active:scale-95 group"
              >
                <Plus size={24} className="text-muted-foreground group-hover:text-white transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-white">追加</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt}
            className="w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isGenerating ? (
              <>
                <Sparkles className="mr-2 h-5 w-5 animate-spin" />
                {statusMessage}
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-5 w-5" />
                漫画を生成する
              </>
            )}
          </button>

          {generatedImages.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={downloadAllImages}
                className="w-full inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white px-4 py-3 shadow-sm transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
                title="全ての画像をダウンロード"
              >
                <Download size={20} className="mr-2" />
                一括ダウンロード
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm animate-in zoom-in-95">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="flex-1 bg-black/20 backdrop-blur-sm rounded-3xl border border-white/5 p-8 overflow-y-auto custom-scrollbar relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {generatedImages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
            <div className="p-6 rounded-full bg-white/5 border border-white/10 animate-float">
              <Layers size={64} className="text-indigo-400/50" />
            </div>
            <p className="text-lg font-light tracking-wide text-gray-300">
              {isGenerating ? statusMessage : '生成結果がここに表示されます'}
            </p>
          </div>
        ) : (
          <div className="space-y-8 relative z-10">
            {generatedImages.map((imgUrl, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="glass-card rounded-2xl p-4 border border-white/10"
              >
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className="bg-indigo-500 w-1 h-5 rounded-full inline-block" />
                    Page {idx + 1}
                  </h3>
                  <button
                    onClick={() => downloadImage(imgUrl, `manga_page_${idx + 1}.${outputFormat === 'jpg' ? 'jpg' : 'png'}`)}
                    className="text-xs flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Download size={14} /> 保存
                  </button>
                </div>

                <div
                  className="relative w-full rounded-xl overflow-hidden border border-white/10 group cursor-pointer"
                  onClick={() => setPreviewImage(imgUrl)}
                >
                  <img src={imgUrl} alt={`Page ${idx + 1}`} className="w-full h-auto object-contain" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-md flex items-center gap-2 border border-white/20">
                      <Maximize2 size={16} /> 拡大表示
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {previewImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
              onClick={() => setPreviewImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl max-h-full rounded-2xl overflow-hidden shadow-2xl glass-card border-white/10 bg-black/50"
                onClick={(e) => e.stopPropagation()}
              >
                <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain" />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => downloadImage(previewImage, `manga_page_preview.${outputFormat === 'jpg' ? 'jpg' : 'png'}`)}
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/10"
                    title="ダウンロード"
                  >
                    <Download size={20} />
                  </button>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="p-2 rounded-full bg-black/50 text-white hover:bg-red-500/50 transition-colors backdrop-blur-md border border-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div >
  );
}
