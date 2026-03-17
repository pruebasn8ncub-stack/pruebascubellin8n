"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

        const fetchMessages = async () => {
            const res = await apiFetch(
                `/api/whatsapp/messages/${selectedId}?limit=50`
            );

            if (res.ok) {
                const json: MessagesResponse = await res.json();
                setMessages(json.data.messages);
                setHasMore(json.data.hasMore);
            }

            // Mark as read
            await apiFetch("/api/whatsapp/mark-read", {
                method: "POST",
                body: JSON.stringify({ conversationId: selectedId }),
            });

            // Optimistically update local unread count
            setConversations((prev) =>
                prev.map((c) =>
                    c.id === selectedId ? { ...c, unread_count: 0 } : c
                )
            );
        };

        fetchMessages();
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

                    // If the message belongs to the currently-selected conversation, append it
                    if (newMsg.conversation_id === selectedIdRef.current) {
                        setMessages((prev) => [...prev, newMsg]);
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
                            prev.map((c) =>
                                c.id === updated.id ? updated : c
                            )
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
        await apiFetch("/api/whatsapp/send", {
            method: "POST",
            body: JSON.stringify({ conversationId: selectedId, content }),
        });
        // The new message will arrive via the Realtime subscription
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

    if (loading) {
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
        <div className="flex h-full">
            {!realtimeConnected && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-center text-sm py-1 z-50 font-medium">
                    Reconectando...
                </div>
            )}
            <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
                botSettings={botSettings!}
                userRole={userRole}
                onGlobalToggle={handleGlobalToggle}
            />
            {selectedConversation ? (
                <ChatPanel
                    conversation={selectedConversation}
                    messages={messages}
                    botSettings={botSettings!}
                    userRole={userRole}
                    onSendMessage={handleSendMessage}
                    onBotPause={handleBotPause}
                    onBotResume={handleBotResume}
                    onLoadMore={handleLoadMore}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                />
            ) : (
                <div className="flex-1">
                    <EmptyChat />
                </div>
            )}
        </div>
    );
}
