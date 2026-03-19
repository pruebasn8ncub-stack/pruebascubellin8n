"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ChevronDown, ChevronUp, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketBannerProps {
    reason: string | null;
    since: string | null;
    contactName: string;
    onResolve: () => void;
    onReply: (message: string) => void;
}

function formatWaitTime(since: string | null): string {
    if (!since) return "";
    const diff = Date.now() - new Date(since).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
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

    const subject = subjectMatch ? subjectMatch[1].trim() : reason.substring(0, 80);
    const summary = summaryMatch ? summaryMatch[1].trim() : "";
    const messages: string[] = [];

    if (messagesMatch) {
        const lines = messagesMatch[1].split("\n");
        for (const line of lines) {
            const clean = line.replace(/^[-\u2022*]\s*/, "").trim();
            if (clean) messages.push(clean);
        }
    }

    return { subject, summary, messages };
}

export default function TicketBanner({ reason, since, contactName, onResolve, onReply }: TicketBannerProps) {
    const [expanded, setExpanded] = useState(false);
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [sending, setSending] = useState(false);
    const { subject, summary, messages } = parseTicketContent(reason);
    const waitTime = formatWaitTime(since);

    const handleReply = async () => {
        if (!replyText.trim() || sending) return;
        setSending(true);

        const fullMessage = `Con respecto a tu consulta sobre "${subject.toLowerCase()}":\n\n${replyText.trim()}`;
        onReply(fullMessage);
        setSending(false);
    };

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
                <div className="px-5 pb-3 space-y-2.5">
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

                    {/* Reply input */}
                    {showReplyInput && (
                        <div className="space-y-2 pt-1">
                            <p className="text-[0.65rem] text-amber-700">
                                Se enviara: &quot;Con respecto a tu consulta sobre &quot;{subject.toLowerCase()}&quot;: [tu respuesta]&quot;
                            </p>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Escribe tu respuesta..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300/50 resize-none"
                            />
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-1">
                        {showReplyInput ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { setShowReplyInput(false); setReplyText(""); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleReply}
                                    disabled={!replyText.trim() || sending}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        "bg-teal text-white hover:bg-teal/90 shadow-sm hover:shadow disabled:opacity-50"
                                    )}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Enviar respuesta
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onResolve(); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 border border-amber-300/60 hover:bg-amber-100 transition-all"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Marcar como resuelto
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowReplyInput(true); }}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                        "bg-teal text-white hover:bg-teal/90 shadow-sm hover:shadow"
                                    )}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    Responder
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
