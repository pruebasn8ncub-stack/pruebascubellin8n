"use client";

import { useState } from "react";
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

    const filtered = conversations
        .filter((c) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                c.contact_name.toLowerCase().includes(q) ||
                c.phone_number.toLowerCase().includes(q)
            );
        })
        .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    return (
        <div className="w-[380px] flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg text-[#0d1f35]">WhatsApp</h2>
                    {userRole === "admin" && (
                        <button
                            type="button"
                            onClick={onGlobalToggle}
                            className={cn(
                                "text-xs font-semibold px-3 py-1.5 rounded-full transition-colors",
                                botSettings.global_pause
                                    ? "bg-red-100 text-red-600 hover:bg-red-200"
                                    : "bg-[#e0f7f5] text-[#00b4a6] hover:bg-[#c0f0ec]"
                            )}
                        >
                            {botSettings.global_pause ? "Bot Global: OFF" : "Bot Global: ON"}
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5e7a9a]" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar conversacion..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-[#0d1f35] placeholder:text-[#5e7a9a] focus:outline-none focus:ring-2 focus:ring-[#00b4a6]/30 focus:border-[#00b4a6] transition-all"
                    />
                </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
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
