"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Calendar, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { LoginModal } from "./LoginModal";

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { name: "Nosotros", href: "#nosotros" },
        { name: "Servicios", href: "#servicios" },
        { name: "Equipo", href: "#equipo" },
        { name: "Opiniones", href: "#opiniones" },
        { name: "FAQ", href: "#faq" },
        { name: "Ubicación", href: "#ubicacion" },
    ];

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white border-b border-border",
                isScrolled ? "py-2 lg:py-3 shadow-md" : "py-3 lg:py-5"
            )}
        >
            <div className="container flex items-center justify-end lg:justify-between min-h-[44px] lg:min-h-0">
                {/* Logo */}
                <Link href="/" className="absolute left-1/2 -translate-x-1/2 lg:static lg:transform-none z-50 flex items-center group">
                    <div className="transition-all duration-500 flex items-center justify-center p-1 lg:p-2">
                        <div className={cn(
                            "relative transition-all duration-500",
                            isScrolled ? "h-8 w-28 lg:h-10 lg:w-36" : "h-10 w-32 lg:h-12 lg:w-44 lg:group-hover:scale-105"
                        )}>
                            <Image
                                src="https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/logo_innovakine.jpg"
                                alt="Innovakine Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            className="text-sm font-bold transition-all text-navy hover:text-cyan relative group tracking-wide"
                        >
                            {link.name}
                            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cyan transition-all duration-300 group-hover:w-full"></span>
                        </Link>
                    ))}
                </nav>

                {/* Actions Desktop */}
                <div className="hidden lg:flex items-center gap-4">
                    <Link
                        href="https://wa.me/56930186496?text=Hola%2C%20quiero%20agendar%20una%20consulta%20en%20Innovakine.%20%C2%BFTienen%20disponibilidad%20esta%20semana%3F"
                        target="_blank"
                        rel="noopener"
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-sm transition-all hover:-translate-y-0.5 active:scale-95 group bg-cyan text-white shadow-lg hover:shadow-cyan/30"
                    >
                        <Calendar className="h-4 w-4 transition-transform group-hover:rotate-12" />
                        Agendar hora
                    </Link>
                    <button
                        onClick={() => setIsLoginModalOpen(true)}
                        aria-label="Acceso administrador"
                        className="transition-colors p-2 rounded-full text-text-muted hover:text-navy hover:bg-navy/5"
                    >
                        <Lock className="h-5 w-5" />
                    </button>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="lg:hidden relative z-50 p-2 rounded-full transition-colors text-navy hover:bg-navy/5"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
                >
                    {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Mobile Navigation Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-border shadow-2xl overflow-hidden"
                    >
                        <div className="flex flex-col gap-1 p-6">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-text font-black tracking-wide text-lg py-4 border-b border-border flex items-center justify-between group hover:text-cyan transition-colors"
                                >
                                    {link.name}
                                    <span className="text-cyan transition-transform group-hover:translate-x-2">→</span>
                                </Link>
                            ))}
                            <Link
                                href="https://wa.me/56930186496?text=Hola%2C%20quiero%20agendar%20una%20consulta%20en%20Innovakine.%20%C2%BFTienen%20disponibilidad%20esta%20semana%3F"
                                target="_blank"
                                rel="noopener"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center justify-center gap-2 bg-navy text-white px-5 py-4 rounded-2xl font-black mt-6 shadow-xl active:scale-95 transition-all hover:bg-cyan"
                            >
                                <Calendar className="h-5 w-5" />
                                WhatsApp Directo
                            </Link>

                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    setIsLoginModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-2 bg-white text-navy border-2 border-border px-5 py-4 rounded-2xl font-black mt-3 transition-all hover:bg-navy/5"
                            >
                                <Lock className="h-5 w-5" />
                                Acceso Especialistas
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
            />
        </header>
    );
}

