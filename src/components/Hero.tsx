"use client";

import { Calendar, ChevronDown, Award, Activity, Star } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

export function Hero() {
    return (
        <section className="relative pt-24 pb-16 md:pt-32 md:pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-navy">
            {/* Mesh Gradient Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-blue-400/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="container relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="max-w-2xl"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 mb-8 shadow-2xl"
                        >
                            <span className="flex h-2 w-2 rounded-full bg-cyan-400 relative">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                            </span>
                            <span className="text-xs font-bold text-blue-100 uppercase tracking-[0.2em]">
                                Clínica Especializada · Viña del Mar
                            </span>
                        </motion.div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] mb-6 md:mb-8 tracking-tighter">
                            Kinesiología y <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-300 italic">Terapia Hiperbárica</span>
                        </h1>

                        <p className="text-base sm:text-lg md:text-xl text-blue-100/80 mb-8 md:mb-12 leading-relaxed max-w-xl font-medium">
                            Recuperación acelerada con oxigenoterapia hiperbárica y kinesiología clínica. Atención personalizada por especialistas certificadas.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-5">
                            <Link
                                href="https://wa.me/56930186496?text=Hola%2C%20quiero%20agendar%20una%20consulta%20en%20Innovakine.%20%C2%BFTienen%20disponibilidad%20esta%20semana%3F"
                                target="_blank"
                                rel="noopener"
                                className="group relative inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-3.5 md:py-4 text-base md:text-lg font-bold text-navy shadow-xl transition-all hover:bg-blue-50 hover:shadow-cyan/20 hover:-translate-y-1 active:scale-95 w-full sm:w-auto"
                            >
                                <Calendar className="h-5 w-5 transition-transform group-hover:rotate-12" />
                                Agendar consulta
                            </Link>
                            <Link
                                href="#servicios"
                                className="inline-flex items-center justify-center gap-3 rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-sm px-8 py-3.5 md:py-4 text-base md:text-lg font-bold text-white transition-all hover:border-white/50 hover:bg-white/10 hover:-translate-y-1 w-full sm:w-auto"
                            >
                                Ver servicios
                                <ChevronDown className="h-5 w-5 animate-bounce" />
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="relative mx-auto w-full max-w-lg lg:max-w-none"
                    >
                        <div className="relative z-10 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border-[4px] lg:border-[8px] border-white/10 backdrop-blur-2xl transition-transform hover:scale-[1.01] duration-700">
                            <div className="relative aspect-[4/5] w-full">
                                <Image
                                    src="https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Kinesiologas_innovakine2.jpeg"
                                    alt="Equipo de Innovakine atendiendo pacientes"
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent"></div>

                            {/* Floating Badge */}
                            <motion.div
                                animate={{ y: [0, -10, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 p-3 md:p-4 lg:p-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-cyan-dark flex items-center justify-center shadow-lg">
                                        <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-base lg:text-lg text-shadow-sm">Innovación en Salud</div>
                                        <div className="text-blue-100/70 text-xs lg:text-sm">Tecnología de punta en Viña</div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Decorative blobs */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-400/20 rounded-full blur-3xl -z-10"></div>
                        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl -z-10"></div>
                    </motion.div>

                </div>

                {/* Stats Section */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="mt-12 md:mt-16 lg:mt-24 p-1 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden"
                >
                    <div className="bg-white rounded-[1.8rem] py-6 px-4 md:p-8 lg:p-12 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 lg:gap-12 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                        <div className="flex flex-col items-center justify-center text-center px-4">
                            <div className="flex items-center justify-center gap-3 text-3xl lg:text-4xl font-black text-navy mb-2">
                                <Award className="h-8 w-8 lg:h-10 lg:w-10 text-cyan" />
                                +10
                            </div>
                            <div className="text-xs font-black text-text-muted uppercase tracking-widest">Años de experiencia</div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center px-4 pt-6 md:pt-0">
                            <div className="flex items-center justify-center gap-3 text-3xl lg:text-4xl font-black text-navy mb-2 relative">
                                <Activity className="h-8 w-8 lg:h-10 lg:w-10 text-cyan" />
                                100%
                            </div>
                            <div className="text-xs font-black text-text-muted uppercase tracking-widest">Atención Certificada</div>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center px-4 pt-6 md:pt-0">
                            <div className="flex items-center justify-center gap-3 text-3xl lg:text-4xl font-black text-navy mb-2">
                                4.9 <Star className="h-8 w-8 lg:h-9 lg:w-9 text-yellow-500 fill-current" />
                            </div>
                            <div className="text-xs font-black text-text-muted uppercase tracking-widest">Satisfacción Total</div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </section>
    );
}

