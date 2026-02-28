"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

export function Services() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const servicios = [
        {
            title: "Oxigenoterapia Hiperbárica",
            description: "Respirar oxígeno puro al 100% en cámara presurizada eleva su concentración en sangre hasta 15 veces, acelerando la regeneración celular y reduciendo inflamación.",
            tags: ["Recuperación deportiva", "Heridas crónicas"],
            imgUrl: "https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Camara_hiperbarica.png",
            wsLink: "https://wa.me/56930186496?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20la%20Oxigenoterapia%20Hiperb%C3%A1rica."
        },
        {
            title: "Rehabilitación Kinesiológica",
            description: "Evaluación biomecánica completa con diseño de plan terapéutico individualizado. Terapia manual, ejercicio terapéutico y agentes físicos especializados.",
            tags: ["Dolor musculoesquelético", "Lesiones articulares"],
            imgUrl: "https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Tratamiento_kinesiologico.png",
            wsLink: "https://wa.me/56930186496?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20Rehabilitaci%C3%B3n%20Kinesiológica."
        },
        {
            title: "Recuperación Deportiva",
            description: "Rehabilitación progresiva para deportistas. Combinamos kinesiología y terapia hiperbárica para reducir tiempos de recuperación drásticamente.",
            tags: ["Post-quirúrgico", "Lesiones deportivas"],
            imgUrl: "https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Rehabilitacion_deportiva.png",
            wsLink: "https://wa.me/56930186496?text=Hola%2C%20quiero%20informaci%C3%B3n%20sobre%20Recuperaci%C3%B3n%20Deportiva."
        }
    ];

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollPosition = scrollRef.current.scrollLeft;
        const totalWidth = scrollRef.current.scrollWidth - scrollRef.current.clientWidth;

        if (totalWidth <= 0) return;

        // Approximate the index based on scroll position proportionally
        const scrollPercentage = scrollPosition / totalWidth;
        const newIndex = Math.round(scrollPercentage * (servicios.length - 1));

        if (newIndex !== activeIndex) {
            setActiveIndex(newIndex);
        }
    };

    useEffect(() => {
        if (isInteracting) return;

        const interval = setInterval(() => {
            if (window.innerWidth >= 768 || !scrollRef.current) return;

            const el = scrollRef.current;
            const { scrollLeft, scrollWidth, clientWidth } = el;

            if (!el.children[0]) return;

            const cardWidth = el.children[0].clientWidth;
            const gap = 24;
            let nextScroll = scrollLeft + cardWidth + gap;

            if (scrollLeft + clientWidth >= scrollWidth - 20) {
                nextScroll = 0;
            }

            el.scrollTo({ left: nextScroll, behavior: "smooth" });
        }, 4000);

        return () => clearInterval(interval);
    }, [isInteracting]);

    return (
        <section id="servicios" className="py-24 lg:py-32 bg-bg-main overflow-hidden">
            <div className="container relative">

                <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 md:mb-24 gap-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="max-w-2xl"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-light text-cyan-dark text-xs font-black uppercase tracking-widest mb-6">
                            <Sparkles className="h-4 w-4" />
                            Nuestras Especialidades
                        </div>
                        <h2 className="text-4xl md:text-6xl font-black text-navy mb-8 tracking-tighter leading-tight">
                            Soluciones de <span className="text-cyan">Vanguardia</span>
                        </h2>
                        <p className="text-text-muted text-lg md:text-xl leading-relaxed font-medium">
                            Tecnología de punta y tratamiento personalizado para tratar lesiones complejas y optimizar tu potencial físico.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <Link
                            href="https://wa.me/56930186496"
                            className="inline-flex items-center gap-3 text-navy font-black hover:text-cyan transition-all group text-lg"
                        >
                            Ver más detalles
                            <div className="h-10 w-10 rounded-full border border-border flex items-center justify-center transition-all group-hover:bg-cyan group-hover:text-white group-hover:border-cyan">
                                <ArrowRight className="h-5 w-5" />
                            </div>
                        </Link>
                    </motion.div>
                </div>

                <div className="relative">
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        onMouseEnter={() => setIsInteracting(true)}
                        onMouseLeave={() => setIsInteracting(false)}
                        onTouchStart={() => setIsInteracting(true)}
                        onTouchEnd={() => {
                            setTimeout(() => setIsInteracting(false), 2000);
                        }}
                        className="flex items-stretch md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-12 overflow-x-auto snap-x snap-mandatory pb-4 md:pb-0 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0"
                    >
                        {servicios.map((service, idx) => (
                            <motion.article
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: idx * 0.15 }}
                                className="group bg-white rounded-[2rem] overflow-hidden border border-border shadow-sm hover:shadow-lg hover:-translate-y-2 transition-all duration-500 flex flex-col w-[75vw] sm:w-[60vw] flex-shrink-0 snap-center md:w-auto md:flex-shrink-1"
                            >
                                <div className="relative h-56 md:h-72 overflow-hidden shrink-0">
                                    <Image
                                        src={service.imgUrl}
                                        alt={service.title}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent opacity-60"></div>
                                    <div className="absolute top-6 left-6">
                                        <div className="bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-white/20">
                                            <CheckCircle2 className="h-5 w-5 text-cyan" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:p-8 lg:p-10 flex flex-col flex-1">
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {service.tags.map((tag, tIdx) => (
                                            <span key={tIdx} className="bg-bg-main text-text-muted px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full border border-border group-hover:border-cyan/30 group-hover:text-cyan-dark transition-colors">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <h3 className="text-xl md:text-2xl font-black text-navy mb-4 group-hover:text-cyan transition-colors leading-tight">
                                        {service.title}
                                    </h3>

                                    <p className="text-text-muted leading-relaxed mb-8 text-sm md:text-base flex-1 font-medium">
                                        {service.description}
                                    </p>

                                    <Link
                                        href={service.wsLink}
                                        target="_blank"
                                        rel="noopener"
                                        className="mt-auto group/btn flex items-center justify-center gap-3 w-full py-4 bg-navy text-white font-black rounded-2xl hover:bg-cyan transition-all duration-300 shadow-lg hover:shadow-cyan/20 active:scale-95 text-sm md:text-base"
                                    >
                                        Solicitar Información
                                        <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                                    </Link>
                                </div>
                            </motion.article>
                        ))}
                    </div>

                    {/* Mobile Navigation Indicators */}
                    <div className="flex md:hidden items-center justify-center gap-2 mt-6">
                        {servicios.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${activeIndex === idx ? 'w-8 bg-cyan' : 'w-2 bg-border'}`}
                            />
                        ))}
                    </div>
                </div>

            </div>
        </section>
    );
}

