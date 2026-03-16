"use client";

import { FileText } from "lucide-react";
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

function DeliveryTicks({ status }: { status: WhatsAppMessage["status"] }) {
    if (status === "sent") {
        return (
            <svg className="inline w-3.5 h-3.5 text-black/40" viewBox="0 0 16 11" fill="none">
                <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (status === "delivered") {
        return (
            <svg className="inline w-4 h-3.5 text-black/40" viewBox="0 0 20 11" fill="none">
                <path d="M1 5.5L5.5 10L15 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 5.5L10.5 10L20 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (status === "read") {
        return (
            <svg className="inline w-4 h-3.5" viewBox="0 0 20 11" fill="none">
                <path d="M1 5.5L5.5 10L15 1" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 5.5L10.5 10L20 1" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
        bubble: "bg-white",
        label: null,
        labelColor: "",
        roundedClass: "rounded-xl rounded-tl-none",
    },
    bot: {
        align: "justify-end",
        bubble: "bg-[#dbeafe]",
        label: "Kini",
        labelColor: "text-[#3b82f6]",
        roundedClass: "rounded-xl rounded-tr-none",
    },
    admin: {
        align: "justify-end",
        bubble: "bg-[#d9fdd3]",
        label: "Admin",
        labelColor: "text-[#00b4a6]",
        roundedClass: "rounded-xl rounded-tr-none",
    },
    system: {
        align: "justify-center",
        bubble: "bg-[#fef9c3] text-center",
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
                <div className={cn("px-4 py-1.5 text-xs text-[#854d0e]", config.bubble, config.roundedClass)}>
                    {message.content}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex my-1", config.align)}>
            <div
                className={cn(
                    "max-w-[65%] px-3 py-2 shadow-sm",
                    config.bubble,
                    config.roundedClass,
                    isFailed && "border-2 border-red-400"
                )}
            >
                {config.label && (
                    <p className={cn("text-xs font-bold mb-0.5", config.labelColor)}>
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
                    <span className="text-[0.65rem] text-black/40">
                        {formatTimestamp(message.created_at)}
                    </span>
                    {message.from_me && <DeliveryTicks status={message.status} />}
                </div>
            </div>
        </div>
    );
}
