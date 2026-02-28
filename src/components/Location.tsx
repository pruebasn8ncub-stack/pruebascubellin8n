"use client";

import { MapPin, Phone, MessageCircle, Navigation, Clock } from "lucide-react";
import { motion } from "framer-motion";

export function Location() {
    return (
        <section id="ubicacion" className="py-16 md:py-24 lg:py-32 bg-navy relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            <div className="container relative z-10">
                <div className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-blue-100 text-xs font-black uppercase tracking-widest mb-6 backdrop-blur-md border border-white/10"
                    >
                        <Navigation className="h-4 w-4" />
                        Visítanos
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                        Ubicación <span className="text-cyan">Privilegiada</span>
                    </h2>
                    <p className="text-blue-100/70 text-lg md:text-xl font-medium leading-relaxed">
                        Estamos ubicados en el corazón de Viña del Mar, con fácil acceso y estacionamiento cercano para tu comodidad.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-stretch">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="lg:col-span-8 bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 h-[250px] md:h-[400px] lg:h-full min-h-[250px]"
                    >
                        <iframe
                            src="https://maps.google.com/maps?q=Innovakine+Av.+Libertad+919+Vi%C3%B1a+del+Mar&t=m&z=16&output=embed&iwloc=near"
                            className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-700"
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Innovakine – Av. Libertad 919, Viña del Mar"
                        ></iframe>
                    </motion.div>

                    <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 hover:border-cyan/30 transition-all duration-500 group shadow-lg"
                        >
                            <div className="h-14 w-14 bg-white text-navy rounded-2xl flex items-center justify-center shadow-sm mb-6 group-hover:bg-cyan group-hover:text-white transition-colors">
                                <MapPin className="h-7 w-7" />
                            </div>
                            <h5 className="text-xl font-black text-white mb-3">Dirección Clínica</h5>
                            <p className="text-blue-100/80 mb-6 font-medium leading-relaxed">
                                Av. Libertad 919, Of. 601<br />
                                Viña del Mar, Valparaíso, Chile
                            </p>
                            <a
                                href="https://maps.app.goo.gl/st5fzWLvwPGfJwUQA"
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-2 text-cyan font-black text-xs uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Abrir en Maps
                                <span className="text-lg">→</span>
                            </a>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 hover:border-cyan/30 transition-all duration-500 group shadow-lg"
                        >
                            <div className="h-14 w-14 bg-white text-navy rounded-2xl flex items-center justify-center shadow-sm mb-6 group-hover:bg-cyan group-hover:text-white transition-colors">
                                <Clock className="h-7 w-7" />
                            </div>
                            <h5 className="text-xl font-black text-white mb-3">Horario de Atención</h5>
                            <div className="space-y-2 mb-6 text-blue-100/80 font-medium">
                                <p className="flex justify-between">
                                    <span>Lunes — Viernes</span>
                                    <span className="text-white">09:00 - 17:00</span>
                                </p>
                                <p className="flex justify-between opacity-50">
                                    <span>Sábado — Domingo</span>
                                    <span>Cerrado</span>
                                </p>
                            </div>
                            <a
                                href="https://wa.me/56930186496"
                                className="inline-flex items-center gap-2 text-cyan font-black text-xs uppercase tracking-widest hover:text-white transition-colors"
                            >
                                Consultar Disponibilidad
                                <MessageCircle className="h-4 w-4" />
                            </a>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
}

