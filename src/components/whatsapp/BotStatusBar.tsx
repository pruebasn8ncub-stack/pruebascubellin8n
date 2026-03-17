"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface BotStatusBarProps {
    isBotPaused: boolean;
    isGlobalPaused: boolean;
}

export default function BotStatusBar({ isBotPaused, isGlobalPaused }: BotStatusBarProps) {
    if (isGlobalPaused) {
        return (
            <div className={cn(
                "px-4 py-2 text-xs font-medium flex items-center gap-2",
                "bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-600 border-l-[3px] border-l-amber-400"
            )}>
                <Bot className="w-3.5 h-3.5" />
                Bot pausado globalmente
            </div>
        );
    }

    if (isBotPaused) {
        return (
            <div className={cn(
                "px-4 py-2 text-xs font-medium flex items-center gap-2",
                "bg-gradient-to-r from-red-50 to-orange-50 text-red-500 border-l-[3px] border-l-red-400"
            )}>
                <Bot className="w-3.5 h-3.5" />
                Bot pausado — Estas respondiendo directamente
            </div>
        );
    }

    return (
        <div className={cn(
            "px-4 py-2 text-xs font-medium flex items-center gap-2",
            "bg-gradient-to-r from-teal/5 to-emerald-50 text-teal border-l-[3px] border-l-teal"
        )}>
            <Bot className="w-3.5 h-3.5" />
            Kini esta activo en esta conversacion
        </div>
    );
}
