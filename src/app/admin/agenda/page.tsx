"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Loader2, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight,
    Filter, UserCircle, AlertTriangle, ArrowLeft, List, LayoutGrid, CalendarDays,
    Activity, ClipboardList, Phone, Mail
} from "lucide-react";
import Link from "next/link";
import {
    format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
    startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, eachHourOfInterval, isSameDay, isToday, isPast,
    differenceInMinutes
} from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppointmentAllocation {
    id: string;
    professional_id: string;
    physical_resource_id: string | null;
    starts_at: string;
    ends_at: string;
    profiles?: { full_name: string };
    physical_resources?: { name: string; type: string } | null;
    service_phases?: {
        phase_order: number;
        duration_minutes: number;
        label: string | null;
        sub_services?: { name: string; color: string } | null;
    } | null;
}

interface Appointment {
    id: string;
    patient_id: string;
    service_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    notes: string | null;
    created_at: string;
    patients?: { id: string; full_name: string; email: string | null; phone: string | null };
    services?: { name: string; duration_minutes: number; color: string; is_composite?: boolean };
    appointment_allocations?: AppointmentAllocation[];
}

type ViewMode = "day" | "week" | "month";
type StatusFilter = "all" | "scheduled" | "overdue" | "completed" | "cancelled" | "no_show";

// ─── Helpers ────────────────────────────────────────────────────────────────

function isOverdue(apt: Appointment): boolean {
    return apt.status === "scheduled" && isPast(new Date(apt.ends_at));
}

function getProfessionalName(apt: Appointment): string {
    if (!apt.appointment_allocations || apt.appointment_allocations.length === 0) return "Sin asignar";
    return apt.appointment_allocations[0].profiles?.full_name || "Sin asignar";
}

