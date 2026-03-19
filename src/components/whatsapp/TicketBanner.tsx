"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketBannerProps {
    reason: string | null;
    since: string | null;
    onResolve: () => void;
}

function formatWaitTime(since: string | null): string {
    if (!since) return "";
    const diff = Date.now() - new Date(since).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

function parseTicketContent(reason: string | null): {
    subject: string;
    summary: string;
    messages: string[];
} {
    if (!reason) return { subject: "Solicitud de atencion", summary: "", messages: [] };

    const subjectMatch = reason.match(/Asunto:\s*(.+?)(?:\n|$)/i);
    const summaryMatch = reason.match(/Resumen:\s*([\s\S]+?)(?:\n\n|\nMensajes)/i);
    const messagesMatch = reason.match(/Mensajes relevantes:\s*\n([\s\S]*?)$/i);

    const subject = subjectMatch ? subjectMatch[1].trim() : reason.substring(0, 60);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const messages: string[] = [];

    if (messagesMatch) {
        const lines = messagesMatch[1].split("\n");
        for (const line of lines) {
            const clean = line.replace(/^[-•*]\s*/, "").trim();
            if (clean) messages.push(clean);
        }
    }

    return { subject, summary, messages };
}

export default function TicketBanner({ reason, since, onResolve }: TicketBannerProps) {
    const [expanded, setExpanded] = useState(true);
    const { subject, summary, messages } = parseTicketContent(reason);
    const waitTime = formatWaitTime(since);

    return (
        <div className="bg-amber-50 border-b border-amber-200/60 flex-shrink-0">
            {/* Header — always visible */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-amber-100/50 transition-colors"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-amber-800 truncate">
                        {subject}
                    </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    {waitTime && (
                        <div className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" />
                            <span className="text-[0.65rem] font-medium">{waitTime}</span>
                        </div>
                    )}
                    {expanded ? (
                        <ChevronUp className="w-4 h-4 text-amber-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-amber-400" />
                    )}
                </div>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-5 pb-3 space-y-2">
                    {summary && (
                        <p className="text-xs text-amber-900/80 leading-relaxed">
                            {summary}
                        </p>
                    )}

                    {messages.length > 0 && (
                        <div className="space-y-1">
                            <p className="text-[0.65rem] font-semibold text-amber-700 uppercase tracking-wide">
                                Mensajes relevantes
                            </p>
                            <div className="space-y-0.5">
                                {messages.map((msg, i) => (
                                    <p key={i} className="text-xs text-amber-900/70 pl-3 border-l-2 border-amber-300/60">
                                        {msg}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-1">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onResolve(); }}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm hover:shadow"
                            )}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Marcar como resuelto
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
