"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    playIncomingSound,
    playOutgoingSound,
    playNotificationSound,
} from "@/lib/whatsapp-sounds";
import type {
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppBotSettings,
} from "@/types/whatsapp";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatPanel from "@/components/whatsapp/ChatPanel";
import EmptyChat from "@/components/whatsapp/EmptyChat";

// ---------------------------------------------------------------------------
// Types for API responses (wrapped by ApiResponseBuilder)
// ---------------------------------------------------------------------------

interface ConversationsResponse {
    success: boolean;
    data: {
        conversations: WhatsAppConversation[];
        botSettings: WhatsAppBotSettings | null;
        total: number;
    };
}

interface MessagesResponse {
    success: boolean;
    data: {
        messages: WhatsAppMessage[];
        hasMore: boolean;
    };
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function WhatsAppPage() {
    const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
    const [botSettings, setBotSettings] = useState<WhatsAppBotSettings | null>(null);
    const [userRole, setUserRole] = useState<string>("");
    const [accessToken, setAccessToken] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(true);

    // Ref to keep the selectedId current inside Realtime callbacks
    const selectedIdRef = useRef<string | null>(selectedId);
    useEffect(() => {
        selectedIdRef.current = selectedId;
    }, [selectedId]);

    // Ref to keep accessToken current for apiFetch used in callbacks
    const accessTokenRef = useRef<string>(accessToken);
    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    // -----------------------------------------------------------------------
    // API helper
    // -----------------------------------------------------------------------

    const apiFetch = useCallback(
        async (url: string, options: RequestInit = {}): Promise<Response> => {
            const token = accessTokenRef.current;
            return fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...options.headers,
                },
            });
        },
        []
    );

    // -----------------------------------------------------------------------
    // Auth & initial load
    // -----------------------------------------------------------------------

    useEffect(() => {
        const init = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) return; // Layout handles redirect

            const token = session.access_token;
            setAccessToken(token);
            accessTokenRef.current = token;

            // Fetch user role
            const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (profile) {
                setUserRole(profile.role as string);
            }

            // Fetch conversations + bot settings
            const res = await fetch("/api/whatsapp/conversations", {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const json: ConversationsResponse = await res.json();
                setConversations(json.data.conversations);
                setBotSettings(json.data.botSettings);
            }

            setLoading(false);
        };

        init();

        // Auto-refresh token when Supabase renews the session
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session?.access_token) {
                    setAccessToken(session.access_token);
                    accessTokenRef.current = session.access_token;
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // -----------------------------------------------------------------------
    // Fetch messages when selected conversation changes
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (!selectedId) {
            setMessages([]);
            setHasMore(false);
            return;
        }

        // Clear previous messages immediately when switching conversations
        setMessages([]);
        setHasMore(false);

        const abortController = new AbortController();

        const fetchMessages = async () => {
            // Optimistically clear unread count immediately
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === selectedId ? { ...c, unread_count: 0 } : c
                )
            );

            // Fetch messages and mark-read in parallel
            const [res] = await Promise.all([
                apiFetch(`/api/whatsapp/messages/${selectedId}?limit=30`, {
                    signal: abortController.signal,
                }),
                apiFetch("/api/whatsapp/mark-read", {
                    method: "POST",
                    body: JSON.stringify({ conversationId: selectedId }),
                    signal: abortController.signal,
                }),
            ]);

            // Only update state if this request wasn't aborted (user switched conversation)
            if (!abortController.signal.aborted && res.ok) {
                const json: MessagesResponse = await res.json();
                setMessages(json.data.messages);
                setHasMore(json.data.hasMore);
            }
        };

        fetchMessages().catch(() => {
            // Silently ignore abort errors
        });

        return () => abortController.abort();
    }, [selectedId, apiFetch]);

    // -----------------------------------------------------------------------
    // Supabase Realtime subscriptions
    // -----------------------------------------------------------------------

    useEffect(() => {
        if (loading) return;

        // 1. New messages
        const messagesChannel = supabase
            .channel("whatsapp-messages")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "whatsapp_messages",
                },
                (payload) => {
                    const newMsg = payload.new as WhatsAppMessage;

                    // If the message belongs to the currently-selected conversation
                    if (newMsg.conversation_id === selectedIdRef.current) {
                        setMessages((prev) => {
                            // Skip if message already exists (duplicate realtime event)
                            if (prev.some((m) => m.id === newMsg.id)) return prev;

                            // Check if this is replacing an optimistic (temp) message
                            // Match the OLDEST temp message with same content and sender type
                            const optimisticIdx = prev.findIndex(
                                (m) => m.id.startsWith("temp-") && m.content === newMsg.content && m.sender_type === newMsg.sender_type
                            );
                            if (optimisticIdx !== -1) {
                                const updated = [...prev];
                                updated[optimisticIdx] = newMsg;
                                return updated;
                            }
                            // Otherwise append (new message from client or bot)
                            return [...prev, newMsg];
                        });

                        // Play sound based on message direction
                        if (!newMsg.from_me) {
                            playIncomingSound();
                        } else if (newMsg.sender_type === "bot") {
                            playOutgoingSound();
                        }
                    } else if (!newMsg.from_me) {
                        // Incoming message in a background conversation
                        playNotificationSound();
                    }

                    // Update the conversation list entry
                    setConversations((prev) =>
                        prev.map((c) => {
                            if (c.id === newMsg.conversation_id) {
                                return {
                                    ...c,
                                    last_message:
                                        newMsg.content ||
                                        (newMsg.media_type
                                            ? `[${newMsg.media_type}]`
                                            : ""),
                                    last_message_at: newMsg.created_at,
                                    last_message_from_me: newMsg.from_me,
                                    last_message_sender_type: newMsg.sender_type,
                                    unread_count:
                                        newMsg.conversation_id ===
                                        selectedIdRef.current
                                            ? 0
                                            : c.unread_count +
                                              (newMsg.from_me ? 0 : 1),
                                };
                            }
                            return c;
                        })
                    );
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "whatsapp_messages",
                },
                (payload) => {
                    const updated = payload.new as WhatsAppMessage;
                    // Update message fields (status ticks, transcription, media URL)
                    if (updated.conversation_id === selectedIdRef.current) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.wa_message_id === updated.wa_message_id
                                    ? {
                                          ...m,
                                          status: updated.status,
                                          content: updated.content ?? m.content,
                                          media_url: updated.media_url ?? m.media_url,
                                          media_mime_type: updated.media_mime_type ?? m.media_mime_type,
                                      }
                                    : m
                            )
                        );
                    }
                }
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    setRealtimeConnected(true);
                } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    setRealtimeConnected(false);
                }
            });

        // 2. Conversation updates (new conversations, bot pause changes, etc.)
        const convsChannel = supabase
            .channel("whatsapp-conversations")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "whatsapp_conversations",
                },
                (payload) => {
                    if (payload.eventType === "INSERT") {
                        const newConv =
                            payload.new as WhatsAppConversation;
                        setConversations((prev) => [newConv, ...prev]);
                    } else if (payload.eventType === "UPDATE") {
                        const updated =
                            payload.new as WhatsAppConversation;
                        setConversations((prev) =>
                            prev.map((c) => {
                                if (c.id !== updated.id) return c;
                                // Keep unread_count at 0 for the selected conversation
                                if (updated.id === selectedIdRef.current) {
                                    return { ...updated, unread_count: 0 };
                                }
                                return updated;
                            })
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(messagesChannel);
            supabase.removeChannel(convsChannel);
        };
    }, [loading]);

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const handleSendMessage = async (content: string) => {
        if (!selectedId) return;

        // Optimistic: show message immediately with "pending" status
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticMsg: WhatsAppMessage = {
            id: tempId,
            conversation_id: selectedId,
            wa_message_id: tempId,
            sender_type: "admin",
            sender_id: null,
            content,
            media_type: null,
            media_url: null,
            media_mime_type: null,
            message_type: "conversation",
            status: "pending",
            from_me: true,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticMsg]);

        // Update conversation preview
        setConversations((prev) =>
            prev.map((c) =>
                c.id === selectedId
                    ? { ...c, last_message: content, last_message_at: optimisticMsg.created_at, last_message_from_me: true, last_message_sender_type: "admin" as const }
                    : c
            )
        );

        const res = await apiFetch("/api/whatsapp/send", {
            method: "POST",
            body: JSON.stringify({ conversationId: selectedId, content }),
        });

        if (res.ok) {
            playOutgoingSound();
            // Replace optimistic message with "sent" status (single tick)
            // Double tick (delivered) and blue ticks (read) come from webhook updates
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === tempId ? { ...m, status: "sent" } : m
                )
            );
        } else {
            // Mark as failed
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === tempId ? { ...m, status: "failed" } : m
                )
            );
        }
    };

    const handleBotPause = async (
        sendTransition: boolean,
        message: string
    ) => {
        if (!selectedId) return;
        await apiFetch("/api/whatsapp/bot-control", {
            method: "POST",
            body: JSON.stringify({
                action: "pause",
                conversationId: selectedId,
                sendTransition,
                transitionMessage: message,
            }),
        });
    };

    const handleBotResume = async (
        sendTransition: boolean,
        message: string
    ) => {
        if (!selectedId) return;
        await apiFetch("/api/whatsapp/bot-control", {
            method: "POST",
            body: JSON.stringify({
                action: "resume",
                conversationId: selectedId,
                sendTransition,
                transitionMessage: message,
            }),
        });
    };

    const handleGlobalToggle = async () => {
        if (!botSettings) return;
        const action = botSettings.global_pause
            ? "global_resume"
            : "global_pause";
        await apiFetch("/api/whatsapp/bot-control", {
            method: "POST",
            body: JSON.stringify({ action }),
        });
        setBotSettings((prev) =>
            prev ? { ...prev, global_pause: !prev.global_pause } : prev
        );
    };

    const handleLoadMore = async () => {
        if (!selectedId || messages.length === 0 || isLoadingMore) return;
        setIsLoadingMore(true);

        const oldest = messages[0].created_at;
        const res = await apiFetch(
            `/api/whatsapp/messages/${selectedId}?before=${oldest}&limit=50`
        );

        if (res.ok) {
            const json: MessagesResponse = await res.json();
            setMessages((prev) => [...json.data.messages, ...prev]);
            setHasMore(json.data.hasMore);
        }

        setIsLoadingMore(false);
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    if (loading || !botSettings) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal" />
            </div>
        );
    }

    const selectedConversation = conversations.find(
        (c) => c.id === selectedId
    );

    return (
        <div className="flex h-full overflow-hidden">
            {!realtimeConnected && (
                <div className="absolute top-0 left-0 right-0 bg-amber-50 text-amber-600 text-center text-xs py-1 z-50 font-medium border-b border-amber-200">
                    Reconectando...
                </div>
            )}
            <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                botSettings={botSettings}
                userRole={userRole}
                onGlobalToggle={handleGlobalToggle}
            />
            {selectedConversation ? (
                <ChatPanel
                    conversation={selectedConversation}
                    messages={messages}
                    botSettings={botSettings}
                    userRole={userRole}
                    onSendMessage={handleSendMessage}
                    onBotPause={handleBotPause}
                    onBotResume={handleBotResume}
                    onLoadMore={handleLoadMore}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                />
            ) : (
                <EmptyChat />
            )}
        </div>
    );
}
