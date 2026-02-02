'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { saveImage, getAllImages, deleteImage } from '@/lib/db';
import { cn } from '@/lib/utils';

// Simple Dropzone implementation since we didn't install react-dropzone
function Dropzone({ onDrop }: { onDrop: (files: File[]) => void }) {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onDrop(Array.from(e.dataTransfer.files));
        }
    }, [onDrop]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onDrop(Array.from(e.target.files));
        }
    }, [onDrop]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            )}
        >
            <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-4 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">クリックしてアップロード</span> またはドラッグ＆ドロップ
                    </p>
                    <p className="text-xs text-muted-foreground">PNG, JPG, GIF (Max 10MB)</p>
                </div>
                <input id="file-upload" type="file" className="hidden" multiple accept="image/*" onChange={handleChange} />
            </label>
        </div>
    );
}

export default function AssetsPage() {
    const [images, setImages] = useState<{ id: string; url: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadImages = useCallback(async () => {
        try {
            const storedImages = await getAllImages();
            // Convert blobs to URLs
            const imageUrls = storedImages.map((img) => ({
                id: img.id,
                url: URL.createObjectURL(img.data),
                name: img.name
            }));
            setImages(imageUrls.reverse()); // Show newest first
        } catch (error) {
            console.error("Failed to load images", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadImages();
        return () => {
            // Cleanup URLs on unmount
            images.forEach(img => URL.revokeObjectURL(img.url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDrop = async (files: File[]) => {
        setIsLoading(true);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                await saveImage(file);
            }
        }
        await loadImages();
    };

    const handleDelete = async (id: string) => {
        if (confirm('この画像を削除しますか？')) {
            await deleteImage(id);
            const newImages = images.filter(img => img.id !== id);
            setImages(newImages);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">アセット管理</h1>
                <p className="text-muted-foreground mt-2">
                    漫画生成に使用する参照画像をアップロード・管理します。
                </p>
            </div>

            <Dropzone onDrop={handleDrop} />

            <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon size={20} />
                    保存された画像
                </h2>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="animate-spin text-primary" size={32} />
                    </div>
                ) : images.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                        画像がありません。上にドロップしてアップロードしてください。
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {images.map((img) => (
                            <div key={img.id} className="group relative aspect-square rounded-lg overflow-hidden border bg-card shadow-sm transition-all hover:shadow-md">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button
                                        onClick={() => handleDelete(img.id)}
                                        className="p-2 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-xs text-white truncate">{img.name}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
