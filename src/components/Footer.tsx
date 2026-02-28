"use client";

import Link from "next/link";
import Image from "next/image";
import { Instagram, Smartphone, Mail, Globe, MapPin } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-navy border-t border-white/5 pt-12 md:pt-20 pb-10 overflow-hidden relative">
            {/* Decorative background circle */}
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-cyan/5 blur-3xl rounded-full" />

            <div className="container relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 md:gap-12 lg:gap-16 mb-10 lg:mb-16">

                    <div className="lg:col-span-4">
                        <Link href="/" className="inline-block mb-8 group">
                            <div className="bg-white p-2.5 rounded-2xl shadow-xl transition-transform group-hover:scale-105">
                                <Image
                                    src="https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/logo_innovakine.jpg"
                                    alt="Innovakine Logo"
                                    width={180}
                                    height={50}
                                    className="h-auto w-40"
                                />
                            </div>
                        </Link>
                        <p className="text-blue-100/70 leading-relaxed mb-8 max-w-sm text-base font-medium">
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
                                    className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/5 text-blue-100 hover:bg-cyan hover:text-white transition-all duration-300 border border-white/10"
                                >
                                    <social.icon className="h-5 w-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-2 lg:ml-auto">
                        <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4 md:mb-8">Servicios</h4>
                        <ul className="flex flex-col gap-4">
                            <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Oxigenoterapia</Link></li>
                            <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Kinesiología Clínica</Link></li>
                            <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Reintegro Deportivo</Link></li>
                            <li><Link href="#servicios" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Post-Operatorio</Link></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-2">
                        <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4 md:mb-8">Nuestra Clínica</h4>
                        <ul className="flex flex-col gap-4">
                            <li><Link href="#nosotros" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Nosotros</Link></li>
                            <li><Link href="#equipo" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Especialistas</Link></li>
                            <li><Link href="#opiniones" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Testimonios</Link></li>
                            <li><Link href="#faq" className="text-blue-100/60 hover:text-cyan transition-colors text-sm font-bold">Preguntas Frecuentes</Link></li>
                        </ul>
                    </div>

                    <div className="lg:col-span-4 bg-white/5 rounded-[2.5rem] p-5 md:p-8 border border-white/5 backdrop-blur-sm">
                        <h4 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-6 md:mb-8">Contacto Directo</h4>
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="h-5 w-5 text-cyan shrink-0 mt-1" />
                                <p className="text-blue-100/80 text-sm font-medium">Av. Libertad 919, Local 1<br />Viña del Mar, Chile</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Smartphone className="h-5 w-5 text-cyan shrink-0" />
                                <p className="text-blue-100/80 text-sm font-black">+56 9 3018 6496</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Clock className="h-5 w-5 text-cyan shrink-0" />
                                <p className="text-blue-100/80 text-sm font-medium">Lunes a Viernes: 09:00 - 17:00</p>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
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

const Clock = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

