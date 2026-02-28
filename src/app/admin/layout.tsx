"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, LayoutDashboard, CalendarDays, Users, UserCog, Briefcase, Box, Clock, CalendarOff, LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push("/");
            } else {
                setLoading(false);
            }
        };

        checkUser();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen bg-navy flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-cyan animate-spin" />
            </div>
        );
    }

    const navigation = [
        { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Agenda", href: "/admin/agenda", icon: CalendarDays },
        { name: "Pacientes", href: "/admin/patients", icon: Users },
        { name: "Profesionales", href: "/admin/professionals", icon: UserCog },
        { name: "Servicios", href: "/admin/services", icon: Briefcase },
        { name: "Recursos Físicos", href: "/admin/resources", icon: Box },
        { name: "Horarios Profesionales", href: "/admin/schedules", icon: Clock },
        { name: "Excepciones", href: "/admin/exceptions", icon: CalendarOff },
    ];

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push("/");
    }

    return (
        <div className="min-h-screen bg-navy text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white/5 border-r border-white/10 hidden md:flex flex-col">
                <div className="p-6">
                    <h2 className="text-xl font-bold tracking-tight text-white">Innovakine Admin</h2>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                                    isActive
                                        ? "bg-cyan text-white shadow-lg shadow-cyan/20"
                                        : "text-blue-100/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-400 hover:bg-red-500/10 transition-colors text-sm font-medium"
                    >
                        <LogOut className="w-5 h-5" />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
