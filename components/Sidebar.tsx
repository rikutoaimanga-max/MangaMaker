'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Images, Settings, BookOpen, ChevronLeft, ChevronRight, User, Layers } from 'lucide-react';

const navItems = [
    { name: '制作', href: '/', icon: LayoutDashboard },

    { name: 'アセット', href: '/assets', icon: Images },

    { name: '設定', href: '/settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div
            className={cn(
                "flex h-screen flex-col justify-between border-r border-white/10 bg-black/40 backdrop-blur-xl px-4 py-6 transition-[width] duration-300 ease-in-out relative z-50",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-9 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-900 shadow-md hover:bg-zinc-800 hover:scale-110 transition-all duration-200"
                title={isCollapsed ? "メニューを展開" : "メニューを折りたたむ"}
            >
                {isCollapsed ? <ChevronRight size={14} className="text-muted-foreground" /> : <ChevronLeft size={14} className="text-muted-foreground" />}
            </button>

            <div>
                <div className={cn("mb-8 flex items-center gap-2 px-2", isCollapsed && "justify-center px-0")}>
                    <div className="flex h-10 w-10 min-w-[2.5rem] items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg text-white">
                        <BookOpen size={20} />
                    </div>
                    {!isCollapsed && (
                        <span className="text-xl font-bold animate-in fade-in duration-300 whitespace-nowrap overflow-hidden bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                            Manga Gen
                        </span>
                    )}
                </div>
                <nav className="flex flex-col gap-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 border border-transparent',
                                    isActive
                                        ? 'bg-primary/20 text-primary border-primary/20 shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                                        : 'text-muted-foreground hover:bg-white/5 hover:text-white',
                                    isCollapsed && "justify-center px-0"
                                )}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <Icon size={20} className={cn("min-w-[20px] transition-transform duration-300", isActive && "scale-110")} />
                                {!isCollapsed && (
                                    <span className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
                                        {item.name}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {!isCollapsed && (
                <div className="px-2 animate-in fade-in duration-500">
                    <div className="rounded-lg bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-3 border border-indigo-500/20">
                        <p className="text-[10px] text-indigo-200/70 text-center whitespace-nowrap uppercase tracking-widest font-semibold">
                            Powered by Gemini
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
