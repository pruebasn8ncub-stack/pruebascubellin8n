"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { FileText, Clock, X, Play, Pause, Mic, Download, ImageIcon, Volume2 } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Delivery ticks (WhatsApp style)
// ---------------------------------------------------------------------------

function SingleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg viewBox="0 0 12 11" width="14" height="11" className={cn("inline-block ml-1 flex-shrink-0", colorClass)}>
            <path
                d="M11.155.651a.474.474 0 0 0-.316-.106.506.506 0 0 0-.396.185L4.108 8.96 1.388 6.585a.478.478 0 0 0-.35-.152.482.482 0 0 0-.356.152l-.324.324a.462.462 0 0 0-.146.35c0 .142.048.26.146.357l3.118 3.118a.753.753 0 0 0 .528.237.72.72 0 0 0 .548-.252l6.91-8.44a.45.45 0 0 0 .112-.34.406.406 0 0 0-.146-.312l-.273-.227z"
                fill="currentColor"
            />
        </svg>
    );
}

function DoubleCheck({ colorClass }: { colorClass: string }) {
    return (
        <svg viewBox="0 0 18 11" width="20" height="11" className={cn("inline-block ml-1 flex-shrink-0", colorClass)}>
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
    if (status === "pending") return <Clock className="inline-block ml-1 flex-shrink-0 w-3 h-3 text-black/25" />;
    if (status === "sent") return <SingleCheck colorClass="text-black/30" />;
    if (status === "delivered") return <DoubleCheck colorClass="text-black/30" />;
    if (status === "read") return <DoubleCheck colorClass="text-[var(--teal)]" />;
    if (status === "failed") return <X className="inline-block ml-1 flex-shrink-0 w-3.5 h-3.5 text-red-500" />;
    return null;
}

// ---------------------------------------------------------------------------
// Audio waveform bars (decorative)
// ---------------------------------------------------------------------------

function WaveformBars({ progress, accentClass, trackClass }: { progress: number; accentClass: string; trackClass: string }) {
    const bars = [3, 6, 4, 8, 5, 7, 3, 6, 9, 4, 7, 5, 8, 3, 6, 4, 7, 5, 9, 6, 3, 7, 5, 8, 4];
    return (
        <div className="flex items-center gap-[2px] h-7 flex-1">
            {bars.map((h, i) => {
                const pct = (i / bars.length) * 100;
                return (
                    <div
                        key={i}
                        className={cn(
                            "w-[3px] rounded-full transition-colors duration-150",
                            pct < progress ? accentClass : trackClass
                        )}
                        style={{ height: `${h * 3}px` }}
                    />
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Audio player
// ---------------------------------------------------------------------------

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
        if (isPlaying) { audio.pause(); } else { audio.play(); }
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

    const btnBg = isFromMe ? "bg-[var(--teal)] hover:bg-[var(--teal-dark)]" : "bg-[var(--cyan)] hover:bg-[var(--cyan-dark)]";
    const accentBar = isFromMe ? "bg-[var(--teal)]" : "bg-[var(--cyan)]";
    const trackBar = isFromMe ? "bg-[var(--teal)]/20" : "bg-[var(--cyan)]/15";

    return (
        <div className="flex items-center gap-3 min-w-[240px]">
            <audio ref={audioRef} src={src} preload="metadata" />

            <button
                onClick={togglePlay}
                className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all shadow-sm",
                    btnBg
                )}
            >
                {isPlaying
                    ? <Pause className="w-4 h-4" fill="currentColor" />
                    : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                }
            </button>

            <div className="flex-1 flex flex-col gap-1 cursor-pointer" onClick={handleSeek}>
                <WaveformBars progress={progress} accentClass={accentBar} trackClass={trackBar} />
                <span className="text-[0.6rem] text-[var(--text-muted)] tabular-nums font-medium">
                    {isPlaying || currentTime > 0
                        ? formatDuration(currentTime)
                        : duration > 0
                            ? formatDuration(duration)
                            : "0:00"}
                </span>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Transcription block
// ---------------------------------------------------------------------------

function TranscriptionBlock({ text, isFromMe }: { text: string; isFromMe: boolean }) {
    const borderColor = isFromMe ? "border-[var(--teal)]/30" : "border-[var(--cyan)]/30";
    const iconColor = isFromMe ? "text-[var(--teal)]" : "text-[var(--cyan)]";
    const bgColor = isFromMe ? "bg-[var(--teal)]/5" : "bg-[var(--cyan)]/5";

    return (
        <div className={cn("flex items-start gap-2 mt-1.5 px-2.5 py-2 rounded-lg border", borderColor, bgColor)}>
            <Volume2 className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", iconColor)} />
            <p className="text-xs text-[var(--text)] leading-relaxed italic">
                {text}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Image with lightbox
// ---------------------------------------------------------------------------

function ImageMedia({ src }: { src: string }) {
    const [open, setOpen] = useState(false);

    const handleDownload = useCallback(() => {
        const link = document.createElement("a");
        link.href = src;
        link.download = `imagen-${Date.now()}.jpg`;
        link.click();
    }, [src]);

    return (
        <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt="imagen"
                className="rounded-xl max-w-[280px] w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setOpen(true)}
            />
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <Download className="w-5 h-5 text-white" />
                    </button>
                    <button
                        onClick={() => setOpen(false)}
                        className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt="imagen"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Media content dispatcher
// ---------------------------------------------------------------------------

function MediaContent({ message }: { message: WhatsAppMessage }) {
    if (!message.media_type) return null;

    if (!message.media_url) {
        const labels: Record<string, string> = { image: "Imagen", audio: "Audio", video: "Video", document: "Documento", sticker: "Sticker" };
        return (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] bg-black/[0.03] rounded-lg px-3 py-2 mb-1">
                <ImageIcon className="w-4 h-4" />
                <span>{labels[message.media_type] ?? "Media"} no disponible</span>
            </div>
        );
    }

    if (message.media_type === "image") {
        return <ImageMedia src={message.media_url} />;
    }
    if (message.media_type === "video") {
        return (
            <video src={message.media_url} controls className="rounded-xl max-w-[280px] w-full" />
        );
    }
    if (message.media_type === "audio") {
        return <AudioPlayer src={message.media_url} isFromMe={message.from_me} />;
    }
    if (message.media_type === "sticker") {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={message.media_url} alt="sticker" className="w-36 h-36 object-contain" />
        );
    }
    if (message.media_type === "document") {
        const filename = message.media_url?.split("/").pop() ?? "documento";
        return (
            <a
                href={message.media_url}
                download
                className="flex items-center gap-2 text-sm text-[var(--cyan)] hover:text-[var(--cyan-dark)] hover:underline mb-1 transition-colors"
            >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{filename}</span>
            </a>
        );
    }
    return null;
}

// ---------------------------------------------------------------------------
// Parse content: separate visible text from AI annotations
// ---------------------------------------------------------------------------

function parseContent(content: string | null, mediaType: string | null) {
    if (!content) return { displayText: null, transcription: null };

    // Audio transcription
    const audioPrefix = "[Audio transcrito]: ";
    if (content.startsWith(audioPrefix) && mediaType === "audio") {
        return { displayText: null, transcription: content.slice(audioPrefix.length).trim() };
    }

    // Image/Sticker AI description prefixes (old and new formats)
    const aiPrefixes = ["[Foto del cliente]: ", "[Imagen adjunta - descripción IA]: ", "[Imagen: ", "[Sticker: "];

    // Image/Sticker with caption + AI description
    if (mediaType === "image" || mediaType === "sticker") {
        for (const prefix of aiPrefixes) {
            const idx = content.indexOf("\n" + prefix);
            if (idx > 0) {
                return { displayText: content.slice(0, idx).trim(), transcription: null };
            }
        }
        // Pure AI description (no caption)
        for (const prefix of aiPrefixes) {
            if (content.startsWith(prefix) || content.startsWith(prefix.replace(": ", ":"))) {
                return { displayText: null, transcription: null };
            }
        }
    }

    return { displayText: content, transcription: null };
}

// ---------------------------------------------------------------------------
// Bubble config per sender type
// ---------------------------------------------------------------------------

const senderConfig: Record<SenderType, {
    align: string;
    bubble: string;
    label: string | null;
    labelColor: string;
    roundedClass: string;
}> = {
    client: {
        align: "justify-start",
        bubble: "bg-white border border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        label: null,
        labelColor: "",
        roundedClass: "rounded-2xl rounded-tl-sm",
    },
    bot: {
        align: "justify-end",
        bubble: "bg-gradient-to-br from-[var(--cyan-light)] to-white border border-[var(--cyan)]/10 shadow-[0_1px_3px_rgba(26,94,168,0.06)]",
        label: "Kini",
        labelColor: "text-[var(--cyan)]",
        roundedClass: "rounded-2xl rounded-tr-sm",
    },
    admin: {
        align: "justify-end",
        bubble: "bg-gradient-to-br from-[var(--teal-light)] to-white border border-[var(--teal)]/10 shadow-[0_1px_3px_rgba(0,180,166,0.06)]",
        label: "Admin",
        labelColor: "text-[var(--teal)]",
        roundedClass: "rounded-2xl rounded-tr-sm",
    },
    system: {
        align: "justify-center",
        bubble: "bg-[var(--bg-main)] border border-[var(--border)]",
        label: null,
        labelColor: "",
        roundedClass: "rounded-full",
    },
};

// ---------------------------------------------------------------------------
// Reaction message display
// Format sync: webhook/route.ts builds this format — keep both in sync.
// ---------------------------------------------------------------------------

function parseReactionContent(content: string): { emoji: string; reference: string | null } {
    // Format: "Reaccionó {emoji} a: "{text}"" or "Reaccionó {emoji}"
    const match = content.match(/^Reaccionó\s(.+?)\sa:\s"([\s\S]+)"$/);
    if (match) {
        return { emoji: match[1], reference: match[2] };
    }
    // Fallback: extract emoji after "Reaccionó "
    const simple = content.match(/^Reaccionó\s(.+)$/);
    return { emoji: simple?.[1] ?? content, reference: null };
}

function ReactionBubble({ message }: { message: WhatsAppMessage }) {
    const config = senderConfig[message.sender_type];
    const { emoji, reference } = parseReactionContent(message.content ?? "");

    return (
        <div className={cn("flex my-1", config.align)}>
            <div className={cn("px-3 py-2", config.bubble, config.roundedClass)}>
                <span className="text-2xl leading-none">{emoji}</span>
                {reference && (
                    <p className="text-[0.65rem] text-[var(--text-muted)]/60 mt-1 max-w-[200px] truncate italic">
                        {reference}
                    </p>
                )}
                <div className="flex items-center justify-end mt-0.5">
                    <span className="text-[0.6rem] text-[var(--text-muted)]/60">
                        {formatTimestamp(message.created_at)}
                    </span>
                    {message.from_me && <DeliveryTicks status={message.status} />}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MessageBubble({ message }: MessageBubbleProps) {
    const config = senderConfig[message.sender_type];
    const isFailed = message.status === "failed";
    const isSticker = message.media_type === "sticker";
    const isFromMe = message.from_me;

    // System messages
    if (message.sender_type === "system") {
        return (
            <div className="flex justify-center my-2">
                <div className={cn("px-4 py-1.5 text-[0.65rem] font-medium text-[var(--text-muted)]", config.bubble, config.roundedClass)}>
                    {message.content}
                </div>
            </div>
        );
    }

    // Reaction messages
    if (message.message_type === "reactionMessage") {
        return <ReactionBubble message={message} />;
    }

    const { displayText, transcription } = parseContent(message.content, message.media_type);
    const hasMedia = !!message.media_type;

    return (
        <div className={cn("flex my-1", config.align)}>
            <div
                className={cn(
                    "max-w-[70%]",
                    isSticker ? "p-1" : hasMedia ? "p-1.5" : "px-3 py-2",
                    !isSticker && config.bubble,
                    !isSticker && config.roundedClass,
                    isFailed && "ring-2 ring-red-200"
                )}
            >
                {/* Sender label */}
                {config.label && (
                    <p className={cn(
                        "text-[0.65rem] font-semibold tracking-wide uppercase mb-0.5",
                        hasMedia ? "px-2 pt-1" : "",
                        config.labelColor
                    )}>
                        {config.label}
                    </p>
                )}

                {/* Media */}
                {hasMedia && message.media_type !== "audio" && (
                    <div className={message.media_type === "image" ? "mb-1" : ""}>
                        <MediaContent message={message} />
                    </div>
                )}

                {/* Audio player with waveform */}
                {message.media_type === "audio" && (
                    <div className={cn("px-2 py-1.5", hasMedia && !displayText && !transcription ? "" : "mb-1")}>
                        <MediaContent message={message} />
                    </div>
                )}

                {/* Transcription */}
                {transcription && (
                    <div className="px-1.5 pb-0.5">
                        <TranscriptionBlock text={transcription} isFromMe={isFromMe} />
                    </div>
                )}

                {/* Text content */}
                {displayText && (
                    <p className={cn(
                        "text-[0.82rem] leading-relaxed text-[var(--text)] whitespace-pre-wrap break-words",
                        hasMedia ? "px-2 pt-1" : ""
                    )}>
                        {displayText}
                    </p>
                )}

                {/* Timestamp + ticks */}
                {isSticker ? (
                    <div className="flex justify-end -mt-5 mr-1 relative z-10">
                        <span className="bg-black/40 backdrop-blur-sm text-white text-[0.6rem] px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            {formatTimestamp(message.created_at)}
                            {isFromMe && <DeliveryTicks status={message.status} />}
                        </span>
                    </div>
                ) : (
                    <div className={cn("flex items-center justify-end gap-1 mt-0.5", hasMedia ? "px-2 pb-1" : "")}>
                        <span className="text-[0.6rem] text-[var(--text-muted)]/60">
                            {formatTimestamp(message.created_at)}
                        </span>
                        {isFromMe && <DeliveryTicks status={message.status} />}
                    </div>
                )}
            </div>
        </div>
    );
}
