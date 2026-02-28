"use client";

import { Star, MessageSquare } from "lucide-react";
import Script from "next/script";
import { motion } from "framer-motion";

export function Reviews() {
    return (
        <section id="opiniones" className="py-16 md:py-24 lg:py-32 bg-white overflow-hidden">
            <div className="container relative">

                <div className="mb-16 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-light text-cyan-dark text-xs font-black uppercase tracking-widest mb-6"
                    >
                        <MessageSquare className="h-4 w-4" />
                        Testimonios de Pacientes
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-navy mb-6 tracking-tight leading-tight">
                        Confianza que <span className="text-cyan">Transforma Vidas</span>
                    </h2>
                    <p className="text-text-muted text-lg md:text-xl font-medium leading-relaxed">
                        Nuestra mayor satisfacción es ver la recuperación y el retorno a las actividades normales de quienes confían en nosotros.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8 mb-16 md:mb-20"
                >
                    <div className="bg-bg-main p-6 md:p-8 lg:p-10 rounded-[2.5rem] border border-border flex flex-col md:flex-row items-center gap-6 md:gap-8 hover:shadow-xl transition-all duration-500 max-w-2xl w-full">
                        <div className="h-20 w-20 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-border flex items-center justify-center p-4">
                            <svg viewBox="0 0 48 48" aria-hidden="true" width="48" height="48">
                                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                            </svg>
                        </div>
                        <div className="text-center md:text-left flex-1">
                            <div className="text-3xl font-black text-navy flex items-center justify-center md:justify-start gap-3 mb-2">
                                4.9 <span className="text-sm font-bold text-text-muted mt-2 ml-1">Rating Google</span>
                            </div>
                            <div className="flex justify-center md:justify-start gap-1 text-[#FFC107] mb-4">
                                {[...Array(5)].map((_, i) => <Star key={i} className="h-6 w-6 fill-current" />)}
                            </div>
                            <a
                                href="https://maps.app.goo.gl/st5fzWLvwPGfJwUQA"
                                target="_blank"
                                rel="noopener"
                                className="text-sm font-black text-cyan hover:text-cyan-dark uppercase tracking-widest transition-colors flex items-center justify-center md:justify-start gap-2 group"
                            >
                                Leer los 38 testimonios
                                <span className="transition-transform group-hover:translate-x-1">→</span>
                            </a>
                        </div>
                    </div>
                </motion.div>

                {/* Elfsight Reviews Widget */}
                <div className="space-y-12">
                    <div className="relative z-10">
                        <Script src="https://elfsightcdn.com/platform.js" strategy="lazyOnload" />
                        <div className="elfsight-app-989f1173-a263-45b3-96b8-d1bfe413008c max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl border border-border" data-elfsight-app-lazy></div>
                    </div>

                    {/* Elfsight Instagram Widget */}
                    <div className="pt-12 border-t border-border">
                        <div className="elfsight-app-3113a761-00d8-42e6-afba-ae4f7e2ee832 max-w-6xl mx-auto rounded-3xl overflow-hidden" data-elfsight-app-lazy></div>
                    </div>
                </div>

            </div>
        </section>
    );
}

