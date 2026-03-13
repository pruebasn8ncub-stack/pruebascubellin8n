"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Users, UserCog, Briefcase, Box, Clock, CalendarOff, Activity, Settings, ArrowRight, LogOut, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/");
            } else {
                setUserEmail(session.user.email ?? null);
                setLoading(false);
            }
        };
        checkUser();
    }, [router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-teal animate-spin" />
            </div>
        );
    }

    const apps = [
        {
            name: "Agenda",
            description: "Gestión de horas médicas, agenda y disponibilidad de boxes.",
            icon: CalendarDays,
            href: "/admin/agenda",
            color: "from-teal to-emerald-500",
            available: true,
        },
        {
            name: "Pacientes",
            description: "Registro clínico, historial de atenciones y documentos.",
            icon: Users,
            href: "/admin/patients",
            color: "from-blue-500 to-indigo-500",
            available: true,
        },
        {
            name: "Profesionales",
            description: "Gestión del equipo de kinesiólogas y administradores.",
            icon: UserCog,
            href: "/admin/professionals",
            color: "from-purple-500 to-pink-500",
            available: true,
        },
        {
            name: "Servicios",
            description: "Configuración de servicios, tarifas y sesiones compuestas.",
            icon: Briefcase,
            href: "/admin/services",
            color: "from-amber-500 to-orange-500",
            available: true,
        },
        {
            name: "Recursos Físicos",
            description: "Administración de salas, cámaras y equipamiento clínico.",
            icon: Box,
            href: "/admin/resources",
            color: "from-rose-500 to-red-500",
            available: true,
        },
        {
            name: "Horarios Profesionales",
            description: "Define bloques de disponibilidad semanal por profesional.",
            icon: Clock,
            href: "/admin/schedules",
            color: "from-cyan to-blue-500",
            available: true,
        },
        {
            name: "Excepciones",
            description: "Bloqueos de agenda, feriados y ausencias programadas.",
            icon: CalendarOff,
            href: "/admin/exceptions",
            color: "from-slate-500 to-gray-600",
            available: true,
        },
        {
            name: "Métricas",
            description: "Estadísticas de ocupación y rendimiento clínico.",
            icon: Activity,
            href: "#",
            color: "from-emerald-400 to-teal",
            available: false,
        },
        {
            name: "Configuración",
            description: "Administración del sistema, usuarios y roles.",
            icon: Settings,
            href: "#",
            color: "from-slate-400 to-gray-500",
            available: false,
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #0d3d72 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal/5 blur-[120px] rounded-full"></div>

            <div className="container mx-auto px-4 py-8 relative z-10">
                <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white border border-slate-200 rounded-3xl p-6 mb-12 shadow-2xl">
                    <div>
                        <h1 className="text-lg font-semibold text-teal-dark">Portal Administrativo</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-slate-800">Usuario Activo</div>
                            <div className="text-xs text-slate-500">{userEmail}</div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="bg-slate-50 hover:bg-red-500/20 text-slate-800 hover:text-red-400 p-3 rounded-xl transition-all border border-slate-100 hover:border-red-500/30 group"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                        </button>
                    </div>
                </header>

                <div className="mb-10 text-center md:text-left">
                    <h2 className="text-lg font-semibold text-slate-800 tracking-tight mb-2">Herramientas del Sistema</h2>
                    <p className="text-slate-500 text-lg">Selecciona la aplicación a la que deseas acceder</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {apps.map((app, index) => (
                        <motion.div
                            key={app.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.07, duration: 0.4 }}
                        >
                            {app.available ? (
                                <Link href={app.href} className="block group h-full">
                                    <div className="bg-white rounded-[2rem] p-8 border border-slate-200 hover:border-teal hover:bg-slate-50 transition-all duration-300 h-full flex flex-col shadow-xl hover:shadow-teal/10">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${app.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                            <app.icon className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-800 mb-3">{app.name}</h3>
                                        <p className="text-slate-500 text-sm mb-8 flex-grow">{app.description}</p>
                                        <div className="flex items-center text-teal font-bold text-sm group-hover:text-slate-800 transition-colors mt-auto">
                                            Abrir aplicación
                                            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-2" />
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                <div className="bg-white rounded-[2rem] p-8 border border-slate-100 opacity-60 h-full flex flex-col shadow-xl relative overflow-hidden">
                                    <div className="absolute top-4 right-4 bg-slate-50 text-slate-800/50 text-[10px] font-black uppercase px-2 py-1 rounded-full tracking-widest">
                                        Próximamente
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-slate-100">
                                        <app.icon className="h-7 w-7 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-black text-slate-800/50 mb-3">{app.name}</h3>
                                    <p className="text-slate-400 text-sm mb-8 flex-grow">{app.description}</p>
                                    <div className="flex items-center text-slate-800/30 font-bold text-sm mt-auto">
                                        No disponible
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
