"use client";

import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function EmptyChat() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f5f8fc] gap-4 relative overflow-hidden">
            {/* Decorative blur */}
            <div className="absolute bg-teal/5 w-32 h-32 rounded-full blur-3xl" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center gap-4 relative z-10"
            >
                <div className="flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-lg">
                    <MessageCircle className="w-16 h-16 text-teal/20" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-[#0d1f35]">WhatsApp Innovakine</h2>
                    <p className="text-sm text-[#5e7a9a] mt-1">
                        Selecciona una conversacion para comenzar
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
