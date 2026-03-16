"use client";

interface BotStatusBarProps {
    isBotPaused: boolean;
    isGlobalPaused: boolean;
}

export default function BotStatusBar({ isBotPaused, isGlobalPaused }: BotStatusBarProps) {
    if (isGlobalPaused) {
        return (
            <div className="px-5 py-2 bg-[#fef9c3] text-[#854d0e] text-xs font-medium text-center">
                Bot pausado globalmente
            </div>
        );
    }

    if (isBotPaused) {
        return (
            <div className="px-5 py-2 bg-[#fef2f2] text-[#ef4444] text-xs font-medium text-center">
                Bot pausado — Estas respondiendo directamente
            </div>
        );
    }

    return (
        <div className="px-5 py-2 bg-[#e0f7f5] text-[#00b4a6] text-xs font-medium text-center">
            Kini esta activo en esta conversacion
        </div>
    );
}
