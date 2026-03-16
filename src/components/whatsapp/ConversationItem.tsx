"use client";

import { cn } from "@/lib/utils";
import type { WhatsAppConversation } from "@/types/whatsapp";

interface ConversationItemProps {
    conversation: WhatsAppConversation;
    isSelected: boolean;
    onClick: () => void;
}

function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
}

function formatTime(timestamp: string): string {
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

    if (isToday) {
        const h = date.getHours().toString().padStart(2, "0");
        const m = date.getMinutes().toString().padStart(2, "0");
        return `${h}:${m}`;
    }
    if (isYesterday) {
        return "Ayer";
    }

    const day = date.getDate().toString().padStart(2, "0");
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const month = months[date.getMonth()];
    return `${day} ${month}`;
}

export default function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
    const initials = getInitials(conversation.contact_name);
    const timeLabel = formatTime(conversation.last_message_at);

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 cursor-pointer text-left transition-colors",
                isSelected ? "bg-[#e0f7f5]" : "bg-white hover:bg-slate-50"
            )}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-semibold text-sm select-none">
                {initials || "?"}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-[#0d1f35] truncate">
                            {conversation.contact_name}
                        </span>
                        {conversation.is_bot_paused ? (
                            <span className="text-[0.6rem] leading-none px-1 py-0.5 rounded-full bg-red-100 text-red-500 flex-shrink-0">
                                ⏸
                            </span>
                        ) : (
                            <span className="text-[0.6rem] leading-none px-1 py-0.5 rounded-full bg-green-100 text-green-600 flex-shrink-0">
                                🤖
                            </span>
                        )}
                    </div>
                    <span className="text-[0.7rem] text-[#5e7a9a] flex-shrink-0">{timeLabel}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-[#5e7a9a] truncate flex-1">
                        {conversation.last_message}
                    </p>
                    {conversation.unread_count > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#00b4a6] text-white text-[0.6rem] font-semibold flex items-center justify-center">
                            {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
