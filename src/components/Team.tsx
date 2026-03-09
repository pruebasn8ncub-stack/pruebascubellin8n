"use client";

import { GraduationCap } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

/* LinkedIn SVG icon component */
function LinkedInIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}

export function Team() {
    const team = [
        {
            name: "Daniela Mayoral Vega",
            role: "Kinesióloga · Directora Clínica",
            bio: "Kinesióloga con trayectoria en medicina hiperbárica y rehabilitación funcional. Diplomada en Salud Familiar y Comunitaria (230 hrs, U. Gabriela Mistral), Neurorehabilitación (200 hrs, OCEUP Educación Continua) y Manejo del Dolor (80 hrs, Instituto Revive). Especialista en oxígeno hiperbárico para regeneración de tejidos y condiciones crónicas complejas.",
            badges: ["Kinesióloga", "U. Playa Ancha"],
            imgUrl: "/images/daniela_mayoral.jpg",
            linkedinUrl: "#"
        },
        {
            name: "Camila Alvarado Barrera",
            role: "Kinesióloga · Co-Fundadora de Innovakine",
            bio: "Profesional orientada a la recuperación integral de sus pacientes. Especializada en Fisiología Clínica del Ejercicio, con amplia experiencia en tratamiento hiperbárico. Destaca por su empatía y sólida experiencia en rehabilitación y trabajo interdisciplinario.",
            badges: ["Diplomada UChile", "Kinesiología"],
            imgUrl: "/images/camila_alvarado.jpg",
            linkedinUrl: "https://www.linkedin.com/in/camila-alvarado-barrera-786164248/"
        }
    ];

    return (
        <section id="equipo" className="py-16 md:py-24 lg:py-32 bg-navy relative overflow-hidden">
            {/* Background ambient glows */}
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-cyan/10 blur-[100px] rounded-full" />
            <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-blue-500/10 blur-[80px] rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-cyan/5 blur-[120px] rounded-full" />

            <div className="container relative z-10">
                {/* Section Header */}
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

                {/* Team Cards Grid */}
                <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
                    {team.map((member, idx) => (
                        <motion.article
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.2, duration: 0.6 }}
                            className="group relative"
                        >
                            {/* Card container with white background */}
                            <div
                                className="relative rounded-[2rem] overflow-hidden border border-gray-200 shadow-xl flex flex-col items-center text-center px-8 pt-10 pb-8 h-full transition-all duration-500 bg-white group-hover:border-cyan/20 group-hover:shadow-[0_8px_40px_rgba(26,94,168,0.12)]"
                            >
                                {/* Subtle top glow */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-24 bg-cyan/5 blur-[40px] rounded-full" />

                                {/* Badges */}
                                <div className="relative z-10 flex flex-wrap justify-center gap-2.5 mb-8">
                                    {member.badges.map((badge, bIdx) => {
                                        const badgeLower = badge.toLowerCase();
                                        const isUChile = badgeLower.includes('uchile') || badgeLower.includes('u. de chile');
                                        const isUPLA = badgeLower.includes('playa ancha');
                                        return (
                                            <span
                                                key={bIdx}
                                                className="px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border border-navy/15 text-navy bg-bg-main transition-colors duration-300 group-hover:border-cyan/30 group-hover:bg-cyan-light inline-flex items-center gap-1.5"
                                            >
                                                {isUChile && (
                                                    <Image src="/images/logo_uchile.png" alt="Universidad de Chile" width={16} height={16} className="object-contain" />
                                                )}
                                                {isUPLA && (
                                                    <Image src="/images/logo_upla.png" alt="Universidad de Playa Ancha" width={16} height={16} className="object-contain" />
                                                )}
                                                {badge}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Avatar with ring */}
                                <div className="relative z-10 mb-7">
                                    {/* Glow behind avatar */}
                                    <div className="absolute inset-0 rounded-full bg-cyan/10 blur-xl scale-110 transition-all duration-500 group-hover:bg-cyan/20 group-hover:scale-125" />
                                    <div className="relative w-40 h-40 rounded-full ring-[3px] ring-cyan/30 ring-offset-[3px] ring-offset-white overflow-hidden transition-transform duration-500 group-hover:scale-105">
                                        <Image
                                            src={member.imgUrl}
                                            alt={member.name}
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                </div>

                                {/* Name */}
                                <h3 className="relative z-10 text-2xl md:text-[1.65rem] font-black text-navy mb-2 leading-tight">
                                    {member.name}
                                </h3>

                                {/* Role */}
                                <p className="relative z-10 text-cyan text-[11px] font-bold uppercase tracking-[0.15em] mb-6">
                                    {member.role}
                                </p>

                                {/* Bio Quote */}
                                <p className="relative z-10 text-text-muted text-sm leading-relaxed mb-8 flex-1 font-medium max-w-xs mx-auto">
                                    &ldquo;{member.bio}&rdquo;
                                </p>

                                {/* LinkedIn Button */}
                                <a
                                    href={member.linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative z-10 w-full inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full border border-navy/15 bg-bg-main text-navy text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:bg-cyan-light hover:border-cyan/30 hover:shadow-[0_4px_16px_rgba(26,94,168,0.12)] group/btn"
                                >
                                    <LinkedInIcon className="w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110" />
                                    Ver Perfil en LinkedIn
                                </a>
                            </div>
                        </motion.article>
                    ))}
                </div>

            </div>
        </section>
    );
}
