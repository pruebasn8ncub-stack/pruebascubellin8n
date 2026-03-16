"use client";

import { useRef, useState, KeyboardEvent, ChangeEvent } from "react";
import { Paperclip, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
}

export default function MessageInput({ onSend, disabled = false }: MessageInputProps) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    function resizeTextarea() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const lineHeight = 24;
        const maxHeight = lineHeight * 5;
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }

    function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
        setValue(e.target.value);
        resizeTextarea();
    }

    function handleSend() {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div
            className={cn(
                "flex items-end gap-3 bg-white border-t border-slate-200 px-5 py-3",
                disabled && "opacity-50"
            )}
        >
            <button
                type="button"
                disabled={disabled}
                aria-label="Adjuntar archivo"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-[#00b4a6] transition-colors rounded-full"
            >
                <Paperclip className="w-5 h-5" />
            </button>

            <textarea
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder="Escribe un mensaje..."
                className={cn(
                    "flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-[#0d1f35]",
                    "placeholder:text-[#5e7a9a] focus:outline-none focus:ring-2 focus:ring-[#00b4a6]/30 focus:border-[#00b4a6]",
                    "transition-all overflow-y-auto leading-6"
                )}
                style={{ minHeight: "40px", maxHeight: "120px" }}
            />

            <button
                type="button"
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                aria-label="Enviar mensaje"
                className={cn(
                    "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all",
                    "bg-[#00b4a6] text-white hover:bg-[#009688] shadow-sm",
                    (disabled || !value.trim()) && "opacity-40 cursor-not-allowed"
                )}
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
    );
}
