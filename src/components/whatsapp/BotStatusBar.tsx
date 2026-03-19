"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface BotStatusBarProps {
    isBotPaused: boolean;
    isGlobalPaused: boolean;
}

export default function BotStatusBar({ isBotPaused, isGlobalPaused }: BotStatusBarProps) {
    if (isBotPaused && isGlobalPaused) {
        return (
            <div className={cn(
                "px-4 py-2 text-xs font-medium flex items-center gap-2",
                "bg-gradient-to-r from-red-50 to-orange-50 text-red-500 border-l-[3px] border-l-red-400"
            )}>
                <Bot className="w-3.5 h-3.5" />
                Bot pausado global y en este chat
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

    if (isGlobalPaused) {
        return (
            <div className={cn(
                "px-4 py-2 text-xs font-medium flex items-center gap-2",
                "bg-gradient-to-r from-teal/5 to-emerald-50 text-teal border-l-[3px] border-l-teal"
            )}>
                <Bot className="w-3.5 h-3.5" />
                Chatbot activo en este chat (global pausado)
            </div>
        );
    }

    return (
        <div className={cn(
            "px-4 py-2 text-xs font-medium flex items-center gap-2",
            "bg-gradient-to-r from-teal/5 to-emerald-50 text-teal border-l-[3px] border-l-teal"
        )}>
            <Bot className="w-3.5 h-3.5" />
            Chatbot activo en esta conversacion
        </div>
    );
}
