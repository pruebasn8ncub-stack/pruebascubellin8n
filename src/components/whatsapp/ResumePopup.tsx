"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ResumePopupProps {
    isOpen: boolean;
    onClose: () => void;
    onResume: (sendTransition: boolean, message: string) => void;
    defaultMessage: string;
}

export default function ResumePopup({ isOpen, onClose, onResume, defaultMessage }: ResumePopupProps) {
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

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="bg-white rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-bold text-[#0d1f35] mb-1">
                            Reactivar chatbot
                        </h2>
                        <p className="text-sm text-[#5e7a9a] mb-5">
                            Deseas enviar un mensaje de transicion al cliente?
                        </p>

                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={4}
                            className="w-full resize-none bg-[#f5f8fc] border-0 rounded-2xl px-4 py-3 text-sm text-[#0d1f35] focus:outline-none focus:ring-2 focus:ring-teal/20 focus:bg-white transition-all mb-6"
                        />

                        <div className="flex gap-3 justify-end flex-wrap">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => onResume(false, message)}
                                className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#0d1f35] border border-slate-200 hover:border-slate-300 transition-all"
                            >
                                Reactivar sin mensaje
                            </button>
                            <button
                                type="button"
                                onClick={() => onResume(true, message)}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-teal to-blue-500 hover:shadow-lg shadow-md transition-all"
                            >
                                Reactivar y enviar
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
