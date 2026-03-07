"use client";

import Link from "next/link";
import Image from "next/image";
import { Instagram, Smartphone, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-navy border-t border-white/5 pt-10 md:pt-14 pb-8 overflow-hidden relative">
            {/* Decorative background circle */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan/5 blur-3xl rounded-full" />

            <div className="container relative z-10">
                <div className="flex flex-col md:flex-row gap-8 md:gap-16 mb-8">

                    <div className="md:max-w-sm">
                        <Link href="/" className="inline-block mb-5 group">
                            <div className="transition-transform group-hover:scale-105">
                                <Image
                                    src="/images/logo_innovakine.png"
                                    alt="Innovakine Logo"
                                    width={180}
                                    height={50}
                                    className="h-auto w-40 brightness-0 invert"
                                />
                            </div>
                        </Link>
                        <p className="text-blue-100/70 leading-relaxed mb-5 text-sm font-medium">
                            Líderes en terapia de oxigenación hiperbárica y kinesiología avanzada en la Región de Valparaíso. Ciencia y calidez humana al servicio de tu bienestar.
                        </p>

                        <div className="flex gap-4">
                            {[
                                { icon: Instagram, href: "https://www.instagram.com/innovakinecl", label: "Instagram" },
                                { icon: Smartphone, href: "https://wa.me/56930186496", label: "WhatsApp" },
                                { icon: Mail, href: "mailto:contacto@innovakine.cl", label: "Email" }
                            ].map((social, i) => (
                                <a
                                    key={i}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener"
                                    aria-label={social.label}
                                    className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 text-blue-100 hover:bg-cyan hover:text-white transition-all duration-300 border border-white/10"
                                >
                                    <social.icon className="h-5 w-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-12 md:gap-16 md:ml-auto">
                        <div>
                            <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4">Servicios</h4>
                            <ul className="flex flex-col gap-3">
                                <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Oxigenoterapia</Link></li>
                                <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Kinesiología Clínica</Link></li>
                                <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Reintegro Deportivo</Link></li>
                                <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Post-Operatorio</Link></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4">Nuestra Clínica</h4>
                            <ul className="flex flex-col gap-3">
                                <li><Link href="#nosotros" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Nosotros</Link></li>
                                <li><Link href="#equipo" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Especialistas</Link></li>
                                <li><Link href="#opiniones" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Testimonios</Link></li>
                                <li><Link href="#faq" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Preguntas Frecuentes</Link></li>
                            </ul>
                        </div>
                    </div>

                </div>

                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-blue-100/40 font-bold uppercase tracking-widest">
                        &copy; {new Date().getFullYear()} Innovakine Clínica Boutique · Todos los derechos reservados
                    </p>
                    <div className="flex gap-8">
                        <Link href="/" className="text-[10px] text-blue-100/30 hover:text-cyan transition-colors uppercase font-black tracking-tighter">Términos y Condiciones</Link>
                        <Link href="/" className="text-[10px] text-blue-100/30 hover:text-cyan transition-colors uppercase font-black tracking-tighter">Privacidad</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
