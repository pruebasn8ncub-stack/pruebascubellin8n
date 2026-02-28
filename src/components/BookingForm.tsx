"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const bookingSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres."),
    rut: z.string().min(8, "RUT no válido").regex(/^[0-9]+-[0-9kK]{1}$/, "Formato RUT inválido (ej: 12345678-9)"),
    email: z.string().email("Debe ser un correo electrónico válido."),
    phone: z.string().min(8, "El teléfono debe tener al menos 8 dígitos."),
    specialty: z.string().min(1, "Debe seleccionar una especialidad."),
    message: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingForm() {
    const [isSuccess, setIsSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<BookingFormValues>({
        resolver: zodResolver(bookingSchema),
    });

    const onSubmit = async (data: BookingFormValues) => {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        console.log("Form submitted:", data);
        setIsSuccess(true);
        reset();

        // Reset success message after 10 seconds
        setTimeout(() => {
            setIsSuccess(false);
        }, 10000);
    };

    return (
        <section id="agendar" className="py-12 md:py-20 lg:py-32 bg-surface relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-bg-main -skew-x-12 transform origin-top-right z-0 hidden lg:block" />

            <div className="container relative z-10">
                <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">

                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-cyan-light px-4 py-2 mb-6 text-cyan-dark">
                            <span className="text-xs font-bold uppercase tracking-widest font-sans">Agendamiento Web</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-navy mb-4 md:mb-6 tracking-tight leading-tight">
                            Solicita tu hora médica de forma rápida y segura
                        </h2>
                        <p className="text-text-muted text-lg mb-10 leading-relaxed font-medium">
                            Completa el formulario y una de nuestras ejecutivas te contactará a la brevedad para confirmar tu reserva, considerando la disponibilidad de nuestros especialistas.
                        </p>

                        <div className="flex flex-col gap-4 md:gap-6">
                            {[
                                { step: "1", title: "Ingresa tus datos", desc: "Asegúrate de que tu información de contacto sea correcta." },
                                { step: "2", title: "Selecciona especialidad", desc: "Indícanos el tipo de consulta o examen que necesitas." },
                                { step: "3", title: "Confirmación", desc: "Te llamaremos para agendar exactamente el día y la hora." }
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-5 group">
                                    <div className="mt-1 flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-light text-cyan-dark font-black transition-transform group-hover:scale-110">
                                        {item.step}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-navy text-lg">{item.title}</h4>
                                        <p className="text-sm text-text-muted font-medium">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg border border-border p-5 md:p-12 relative overflow-hidden">
                        <AnimatePresence>
                            {isSuccess && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute inset-0 z-20 bg-white/98 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl text-center p-8"
                                >
                                    <div className="h-20 w-20 bg-success/10 text-success rounded-full flex items-center justify-center mb-6 shadow-sm">
                                        <CheckCircle2 className="h-10 w-10" />
                                    </div>
                                    <h3 className="text-2xl font-black text-navy mb-3">¡Solicitud Enviada!</h3>
                                    <p className="text-text-muted font-medium text-lg leading-relaxed max-w-xs mx-auto">
                                        Nos pondremos en contacto contigo prontamente para confirmar tu hora médica.
                                    </p>
                                    <button
                                        onClick={() => setIsSuccess(false)}
                                        className="mt-8 text-sm font-bold text-cyan hover:text-cyan-dark transition-colors uppercase tracking-widest"
                                    >
                                        Enviar otra solicitud
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-bold text-navy uppercase tracking-wider">Nombre Completo *</label>
                                    <input
                                        id="name"
                                        {...register("name")}
                                        className={cn(
                                            "w-full rounded-xl border px-4 py-4 text-sm outline-none transition-all font-medium",
                                            errors.name
                                                ? "border-error bg-error/5 focus:border-error"
                                                : "border-border bg-bg-main focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light"
                                        )}
                                        placeholder="Ej. Juan Pérez"
                                    />
                                    {errors.name && <p className="text-xs font-bold text-error mt-1">{errors.name.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="rut" className="text-sm font-bold text-navy uppercase tracking-wider">RUT *</label>
                                    <input
                                        id="rut"
                                        {...register("rut")}
                                        className={cn(
                                            "w-full rounded-xl border px-4 py-4 text-sm outline-none transition-all font-medium",
                                            errors.rut
                                                ? "border-error bg-error/5 focus:border-error"
                                                : "border-border bg-bg-main focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light"
                                        )}
                                        placeholder="12345678-9"
                                    />
                                    {errors.rut && <p className="text-xs font-bold text-error mt-1">{errors.rut.message}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-bold text-navy uppercase tracking-wider">Correo Electrónico *</label>
                                    <input
                                        id="email"
                                        type="email"
                                        {...register("email")}
                                        className={cn(
                                            "w-full rounded-xl border px-4 py-4 text-sm outline-none transition-all font-medium",
                                            errors.email
                                                ? "border-error bg-error/5 focus:border-error"
                                                : "border-border bg-bg-main focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light"
                                        )}
                                        placeholder="correo@ejemplo.com"
                                    />
                                    {errors.email && <p className="text-xs font-bold text-error mt-1">{errors.email.message}</p>}
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-bold text-navy uppercase tracking-wider">Teléfono *</label>
                                    <input
                                        id="phone"
                                        type="tel"
                                        {...register("phone")}
                                        className={cn(
                                            "w-full rounded-xl border px-4 py-4 text-sm outline-none transition-all font-medium",
                                            errors.phone
                                                ? "border-error bg-error/5 focus:border-error"
                                                : "border-border bg-bg-main focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light"
                                        )}
                                        placeholder="+56 9 1234 5678"
                                    />
                                    {errors.phone && <p className="text-xs font-bold text-error mt-1">{errors.phone.message}</p>}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="specialty" className="text-sm font-bold text-navy uppercase tracking-wider">Especialidad / Servicio *</label>
                                <div className="relative">
                                    <select
                                        id="specialty"
                                        {...register("specialty")}
                                        className={cn(
                                            "w-full rounded-xl border px-4 py-4 text-sm outline-none transition-all appearance-none font-medium bg-bg-main",
                                            errors.specialty
                                                ? "border-error bg-error/5 focus:border-error"
                                                : "border-border focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light"
                                        )}
                                    >
                                        <option value="">Selecciona una opción...</option>
                                        <option value="medicina_general">Medicina General</option>
                                        <option value="kinesiologia">Kinesiología</option>
                                        <option value="examenes">Exámenes de Laboratorio</option>
                                        <option value="telemedicina">Telemedicina</option>
                                        <option value="otro">Otro</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                                        <motion.div animate={{ y: [0, 2, 0] }} transition={{ repeat: Infinity, duration: 2 }}>↓</motion.div>
                                    </div>
                                </div>
                                {errors.specialty && <p className="text-xs font-bold text-error mt-1">{errors.specialty.message}</p>}
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="message" className="text-sm font-bold text-navy uppercase tracking-wider">Comentarios Adicionales</label>
                                <textarea
                                    id="message"
                                    rows={3}
                                    {...register("message")}
                                    className="w-full rounded-xl border border-border bg-bg-main px-4 py-4 text-sm outline-none transition-all focus:border-cyan focus:bg-white focus:ring-4 focus:ring-cyan-light resize-none font-medium"
                                    placeholder="¿Alguna información importante que debamos saber?"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-cyan px-6 py-4 md:px-8 md:py-5 text-base font-black text-white transition-all hover:bg-cyan-dark disabled:opacity-70 disabled:cursor-not-allowed shadow-btn hover:shadow-btn-hover hover:-translate-y-1"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Procesando Envio...
                                    </>
                                ) : (
                                    "Solicitar Hora Ahora"
                                )}
                            </button>

                            <p className="text-center text-xs text-text-muted font-bold uppercase tracking-tight opacity-70">
                                Tus datos están seguros con nosotros • Innovakine 2024
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}

