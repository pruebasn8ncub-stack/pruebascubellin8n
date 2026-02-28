"use client";

import { useState } from "react";
import { Plus, Minus, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function FAQ() {
    const faqs = [
        {
            question: "¿Qué es la terapia hiperbárica y para qué sirve?",
            answer: "Consiste en respirar oxígeno puro al 100% en una cámara presurizada. Esto eleva la concentración de oxígeno en sangre hasta 15 veces, acelerando la curación de tejidos, reduciendo la inflamación y estimulando la regeneración celular. Es eficaz para recuperación deportiva, heridas crónicas, fatiga y condiciones neurológicas."
        },
        {
            question: "¿Cuántas sesiones de kinesiología necesito?",
            answer: "Depende de cada caso. En la consulta inicial realizamos una evaluación funcional completa y elaboramos un plan personalizado. Los tratamientos suelen variar entre 6 y 20 sesiones, con reevaluaciones periódicas para ajustar el protocolo."
        },
        {
            question: "¿Tienen convenio con FONASA o Isapres?",
            answer: "Atendemos de manera particular. Sin embargo, algunos procedimientos kinesiológicos pueden ser reembolsables según tu plan de salud. Consúltanos directamente por WhatsApp para más información sobre aranceles."
        },
        {
            question: "¿La terapia hiperbárica es segura?",
            answer: "Sí. Es un tratamiento médico avalado por evidencia científica, no invasivo y bien tolerado. Antes de iniciar realizamos una evaluación para identificar posibles contraindicaciones. Las sesiones tienen una duración aproximada de 60 minutos."
        },
        {
            question: "¿Puedo combinar kinesiología con terapia hiperbárica?",
            answer: "Sí, y es una de las principales ventajas de Innovakine. La combinación de ambas terapias acelera significativamente la recuperación en lesiones musculoesqueléticas y post-quirúrgicas. Nuestras kinesiólogas diseñarán un protocolo integrado según tu condición."
        },
        {
            question: "¿Cómo puedo agendar una hora?",
            answer: "Escríbenos por WhatsApp al +56 9 3018 6496 o usa el formulario de esta página. Atendemos lunes a viernes de 9:00 a 17:00 hrs y respondemos a la brevedad."
        }
    ];

    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section id="faq" className="py-12 md:py-24 bg-gradient-to-b from-bg-main to-surface">
            <div className="container max-w-4xl">

                <div className="mb-16 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-light text-cyan-dark text-xs font-black uppercase tracking-widest mb-4"
                    >
                        <HelpCircle className="h-4 w-4" />
                        Atención al Paciente
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-navy mb-6 tracking-tight">
                        Preguntas <span className="text-cyan">Frecuentes</span>
                    </h2>
                    <p className="text-text-muted text-lg max-w-2xl mx-auto font-medium">
                        Todo lo que necesitas saber sobre nuestros tratamientos y cómo prepararte para tu primera visita.
                    </p>
                </div>

                <div className="flex flex-col gap-3 md:gap-4">
                    {faqs.map((faq, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                                "rounded-2xl border transition-all duration-300 overflow-hidden bg-white",
                                openIndex === idx
                                    ? "border-cyan shadow-lg shadow-cyan/5"
                                    : "border-border hover:border-cyan/30 hover:shadow-sm"
                            )}
                        >
                            <button
                                className="w-full text-left px-5 py-4 md:px-8 md:py-6 flex items-center justify-between group focus:outline-none"
                                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                                aria-expanded={openIndex === idx}
                            >
                                <span className={cn(
                                    "font-bold text-base md:text-xl transition-colors",
                                    openIndex === idx ? "text-cyan-dark" : "text-navy group-hover:text-cyan"
                                )}>
                                    {faq.question}
                                </span>
                                <div className={cn(
                                    "flex-shrink-0 ml-4 h-8 w-8 rounded-full flex items-center justify-center transition-all",
                                    openIndex === idx ? "bg-cyan text-white rotate-180" : "bg-bg-main text-text-muted group-hover:bg-cyan-light group-hover:text-cyan"
                                )}>
                                    {openIndex === idx ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {openIndex === idx && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                    >
                                        <div className="px-5 pb-5 md:px-8 md:pb-8">
                                            <div className="h-px w-full bg-gray-100 mb-4 md:mb-6" />
                                            <p className="text-text-muted leading-relaxed text-sm md:text-lg font-medium">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-text-muted font-bold mb-4">¿Aún tienes dudas?</p>
                    <Link
                        href="https://wa.me/56930186496"
                        className="inline-flex items-center gap-2 text-cyan font-black hover:text-cyan-dark transition-colors text-lg"
                    >
                        Contáctanos directamente por WhatsApp
                        <span className="text-2xl">→</span>
                    </Link>
                </div>

            </div>
        </section>
    );
}

