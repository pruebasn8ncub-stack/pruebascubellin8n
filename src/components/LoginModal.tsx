"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, Loader2, X } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError("Credenciales incorrectas: " + signInError.message);
                setLoading(false);
                return;
            }

            onClose();
            router.push("/admin/dashboard");
        } catch (err: any) {
            setError(err.message || "Error de red al intentar iniciar sesión");
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-navy/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", duration: 0.5 }}
                            className="w-full max-w-md bg-white rounded-[2.5rem] relative overflow-hidden shadow-2xl pointer-events-auto border border-gray-200"
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-20"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="p-8 md:p-10 relative z-10">
                                <div className="mb-8 flex justify-center">
                                    <div className="p-3">
                                        <Image
                                            src="/images/logo_innovakine.png"
                                            alt="Innovakine Logo"
                                            width={150}
                                            height={40}
                                            className="object-contain"
                                            priority
                                        />
                                    </div>
                                </div>

                                <div className="text-center mb-8">
                                    <div className="w-14 h-14 bg-gradient-to-br from-cyan to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan/20">
                                        <Lock className="h-7 w-7 text-white" />
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Acceso Privado</h2>
                                    <p className="text-gray-500 text-sm mt-2">Portal exclusivo para especialistas</p>
                                </div>

                                <form onSubmit={handleLogin} className="space-y-5">
                                    {error && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-xl text-center"
                                        >
                                            Credenciales incorrectas.
                                        </motion.div>
                                    )}

                                    <div className="space-y-4">
                                        <div>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Mail className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    id="email"
                                                    type="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-all"
                                                    placeholder="Correo Electrónico"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                    <Lock className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    id="password"
                                                    type="password"
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3.5 pl-11 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan focus:border-transparent transition-all"
                                                    placeholder="Contraseña"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-cyan text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 mt-8 hover:bg-cyan-light hover:shadow-lg hover:shadow-cyan/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                Ingresar al Sistema
                                                <ArrowRight className="h-5 w-5" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
