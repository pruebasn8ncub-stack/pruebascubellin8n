"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { WhatsAppConversation, WhatsAppMessage, WhatsAppBotSettings } from "@/types/whatsapp";
import BotStatusBar from "./BotStatusBar";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import PausePopup from "./PausePopup";
import ResumePopup from "./ResumePopup";

interface ChatPanelProps {
    conversation: WhatsAppConversation;
    messages: WhatsAppMessage[];
    botSettings: WhatsAppBotSettings;
    userRole: string;
    onSendMessage: (content: string) => void;
    onBotPause: (sendTransition: boolean, message: string) => void;
    onBotResume: (sendTransition: boolean, message: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    isLoadingMore: boolean;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
}

function formatDateDivider(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate();

    if (isToday) return "Hoy";
    if (isYesterday) return "Ayer";

    const day = date.getDate().toString().padStart(2, "0");
    const months = ["enero", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = months[date.getMonth()];
    const year = date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : "";
    return `${day} ${month}${year}`;
}

function isSameDay(a: string, b: string): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
}

export default function ChatPanel({
    conversation,
    messages,
    botSettings,
    onSendMessage,
    onBotPause,
    onBotResume,
    onLoadMore,
    hasMore,
    isLoadingMore,
}: ChatPanelProps) {
    const [showPausePopup, setShowPausePopup] = useState(false);
    const [showResumePopup, setShowResumePopup] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    const initials = getInitials(conversation.contact_name);

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-5 py-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm flex-shrink-0 select-none">
                        {initials || "?"}
                    </div>
                    <div>
                        <p className="font-semibold text-sm text-[#0d1f35] leading-tight">
                            {conversation.contact_name}
                        </p>
                        <p className="text-xs text-[#5e7a9a] leading-tight">
                            {conversation.phone_number}
                        </p>
                    </div>
                </div>

                {/* Pause / Resume button */}
                {conversation.is_bot_paused ? (
                    <button
                        type="button"
                        onClick={() => setShowResumePopup(true)}
                        className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-[#e0f7f5] text-[#00b4a6] hover:bg-[#c0f0ec] transition-colors"
                    >
                        Reactivar Bot
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowPausePopup(true)}
                        className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                        Pausar Bot
                    </button>
                )}
            </div>

            {/* Bot Status Bar */}
            <BotStatusBar
                isBotPaused={conversation.is_bot_paused}
                isGlobalPaused={botSettings.global_pause}
            />

            {/* Messages area */}
            <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-[60px] py-5"
                style={{ backgroundColor: "#efeae2" }}
            >
                {/* Load more */}
                {hasMore && (
                    <div className="flex justify-center mb-4">
                        <button
                            type="button"
                            onClick={onLoadMore}
                            disabled={isLoadingMore}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-sm text-[#5e7a9a] shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-60"
                        >
                            {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                            Cargar mas...
                        </button>
                    </div>
                )}

                {/* Messages with date dividers */}
                {messages.map((msg, index) => {
                    const prev = messages[index - 1];
                    const showDivider = !prev || !isSameDay(prev.created_at, msg.created_at);

                    return (
                        <div key={msg.id}>
                            {showDivider && (
                                <div className="flex justify-center my-3">
                                    <span className="bg-white text-[#5e7a9a] text-xs px-3 py-1 rounded-full shadow-sm">
                                        {formatDateDivider(msg.created_at)}
                                    </span>
                                </div>
                            )}
                            <MessageBubble message={msg} />
                        </div>
                    );
                })}

                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput onSend={onSendMessage} />

            {/* Popups */}
            <PausePopup
                isOpen={showPausePopup}
                onClose={() => setShowPausePopup(false)}
                onPause={(sendTransition, message) => {
                    onBotPause(sendTransition, message);
                    setShowPausePopup(false);
                }}
                defaultMessage={botSettings.transition_message_on}
            />
            <ResumePopup
                isOpen={showResumePopup}
                onClose={() => setShowResumePopup(false)}
                onResume={(sendTransition, message) => {
                    onBotResume(sendTransition, message);
                    setShowResumePopup(false);
                }}
                defaultMessage={botSettings.transition_message_off}
            />
        </div>
    );
}
