"use client";

import { MessageCircle } from "lucide-react";

export default function EmptyChat() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#efeae2] gap-4">
            <div className="flex items-center justify-center w-24 h-24 rounded-full bg-slate-200">
                <MessageCircle className="w-12 h-12 text-slate-400" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-semibold text-[#0d1f35]">WhatsApp Innovakine</h2>
                <p className="text-sm text-[#5e7a9a] mt-1">
                    Selecciona una conversacion para comenzar
                </p>
            </div>
        </div>
    );
}
