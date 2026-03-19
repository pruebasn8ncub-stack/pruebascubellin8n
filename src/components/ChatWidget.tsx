"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: string;
    text: string;
    sender: "user" | "bot";
    timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
    id: "welcome",
    text: "¡Hola! 👋 Soy Kini, la asistente virtual de Innovakine. Puedo ayudarte a agendar una hora, resolver dudas sobre nuestros servicios o darte información de la clínica. ¿En qué te puedo ayudar?",
    sender: "bot",
    timestamp: new Date(),
};

const ERROR_MESSAGE =
    "Lo siento, estoy teniendo dificultades para responder en este momento. Por favor intenta de nuevo o contáctanos directamente al +56 9 3018 6496.";

// Generate a persistent session ID per browser tab
function getSessionId(): string {
    if (typeof window === "undefined") return "server";
    let id = sessionStorage.getItem("innovakine-chat-session");
    if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem("innovakine-chat-session", id);
    }
    return id;
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [inputValue, setInputValue] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [hasUnread, setHasUnread] = useState(true);
    const [tooltipDismissed, setTooltipDismissed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionId = useRef<string>(getSessionId());

    // Show widget after scroll
    useEffect(() => {
        const toggleVisibility = () => {
            setIsVisible(window.scrollY > 200);
        };
        // Show after a brief delay even without scroll
        const timer = setTimeout(() => setIsVisible(true), 3000);
        window.addEventListener("scroll", toggleVisibility);
        return () => {
            window.removeEventListener("scroll", toggleVisibility);
            clearTimeout(timer);
        };
    }, []);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 300);
            setHasUnread(false);
            setTooltipDismissed(true);
        }
    }, [isOpen]);

    const sendMessage = async () => {
        const text = inputValue.trim();
        if (!text || isTyping) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    sessionId: sessionId.current,
                }),
            });

            const data = await res.json();

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: res.ok ? data.response : (data.error || ERROR_MESSAGE),
                sender: "bot",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch {
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: ERROR_MESSAGE,
                sender: "bot",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatTime = (date: Date) =>
        date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] font-sans">
                    {/* ============ CHAT PANEL ============ */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.9, transformOrigin: "bottom right" }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="absolute bottom-20 right-0 w-[340px] md:w-[380px] h-[520px] md:h-[560px] bg-[#EFEAE2] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 border border-gray-200"
                                style={{ maxHeight: "calc(100vh - 120px)" }}
                            >
                                {/* Pattern Background Overlay */}
                                <div className="absolute inset-0 z-0 opacity-[0.06] bg-[url('https://cdn.whatsapp.net/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] bg-repeat" />

                                {/* WhatsApp Header */}
                                <div className="relative z-10 bg-[#075E54] px-4 py-3 flex items-center justify-between shrink-0 shadow-sm cursor-pointer" onClick={() => setIsOpen(false)}>
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm p-[2px]">
                                                <img src="/assets/doctor-avatar.png" alt="Asistente Innovakine" className="w-full h-full rounded-full object-cover" />
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="text-white font-medium text-[16px] leading-tight">
                                                Innovakine
                                            </h3>
                                            <span className="text-white/80 text-[13px] italic">
                                                {isTyping ? "escribiendo..." : "en línea"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                            className="text-white hover:text-white/80 transition-colors p-1"
                                            aria-label="Cerrar"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Direct to WhatsApp Banner */}
                                <a
                                    href="https://wa.me/56930186496?text=Hola%2C%20quiero%20agendar%20una%20consulta%20en%20Innovakine.%20%C2%BFTienen%20disponibilidad%20esta%20semana%3F"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative z-10 w-full bg-[#F0F2F5] hover:bg-[#E2E5E9] text-[#075E54] text-[13px] py-2 px-3 flex items-center justify-center gap-2 border-b border-gray-200 transition-colors font-semibold"
                                >
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                    </svg>
                                    Abrir en la aplicación de WhatsApp
                                </a>

                                {/* Messages Area */}
                                <div className="relative z-10 flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-thin">
                                    {/* Security notification bubble */}
                                    <div className="flex justify-center mb-4">
                                        <div className="bg-[#FFF3C2] text-[#6A5A35] text-[12px] px-3 py-1.5 rounded-lg shadow-sm max-w-[90%] text-center">
                                            Los mensajes enviados a este chat están cifrados y seguros. Nadie fuera de este chat, ni siquiera WhatsApp, puede leerlos ni escucharlos.
                                        </div>
                                    </div>

                                    {messages.map((msg) => {
                                        const isUser = msg.sender === "user";

                                        // Hide typing indicator when there is an active text coming in.
                                        return (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`relative px-3 py-2 text-[14.5px] leading-[1.3] shadow-[0_1px_0.5px_rgba(11,20,26,.13)] max-w-[85%]
                                                    ${isUser
                                                            ? "bg-[#D9FDD3] text-[#111B21] rounded-lg rounded-tr-none"
                                                            : "bg-white text-[#111B21] rounded-lg rounded-tl-none"
                                                        }
                                                    `}
                                                >
                                                    {/* Tail arrow */}
                                                    {isUser ? (
                                                        <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -right-[8px] text-[#D9FDD3] fill-current">
                                                            <path opacity=".13" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
                                                            <path fill="currentColor" d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" />
                                                        </svg>
                                                    ) : (
                                                        <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -left-[8px] text-white fill-current">
                                                            <path opacity=".13" d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
                                                            <path fill="currentColor" d="M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" />
                                                        </svg>
                                                    )}

                                                    <span className="whitespace-pre-wrap word-break-words">{msg.text}</span>

                                                    <div className="float-right mt-[4px] ml-2 flex items-center h-[15px]">
                                                        <span className="text-[11px] text-gray-500 font-medium">
                                                            {formatTime(msg.timestamp)}
                                                        </span>
                                                        {isUser && (
                                                            <svg viewBox="0 0 16 15" width="16" height="15" className="fill-[#53bdeb] ml-1">
                                                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}

                                    {/* Typing indicator */}
                                    <AnimatePresence>
                                        {isTyping && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex justify-start"
                                            >
                                                <div className="relative bg-white text-[#111B21] px-4 py-3 rounded-lg rounded-tl-none shadow-[0_1px_0.5px_rgba(11,20,26,.13)] flex gap-1 items-center">
                                                    <svg viewBox="0 0 8 13" width="8" height="13" className="absolute top-0 -left-[8px] text-white fill-current">
                                                        <path opacity=".13" d="M1.533 3.568L8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
                                                        <path fill="currentColor" d="M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" />
                                                    </svg>
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div ref={messagesEndRef} className="h-1" />
                                </div>

                                {/* WhatsApp Input Area */}
                                <div className="relative z-10 shrink-0 bg-[#F0F2F5] px-2 py-2 flex items-center gap-2">
                                    <div className="flex-1 bg-white rounded-xl px-4 py-2.5 flex items-center shadow-sm">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Escribe un mensaje..."
                                            className="flex-1 bg-transparent text-[15px] text-[#111B21] placeholder-gray-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={sendMessage}
                                        disabled={!inputValue.trim()}
                                        className="w-11 h-11 flex items-center justify-center rounded-full bg-[#00A884] text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex-shrink-0"
                                    >
                                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                                            <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
                                        </svg>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ============ WHATSAPP FLOATING BUTTON + TOOLTIP ============ */}
                    <div className="flex items-center gap-4 z-50 mt-4 relative">
                        {/* Tooltip */}
                        <AnimatePresence>
                            {!isOpen && !tooltipDismissed && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                    animate={{
                                        opacity: 1,
                                        scale: [1, 1.05, 1],
                                        x: 0
                                    }}
                                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                    transition={{
                                        scale: {
                                            duration: 2,
                                            repeat: Infinity,
                                            repeatType: "reverse",
                                            ease: "easeInOut"
                                        },
                                        opacity: { duration: 0.4, delay: 0.5 },
                                        x: { duration: 0.4, delay: 0.5 }
                                    }}
                                    className="pointer-events-none"
                                >
                                    <div className="bg-[#128C7E] px-4 py-3 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.25)] max-w-[240px] relative">
                                        <p className="text-[14px] font-semibold leading-snug tracking-wide text-white">
                                            Habla con nuestra asistente 24/7
                                        </p>
                                        <div className="absolute top-1/2 -translate-y-1/2 -right-[15px] border-[8px] border-transparent border-l-[#128C7E]" />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Main floating button */}
                        <motion.div
                            className="relative"
                            animate={
                                !isOpen
                                    ? { scale: [1, 1.1, 1, 1, 1, 1], rotate: [0, -10, 10, -10, 10, 0, 0, 0, 0, 0] }
                                    : { scale: 1, rotate: 0 }
                            }
                            transition={
                                !isOpen
                                    ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" }
                                    : { duration: 0.2 }
                            }
                        >
                            <motion.button
                                onClick={() => setIsOpen(!isOpen)}
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`w-14 h-14 md:w-16 md:h-16 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center transition-colors z-50 relative ${isOpen ? 'bg-white border border-gray-200 text-gray-500' : 'bg-[#25D366] text-white'
                                    }`}
                                aria-label={isOpen ? "Cerrar chat" : "Abrir chat de WhatsApp"}
                            >
                                <AnimatePresence mode="wait">
                                    {isOpen ? (
                                        <motion.svg
                                            key="close"
                                            initial={{ rotate: -90, opacity: 0 }}
                                            animate={{ rotate: 0, opacity: 1 }}
                                            exit={{ rotate: 90, opacity: 0 }}
                                            width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                        >
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </motion.svg>
                                    ) : (
                                        <motion.svg
                                            key="whatsapp"
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                            viewBox="0 0 24 24" width="34" height="34" fill="currentColor"
                                        >
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                        </motion.svg>
                                    )}
                                </AnimatePresence>
                            </motion.button>

                            {/* Notification badge */}
                            {hasUnread && !isOpen && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-sm z-50 border border-white"
                                >
                                    1
                                </motion.div>
                            )}
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
