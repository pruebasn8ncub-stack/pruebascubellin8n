"use client";

import { FileText, PersonStanding, Activity, CheckCircle } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export function About() {
    return (
        <section id="nosotros" className="py-16 md:py-24 lg:py-32 bg-white relative overflow-hidden">
            {/* Subtle background element */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-navy/5 to-transparent" />

            <div className="container relative z-10">
                <div className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-light text-cyan-dark text-xs font-black uppercase tracking-widest mb-6"
                    >
                        Nuestra Trayectoria
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-navy mb-6 tracking-tight leading-tight">
                        Expertos en Kinesiología y <span className="text-cyan">Oxigenoterapia</span>
                    </h2>
                    <p className="text-text-muted text-lg md:text-xl font-medium leading-relaxed">
                        Combinamos tecnología médica avanzada con atención humana y altamente personalizada en el corazón de Viña del Mar.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="relative"
                    >
                        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-bg-main aspect-[4/3]">
                            <Image
                                src="https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Kinesiologas_innovakine2.jpeg"
                                alt="Kinesiólogas de Innovakine en sesión"
                                fill
                                className="object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent flex items-end p-6 lg:p-12">
                                <div className="text-white">
                                    <p className="font-black text-xl md:text-2xl mb-1 md:mb-2">Innovakine</p>
                                    <p className="text-sm font-bold opacity-90 uppercase tracking-[0.2em]">Más que una clínica, tu salud</p>
                                </div>
                            </div>
                        </div>
                        {/* Decorative element */}
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-cyan-light rounded-full -z-10 blur-xl opacity-50" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="flex flex-col gap-8"
                    >
                        <div className="space-y-6">
                            <p className="text-lg md:text-xl text-navy leading-relaxed font-bold">
                                Innovakine es una clínica de vanguardia orientada a la rehabilitación integral.
                                <span className="text-cyan ml-1 underline decoration-cyan-light underline-offset-4">Nuestra misión es devolverte la movilidad y el bienestar.</span>
                            </p>
                            <p className="text-text-muted leading-relaxed text-lg font-medium">
                                Integramos la kinesiología clínica con la terapia de oxigenación hiperbárica para acelerar los procesos naturales de sanación del cuerpo. Atendemos a deportistas y pacientes generales con protocolos validados científicamente.
                            </p>
                        </div>

                        <div className="grid gap-6">
                            {[
                                {
                                    icon: Activity,
                                    title: "Equipamiento de Elite",
                                    desc: "Cámaras hiperbáricas certificadas internacionalmente para máxima seguridad."
                                },
                                {
                                    icon: PersonStanding,
                                    title: "Evaluación Personalizada",
                                    desc: "No creemos en soluciones genéricas; cada paciente es un caso único para nosotros."
                                },
                                {
                                    icon: FileText,
                                    title: "Evidencia Científica",
                                    desc: "Todos nuestros tratamientos se basan en los últimos estudios médicos globales."
                                }
                            ].map((item, i) => (
                                <div key={i} className="flex items-start gap-4 md:gap-5 p-3 md:p-4 rounded-2xl transition-colors hover:bg-bg-main">
                                    <div className="mt-1 flex h-12 w-12 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-light text-cyan-dark shadow-sm">
                                        <item.icon className="h-6 w-6 md:h-7 md:w-7" />
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-black text-navy mb-1">{item.title}</h4>
                                        <p className="text-text-muted font-medium text-sm leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

