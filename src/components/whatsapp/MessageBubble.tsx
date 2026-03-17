"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { FileText, Clock, X, Play, Pause, Mic } from "lucide-react";
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

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// Single check SVG (WhatsApp style)
function SingleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg
            viewBox="0 0 12 11"
            width="14"
            height="11"
            className={cn("inline-block ml-1 flex-shrink-0", colorClass)}
        >
            <path
                d="M11.155.651a.474.474 0 0 0-.316-.106.506.506 0 0 0-.396.185L4.108 8.96 1.388 6.585a.478.478 0 0 0-.35-.152.482.482 0 0 0-.356.152l-.324.324a.462.462 0 0 0-.146.35c0 .142.048.26.146.357l3.118 3.118a.753.753 0 0 0 .528.237.72.72 0 0 0 .548-.252l6.91-8.44a.45.45 0 0 0 .112-.34.406.406 0 0 0-.146-.312l-.273-.227z"
                fill="currentColor"
            />
        </svg>
    );
}

// Double check SVG (WhatsApp style - two clearly visible checks)
function DoubleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg
            viewBox="0 0 18 11"
            width="20"
            height="11"
            className={cn("inline-block ml-1 flex-shrink-0", colorClass)}
        >
            <path
                d="M17.155.651a.474.474 0 0 0-.316-.106.506.506 0 0 0-.396.185L10.108 8.96 7.388 6.585a.478.478 0 0 0-.35-.152.482.482 0 0 0-.356.152l-.324.324a.462.462 0 0 0-.146.35c0 .142.048.26.146.357l3.118 3.118a.753.753 0 0 0 .528.237.72.72 0 0 0 .548-.252l6.91-8.44a.45.45 0 0 0 .112-.34.406.406 0 0 0-.146-.312l-.273-.227z"
                fill="currentColor"
            />
            <path
                d="M11.155.651a.474.474 0 0 0-.316-.106.506.506 0 0 0-.396.185L4.108 8.96 1.388 6.585a.478.478 0 0 0-.35-.152.482.482 0 0 0-.356.152l-.324.324a.462.462 0 0 0-.146.35c0 .142.048.26.146.357l3.118 3.118a.753.753 0 0 0 .528.237.72.72 0 0 0 .548-.252l6.91-8.44a.45.45 0 0 0 .112-.34.406.406 0 0 0-.146-.312l-.273-.227z"
                fill="currentColor"
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

// Custom WhatsApp-style audio player
function AudioPlayer({ src, isFromMe }: { src: string; isFromMe: boolean }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoaded = () => setDuration(audio.duration);
        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("ended", onEnded);

        return () => {
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("ended", onEnded);
        };
    }, []);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = pct * duration;
        setCurrentTime(audio.currentTime);
    }, [duration]);

    const accentColor = isFromMe ? "bg-teal" : "bg-[#5e7a9a]";
    const trackBg = isFromMe ? "bg-teal/20" : "bg-[#5e7a9a]/20";

    return (
        <div className="flex items-center gap-3 min-w-[220px]">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Play/Pause button */}
            <button
                onClick={togglePlay}
                className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                    isFromMe
                        ? "bg-teal text-white hover:bg-teal/90"
                        : "bg-[#5e7a9a] text-white hover:bg-[#5e7a9a]/90"
                )}
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4" fill="currentColor" />
                ) : (
                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                )}
            </button>

            {/* Progress bar + duration */}
            <div className="flex-1 flex flex-col gap-1">
                <div
                    className={cn("relative h-1.5 rounded-full cursor-pointer", trackBg)}
                    onClick={handleSeek}
                >
                    <div
                        className={cn("absolute left-0 top-0 h-full rounded-full transition-all", accentColor)}
                        style={{ width: `${progress}%` }}
                    />
                    <div
                        className={cn("absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-sm transition-all", accentColor)}
                        style={{ left: `calc(${progress}% - 6px)` }}
                    />
                </div>
                <span className="text-[0.6rem] text-black/40 tabular-nums">
                    {isPlaying || currentTime > 0
                        ? formatDuration(currentTime)
                        : duration > 0
                            ? formatDuration(duration)
                            : "0:00"}
                </span>
            </div>

            {/* Mic icon */}
            <Mic className={cn("w-4 h-4 flex-shrink-0", isFromMe ? "text-teal/40" : "text-[#5e7a9a]/40")} />
        </div>
    );
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
            <div className="mb-1">
                <AudioPlayer src={message.media_url} isFromMe={message.from_me} />
            </div>
        );
    }
    if (message.media_type === "sticker") {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={message.media_url}
                alt="sticker"
                className="w-36 h-36 object-contain"
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

    // Stickers render without bubble background
    const isSticker = message.media_type === "sticker";

    return (
        <div className={cn("flex my-1", config.align)}>
            <div
                className={cn(
                    "max-w-[70%]",
                    isSticker ? "p-1" : "px-3 py-2",
                    !isSticker && config.bubble,
                    !isSticker && config.roundedClass,
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
