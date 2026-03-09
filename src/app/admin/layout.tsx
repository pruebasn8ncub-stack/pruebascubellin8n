"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, LayoutDashboard, CalendarDays, Users, UserCog, Briefcase, Box, Clock, CalendarOff, LogOut } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="h-10 w-10 animate-spin text-teal" />
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

    const isDashboard = pathname === "/admin/dashboard";

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Sidebar — only inside apps, sticky while scrolling */}
            {!isDashboard && (
                <aside className="w-64 hidden md:flex flex-col border-r border-slate-200 bg-white sticky top-0 h-screen overflow-y-auto">
                    <nav className="flex-1 px-3 space-y-1 mt-4">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm",
                                        isActive
                                            ? "text-white shadow-lg"
                                            : "text-white/80 hover:text-white hover:shadow-md"
                                    )}
                                    style={isActive ? {
                                        background: "linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)",
                                        boxShadow: "0 4px 15px var(--teal-glow)",
                                    } : {
                                        background: "linear-gradient(135deg, #0d3d72 0%, #092d55 100%)",
                                    }}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="p-4 border-t border-slate-100">
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-red-400 hover:bg-red-50 transition-colors text-sm font-medium"
                        >
                            <LogOut className="w-5 h-5" />
                            Cerrar Sesión
                        </button>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-slate-50 text-slate-800">
                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