function getResourceName(apt: Appointment): string | null {
    if (!apt.appointment_allocations) return null;
    const alloc = apt.appointment_allocations.find(a => a.physical_resources);
    return alloc?.physical_resources?.name || null;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    scheduled: { label: "Agendada", bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/20" },
    confirmed: { label: "Confirmada", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
    completed: { label: "Completada", bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/20" },
    cancelled: { label: "Cancelada", bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
    no_show: { label: "No Asistió", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
};

/**
 * Retorna colores planos sólidos, parecidos al ejemplo
 */
function getBlockStyle(apt: Appointment): { style: React.CSSProperties; className: string; textClassName: string } {
    if (apt.status === "cancelled") {
        return {
            style: {
                backgroundColor: "#cbd5e1", // slate-300
                borderColor: "#94a3b8", // slate-400
                borderLeftColor: "#64748b", // slate-500
                borderLeftWidth: "4px"
            },
            className: "opacity-60 grayscale",
            textClassName: "text-slate-600 line-through decoration-slate-500",
        };
    }
    if (isOverdue(apt)) {
        return {
            style: {
                backgroundColor: "#fb923c", // orange-400
                borderColor: "#f97316", // orange-500
                borderLeftWidth: "0px"
            },
            className: "",
            textClassName: "text-white",
        };
    }
    const hex = apt.services?.color || "#3b82f6"; // default blue
    return {
        style: {
            backgroundColor: hex,
            borderColor: "rgba(0,0,0,0.05)",
            borderLeftWidth: "0px" // Usamos todo color solido según la referencia
        },
        className: "",
        textClassName: "text-white",
    };
}

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 21;

// ─── Overlap Layout Algorithm ───────────────────────────────────────────────

interface LayoutInfo {
    appointment: Appointment;
    columnIndex: number;
    totalColumns: number;
}

function calculateOverlapLayout(appointments: Appointment[]): LayoutInfo[] {
    if (appointments.length === 0) return [];

    const sorted = [...appointments].sort((a, b) => {
        const startDiff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
        if (startDiff !== 0) return startDiff;
        return differenceInMinutes(new Date(b.ends_at), new Date(b.starts_at))
            - differenceInMinutes(new Date(a.ends_at), new Date(a.starts_at));
    });

    const groups: Appointment[][] = [];
    let currentGroup: Appointment[] = [];
    let groupEnd = 0;

    for (const apt of sorted) {
        const aptStart = new Date(apt.starts_at).getTime();
        const aptEnd = new Date(apt.ends_at).getTime();

        if (currentGroup.length === 0 || aptStart < groupEnd) {
            currentGroup.push(apt);
            groupEnd = Math.max(groupEnd, aptEnd);
        } else {
            groups.push(currentGroup);
            currentGroup = [apt];
            groupEnd = aptEnd;
        }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    const result: LayoutInfo[] = [];

    for (const group of groups) {
        const columns: Appointment[][] = [];

        for (const apt of group) {
            const aptStart = new Date(apt.starts_at).getTime();
            let placed = false;

            for (let col = 0; col < columns.length; col++) {
                const lastInCol = columns[col][columns[col].length - 1];
                const lastEnd = new Date(lastInCol.ends_at).getTime();
                if (aptStart >= lastEnd) {
                    columns[col].push(apt);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                columns.push([apt]);
            }
        }

        const totalColumns = columns.length;

        for (let col = 0; col < columns.length; col++) {
            for (const apt of columns[col]) {
                result.push({ appointment: apt, columnIndex: col, totalColumns });
            }
        }
    }

    return result;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AgendaPage() {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>("week");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("scheduled");
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

    const dateRange = useMemo(() => {
        switch (viewMode) {
            case "day": return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
            case "week": return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) };
            case "month": return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
        }
    }, [selectedDate, viewMode]);

    const fetchAppointments = useCallback(async (start: Date, end: Date) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/v1/appointments?start_date=${encodeURIComponent(start.toISOString())}&end_date=${encodeURIComponent(end.toISOString())}`
            );
            if (!res.ok) throw new Error("Error al obtener las citas");
            const data = await res.json();
            if (data.success && data.data) {
                setAppointments(data.data as Appointment[]);
            } else {
                throw new Error(data.error?.message || "Error desconocido");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAppointments(dateRange.start, dateRange.end);
    }, [dateRange, fetchAppointments]);

    const filteredAppointments = useMemo(() => {
        if (statusFilter === "all") return appointments;
        if (statusFilter === "overdue") return appointments.filter(a => isOverdue(a));
        if (statusFilter === "scheduled") return appointments.filter(a => a.status === "scheduled" && !isOverdue(a));
        return appointments.filter(a => a.status === statusFilter);
    }, [appointments, statusFilter]);

    const overdueCount = appointments.filter(a => isOverdue(a)).length;

    const uniqueServices = useMemo(() => {
        const servicesMap = new Map<string, { name: string, color: string }>();
        appointments.forEach(apt => {
            if (apt.services) {
                servicesMap.set(apt.services.name, {
                    name: apt.services.name,
                    color: apt.services.color || "#06b6d4"
                });
            }
        });
        return Array.from(servicesMap.values());
    }, [appointments]);

    const goBack = () => {
        switch (viewMode) {
            case "day": setSelectedDate(prev => subDays(prev, 1)); break;
            case "week": setSelectedDate(prev => subWeeks(prev, 1)); break;
            case "month": setSelectedDate(prev => subMonths(prev, 1)); break;
        }
    };
    const goForward = () => {
        switch (viewMode) {
            case "day": setSelectedDate(prev => addDays(prev, 1)); break;
            case "week": setSelectedDate(prev => addWeeks(prev, 1)); break;
            case "month": setSelectedDate(prev => addMonths(prev, 1)); break;
        }
    };
    const goToToday = () => setSelectedDate(new Date());

    const dateLabel = useMemo(() => {
        switch (viewMode) {
            case "day": return format(selectedDate, "EEEE dd 'de' MMMM, yyyy", { locale: es });
            case "week": {
                const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
                return `${format(ws, "dd MMM", { locale: es })} — ${format(we, "dd MMM yyyy", { locale: es })}`;
            }
            case "month": return format(selectedDate, "MMMM yyyy", { locale: es });
        }
    }, [selectedDate, viewMode]);

    const isCurrentPeriod = useMemo(() => {
        const now = new Date();
        switch (viewMode) {
            case "day": return isSameDay(selectedDate, now);
            case "week": return isSameDay(startOfWeek(selectedDate, { weekStartsOn: 1 }), startOfWeek(now, { weekStartsOn: 1 }));
            case "month": return format(selectedDate, "yyyy-MM") === format(now, "yyyy-MM");
        }
    }, [selectedDate, viewMode]);

    return (
        <div className="space-y-4 h-full flex flex-col pt-2">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-[20px] shadow-sm backdrop-blur-md">

                {/* View Actions & Date */}
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={goBack} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-slate-300 hover:text-white" title="Anterior">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    {!isCurrentPeriod && (
                        <button onClick={goToToday} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
                            Hoy
                        </button>
                    )}
                    <button onClick={goForward} className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-slate-300 hover:text-white" title="Siguiente">
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <h2 className="text-xl font-bold text-white capitalize min-w-[200px] ml-2 tracking-tight">
                        {dateLabel}
                    </h2>
                </div>

                {/* Filters & View Toggles */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex items-center bg-black/30 rounded-xl p-1 border border-white/5 shadow-inner">
                        {([
                            { mode: "day" as ViewMode, icon: List, label: "Día" },
                            { mode: "week" as ViewMode, icon: CalendarDays, label: "Semana" },
                            { mode: "month" as ViewMode, icon: LayoutGrid, label: "Mes" },
                        ]).map(({ mode, icon: Icon, label }) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === mode
                                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden md:block"></div>

                    {/* Filter */}
                    <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 px-3 border border-white/5">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className="bg-transparent border-none text-white text-sm font-medium py-1.5 focus:outline-none focus:ring-0 appearance-none cursor-pointer"
                        >
                            <option value="all" className="bg-[#0f172a] text-sm">Todas ({appointments.length})</option>
                            <option value="scheduled" className="bg-[#0f172a] text-sm">Agendadas</option>
                            <option value="overdue" className="bg-[#0f172a] text-sm">Vencidas ({overdueCount})</option>
                            <option value="completed" className="bg-[#0f172a] text-sm">Completadas</option>
                            <option value="cancelled" className="bg-[#0f172a] text-sm">Canceladas</option>
                            <option value="no_show" className="bg-[#0f172a] text-sm">No Asistió</option>
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium text-sm">{error}</p>
                </div>
            )}

            {/* Service Color Legend */}
            {uniqueServices.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mr-2">Servicios:</span>
                    {uniqueServices.map((srv, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">
                            <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: srv.color }} />
                            <span className="text-xs font-semibold text-slate-700">{srv.name}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Calendar View Container */}
            <div className="flex-1 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-2xl min-h-[600px] flex flex-col relative z-0">
                {loading ? (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                        <Loader2 className="h-10 w-10 text-cyan-500 animate-spin mb-4" />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando agenda...</p>
                    </div>
                ) : null}

                {viewMode === "day" && (
                    <DayView
                        date={selectedDate}
                        appointments={filteredAppointments}
                        onSelectAppointment={setSelectedAppointment}
                    />
                )}
                {viewMode === "week" && (
                    <WeekView
                        date={selectedDate}
                        appointments={filteredAppointments}
                        onSelectAppointment={setSelectedAppointment}
                        onNavigateToDay={(d) => { setSelectedDate(d); setViewMode("day"); }}
                    />
                )}
                {viewMode === "month" && (
                    <MonthView
                        date={selectedDate}
                        appointments={filteredAppointments}
                        onSelectAppointment={setSelectedAppointment}
                        onNavigateToDay={(d) => { setSelectedDate(d); setViewMode("day"); }}
                    />
                )}
            </div>

            {selectedAppointment && (
                <AppointmentDetail
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                />
            )}
        </div>
    );
}

// ─── DAY VIEW (Timeline) ───────────────────────────────────────────────────

function DayView({
    date,
    appointments,
    onSelectAppointment,
}: {
    date: Date;
    appointments: Appointment[];
    onSelectAppointment: (a: Appointment) => void;
}) {
    const hours = Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }, (_, i) => WORK_START_HOUR + i);
    const HOUR_HEIGHT = 90; // generous height for readability

    const dayAppointments = appointments.filter(a =>
        isSameDay(new Date(a.starts_at), date)
    );

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 relative">

            {/* Day Header - Sticky */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200 py-4 px-6 flex items-center gap-4 shadow-sm">
                <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl ${isToday(date) ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30" : "bg-slate-100 text-slate-700"} flex-shrink-0`}>
                    <span className="text-xs uppercase font-bold tracking-wider">{format(date, "EEE", { locale: es })}</span>
                    <span className="text-2xl font-black">{format(date, "d")}</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800">
                        {isToday(date) ? "Agenda de Hoy" : format(date, "EEEE, d 'de' MMMM", { locale: es })}
                    </h3>
                    <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" />
                        {dayAppointments.length} citas programadas
                    </p>
                </div>
            </div>

            <div className="relative mt-4" style={{ minHeight: hours.length * HOUR_HEIGHT + 40 }}>
                {/* Grid */}
                {hours.map((hour) => {
                    const top = (hour - WORK_START_HOUR) * HOUR_HEIGHT;
                    return (
                        <div key={hour} className="absolute left-0 right-0 flex" style={{ top }}>
                            <div className="w-20 flex-shrink-0 text-right pr-6 pt-1 text-xs font-bold text-slate-400 tracking-wider">
                                {String(hour).padStart(2, "0")}:00
                            </div>
                            <div className="flex-1 border-t-2 border-slate-200/60 border-dashed" />
                        </div>
                    );
                })}

                {/* Now Indicator */}
                {isToday(date) && (() => {
                    const now = new Date();
                    const minutesSinceStart = (now.getHours() - WORK_START_HOUR) * 60 + now.getMinutes();
                    const top = (minutesSinceStart / 60) * HOUR_HEIGHT;
                    if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
                    return (
                        <div className="absolute left-20 right-0 z-30 flex items-center pointer-events-none" style={{ top }}>
                            <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-md ring-4 ring-cyan-500/20 -ml-1.5" />
                            <div className="flex-1 h-0.5 bg-cyan-500/80" />
                        </div>
                    );
                })()}

                {/* Cards */}
                <div className="absolute left-24 right-6 top-0 bottom-0">
                    {calculateOverlapLayout(dayAppointments).map(({ appointment: apt, columnIndex, totalColumns }) => {
                        const start = new Date(apt.starts_at);
                        const end = new Date(apt.ends_at);
                        const topMin = (start.getHours() - WORK_START_HOUR) * 60 + start.getMinutes();
                        const durationMin = differenceInMinutes(end, start);
                        const top = (topMin / 60) * HOUR_HEIGHT;
                        const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 40);
                        const blockStyle = getBlockStyle(apt);
                        const widthPercent = 100 / totalColumns;
                        const leftPercent = columnIndex * widthPercent;

                        return (
                            <button
                                key={apt.id}
                                onClick={() => onSelectAppointment(apt)}
                                className={`absolute rounded-xl border p-3 cursor-pointer text-left flex flex-col group
                                    transition-all duration-300 ease-out hover:shadow-2xl hover:z-50 focus:outline-none focus:ring-2 focus:ring-cyan-500
                                    ${blockStyle.className}`}
                                style={{
                                    top,
                                    height: height - 4,
                                    left: `calc(${leftPercent}% + 4px)`,
                                    width: `calc(${widthPercent}% - 8px)`,
                                    zIndex: 10 + columnIndex,
                                    ...blockStyle.style,
                                }}
                            >
                                <div className="flex flex-row items-center gap-3 h-full relative w-full px-2">
                                    {/* Indicador de Tiempos */}
                                    <div className={`flex items-center gap-1.5 flex-shrink-0 text-left bg-black/10 px-2 py-1 rounded-md shadow-inner border border-white/10 ${blockStyle.textClassName}`}>
                                        <Clock className="w-3.5 h-3.5 opacity-80" />
                                        <span className="text-xs md:text-sm font-black tracking-tight leading-none drop-shadow-sm">{format(start, "HH:mm")}</span>
                                        {height >= 40 && (
                                            <>
                                                <span className="text-[10px] md:text-sm font-semibold opacity-60">-</span>
                                                <span className="text-xs md:text-sm font-semibold opacity-90 leading-none drop-shadow-sm">{format(end, "HH:mm")}</span>
                                            </>
                                        )}
                                    </div>

                                    {/* Division Vertical Opcional */}
                                    {height >= 40 && <div className="w-px h-6 bg-white/20 hidden sm:block"></div>}

                                    {/* Información Principal de Cita */}
                                    <div className={`flex flex-row items-center flex-wrap sm:flex-nowrap gap-x-4 gap-y-1 overflow-hidden w-full ${blockStyle.textClassName}`}>
                                        {/* Nombre Paciente */}
                                        <div className="flex items-center gap-2 min-w-0 shrink-0">
                                            <span className="text-sm md:text-base font-bold truncate leading-tight drop-shadow-md">
                                                {apt.patients?.full_name || "Paciente no especificado"}
                                            </span>
                                        </div>

                                        {/* Detalles Servicio y Profesional (solo si hay espacio/altura) */}
                                        {height >= 40 && (
                                            <div className="flex items-center gap-3 min-w-0 opacity-90 text-[11px] md:text-xs font-medium">
                                                <span className="flex items-center gap-1.5 truncate drop-shadow-sm bg-black/5 px-2 py-0.5 rounded-full border border-white/10 hidden md:flex">
                                                    <Activity className="w-3 h-3" /> <span className="truncate">{apt.services?.name}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 truncate drop-shadow-sm text-white/80">
                                                    <UserCircle className="w-3.5 h-3.5" /> <span className="truncate">{getProfessionalName(apt)}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Icono de advertencia absolute a la derecha */}
                                    {isOverdue(apt) && (
                                        <AlertTriangle className="absolute top-1/2 -translate-y-1/2 right-2 w-4 h-4 text-white drop-shadow-sm" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {dayAppointments.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center mt-20 pointer-events-none">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
                            <CalendarIcon className="w-12 h-12 text-slate-300 mb-3" />
                            <h3 className="text-slate-500 font-bold">Día despejado</h3>
                            <p className="text-slate-400 text-sm">No hay citas programadas para hoy</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── WEEK VIEW (7-column grid) ──────────────────────────────────────────────

function getCompactPatientName(fullName: string | undefined): string {
    if (!fullName) return "P.";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1][0]}.`;
}

function WeekView({
    date,
    appointments,
    onSelectAppointment,
    onNavigateToDay,
}: {
    date: Date;
    appointments: Appointment[];
    onSelectAppointment: (a: Appointment) => void;
    onNavigateToDay: (d: Date) => void;
}) {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: endOfWeek(date, { weekStartsOn: 1 }) });
    const hours = Array.from({ length: WORK_END_HOUR - WORK_START_HOUR }, (_, i) => WORK_START_HOUR + i);
    const HOUR_HEIGHT = 80; // slightly taller for more breathing room

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            {/* Headers */}
            <div className="z-30 bg-white border-b border-slate-200 flex sticky top-0 shadow-sm">
                <div className="w-16 flex-shrink-0 border-r border-slate-100 bg-slate-50/50" />
                {weekDays.map((day) => {
                    const today = isToday(day);
                    const dayAptCount = appointments.filter(a => isSameDay(new Date(a.starts_at), day)).length;

                    return (
                        <div key={day.toISOString()} className="flex-1 py-3 px-1 border-r border-slate-100 relative group min-w-0">
                            <button
                                onClick={() => onNavigateToDay(day)}
                                className={`w-full flex flex-col items-center justify-center rounded-2xl py-2 px-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${today ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "hover:bg-slate-100"
                                    }`}
                            >
                                <div className={`text-[10px] md:text-xs uppercase tracking-widest font-black ${today ? "text-cyan-100" : "text-slate-400"}`}>
                                    {format(day, "EEE", { locale: es })}
                                </div>
                                <div className={`text-xl md:text-3xl font-black mt-0.5 ${today ? "text-white" : "text-slate-800"}`}>
                                    {format(day, "d")}
                                </div>

                                {dayAptCount > 0 && (
                                    <div className={`mt-1 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${today ? "bg-white/20 text-white" : "bg-slate-200/60 text-slate-600"}`}>
                                        <Activity className="w-3 h-3 shrink-0" />
                                        <span>{dayAptCount}</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
                <div className="relative flex" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
                    {/* Time Column */}
                    <div className="w-16 flex-shrink-0 bg-slate-50 border-r border-slate-100 sticky left-0 z-20">
                        {hours.map((hour) => (
                            <div
                                key={hour}
                                className="text-right pr-3 text-xs font-bold text-slate-400 tracking-wider relative"
                                style={{ height: HOUR_HEIGHT }}
                            >
                                <span className="absolute right-3 -top-2.5 bg-slate-50 px-1">{String(hour).padStart(2, "0")}:00</span>
                            </div>
                        ))}
                    </div>

                    {/* Columns Wrapper */}
                    <div className="flex flex-1 relative">
                        {/* Continuous Grid Lines underneath everything */}
                        <div className="absolute inset-0 pointer-events-none grid grid-rows-[repeat(13,80px)]">
                            {hours.map(h => (
                                <div key={h} className="border-t border-slate-100" />
                            ))}
                        </div>

                        {/* Current Time Line spanning across all columns */}
                        {isSameDay(startOfWeek(date, { weekStartsOn: 1 }), startOfWeek(new Date(), { weekStartsOn: 1 })) && (() => {
                            const now = new Date();
                            const minSince = (now.getHours() - WORK_START_HOUR) * 60 + now.getMinutes();
                            const topPx = (minSince / 60) * HOUR_HEIGHT;
                            if (topPx >= 0 && topPx <= hours.length * HOUR_HEIGHT) {
                                return (
                                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: topPx }}>
                                        <div className="w-full h-0.5 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                                    </div>
                                );
                            }
                        })()}

                        {weekDays.map((day) => {
                            const dayApts = appointments.filter(a => isSameDay(new Date(a.starts_at), day));
                            const today = isToday(day);
                            // Obtenemos layout con las columnas calculadas
                            const layout = calculateOverlapLayout(dayApts);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={`flex-1 relative border-r border-slate-100 group/day ${today ? "bg-cyan-50/20" : ""}`}
                                >
                                    {/* Appointment Cards en Cascada */}
                                    {layout.map(({ appointment: apt, columnIndex, totalColumns }) => {
                                        const start = new Date(apt.starts_at);
                                        const end = new Date(apt.ends_at);
                                        const topMin = (start.getHours() - WORK_START_HOUR) * 60 + start.getMinutes();
                                        const durationMin = differenceInMinutes(end, start);
                                        const topPx = (topMin / 60) * HOUR_HEIGHT;
                                        const heightPx = Math.max((durationMin / 60) * HOUR_HEIGHT, 24);
                                        const blockStyle = getBlockStyle(apt);

                                        // Efecto Cascada:
                                        // Si están exactamente a la misma hora y compiten de inicio a fin (ej: totalColumns = 2) -> compartiran width como 50% y 50%
                                        // Pero como nuestro layout básico ya numera índices de columnas, podemos hacer lo siguiente:
                                        const isStrictOverlap = totalColumns > 1 && layout.filter(l =>
                                            new Date(l.appointment.starts_at).getTime() === start.getTime()
                                        ).length > 1;

                                        let lPct = columnIndex * (100 / totalColumns);
                                        let wPct = 100 / totalColumns;

                                        // Si NO son estrictamente superpuestas al inicio (efecto escalera del mié 11):
                                        if (!isStrictOverlap && totalColumns > 1) {
                                            // Desplazamos un % a la derecha para que se lea la de atrás
                                            const offsetStep = 15; // 15% por cada "nivel" de solapamiento
                                            lPct = Math.min(columnIndex * offsetStep, 60);
                                            // Ocupa hasta el 95% o el 100% de la celda de ancho, para solapar a la otra
                                            wPct = 95 - lPct;
                                        }

                                        return (
                                            <button
                                                key={apt.id}
                                                onClick={() => onSelectAppointment(apt)}
                                                className={`absolute rounded-sm border cursor-pointer text-left flex flex-col overflow-hidden
                                                    transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-white
                                                    hover:shadow-[0_8px_16px_rgba(0,0,0,0.3)] hover:z-50 border-white/20
                                                    ${blockStyle.className}`}
                                                style={{
                                                    top: topPx,
                                                    height: heightPx - 1, // -1 para borde suave abajo
                                                    left: `calc(${lPct}%)`,
                                                    width: `calc(${wPct}%)`,
                                                    zIndex: 10 + columnIndex + (start.getTime() % 100), // Las más tardías se dibujan sobre las primeras
                                                    ...blockStyle.style,
                                                    padding: heightPx < 30 ? "2px 4px" : "4px 6px",
                                                    boxShadow: totalColumns > 1 ? "-2px 2px 5px rgba(0,0,0,0.15)" : "none", // Sombra lateral para separar solapes
                                                }}
                                            >
                                                <div className="flex flex-col h-full w-full justify-center items-center text-center relative pt-0.5">
                                                    <div className={`text-[11px] sm:text-sm font-black tracking-tighter leading-none ${blockStyle.textClassName}`}>
                                                        {format(start, "HH:mm")}
                                                    </div>
                                                    {heightPx >= 35 && (
                                                        <div className={`text-[9px] sm:text-[10px] font-semibold opacity-90 mt-1 ${blockStyle.textClassName}`}>
                                                            {format(end, "HH:mm")}
                                                        </div>
                                                    )}
                                                </div>

                                                {isOverdue(apt) && (
                                                    <AlertTriangle className="absolute top-1 right-1 w-3 h-3 text-white drop-shadow-sm" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── MONTH VIEW (Calendar grid) ─────────────────────────────────────────────

function MonthView({
    date,
    appointments,
    onSelectAppointment,
    onNavigateToDay,
}: {
    date: Date;
    appointments: Appointment[];
    onSelectAppointment: (a: Appointment) => void;
    onNavigateToDay: (d: Date) => void;
}) {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    const appointmentsByDay = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        appointments.forEach(apt => {
            const dayKey = format(new Date(apt.starts_at), "yyyy-MM-dd");
            if (!map.has(dayKey)) map.set(dayKey, []);
            map.get(dayKey)!.push(apt);
        });
        return map;
    }, [appointments]);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 rounded-b-2xl">
            {/* Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-white shadow-sm z-10">
                {weekDayLabels.map((day) => (
                    <div key={day} className="text-center py-4 text-xs text-slate-400 font-bold uppercase tracking-widest border-r border-slate-100 last:border-r-0">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px border-b border-slate-200 overflow-y-auto">
                {calendarDays.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayApts = appointmentsByDay.get(dayKey) || [];
                    const isCurrentMonth = day.getMonth() === date.getMonth();
                    const today = isToday(day);

                    // Sort appointments for the day to show chronologically
                    const sortedApts = [...dayApts].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

                    // Cap at 3 for rendering small badges
                    const visibleApts = sortedApts.slice(0, 3);
                    const overflow = sortedApts.length - 3;

                    return (
                        <div
                            key={dayKey}
                            className={`flex flex-col bg-white p-2 min-h-[140px] transition-colors group ${!isCurrentMonth ? "bg-slate-50/60" : "hover:bg-slate-50"
                                } ${today ? "ring-2 ring-inset ring-cyan-500 bg-cyan-50/10" : ""}`}
                            onClick={(e) => {
                                // Only navigate if clicking the background, not the specific appointment
                                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'DIV') {
                                    onNavigateToDay(day);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            {/* Day Number Header */}
                            <div className="flex justify-between items-center mb-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNavigateToDay(day); }}
                                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all
                                        hover:scale-110 focus:outline-none focus:ring-2 focus:ring-cyan-500
                                        ${today ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/30" : isCurrentMonth ? "text-slate-800 hover:bg-slate-200" : "text-slate-400 hover:bg-slate-200"}`}
                                >
                                    {format(day, "d")}
                                </button>
                                {dayApts.length > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400 px-2 py-1 rounded bg-slate-100">
                                        {dayApts.length} citas
                                    </span>
                                )}
                            </div>

                            {/* Appointment Badges */}
                            <div className="flex-1 space-y-1 overflow-visible">
                                {visibleApts.map((apt) => {
                                    const style = getBlockStyle(apt);
                                    return (
                                        <button
                                            key={apt.id}
                                            onClick={(e) => { e.stopPropagation(); onSelectAppointment(apt); }}
                                            className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] hover:shadow-md hover:scale-[1.02] hover:z-10 relative transition-transform
                                                ${style.className}`}
                                            style={style.style}
                                            title={`${format(new Date(apt.starts_at), "HH:mm")} - ${apt.patients?.full_name}`}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span className="font-bold shrink-0">{format(new Date(apt.starts_at), "HH:mm")}</span>
                                                <span className="font-semibold opacity-70 text-[9px]">- {format(new Date(apt.ends_at), "HH:mm")}</span>
                                            </div>
                                        </button>
                                    );
                                })}

                                {overflow > 0 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNavigateToDay(day); }}
                                        className="w-full text-left text-[11px] font-bold text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 p-1.5 rounded transition-colors"
                                    >
                                        + {overflow} citas más...
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Appointment Detail Modal ───────────────────────────────────────────────

function AppointmentDetail({
    appointment: apt,
    onClose,
}: {
    appointment: Appointment;
    onClose: () => void;
}) {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const overdue = isOverdue(apt);
    const serviceColor = apt.services?.color || "#3b82f6"; // default blue

    return (


        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 duration-200 ease-in-out
                ${isClosing ? "animate-out fade-out opacity-0" : "animate-in fade-in"}`}
            onClick={handleClose}
        >
            <div
                className={`w-full max-w-md shadow-2xl overflow-hidden rounded-sm duration-200 ease-in-out relative
                    ${isClosing ? "animate-out zoom-out-95 opacity-0 scale-95" : "animate-in zoom-in-105 scale-100"}`}
                onClick={(e) => e.stopPropagation()}
                style={{ backgroundColor: serviceColor }}
            >
                {/* Doblez del Post-it (Efecto visual) */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-bl-lg" style={{ boxShadow: "-2px 2px 5px rgba(0,0,0,0.1)" }}></div>

                {/* Header */}
                <div className="p-6 pb-2 relative text-white">
                    <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white bg-black/20 hover:bg-black/40 rounded-full transition-colors font-bold text-center z-10 shadow-sm backdrop-blur-sm ring-1 ring-white/20">
                        &times;
                    </button>

                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-bold text-white/90 bg-black/10 px-2 py-1 rounded-sm backdrop-blur-sm shadow-sm ring-1 ring-white/20">
                            {format(new Date(apt.starts_at), "dd MMM yy")}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white px-2 py-1 rounded-sm border border-white/30 bg-white/10">
                            {apt.status === "cancelled" ? "Cancelada" : overdue ? "Vencida" : apt.status}
                        </span>
                    </div>

                    <h2 className="text-3xl font-black tracking-tight leading-none mb-2 drop-shadow-md">
                        {apt.patients?.full_name || "Paciente no especificado"}
                    </h2>

                    {apt.services?.name && (
                        <h3 className="text-sm font-bold opacity-90 flex items-center gap-1.5 drop-shadow-sm">
                            <Activity className="w-4 h-4" />
                            {apt.services.name}
                        </h3>
                    )}
                </div>

                {/* Body details */}
                <div className="p-6 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <DetailCard icon={<Clock />} title="Horario" value={`${format(new Date(apt.starts_at), "HH:mm")} - ${format(new Date(apt.ends_at), "HH:mm")}`} />
                        <DetailCard icon={<UserCircle />} title="Profesional" value={getProfessionalName(apt)} />
                        {getResourceName(apt) && (
                            <DetailCard icon={<LayoutGrid />} title="Recurso" value={getResourceName(apt)!} />
                        )}
                        {apt.patients?.phone && (
                            <DetailCard icon={<Phone />} title="Teléfono" value={apt.patients.phone} />
                        )}
                        {apt.patients?.email && (
                            <DetailCard icon={<Mail />} title="Correo Electrónico" value={apt.patients.email} />
                        )}
                    </div>

                    {/* Timeline de Fases apiladas en columna (solo visible si es un servicio compuesto) */}
                    {apt.services?.is_composite && apt.appointment_allocations && apt.appointment_allocations.length > 0 && (
                        <div className="bg-black/10 rounded-sm p-4 border border-white/20 mt-4 shadow-inner">
                            <h4 className="text-xs font-bold text-white/70 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Activity className="w-4 h-4" /> Desglose de Fases
                            </h4>
                            <div className="flex flex-col gap-2.5 relative">
                                {apt.appointment_allocations
                                    .slice()
                                    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                                    .map((alloc, idx) => {
                                        const allocStart = new Date(alloc.starts_at);
                                        const allocEnd = new Date(alloc.ends_at);
                                        const subService = alloc.service_phases?.sub_services;
                                        const phaseLabel = alloc.service_phases?.label || subService?.name || `Fase ${idx + 1}`;

                                        // Color específico subservicio. Si no existe, usamos una semitransparencia sutil del post-it.
                                        const phaseColor = subService?.color || "rgba(255,255,255,0.15)";

                                        const profName = alloc.profiles?.full_name || "Sin asignar";
                                        const resName = alloc.physical_resources?.name || "";

                                        return (
                                            <div
                                                key={alloc.id}
                                                className="relative flex flex-col p-3 rounded-sm text-white shadow-sm border border-white/20 transition-transform hover:-translate-y-0.5"
                                                style={{ backgroundColor: phaseColor }}
                                            >
                                                {/* Efecto de pliegue interno en la tarjetita */}
                                                <div className="absolute top-0 right-0 w-3 h-3 bg-white/20 rounded-bl-sm" style={{ boxShadow: "-1px 1px 2px rgba(0,0,0,0.1)" }}></div>

                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black/20 text-[10px] font-black shrink-0 shadow-inner">
                                                            {idx + 1}
                                                        </span>
                                                        <h5 className="font-bold text-sm drop-shadow-sm">{phaseLabel}</h5>
                                                    </div>
                                                    <div className="text-[10px] bg-black/20 px-2 py-0.5 rounded-sm font-bold tracking-widest text-right shrink-0 border border-white/10 shadow-inner">
                                                        {format(allocStart, "HH:mm")} - {format(allocEnd, "HH:mm")}
                                                    </div>
                                                </div>

                                                <div className="flex gap-4 text-[10px] font-semibold text-white/90 mt-1 bg-black/10 p-2 rounded-sm border border-white/10 shadow-inner flex-wrap">
                                                    <div className="flex items-center gap-1.5 drop-shadow-sm">
                                                        <UserCircle className="w-3.5 h-3.5 opacity-80" /> {profName}
                                                    </div>
                                                    {resName && (
                                                        <div className="flex items-center gap-1.5 drop-shadow-sm">
                                                            <LayoutGrid className="w-3.5 h-3.5 opacity-80" /> {resName}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {apt.notes && (
                        <div className="bg-black/10 rounded-sm p-4 border border-white/20 mt-4 shadow-inner">
                            <h4 className="text-xs font-bold text-white/70 uppercase tracking-widest flex items-center gap-2 mb-2">
                                <ClipboardList className="w-4 h-4" /> Notas
                            </h4>
                            <p className="text-sm text-white font-medium whitespace-pre-wrap">{apt.notes}</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

function DetailCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
    return (
        <div className="flex items-start gap-2.5 p-3 rounded-sm bg-black/10 border border-white/20 shadow-sm backdrop-blur-sm">
            <div className="p-1.5 bg-white/20 rounded shadow-inner text-white">
                {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 drop-shadow-sm" })}
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-black text-white/70 uppercase tracking-wider mb-0.5">{title}</p>
                <p className="text-xs font-bold text-white truncate drop-shadow-sm">{value}</p>
            </div>
        </div>
    );
}
