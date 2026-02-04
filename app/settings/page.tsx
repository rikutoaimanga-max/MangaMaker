'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2, List, RefreshCcw, Settings, Key, Globe, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
// Note: Client-side model fetching for Vertex might be tricky without a proxy/action. 
// For now we keep listModels for Google AI Studio or disable it for Vertex/implement later.
import { getAvailableModels } from '@/lib/gemini';

export default function SettingsPage() {
    const [provider, setProvider] = useState<'google' | 'vertex'>('google');
    const [apiKey, setApiKey] = useState('');
    const [projectId, setProjectId] = useState('');
    const [location, setLocation] = useState('us-central1');
    const [falApiKey, setFalApiKey] = useState('');

    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    // Model List State (Google AI Only for now)
    const [models, setModels] = useState<{ name: string; displayName: string; description: string; supportedGenerationMethods: string[] }[]>([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [modelError, setModelError] = useState('');

    useEffect(() => {
        const storedProvider = localStorage.getItem('gemini_provider');
        if (storedProvider === 'vertex') setProvider('vertex');

        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) setApiKey(storedKey);

        const storedProject = localStorage.getItem('vertex_project_id');
        if (storedProject) setProjectId(storedProject);

        const storedLocation = localStorage.getItem('vertex_location');
        if (storedLocation) setLocation(storedLocation);

        const storedFalKey = localStorage.getItem('fal_api_key');
        if (storedFalKey) setFalApiKey(storedFalKey);
    }, []);

    const handleSaveAndVerify = async () => {
        if (provider === 'google' && !apiKey.trim()) {
            setStatus('error');
            setMessage('APIキーを入力してください');
            return;
        }
        if (provider === 'vertex' && (!projectId.trim() || !location.trim())) {
            setStatus('error');
            setMessage('Project IDとLocationを入力してください');
            return;
        }

        setStatus('saving');
        setMessage('保存中...');

        try {
            // Basic LocalStorage Save
            localStorage.setItem('gemini_provider', provider);
            localStorage.setItem('fal_api_key', falApiKey);

            if (provider === 'google') {
                localStorage.setItem('gemini_api_key', apiKey);
                // Simple validation attempt for Google
                try {
                    const list = await getAvailableModels(apiKey);
                    setModels(list); // Side effect: update model list
                } catch (e) {
                    console.warn("Model fetch failed during verification", e);
                    // Non-fatal if just saving, but good to warn
                }
            } else {
                localStorage.setItem('vertex_project_id', projectId);
                localStorage.setItem('vertex_location', location);
                // Vertex verification would need a server action. 
                // For now, we assume success if inputs are present.
            }

            setStatus('success');
            setMessage('設定を保存しました');

            // Clear status after 3 seconds
            setTimeout(() => {
                setStatus('idle');
                setMessage('');
            }, 3000);

        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('エラーが発生しました: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const fetchModels = async () => {
        if (provider !== 'google') {
            setModelError('モデル一覧の取得は現在Google AI Studioのみ対応しています');
            return;
        }
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
                    AIプロバイダーとAPIキーの設定を行います。設定はブラウザにのみ保存されます。
                </p>
            </div>

            <div className="space-y-6">
                {/* Provider Selection */}
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Cloud className="w-5 h-5" />
                        プロバイダー選択
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setProvider('google')}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                provider === 'google'
                                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                                    : "border-white/10 hover:border-white/20 hover:bg-white/5"
                            )}
                        >
                            <span className="font-bold">Google AI Studio</span>
                            <span className="text-xs text-muted-foreground">API Key (Free/Paid)</span>
                        </button>
                        <button
                            onClick={() => setProvider('vertex')}
                            className={cn(
                                "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                                provider === 'vertex'
                                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-200"
                                    : "border-white/10 hover:border-white/20 hover:bg-white/5"
                            )}
                        >
                            <span className="font-bold">Vertex AI</span>
                            <span className="text-xs text-muted-foreground">Google Cloud (ADC)</span>
                        </button>
                    </div>
                </div>

                {/* Gemini / Vertex Settings */}
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Gemini設定 ({provider === 'google' ? 'Google AI Studio' : 'Vertex AI'})
                    </h2>

                    {provider === 'google' ? (
                        <div className="space-y-2">
                            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Key className="w-4 h-4" /> API Key
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
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="projectId" className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> Project ID
                                </label>
                                <input
                                    id="projectId"
                                    type="text"
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    placeholder="my-project-123"
                                    className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="location" className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <Globe className="w-4 h-4" /> Location
                                </label>
                                <input
                                    id="location"
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="us-central1"
                                    className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="p-3 bg-yellow-500/10 text-yellow-200 text-xs rounded border border-yellow-500/20">
                                <strong>注意:</strong> Vertex AIを使用するには、このアプリが実行されている環境で認証情報（ADC）が設定されている必要があります。
                                <br />（例: <code>gcloud auth application-default login</code> を実行済みであること）
                            </div>
                        </div>
                    )}
                </div>

                {/* Fal Settings */}
                <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        fal.ai 設定 (Optional)
                    </h2>
                    <div className="space-y-2">
                        <label htmlFor="falApiKey" className="block text-sm font-medium text-gray-300">
                            API Key
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
                            FLUX.1などの画像生成モデルを使用する場合に入力してください。
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-4 pb-8">
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
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 py-2"
                    >
                        <Save className="mr-2 h-4 w-4" />
                        設定を保存
                    </button>
                </div>

                {/* Model List (Google Only) */}
                {provider === 'google' && (
                    <div className="space-y-4 pt-8 border-t border-white/10">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                <List size={20} />
                                利用可能なモデル一覧 (Google AI)
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
                                モデル一覧を表示するにはAPIキーを入力して更新してください。
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

