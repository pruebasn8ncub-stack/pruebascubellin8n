"use client";

import { motion, AnimatePresence } from "framer-motion";

interface PausePopupProps {
    isOpen: boolean;
    onClose: () => void;
    onPause: (sendTransition: boolean, message: string) => void;
    defaultMessage: string;
}

export default function PausePopup({ isOpen, onClose, onPause, defaultMessage }: PausePopupProps) {
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
                            Pausar Kini en esta conversacion
                        </h2>
                        <p className="text-sm text-[#5e7a9a] mb-6">
                            El chatbot dejara de responder en este chat. Podras reactivarlo cuando quieras.
                        </p>

                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => onPause(false, defaultMessage)}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-rose-500 hover:shadow-lg shadow-md transition-all"
                            >
                                Pausar
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
