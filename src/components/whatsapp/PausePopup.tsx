"use client";

import { useEffect, useRef, useState } from "react";

interface PausePopupProps {
    isOpen: boolean;
    onClose: () => void;
    onPause: (sendTransition: boolean, message: string) => void;
    defaultMessage: string;
}

export default function PausePopup({ isOpen, onClose, onPause, defaultMessage }: PausePopupProps) {
    const [message, setMessage] = useState(defaultMessage);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setMessage(defaultMessage);
    }, [defaultMessage, isOpen]);

    useEffect(() => {
        if (isOpen) {
            textareaRef.current?.focus();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl p-7 max-w-md w-full mx-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-base font-semibold text-[#0d1f35] mb-1">
                    Pausar chatbot para esta conversacion
                </h2>
                <p className="text-sm text-[#5e7a9a] mb-4">
                    Deseas enviar un mensaje de transicion al cliente?
                </p>

                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full resize-none border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#0d1f35] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00b4a6]/30 focus:border-[#00b4a6] transition-all mb-5"
                />

                <div className="flex gap-3 justify-end flex-wrap">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={() => onPause(false, message)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                        Pausar sin mensaje
                    </button>
                    <button
                        type="button"
                        onClick={() => onPause(true, message)}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#ef4444] hover:bg-red-500 transition-colors"
                    >
                        Pausar y enviar
                    </button>
                </div>
            </div>
        </div>
    );
}
