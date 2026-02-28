"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Calendar, Users, Settings, Activity, ArrowRight, LogOut, Loader2 } from "lucide-react";
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
            <div className="min-h-screen bg-navy flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-cyan animate-spin" />
            </div>
        );
    }

    const apps = [
        {
            name: "Agenda y Citas",
            description: "Gestión de horas médicas, pacientes y disponibilidad de boxes.",
            icon: Calendar,
            href: "/admin/agenda",
            color: "from-blue-500 to-cyan",
            available: true,
        },
        {
            name: "Pacientes",
            description: "Registro clínico, historial de atenciones y documentos.",
            icon: Users,
            href: "/admin/patients",
            color: "from-purple-500 to-pink-500",
            available: true,
        },
        {
            name: "Métricas",
            description: "Estadísticas de ocupación y rendimiento clínico.",
            icon: Activity,
            href: "#",
            color: "from-emerald-400 to-teal-500",
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
        <div className="min-h-screen bg-navy relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan/10 blur-[120px] rounded-full"></div>

            <div className="container mx-auto px-4 py-8 relative z-10">
                <header className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-12 shadow-2xl">
                    <div className="flex items-center gap-6">
                        <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                            <Image
                                src="https://svtbqdpulegufprcnppi.supabase.co/storage/v1/object/public/innovakine/logo_innovakine.jpg"
                                alt="Innovakine Logo"
                                width={140}
                                height={40}
                                className="h-auto w-32 object-contain mix-blend-multiply"
                                priority
                            />
                        </div>
                        <div className="hidden md:block">
                            <h1 className="text-xl font-black text-white">Portal Administrativo</h1>
                            <p className="text-blue-100/60 text-sm">Gestiona tu centro clínico</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-bold text-white">Usuario Activo</div>
                            <div className="text-xs text-blue-100/60">{userEmail}</div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 p-3 rounded-xl transition-all border border-white/5 hover:border-red-500/30 group"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                        </button>
                    </div>
                </header>

                <div className="mb-10 text-center md:text-left">
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">Herramientas del Sistema</h2>
                    <p className="text-blue-100/70 text-lg">Selecciona la aplicación a la que deseas acceder</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {apps.map((app, index) => (
                        <motion.div
                            key={app.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                        >
                            {app.available ? (
                                <Link href={app.href} className="block group h-full">
                                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 hover:border-cyan/50 hover:bg-white/10 transition-all duration-300 h-full flex flex-col shadow-xl hover:shadow-cyan/20">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${app.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                            <app.icon className="h-7 w-7 text-white" />
                                        </div>
                                        <h3 className="text-xl font-black text-white mb-3">{app.name}</h3>
                                        <p className="text-blue-100/60 text-sm mb-8 flex-grow">{app.description}</p>
                                        <div className="flex items-center text-cyan font-bold text-sm group-hover:text-white transition-colors mt-auto">
                                            Abrir aplicación
                                            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-2" />
                                        </div>
                                    </div>
                                </Link>
                            ) : (
                                <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/5 opacity-60 h-full flex flex-col shadow-xl relative overflow-hidden">
                                    <div className="absolute top-4 right-4 bg-white/10 text-white/50 text-[10px] font-black uppercase px-2 py-1 rounded-full tracking-widest">
                                        Próximamente
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-white/10">
                                        <app.icon className="h-7 w-7 text-white/50" />
                                    </div>
                                    <h3 className="text-xl font-black text-white/50 mb-3">{app.name}</h3>
                                    <p className="text-blue-100/40 text-sm mb-8 flex-grow">{app.description}</p>
                                    <div className="flex items-center text-white/30 font-bold text-sm mt-auto">
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
