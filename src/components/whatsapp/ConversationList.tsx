"use client";

import { useState, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppConversation, WhatsAppBotSettings } from "@/types/whatsapp";
import ConversationItem from "./ConversationItem";

interface ConversationListProps {
    conversations: WhatsAppConversation[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    botSettings: WhatsAppBotSettings;
    userRole: string;
    onGlobalToggle: () => void;
}

export default function ConversationList({
    conversations,
    selectedId,
    onSelect,
    botSettings,
    userRole,
    onGlobalToggle,
}: ConversationListProps) {
    const [search, setSearch] = useState("");
    const [headerShadow, setHeaderShadow] = useState(false);
    const [togglePressed, setTogglePressed] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        if (listRef.current) {
            setHeaderShadow(listRef.current.scrollTop > 0);
        }
    }, []);

    function handleToggleClick() {
        setTogglePressed(true);
        onGlobalToggle();
        setTimeout(() => setTogglePressed(false), 200);
    }

    const filtered = conversations
        .filter((c) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                c.contact_name.toLowerCase().includes(q) ||
                c.phone_number.toLowerCase().includes(q)
            );
        })
        .sort(
            (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime()
        );

    return (
        <div className="w-[380px] flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200">
            {/* Header with scroll-triggered shadow */}
            <div
                className={cn(
                    "px-5 py-4 border-b border-slate-100 transition-shadow duration-200",
                    headerShadow && "shadow-md"
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg text-[#0d1f35]">WhatsApp</h2>
                    {userRole === "admin" && (
                        <button
                            type="button"
                            onClick={handleToggleClick}
                            className={cn(
                                "text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200",
                                togglePressed && "scale-90",
                                botSettings.global_pause
                                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                                    : "bg-[#e0f7f5] text-[#00b4a6] hover:bg-[#c0f0ec]"
                            )}
                        >
                            {botSettings.global_pause ? "Bot Global: OFF" : "Bot Global: ON"}
                        </button>
                    )}
                </div>

                {/* Search with icon inside input */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5e7a9a] pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar conversacion..."
                        className={cn(
                            "w-full pl-9 pr-4 py-2 rounded-xl bg-[#f0f2f5] border border-transparent text-sm text-[#0d1f35]",
                            "placeholder:text-[#5e7a9a] focus:outline-none focus:ring-2 focus:ring-[#00b4a6]/30 focus:border-[#00b4a6]",
                            "transition-all"
                        )}
                    />
                </div>
            </div>

            {/* Conversation list */}
            <div
                ref={listRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto"
            >
                {filtered.length === 0 ? (
                    <p className="text-center text-sm text-[#5e7a9a] mt-10 px-4">
                        No se encontraron conversaciones
                    </p>
                ) : (
                    filtered.map((conv) => (
                        <ConversationItem
                            key={conv.id}
                            conversation={conv}
                            isSelected={selectedId === conv.id}
                            onClick={() => onSelect(conv.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
