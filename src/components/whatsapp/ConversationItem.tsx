"use client";

import { cn } from "@/lib/utils";
import type { WhatsAppConversation } from "@/types/whatsapp";

interface ConversationItemProps {
    conversation: WhatsAppConversation;
    isSelected: boolean;
    onClick: () => void;
}

const AVATAR_COLORS = [
    "bg-emerald-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
];

function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
        return date.toLocaleTimeString("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    if (isYesterday) {
        return "Ayer";
    }

    const day = date.getDate().toString().padStart(2, "0");
    const months = [
        "ene", "feb", "mar", "abr", "may", "jun",
        "jul", "ago", "sep", "oct", "nov", "dic",
    ];
    const month = months[date.getMonth()];
    return `${day} ${month}`;
}

export default function ConversationItem({
    conversation,
    isSelected,
    onClick,
}: ConversationItemProps) {
    const initials = getInitials(conversation.contact_name);
    const timeLabel = formatTime(conversation.last_message_at);
    const avatarColor = getAvatarColor(conversation.contact_name);

    // Prefix for last message preview based on sender context
    const lastMessageSender = conversation.is_bot_paused ? "admin" : "bot";
    const lastMessagePrefix =
        lastMessageSender === "admin" ? (
            <span className="text-slate-400 mr-0.5">Tú: </span>
        ) : (
            <span className="mr-0.5">🤖 </span>
        );

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 cursor-pointer text-left",
                "transition-colors duration-150",
                isSelected
                    ? "bg-[#f0f2f5] border-l-[3px] border-l-[#00b4a6]"
                    : "bg-white hover:bg-[#f5f6f6] border-l-[3px] border-l-transparent"
            )}
        >
            {/* Avatar with deterministic color */}
            <div
                className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
                    "text-white font-semibold text-sm select-none",
                    avatarColor
                )}
            >
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
                    <span className="text-[0.7rem] text-[#5e7a9a] flex-shrink-0">
                        {timeLabel}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-[#5e7a9a] truncate flex-1">
                        {lastMessagePrefix}
                        {conversation.last_message}
                    </p>
                    {conversation.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-[#25d366] text-white text-[0.6rem] font-semibold flex items-center justify-center px-1">
                            {conversation.unread_count > 99
                                ? "99+"
                                : conversation.unread_count}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}
