"use client";

import { useRef, useState, useEffect, KeyboardEvent, ChangeEvent } from "react";
import { Paperclip, Send, Smile, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
    onSend: (content: string, pauseBot?: boolean) => void;
    isBotActive?: boolean;
    disabled?: boolean;
}

export default function MessageInput({ onSend, isBotActive = false, disabled = false }: MessageInputProps) {
    const [value, setValue] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showBotAlert, setShowBotAlert] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(e.target as Node)
            ) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    function clearInput() {
        setValue("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    }

    function handleSend() {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;

        if (isBotActive) {
            setShowBotAlert(true);
            return;
        }

        onSend(trimmed);
        clearInput();
    }

    function handleSendWithPause() {
        onSend(value.trim(), true);
        clearInput();
        setShowBotAlert(false);
    }

    function handleSendWithoutPause() {
        onSend(value.trim(), false);
        clearInput();
        setShowBotAlert(false);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function handleEmojiClick(emojiData: EmojiClickData) {
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newValue =
                value.slice(0, start) + emojiData.emoji + value.slice(end);
            setValue(newValue);
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd =
                    start + emojiData.emoji.length;
                textarea.focus();
            }, 0);
        } else {
            setValue((prev) => prev + emojiData.emoji);
        }
        setShowEmojiPicker(false);
    }

    return (
        <div
            className={cn(
                "relative flex items-end gap-3 bg-white border-t border-slate-100 px-4 py-3",
                disabled && "opacity-50"
            )}
        >
            {/* Emoji picker floating panel */}
            {showEmojiPicker && (
                <div
                    ref={emojiPickerRef}
                    className="absolute bottom-full left-4 mb-2 z-50"
                >
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.LIGHT}
                        width={350}
                        height={400}
                        searchPlaceHolder="Buscar emoji..."
                        previewConfig={{ showPreview: false }}
                    />
                </div>
            )}

            {/* Paperclip button */}
            <button
                type="button"
                disabled={disabled}
                aria-label="Adjuntar archivo"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-[#5e7a9a] hover:text-teal transition-colors rounded-full"
            >
                <Paperclip className="w-5 h-5" />
            </button>

            {/* Emoji picker toggle button */}
            <button
                type="button"
                disabled={disabled}
                aria-label="Insertar emoji"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={cn(
                    "flex-shrink-0 w-9 h-9 flex items-center justify-center transition-colors rounded-full",
                    showEmojiPicker
                        ? "text-teal"
                        : "text-[#5e7a9a] hover:text-teal"
                )}
            >
                <Smile className="w-5 h-5" />
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
                    "flex-1 resize-none bg-[#f5f8fc] border-0 rounded-2xl px-4 py-2.5 text-sm text-[#0d1f35]",
                    "placeholder:text-[#5e7a9a] focus:outline-none focus:ring-2 focus:ring-teal/20 focus:bg-white",
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
                    "bg-gradient-to-r from-teal to-blue-500 text-white hover:shadow-lg shadow-md hover:scale-105",
                    (disabled || !value.trim()) && "opacity-40 cursor-not-allowed hover:scale-100 hover:shadow-md"
                )}
            >
                <Send className="w-4 h-4" />
            </button>

            {/* Bot pause alert — modal popup */}
            <AnimatePresence>
                {showBotAlert && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setShowBotAlert(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal/10 to-blue-50 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-teal" />
                                </div>
                                <h2 className="text-lg font-bold text-[#0d1f35]">
                                    Kini esta activo
                                </h2>
                            </div>
                            <p className="text-sm text-[#5e7a9a] mb-6 ml-[52px]">
                                Enviar este mensaje puede desactivar el chatbot para esta conversacion. Elige como proceder.
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => setShowBotAlert(false)}
                                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendWithoutPause}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal to-blue-500 hover:shadow-lg shadow-md transition-all"
                                >
                                    Solo enviar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSendWithPause}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-lg shadow-md transition-all"
                                >
                                    Enviar y pausar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
