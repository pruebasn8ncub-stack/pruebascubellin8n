"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown, Bot, User, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarGradient, getInitials } from "@/lib/avatar";
import type { WhatsAppConversation, WhatsAppMessage, WhatsAppBotSettings } from "@/types/whatsapp";
import TicketBanner from "./TicketBanner";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import PausePopup from "./PausePopup";
import ResumePopup from "./ResumePopup";

interface ChatPanelProps {
    conversation: WhatsAppConversation;
    messages: WhatsAppMessage[];
    botSettings: WhatsAppBotSettings;
    userRole: string;
    onSendMessage: (content: string, pauseBot?: boolean) => void;
    onBotPause: (sendTransition: boolean, message: string) => void;
    onBotResume: (sendTransition: boolean, message: string) => void;
    onResolveTicket: (conversationId: string) => void;
    onLoadMore: () => void;
    hasMore: boolean;
    isLoadingMore: boolean;
    isLoadingChat: boolean;
    onRenameContact: (conversationId: string, newName: string) => void;
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
    onResolveTicket,
    onLoadMore,
    hasMore,
    isLoadingMore,
    isLoadingChat,
    onRenameContact,
}: ChatPanelProps) {
    const [showPausePopup, setShowPausePopup] = useState(false);
    const [showResumePopup, setShowResumePopup] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState("");
    const nameInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    // Track scroll position to show/hide the scroll-to-bottom button
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const distanceFromBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
            setShowScrollButton(distanceFromBottom > 200);
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    function scrollToBottom() {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    const initials = getInitials(conversation.contact_name);
    const avatarGradient = getAvatarGradient(conversation.contact_name);

    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 bg-white shadow-sm border-b border-slate-100 px-5 py-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {conversation.contact_avatar_url ? (
                        <img
                            src={conversation.contact_avatar_url}
                            alt={conversation.contact_name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.nextElementSibling?.classList.remove("hidden");
                            }}
                        />
                    ) : null}
                    <div
                        className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 select-none bg-gradient-to-br shadow-sm",
                            avatarGradient,
                            conversation.contact_avatar_url ? "hidden" : ""
                        )}
                    >
                        {initials || <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const trimmed = editName.trim();
                                        if (trimmed && trimmed !== conversation.contact_name) {
                                            onRenameContact(conversation.id, trimmed);
                                        }
                                        setIsEditingName(false);
                                    }
                                    if (e.key === "Escape") setIsEditingName(false);
                                }}
                                onBlur={() => {
                                    const trimmed = editName.trim();
                                    if (trimmed && trimmed !== conversation.contact_name) {
                                        onRenameContact(conversation.id, trimmed);
                                    }
                                    setIsEditingName(false);
                                }}
                                className="font-bold text-sm text-[#0d1f35] leading-tight bg-slate-50 border border-teal/30 rounded-md px-2 py-0.5 w-full focus:outline-none focus:ring-2 focus:ring-teal/20"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditName(conversation.contact_name);
                                    setIsEditingName(true);
                                    setTimeout(() => nameInputRef.current?.select(), 0);
                                }}
                                className="group flex items-center gap-1.5 text-left"
                                title="Editar nombre del contacto"
                            >
                                <p className="font-bold text-sm text-[#0d1f35] leading-tight truncate">
                                    {conversation.contact_name}
                                </p>
                                <Pencil className="w-3 h-3 text-slate-300 group-hover:text-teal transition-colors flex-shrink-0" />
                            </button>
                        )}
                        <p className="text-xs text-[#5e7a9a] leading-tight">
                            {conversation.phone_number}
                        </p>
                    </div>
                </div>

                {/* Bot toggle for this chat */}
                <button
                    type="button"
                    onClick={() => conversation.is_bot_paused ? setShowResumePopup(true) : setShowPausePopup(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0 transition-all"
                >
                    <Bot className={cn("w-4 h-4", conversation.is_bot_paused ? "text-red-500" : "text-emerald-500")} />
                    <div className={cn(
                        "relative w-9 h-5 rounded-full transition-colors duration-200",
                        conversation.is_bot_paused ? "bg-red-500" : "bg-emerald-500"
                    )}>
                        <div className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                            conversation.is_bot_paused ? "left-0.5" : "translate-x-4 left-0.5"
                        )} />
                    </div>
                </button>
            </div>

            {/* Ticket Banner */}
            {conversation.needs_human && conversation.needs_human_status !== "resolved" && (
                <TicketBanner
                    reason={conversation.needs_human_reason}
                    since={conversation.needs_human_since}
                    onResolve={() => onResolveTicket(conversation.id)}
                />
            )}

            {/* Messages area */}
            <div className="flex-1 relative overflow-hidden">
                <div
                    ref={messagesContainerRef}
                    className="h-full overflow-y-auto px-[60px] py-5"
                    style={{
                        backgroundColor: "#efeae2",
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23d5cfc7' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.3'%3E%3Crect x='6' y='6' width='18' height='12' rx='3'/%3E%3Cpolygon points='10,18 8,23 14,18'/%3E%3Ccircle cx='10' cy='12' r='1.2'/%3E%3Ccircle cx='15' cy='12' r='1.2'/%3E%3Ccircle cx='20' cy='12' r='1.2'/%3E%3Cpath d='M53 11 c0-2-2-4-4-2 c-2-2-4 0-4 2 c0 3 4 6 4 6 s4-3 4-6z'/%3E%3Cpolygon points='67,6 68.5,10.5 73,10.5 69.5,13 71,17.5 67,15 63,17.5 64.5,13 61,10.5 65.5,10.5'/%3E%3Ccircle cx='15' cy='58' r='7'/%3E%3Ccircle cx='12.5' cy='56' r='1'/%3E%3Ccircle cx='17.5' cy='56' r='1'/%3E%3Cpath d='M11.5 60 q3.5 3 7 0'/%3E%3Cpath d='M57 48 q-1-1 0-3 l2-3 q1-1 2 0 l2 2 q1 1-1 4 q-3 4-7 7 q-3 2-4 1 l-2-2 q-1-1 0-2 l3-2 q2-1 3 0 l1 1 q2-2 1-3z'/%3E%3Ccircle cx='68' cy='55' r='2.5'/%3E%3Ccircle cx='68' cy='49.5' r='2'/%3E%3Ccircle cx='68' cy='60.5' r='2'/%3E%3Ccircle cx='62.5' cy='55' r='2'/%3E%3Ccircle cx='73.5' cy='55' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
                        backgroundRepeat: "repeat",
                    }}
                >
                    {/* Loading skeleton */}
                    {isLoadingChat && messages.length === 0 && (
                        <div className="flex flex-col gap-3 animate-pulse">
                            {/* Incoming message skeleton */}
                            <div className="flex justify-start">
                                <div className="bg-white/80 rounded-xl rounded-tl-sm shadow-sm px-4 py-3 max-w-[55%]">
                                    <div className="h-3 bg-slate-200 rounded-full w-32 mb-2" />
                                    <div className="h-3 bg-slate-200 rounded-full w-48" />
                                </div>
                            </div>
                            {/* Outgoing message skeleton */}
                            <div className="flex justify-end">
                                <div className="bg-[#d9fdd3]/80 rounded-xl rounded-tr-sm shadow-sm px-4 py-3 max-w-[55%]">
                                    <div className="h-3 bg-emerald-200 rounded-full w-40 mb-2" />
                                    <div className="h-3 bg-emerald-200 rounded-full w-24" />
                                </div>
                            </div>
                            {/* Incoming */}
                            <div className="flex justify-start">
                                <div className="bg-white/80 rounded-xl rounded-tl-sm shadow-sm px-4 py-3 max-w-[55%]">
                                    <div className="h-3 bg-slate-200 rounded-full w-52 mb-2" />
                                    <div className="h-3 bg-slate-200 rounded-full w-36 mb-2" />
                                    <div className="h-3 bg-slate-200 rounded-full w-20" />
                                </div>
                            </div>
                            {/* Outgoing */}
                            <div className="flex justify-end">
                                <div className="bg-[#d9fdd3]/80 rounded-xl rounded-tr-sm shadow-sm px-4 py-3 max-w-[55%]">
                                    <div className="h-3 bg-emerald-200 rounded-full w-28" />
                                </div>
                            </div>
                            {/* Incoming */}
                            <div className="flex justify-start">
                                <div className="bg-white/80 rounded-xl rounded-tl-sm shadow-sm px-4 py-3 max-w-[55%]">
                                    <div className="h-3 bg-slate-200 rounded-full w-44 mb-2" />
                                    <div className="h-3 bg-slate-200 rounded-full w-32" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Load more */}
                    {hasMore && (
                        <div className="flex justify-center mb-4">
                            <button
                                type="button"
                                onClick={onLoadMore}
                                disabled={isLoadingMore}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-teal text-xs font-medium shadow-sm hover:shadow-md transition-all disabled:opacity-60"
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
                                        <span className="bg-white/90 backdrop-blur-sm text-[#5e7a9a] text-[0.7rem] font-medium px-4 py-1 rounded-full shadow-sm">
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

                {/* Scroll-to-bottom floating button */}
                {showScrollButton && (
                    <button
                        type="button"
                        onClick={scrollToBottom}
                        aria-label="Ir al mensaje mas reciente"
                        className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl flex items-center justify-center text-[#5e7a9a] border border-slate-200 transition-all hover:scale-105 z-10"
                    >
                        <ChevronDown className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Message Input */}
            <MessageInput
                onSend={onSendMessage}
                isBotActive={!conversation.is_bot_paused}
            />

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
