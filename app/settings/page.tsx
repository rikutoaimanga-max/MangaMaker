'use client';

import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Save, CheckCircle, AlertCircle, Loader2, List, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvailableModels } from '@/lib/gemini';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [falApiKey, setFalApiKey] = useState(''); // Added falApiKey state
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // Model List State
    const [models, setModels] = useState<{ name: string; displayName: string; description: string; supportedGenerationMethods: string[] }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelError, setModelError] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) setApiKey(storedKey);
        const storedFalKey = localStorage.getItem('fal_api_key'); // Load fal_api_key
        if (storedFalKey) setFalApiKey(storedFalKey);
    }, []);

    const handleSaveAndVerify = async () => {
        if (!apiKey.trim()) {
            setStatus('error');
            setMessage('APIキーを入力してください');
            return;
        }

        setStatus('saving');
        setMessage('検証中...');

        try {
            // APIキーの検証（軽いリクエストを送ってみる）
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
            await model.generateContent('Hello');

            localStorage.setItem('gemini_api_key', apiKey);
            setStatus('success');
            setMessage('APIキーが保存され、検証に成功しました');
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('APIキーが無効か、エラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const fetchModels = async () => {
        if (!apiKey.trim()) return;
        setLoadingModels(true);
        setModelError('');
        setModels([]);

        try {
            const list = await getAvailableModels(apiKey);
            setModels(list);
        } catch (err) {
            setModelError(err instanceof Error ? err.message : 'モデル一覧の取得に失敗しました');
        } finally {
            setLoadingModels(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">設定</h1>
                <p className="text-muted-foreground mt-2">
                    Gemini APIの設定を行います。APIキーはローカル環境にのみ保存されます。
                </p>
            </div>

            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm space-y-4">
                <div className="space-y-2">
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">
                        Gemini API Key
                    </label>
                    <input
                        id="apiKey"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-400">
                        Google AI Studioから取得したAPIキーを入力してください。
                    </p>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/10">
                    <label htmlFor="falApiKey" className="block text-sm font-medium text-gray-300">
                        fal API Key (Optional)
                    </label>
                    <input
                        id="falApiKey"
                        type="password"
                        value={falApiKey}
                        onChange={(e) => setFalApiKey(e.target.value)}
                        placeholder="key-..."
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-400">
                        fal API (FLUX.1など) を使用して画像生成する場合に入力してください。
                    </p>
                </div>

                <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center space-x-2">
                        {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        {status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                        <span className={cn(
                            "text-sm font-medium",
                            status === 'success' && "text-green-600",
                            status === 'error' && "text-destructive"
                        )}>
                            {message}
                        </span>
                    </div>

                    <button
                        onClick={handleSaveAndVerify}
                        disabled={status === 'saving'}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        保存して検証
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <List size={20} />
                        利用可能なモデル一覧
                    </h2>
                    <button
                        onClick={fetchModels}
                        disabled={loadingModels || !apiKey}
                        className="inline-flex items-center text-sm text-primary hover:text-primary/80 disabled:opacity-50"
                    >
                        {loadingModels ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCcw className="mr-2 h-4 w-4" />
                        )}
                        一覧を更新
                    </button>
                </div>

                {modelError && (
                    <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {modelError}
                    </div>
                )}

                {models.length > 0 ? (
                    <div className="grid gap-3">
                        {models.map(model => (
                            <div key={model.name} className="p-4 rounded-lg border bg-card/50 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm">{model.displayName || model.name}</span>
                                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">{model.name.replace('models/', '')}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{model.description}</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {model.supportedGenerationMethods.map(method => (
                                        <span key={method} className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded border",
                                            method.includes('generateImage') || method.includes('predict')
                                                ? "bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400 dark:border-blue-900"
                                                : "bg-muted border-transparent text-muted-foreground"
                                        )}>
                                            {method}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        APIキーを入力して「一覧を更新」を押すと、<br />利用可能なモデルが表示されます。
                    </div>
                )}
            </div>
        </div>
    );
}

