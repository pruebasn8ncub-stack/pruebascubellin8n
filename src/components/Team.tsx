"use client";

import { CheckCircle2, GraduationCap, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export function Team() {
    const team = [
        {
            name: "Daniela Mayoral Vega",
            role: "Kinesióloga · Esp. Medicina Hiperbárica",
            bio: "Kinesióloga con trayectoria en medicina hiperbárica y rehabilitación funcional. Especialista en el uso terapéutico del oxígeno hiperbárica para acelerar la regeneración de tejidos y tratar condiciones crónicas complejas.",
            badges: ["Directora Clínica", "U. de Chile"],
            imgUrl: "https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/Kinesiologas_innovakine2.jpeg"
        },
        {
            name: "Camila Alvarado Barrera",
            role: "Kinesióloga · Esp. Rehabilitación Deportiva",
            bio: "Experta en el reintegro deportivo y recuperación post-quirúrgica. Integra avanzadas técnicas de terapia manual con oxigenoterapia para optimizar el rendimiento y bienestar de sus pacientes.",
            badges: ["Medicina Deportiva", "PUC"],
            imgUrl: "https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/kinesiologas_innovakine.png"
        }
    ];

    return (
        <section id="equipo" className="py-16 md:py-24 lg:py-32 bg-navy relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-cyan/10 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-blue-500/10 blur-[80px] rounded-full" />

            <div className="container relative z-10">
                <div className="mb-16 md:mb-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-blue-100 text-xs font-black uppercase tracking-widest mb-6 backdrop-blur-md border border-white/10"
                    >
                        <GraduationCap className="h-4 w-4" />
                        Staff Médico Certificado
                    </motion.div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                        Nuestro Equipo de <span className="text-cyan">Especialistas</span>
                    </h2>
                    <p className="text-blue-100/70 text-lg md:text-xl font-medium leading-relaxed">
                        Contamos con profesionales de excelencia, certificadas por instituciones líderes y con amplia experiencia en la salud pública y privada de Chile.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
                    {team.map((member, idx) => (
                        <motion.article
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.2 }}
                            className="bg-white rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row items-stretch group"
                        >
                            <div className="relative w-full md:w-2/5 aspect-[4/5] md:aspect-auto overflow-hidden">
                                <Image
                                    src={member.imgUrl}
                                    alt={member.name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                                    {member.badges.map((badge, bIdx) => (
                                        <span key={bIdx} className="bg-white/90 backdrop-blur-md text-navy text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm uppercase tracking-tighter">
                                            {badge}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 md:p-8 lg:p-10 md:w-3/5 flex flex-col">
                                <h3 className="text-2xl font-black text-navy mb-2">{member.name}</h3>
                                <p className="text-cyan font-bold text-sm mb-6 uppercase tracking-widest">{member.role}</p>
                                <p className="text-text-muted leading-relaxed mb-8 flex-1 font-medium italic">
                                    "{member.bio}"
                                </p>
                                <div className="inline-flex items-center gap-3 px-5 py-3 bg-bg-main rounded-2xl border border-border group-hover:border-cyan/20 transition-all">
                                    <ShieldCheck className="h-5 w-5 text-cyan" />
                                    <span className="text-xs font-black text-navy uppercase tracking-tight">Registro SIS Autorizado</span>
                                </div>
                            </div>
                        </motion.article>
                    ))}
                </div>

                <div className="mt-16 lg:mt-24 text-center">
                    <div className="inline-flex flex-col md:flex-row items-center gap-4 md:gap-6 p-5 md:p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="flex -space-x-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 w-12 rounded-full border-2 border-navy bg-gray-200 overflow-hidden">
                                    <Image src={team[0].imgUrl} alt="social" width={48} height={48} className="object-cover grayscale" />
                                </div>
                            ))}
                        </div>
                        <p className="text-white font-bold">Únete a cientos de pacientes recuperados</p>
                    </div>
                </div>

            </div>
        </section>
    );
}

