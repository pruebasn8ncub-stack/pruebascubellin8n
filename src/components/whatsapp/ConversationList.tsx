"use client";

import { useState, useRef, useCallback } from "react";
import { Search, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
    const [botFilter, setBotFilter] = useState<"all" | "active" | "paused">("all");
    const [showNeedsHuman, setShowNeedsHuman] = useState(false);
    const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
    const [headerShadow, setHeaderShadow] = useState(false);
    const [togglePressed, setTogglePressed] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        if (listRef.current) {
            setHeaderShadow(listRef.current.scrollTop > 0);
        }
    }, []);

    function handleToggleClick() {
        setShowGlobalConfirm(true);
    }

    function confirmGlobalToggle() {
        setTogglePressed(true);
        onGlobalToggle();
        setShowGlobalConfirm(false);
        setTimeout(() => setTogglePressed(false), 200);
    }

    const needsHumanCount = conversations.filter((c) => c.needs_human).length;

    const filtered = conversations
        .filter((c) => {
            // Needs human filter (overrides other filters)
            if (showNeedsHuman) return c.needs_human;
            // Search filter
            if (search.trim()) {
                const q = search.toLowerCase();
                if (!c.contact_name.toLowerCase().includes(q) && !c.phone_number.toLowerCase().includes(q)) {
                    return false;
                }
            }
            // Read/unread filter
            if (readFilter === "unread" && c.unread_count === 0) return false;
            if (readFilter === "read" && c.unread_count > 0) return false;
            // Bot filter
            if (botFilter === "active" && c.is_bot_paused) return false;
            if (botFilter === "paused" && !c.is_bot_paused) return false;
            return true;
        })
        .sort(
            (a, b) =>
                new Date(b.last_message_at).getTime() -
                new Date(a.last_message_at).getTime()
        );

    return (
        <div className="w-[380px] flex-shrink-0 flex flex-col h-full bg-white border-r border-slate-200">
            {/* Header */}
            <div
                className={cn(
                    "px-5 py-4 bg-white border-b border-slate-100 transition-shadow duration-200",
                    headerShadow && "shadow-sm"
                )}
            >
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg text-navy">WhatsApp</h2>
                    {userRole === "admin" && (
                        <button
                            type="button"
                            onClick={handleToggleClick}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200",
                                togglePressed && "scale-95",
                            )}
                        >
                            <Bot className={cn("w-4 h-4", botSettings.global_pause ? "text-red-400" : "text-teal")} />
                            <span className={cn("text-xs font-medium", botSettings.global_pause ? "text-red-400" : "text-navy")}>
                                Kini
                            </span>
                            {/* Toggle switch */}
                            <div className={cn(
                                "relative w-9 h-5 rounded-full transition-colors duration-200",
                                botSettings.global_pause ? "bg-red-300" : "bg-teal"
                            )}>
                                <div className={cn(
                                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                                    botSettings.global_pause ? "left-0.5" : "translate-x-4 left-0.5"
                                )} />
                            </div>
                        </button>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5e7a9a] pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar conversacion..."
                        className={cn(
                            "w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#f5f8fc] border-0 text-sm text-[#0d1f35]",
                            "placeholder:text-[#5e7a9a] focus:outline-none focus:ring-2 focus:ring-teal/20 focus:bg-white",
                            "transition-all"
                        )}
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {/* Read filters */}
                    {(["all", "unread", "read"] as const).map((v) => {
                        const labels = { all: "Todos", unread: "No leídos", read: "Leídos" };
                        return (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setReadFilter(readFilter === v ? "all" : v)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[0.68rem] font-medium transition-all",
                                    readFilter === v
                                        ? "bg-teal/10 text-teal border border-teal/20"
                                        : "bg-[#f5f8fc] text-[#5e7a9a] border border-transparent hover:bg-[#edf2f7]"
                                )}
                            >
                                {labels[v]}
                            </button>
                        );
                    })}
                    <div className="w-px h-5 bg-slate-200 self-center mx-0.5" />
                    {/* Bot filters */}
                    {(["active", "paused"] as const).map((v) => {
                        const labels = { active: "Bot activo", paused: "Bot pausado" };
                        return (
                            <button
                                key={v}
                                type="button"
                                onClick={() => { setBotFilter(botFilter === v ? "all" : v); setShowNeedsHuman(false); }}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[0.68rem] font-medium transition-all",
                                    botFilter === v && !showNeedsHuman
                                        ? v === "active"
                                            ? "bg-teal/10 text-teal border border-teal/20"
                                            : "bg-red-50 text-red-400 border border-red-200/50"
                                        : "bg-[#f5f8fc] text-[#5e7a9a] border border-transparent hover:bg-[#edf2f7]"
                                )}
                            >
                                {labels[v]}
                            </button>
                        );
                    })}
                    {needsHumanCount > 0 && (
                        <>
                            <div className="w-px h-5 bg-slate-200 self-center mx-0.5" />
                            <button
                                type="button"
                                onClick={() => { setShowNeedsHuman(!showNeedsHuman); setReadFilter("all"); setBotFilter("all"); }}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-[0.68rem] font-medium transition-all flex items-center gap-1",
                                    showNeedsHuman
                                        ? "bg-amber-50 text-amber-600 border border-amber-200/50"
                                        : "bg-amber-50 text-amber-600 border border-transparent hover:border-amber-200/50 animate-pulse"
                                )}
                            >
                                Atencion
                                <span className="min-w-[16px] h-4 rounded-full bg-amber-500 text-white text-[0.55rem] font-bold flex items-center justify-center px-1">
                                    {needsHumanCount}
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Conversation list */}
            <div
                ref={listRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto relative"
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

                {/* Bottom gradient fade for scrollable list */}
                <div className="sticky bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            </div>

            {/* Global toggle confirmation popup */}
            <AnimatePresence>
                {showGlobalConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setShowGlobalConfirm(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-bold text-[#0d1f35] mb-1">
                                {botSettings.global_pause ? "Reactivar Kini globalmente" : "Pausar Kini globalmente"}
                            </h2>
                            <p className="text-sm text-[#5e7a9a] mb-6">
                                {botSettings.global_pause
                                    ? "El chatbot volvera a responder en todas las conversaciones."
                                    : "El chatbot dejara de responder en todas las conversaciones."}
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowGlobalConfirm(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmGlobalToggle}
                                    className={cn(
                                        "px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:shadow-lg shadow-md transition-all",
                                        botSettings.global_pause
                                            ? "bg-gradient-to-r from-emerald-500 to-teal"
                                            : "bg-gradient-to-r from-red-500 to-rose-500"
                                    )}
                                >
                                    {botSettings.global_pause ? "Reactivar" : "Pausar"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
