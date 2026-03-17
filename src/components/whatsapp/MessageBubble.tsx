"use client";

import { FileText, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppMessage, SenderType } from "@/types/whatsapp";

interface MessageBubbleProps {
    message: WhatsAppMessage;
}

function formatTimestamp(ts: string): string {
    const date = new Date(ts);
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
}

// Filled-path SVG single check (WhatsApp style)
function SingleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg
            viewBox="0 0 16 11"
            width="16"
            height="11"
            className={cn("inline-block ml-1 flex-shrink-0", colorClass)}
        >
            <path
                d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.046.25.14.343l2.996 2.996a.724.724 0 0 0 .508.228.695.695 0 0 0 .527-.242l6.641-8.112a.434.434 0 0 0 .108-.326.398.398 0 0 0-.14-.3z"
                fill="currentColor"
            />
        </svg>
    );
}

// Filled-path SVG double check (WhatsApp style)
function DoubleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg
            viewBox="0 0 16 11"
            width="16"
            height="11"
            className={cn("inline-block ml-1 flex-shrink-0", colorClass)}
        >
            <path
                d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.046.25.14.343l2.996 2.996a.724.724 0 0 0 .508.228.695.695 0 0 0 .527-.242l6.641-8.112a.434.434 0 0 0 .108-.326.398.398 0 0 0-.14-.3z"
                fill="currentColor"
            />
            <path
                d="M7.404.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178L.529 8.365l.532.532 6.641-8.112a.434.434 0 0 0 .108-.326.398.398 0 0 0-.14-.3z"
                fill="currentColor"
                opacity="0.75"
            />
        </svg>
    );
}

function DeliveryTicks({ status }: { status: WhatsAppMessage["status"] }) {
    if (status === "pending") {
        return (
            <Clock className="inline-block ml-1 flex-shrink-0 w-3 h-3 text-black/30" />
        );
    }
    if (status === "sent") {
        return <SingleCheck colorClass="text-gray-400" />;
    }
    if (status === "delivered") {
        return <DoubleCheck colorClass="text-gray-400" />;
    }
    if (status === "read") {
        return <DoubleCheck colorClass="text-[#53bdeb]" />;
    }
    if (status === "failed") {
        return (
            <X className="inline-block ml-1 flex-shrink-0 w-3.5 h-3.5 text-red-500" />
        );
    }
    return null;
}

function MediaContent({ message }: { message: WhatsAppMessage }) {
    if (!message.media_type || !message.media_url) return null;

    if (message.media_type === "image") {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={message.media_url}
                alt="imagen"
                className="rounded-lg max-w-[280px] w-full object-cover mb-1"
            />
        );
    }
    if (message.media_type === "video") {
        return (
            <video
                src={message.media_url}
                controls
                className="rounded-lg max-w-[280px] w-full mb-1"
            />
        );
    }
    if (message.media_type === "audio") {
        return (
            <audio
                src={message.media_url}
                controls
                className="w-full mb-1"
            />
        );
    }
    if (message.media_type === "document") {
        const filename = message.media_url.split("/").pop() ?? "documento";
        return (
            <a
                href={message.media_url}
                download
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline mb-1"
            >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{filename}</span>
            </a>
        );
    }
    return null;
}

const senderConfig: Record<SenderType, {
    align: string;
    bubble: string;
    label: string | null;
    labelColor: string;
    roundedClass: string;
}> = {
    client: {
        align: "justify-start",
        bubble: "bg-white shadow-sm",
        label: null,
        labelColor: "",
        roundedClass: "rounded-2xl rounded-tl-md",
    },
    bot: {
        align: "justify-end",
        bubble: "bg-gradient-to-br from-blue-50 to-blue-100 shadow-sm",
        label: "Kini",
        labelColor: "text-blue-500",
        roundedClass: "rounded-2xl rounded-tr-md",
    },
    admin: {
        align: "justify-end",
        bubble: "bg-gradient-to-br from-[#e0f7f5] to-emerald-50 shadow-sm",
        label: "Admin",
        labelColor: "text-teal",
        roundedClass: "rounded-2xl rounded-tr-md",
    },
    system: {
        align: "justify-center",
        bubble: "bg-amber-50/80 backdrop-blur-sm text-center",
        label: null,
        labelColor: "",
        roundedClass: "rounded-full",
    },
};

export default function MessageBubble({ message }: MessageBubbleProps) {
    const config = senderConfig[message.sender_type];
    const isFailed = message.status === "failed";

    if (message.sender_type === "system") {
        return (
            <div className="flex justify-center my-1">
                <div className={cn("px-4 py-1.5 text-[0.7rem] font-medium text-amber-700 shadow-sm", config.bubble, config.roundedClass)}>
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex my-1", config.align)}>
            <div
                className={cn(
                    "max-w-[70%] px-3 py-2",
                    config.bubble,
                    config.roundedClass,
                    isFailed && "ring-2 ring-red-200"
                )}
            >
                {config.label && (
                    <p className={cn("text-[0.65rem] font-semibold mb-0.5", config.labelColor)}>
                        {config.label}
                    </p>
                )}
                <MediaContent message={message} />
                {message.content && (
                    <p className="text-sm text-[#0d1f35] whitespace-pre-wrap break-words">
                        {message.content}
                    </p>
                )}
                <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="text-[0.6rem] text-black/30">
                        {formatTimestamp(message.created_at)}
                    </span>
                    {message.from_me && <DeliveryTicks status={message.status} />}
                </div>
            </div>
        </div>
    );
}
