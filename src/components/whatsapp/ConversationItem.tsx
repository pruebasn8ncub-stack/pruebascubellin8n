"use client";

import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarGradient, getInitials, getDisplayName } from "@/lib/avatar";
import type { WhatsAppConversation } from "@/types/whatsapp";

interface ConversationItemProps {
    conversation: WhatsAppConversation;
    isSelected: boolean;
    onClick: () => void;
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
    const displayName = getDisplayName(conversation.custom_name, conversation.contact_name);
    const initials = getInitials(displayName);
    const timeLabel = formatTime(conversation.last_message_at);
    const avatarGradient = getAvatarGradient(displayName);

    // Show prefix based on who sent the last message
    const lastMessagePrefix = !conversation.last_message_from_me ? null :
        conversation.last_message_sender_type === "bot" ? (
            <span className="text-blue-400 mr-0.5">Kini: </span>
        ) : (
            <span className="text-[#5e7a9a]/60 mr-0.5">Tu: </span>
        );

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/80 cursor-pointer text-left",
                "transition-all duration-200",
                isSelected
                    ? "bg-teal/5 border-l-[3px] border-l-teal shadow-[inset_4px_0_8px_-4px_rgba(0,180,166,0.1)]"
                    : "bg-white hover:bg-[#f5f8fc] border-l-[3px] border-l-transparent"
            )}
        >
            {/* Avatar */}
            {conversation.contact_avatar_url ? (
                <img
                    src={conversation.contact_avatar_url}
                    alt={conversation.contact_name}
                    className="flex-shrink-0 w-12 h-12 rounded-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                />
            ) : null}
            <div
                className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center",
                    "text-white font-semibold text-sm select-none bg-gradient-to-br shadow-sm",
                    avatarGradient,
                    conversation.contact_avatar_url ? "hidden" : ""
                )}
            >
                {initials || <User className="w-5 h-5" />}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-sm text-[#0d1f35] truncate">
                            {displayName}
                        </span>
                        {conversation.needs_human && (
                            <span className="text-[0.6rem] leading-none px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 font-medium flex-shrink-0">
                                Atencion
                            </span>
                        )}
                        {conversation.is_bot_paused ? (
                            <span className="flex items-center gap-1 text-[0.6rem] leading-none px-1.5 py-0.5 rounded-md bg-red-100 text-red-600 font-medium flex-shrink-0 border border-red-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Pausado
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-[0.6rem] leading-none px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-medium flex-shrink-0 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Activo
                            </span>
                        )}
                    </div>
                    <span className="text-[0.65rem] text-[#5e7a9a] flex-shrink-0">
                        {timeLabel}
                    </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-[#5e7a9a] truncate flex-1">
                        {lastMessagePrefix}
                        {conversation.last_message}
                    </p>
                    {conversation.unread_count > 0 && (
                        <span className="flex-shrink-0 min-w-[20px] h-5 rounded-full bg-gradient-to-r from-teal to-emerald-400 text-white text-[0.6rem] font-bold flex items-center justify-center px-1.5 shadow-sm">
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
