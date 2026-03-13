"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Loader2, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight,
    Filter, UserCircle, AlertTriangle, ArrowLeft, List, LayoutGrid, CalendarDays,
    Activity, ClipboardList, Phone, Mail, Plus, X, Save, Pencil,
    Users, Briefcase, UserCog, ChevronDown, ChevronUp, Search
} from "lucide-react";
import {
    format, addDays, subDays, addMonths, subMonths,
    startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameDay, isToday, isPast,
    differenceInMinutes
} from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

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

type ViewMode = "month" | "day";
type StatusFilter = "all" | "scheduled" | "overdue" | "completed" | "cancelled" | "no_show";

interface Patient { id: string; full_name: string; email: string; phone: string }
interface Service { id: string; name: string; duration_minutes: number; color: string; is_composite: boolean }
interface Professional { id: string; full_name: string }

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
    scheduled: { label: "Agendada", bg: "bg-teal/10", text: "text-teal-dark", border: "border-teal/20" },
    confirmed: { label: "Confirmada", bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20" },
    completed: { label: "Completada", bg: "bg-gray-500/10", text: "text-gray-500", border: "border-gray-500/20" },
    cancelled: { label: "Cancelada", bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/20" },
    no_show: { label: "No Asistió", bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/20" },
};

function getBlockStyle(apt: Appointment): { style: React.CSSProperties; className: string; textClassName: string } {
    if (apt.status === "cancelled") {
        return {
            style: { backgroundColor: "#cbd5e1", borderColor: "#94a3b8", borderLeftColor: "#64748b", borderLeftWidth: "4px" },
            className: "opacity-60 grayscale",
            textClassName: "text-slate-600 line-through decoration-slate-500",
        };
    }
    const colorVal = apt.services?.color || "bg-teal-500";
    const isTw = colorVal.startsWith("bg-");

    return {
        style: {
            backgroundColor: isTw ? undefined : colorVal,
            borderColor: "rgba(0,0,0,0.05)",
            borderLeftWidth: "0px"
        },
        className: isTw ? colorVal : "",
        textClassName: isTw ? "text-white drop-shadow-sm" : "text-slate-800",
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
            if (!placed) columns.push([apt]);
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
    const [viewMode, setViewMode] = useState<ViewMode>("month");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);

    // Always fetch full month range so monthly view has all data
    const dateRange = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        return { start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) };
    }, [selectedDate]);

    const fetchAppointments = useCallback(async (start: Date, end: Date) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    patients:patient_id(id, full_name, email, phone),
                    services:service_id(name, duration_minutes, color, is_composite),
                    appointment_allocations(
                        id,
                        service_phase_id,
                        professional_id, 
                        physical_resource_id,
                        starts_at,
                        ends_at,
                        profiles:professional_id(full_name),
                        physical_resources:physical_resource_id(name, type),
                        service_phases:service_phase_id(
                            phase_order, 
                            duration_minutes, 
                            requires_resource_type, 
                            label, 
                            sub_services:services!service_phases_sub_service_id_fkey(name, color)
                        )
                    )
                `)
                .gte('starts_at', start.toISOString())
                .lte('ends_at', end.toISOString());

            if (error) throw new Error("Error al obtener las citas: " + error.message);
            setAppointments((data || []) as unknown as Appointment[]);
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

    const navigateToDay = (day: Date) => {
        setSelectedDate(day);
        setViewMode("day");
    };

    const goBack = () => setSelectedDate(prev => subMonths(prev, 1));
    const goForward = () => setSelectedDate(prev => addMonths(prev, 1));
    const goToToday = () => setSelectedDate(new Date());

    const dateLabel = useMemo(() => {
        if (viewMode === "day") return format(selectedDate, "EEEE dd 'de' MMMM, yyyy", { locale: es });
        return format(selectedDate, "MMMM yyyy", { locale: es });
    }, [selectedDate, viewMode]);

    const isCurrentPeriod = useMemo(() => {
        const now = new Date();
        if (viewMode === "day") return isSameDay(selectedDate, now);
        return format(selectedDate, "yyyy-MM") === format(now, "yyyy-MM");
    }, [selectedDate, viewMode]);

    return (
        <div className="space-y-4 h-full flex flex-col pt-2">
            {/* Page Title */}
            <div>
                <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-teal to-blue-400">
                    Agenda
                </h1>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-[20px] shadow-sm ">
                <div className="flex flex-wrap items-center gap-2">
                    {viewMode === "day" ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setViewMode("month")}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal to-blue-500 text-white shadow-md hover:shadow-lg hover:opacity-90 transition-all text-sm font-semibold mr-2"
                                title="Volver al Mes"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Volver al Calendario</span>
                            </button>

                            <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                                <button
                                    onClick={() => setSelectedDate(prev => subDays(prev, 1))}
                                    className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-slate-800"
                                    title="Día anterior"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={goToToday}
                                    className="px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-teal"
                                    title="Ir a hoy"
                                >
                                    Hoy
                                </button>
                                <button
                                    onClick={() => setSelectedDate(prev => addDays(prev, 1))}
                                    className="p-1.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-slate-500 hover:text-slate-800"
                                    title="Día siguiente"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <button onClick={goBack} className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-300 hover:text-slate-800" title="Mes anterior">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            {!isCurrentPeriod && (
                                <button onClick={goToToday} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20 transition-colors capitalize">
                                    {format(new Date(), "MMMM", { locale: es })}
                                </button>
                            )}
                            <button onClick={goForward} className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-slate-300 hover:text-slate-800" title="Mes siguiente">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    {viewMode === "month" && (
                        <h2 className="text-xl font-bold text-slate-800 capitalize min-w-[200px] ml-2 tracking-tight">
                            {dateLabel}
                        </h2>
                    )}
                </div>

                {/* Filter & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsFormModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal to-blue-500 text-white rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all font-semibold text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Nueva Cita</span>
                    </button>

                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="font-medium text-sm">{error}</p>
                </div>
            )}

            {/* Calendar View Container */}
            <div className="flex-1 bg-white border border-slate-200 rounded-[20px] overflow-hidden shadow-2xl min-h-[600px] flex flex-col relative z-0">
                {loading && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 ">
                        <Loader2 className="h-10 w-10 text-teal animate-spin mb-4" />
                        <p className="text-slate-500 font-medium animate-pulse">Cargando agenda...</p>
                    </div>
                )}

                {viewMode === "month" && (
                    <MonthCalendarView
                        date={selectedDate}
                        appointments={filteredAppointments}
                        onNavigateToDay={navigateToDay}
                    />
                )}
                {viewMode === "day" && (
                    <DayView
                        date={selectedDate}
                        appointments={filteredAppointments}
                        onSelectAppointment={setSelectedAppointment}
                    />
                )}
            </div>

            {selectedAppointment && (
                <AppointmentDetail
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onDeleted={() => {
                        setSelectedAppointment(null);
                        fetchAppointments(dateRange.start, dateRange.end);
                    }}
                    onEdited={(updated) => {
                        setSelectedAppointment(null);
                        fetchAppointments(dateRange.start, dateRange.end);
                    }}
                />
            )}

            {isFormModalOpen && (
                <AppointmentFormModal
                    defaultDate={viewMode === "day" ? selectedDate : new Date()}
                    onClose={() => setIsFormModalOpen(false)}
                    onSuccess={() => {
                        setIsFormModalOpen(false);
                        fetchAppointments(dateRange.start, dateRange.end);
                    }}
                />
            )}
        </div>
    );
}

// ─── MONTH CALENDAR VIEW (Card Grid) ────────────────────────────────────────

function MonthCalendarView({
    date,
    appointments,
    onNavigateToDay,
}: {
    date: Date;
    appointments: Appointment[];
    onNavigateToDay: (d: Date) => void;
}) {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const weekDayLabels = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const weekDayShort = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-white/20" style={{ background: "linear-gradient(to right, var(--teal), #3b82f6)" }}>
                {weekDayLabels.map((day, i) => (
                    <div key={day} className="text-center py-3 px-2 border-r border-white/10 last:border-r-0">
                        <span className="hidden md:inline text-xs text-white/90 font-bold uppercase tracking-widest">{day}</span>
                        <span className="md:hidden text-xs text-white/90 font-bold uppercase tracking-widest">{weekDayShort[i]}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 overflow-y-auto">
                {calendarDays.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayApts = appointmentsByDay.get(dayKey) || [];
                    const isCurrentMonth = day.getMonth() === date.getMonth();
                    const today = isToday(day);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const hasAppointments = dayApts.length > 0;
                    const overdueApts = dayApts.filter(a => isOverdue(a));

                    return (
                        <button
                            key={dayKey}
                            onClick={() => onNavigateToDay(day)}
                            className={`
                                flex flex-col items-center justify-center p-3 min-h-[100px] md:min-h-[120px]
                                transition-all duration-200 cursor-pointer group relative
                                focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal
                                ${!isCurrentMonth
                                    ? "bg-slate-100/80 text-slate-400"
                                    : isWeekend
                                        ? "bg-slate-50 hover:bg-teal-light"
                                        : "bg-white hover:bg-teal-light"
                                }
                                ${today ? "ring-2 ring-inset ring-teal bg-teal-light/50" : ""}
                            `}
                        >
                            {/* Day of week (mobile only) */}
                            <span className={`text-[10px] uppercase tracking-wider font-bold mb-1 md:hidden ${today ? "text-teal-dark" : !isCurrentMonth ? "text-slate-300" : "text-slate-400"
                                }`}>
                                {format(day, "EEE", { locale: es })}
                            </span>

                            {/* Day Number */}
                            <div className={`
                                flex items-center justify-center w-10 h-10 rounded-full text-lg font-black transition-all
                                ${today
                                    ? "bg-teal text-white shadow-lg shadow-teal/30"
                                    : !isCurrentMonth
                                        ? "text-slate-400 group-hover:bg-slate-200"
                                        : "text-slate-800 group-hover:bg-teal-light"
                                }
                            `}>
                                {format(day, "d")}
                            </div>

                            {/* Appointment Count */}
                            {hasAppointments && (
                                <div className={`
                                    mt-2 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold
                                    bg-teal/10 text-teal-dark border border-teal/20
                                `}>
                                    <span>{dayApts.length}</span>
                                    <span className="hidden sm:inline">{dayApts.length === 1 ? "cita" : "citas"}</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DayView({
    date,
    appointments,
    onSelectAppointment,
}: {
    date: Date;
    appointments: Appointment[];
    onSelectAppointment: (a: Appointment) => void;
}) {
    const dayAppointments = useMemo(() =>
        appointments
            .filter(a => isSameDay(new Date(a.starts_at), date))
            .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
        [appointments, date]
    );

    // Group appointments by hour for visual separators (must be before early return for hooks rules)
    const grouped = useMemo(() => {
        const map = new Map<number, Appointment[]>();
        dayAppointments.forEach(apt => {
            const h = new Date(apt.starts_at).getHours();
            if (!map.has(h)) map.set(h, []);
            map.get(h)!.push(apt);
        });
        return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    }, [dayAppointments]);

    // Empty state
    if (dayAppointments.length === 0) {
        return (
            <div className="h-full flex flex-col bg-slate-50">
                <div className="sticky top-0 z-40 bg-white/90 border-b border-slate-200 py-4 px-6 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800">
                        {isToday(date) ? "Agenda de Hoy" : format(date, "EEEE, d 'de' MMMM", { locale: es })}
                    </h3>

                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-teal-light flex items-center justify-center mb-5">
                            <CalendarIcon className="w-10 h-10 text-teal" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Día sin citas</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">No hay citas programadas para este día. Puedes volver al calendario mensual para ver otros días.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50">
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-200 py-4 px-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {isToday(date) ? "Agenda de Hoy" : format(date, "EEEE, d 'de' MMMM", { locale: es })}
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{dayAppointments.length} citas</span>
                </h3>

            </div>

            <div className="p-4 md:p-6 space-y-1">
                {grouped.map(([hour, apts]) => (
                    <div key={hour}>
                        {/* Hour label */}
                        <div className="flex items-center gap-3 mb-1.5 mt-3 first:mt-0">
                            <span className="text-xs font-bold text-slate-400 tracking-wider w-14 text-right flex-shrink-0">
                                {String(hour).padStart(2, '0')}:00
                            </span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* Appointment rows for this hour */}
                        <div className="space-y-1.5 ml-[68px]">
                            {apts.map(apt => {
                                const start = new Date(apt.starts_at);
                                const end = new Date(apt.ends_at);
                                const overdue = isOverdue(apt);
                                const serviceColor = apt.services?.color || '#14b8a6';
                                const isTw = serviceColor.startsWith('bg-');

                                return (
                                    <button
                                        key={apt.id}
                                        onClick={() => onSelectAppointment(apt)}
                                        className={`w-full flex items-center gap-3 md:gap-4 px-4 py-3 rounded-xl bg-white border text-left
                                            transition-all duration-150 hover:shadow-md hover:border-slate-300 group
                                            ${overdue ? 'border-amber-200 bg-amber-50/50' : 'border-slate-100'}`}
                                    >
                                        {/* Service color indicator */}
                                        <div
                                            className={`w-1.5 h-10 rounded-full flex-shrink-0 ${isTw ? serviceColor.replace('bg-', 'bg-') : ''}`}
                                            style={isTw ? undefined : { backgroundColor: serviceColor }}
                                        />

                                        {/* Time */}
                                        <div className="flex-shrink-0 text-center w-24">
                                            <span className="text-sm font-bold text-slate-700">{format(start, 'HH:mm')}</span>
                                            <span className="text-slate-400 mx-1">–</span>
                                            <span className="text-sm text-slate-500">{format(end, 'HH:mm')}</span>
                                        </div>

                                        {/* Patient */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">
                                                {apt.patients?.full_name || 'Paciente no especificado'}
                                            </p>
                                            <p className="text-xs text-slate-400 truncate">
                                                {apt.services?.name || 'Sin servicio'}
                                            </p>
                                        </div>

                                        {/* Professional */}
                                        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                                            <UserCircle className="w-3.5 h-3.5" />
                                            <span className="truncate max-w-[120px]">{getProfessionalName(apt)}</span>
                                        </div>

                                        {/* Overdue badge */}
                                        {overdue && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                                <AlertTriangle className="w-3 h-3" />
                                                Vencida
                                            </span>
                                        )}

                                        {/* Chevron */}
                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}


// ─── Appointment Detail Modal ───────────────────────────────────────────────

function AppointmentDetail({
    appointment: apt,
    onClose,
    onDeleted,
    onEdited,
}: {
    appointment: Appointment;
    onClose: () => void;
    onDeleted: () => void;
    onEdited: (updated: Appointment) => void;
}) {
    const [isClosing, setIsClosing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            // Delete allocations first (FK constraint)
            await supabase.from('appointment_allocations').delete().eq('appointment_id', apt.id);
            const { error } = await supabase.from('appointments').delete().eq('id', apt.id);
            if (error) throw error;
            onDeleted();
        } catch (err: any) {
            console.error("Error deleting appointment:", err);
            setDeleting(false);
            setConfirmDelete(false);
        }
    };

    const overdue = isOverdue(apt);
    const serviceColorVal = apt.services?.color || '#14b8a6';
    const isTw = serviceColorVal.startsWith('bg-');

    return (<>
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 duration-200 ease-in-out
                ${isClosing ? "animate-out fade-out opacity-0" : "animate-in fade-in"}`}
            onClick={handleClose}
        >
            <div
                className={`w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] duration-200 ease-in-out
                    ${isClosing ? "animate-out zoom-out-95 opacity-0 scale-95" : "animate-in zoom-in-105 scale-100"}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — same style as edit/create */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-slate-800">Detalle de Cita</h2>
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                            apt.status === "cancelled"
                                ? "text-red-600 bg-red-50"
                                : overdue
                                ? "text-amber-600 bg-amber-50"
                                : "text-teal bg-teal-light"
                        }`}>
                            {apt.status === "cancelled" ? "Cancelada" : overdue ? "Vencida" : "Programada"}
                        </span>
                    </div>
                    <button onClick={handleClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body — same padding and scroll as edit/create */}
                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                    {/* Patient — same style as CustomSelect */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Paciente *</label>
                        <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white">
                            <Users className="w-4 h-4 text-teal flex-shrink-0" />
                            <span className="flex-1 truncate text-slate-800 font-medium">{apt.patients?.full_name || "Paciente no especificado"}</span>
                            {apt.patients?.phone && (
                                <span className="text-xs text-slate-400 flex-shrink-0">{apt.patients.phone}</span>
                            )}
                        </div>
                    </div>

                    {/* Service — same style as CustomSelect with dot */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Servicio principal *</label>
                        <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white">
                            <Briefcase className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="flex-1 truncate text-slate-800 font-medium">{apt.services?.name || "Sin servicio"}</span>
                            {apt.services?.duration_minutes && (
                                <span className="text-xs text-slate-400 flex-shrink-0">{apt.services.duration_minutes} min</span>
                            )}
                        </div>
                    </div>

                    {/* Professional — same style as CustomSelect */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Profesional asignado *</label>
                        <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white">
                            <UserCog className="w-4 h-4 text-purple-500 flex-shrink-0" />
                            <span className="flex-1 truncate text-slate-800 font-medium">{getProfessionalName(apt)}</span>
                        </div>
                    </div>

                    {/* Date & Time — same grid as edit/create */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Fecha *</label>
                            <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white">
                                <CalendarIcon className="w-4 h-4 text-teal flex-shrink-0" />
                                <span className="flex-1 text-slate-800 font-medium">{format(new Date(apt.starts_at), "d 'de' MMMM, yyyy", { locale: es })}</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1.5">Hora de inicio *</label>
                            <div className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white">
                                <Clock className="w-4 h-4 text-teal flex-shrink-0" />
                                <span className="flex-1 text-slate-800 font-medium">{format(new Date(apt.starts_at), "hh:mm a")}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes — same textarea style */}
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Notas (Opcional)</label>
                        <div className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]">
                            {apt.notes || <span className="text-slate-400">Sin notas</span>}
                        </div>
                    </div>
                </div>

                {/* Footer — same style as edit/create */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-3xl">
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-4 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        Eliminar
                    </button>
                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-teal rounded-xl shadow-md hover:shadow-lg hover:bg-teal-dark transition-all flex items-center gap-2"
                    >
                        <Pencil className="w-4 h-4" /> Editar Cita
                    </button>
                </div>
            </div>
        </div>

        {/* Delete confirmation popup */}
        {
            confirmDelete && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center gap-5 text-center animate-in zoom-in-95">
                        <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">¿Eliminar esta cita?</h3>
                            <p className="text-sm text-slate-500">Esta acción no se puede deshacer. La cita y sus asignaciones serán eliminadas permanentemente.</p>
                        </div>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {deleting ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Eliminando...</>
                                ) : (
                                    'Sí, eliminar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        {isEditOpen && (
            <AppointmentEditModal
                appointment={apt}
                onClose={() => setIsEditOpen(false)}
                onSuccess={() => {
                    setIsEditOpen(false);
                    onEdited(apt);
                }}
            />
        )}
    </>
    );
}

// ─── Manual Appointment Form Modal ──────────────────────────────────────────

function AppointmentFormModal({ defaultDate, onClose, onSuccess }: { defaultDate?: Date, onClose: () => void, onSuccess: () => void }) {
    const [loadingData, setLoadingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);

    // Use defaultDate if provided, but never allow a past date
    const initialDate = (() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        if (defaultDate) {
            const d = new Date(defaultDate);
            d.setHours(0,0,0,0);
            return d >= today ? format(defaultDate, "yyyy-MM-dd") : format(today, "yyyy-MM-dd");
        }
        return format(today, "yyyy-MM-dd");
    })();

    const [form, setForm] = useState({
        patient_id: "",
        service_id: "",
        professional_id: "",
        date: initialDate,
        time: "09:00",
        notes: ""
    });

    useEffect(() => {
        async function fetchData() {
            setLoadingData(true);
            try {
                const [ptsRes, srvRes, profRes] = await Promise.all([
                    supabase.from('patients').select('id, full_name, email, phone').order('full_name'),
                    supabase.from('services').select('id, name, duration_minutes, color, is_composite').order('name'),
                    // Assuming role 'professional' or we just fetch all profiles for now as per plan
                    supabase.from('profiles').select('id, full_name').order('full_name') // You might want to filter this by role later
                ]);

                if (ptsRes.error) throw new Error("Error cargando pacientes: " + ptsRes.error.message);
                if (srvRes.error) throw new Error("Error cargando servicios: " + srvRes.error.message);
                if (profRes.error) throw new Error("Error cargando profesionales: " + profRes.error.message);

                setPatients(ptsRes.data || []);
                setServices(srvRes.data || []);
                setProfessionals(profRes.data || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
            }
        }
        fetchData();
    }, []);

    // A helper to refresh patients when a new one is created inline
    const handlePatientCreated = async (newPatientId: string) => {
        setIsNewPatientModalOpen(false);
        try {
            const { data, error } = await supabase.from('patients').select('id, full_name, email, phone').order('full_name');
            if (error) throw error;
            setPatients(data || []);
            setForm(prev => ({ ...prev, patient_id: newPatientId }));
        } catch (err: any) {
            console.error("Error refreshing patients:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            const selectedService = services.find(s => s.id === form.service_id);
            if (!selectedService) throw new Error("Debes seleccionar un servicio válido.");
            if (!form.patient_id) throw new Error("Debes seleccionar un paciente.");
            if (!form.professional_id) throw new Error("Debes seleccionar un profesional.");

            // Calculate start and end times
            const startDateTime = new Date(`${form.date}T${form.time}:00`);
            const endDateTime = new Date(startDateTime.getTime() + selectedService.duration_minutes * 60000);

            if (isNaN(startDateTime.getTime())) throw new Error("Fecha u hora inválida.");

            // 1. Insert Appointment
            const { data: aptData, error: aptError } = await supabase
                .from('appointments')
                .insert({
                    patient_id: form.patient_id,
                    service_id: form.service_id,
                    starts_at: startDateTime.toISOString(),
                    ends_at: endDateTime.toISOString(),
                    status: "scheduled",
                    notes: form.notes || null,
                })
                .select('id')
                .single();

            if (aptError) throw new Error("Error creando cita: " + aptError.message);
            const appointmentId = aptData.id;

            // 2. Insert Allocation (single block for the professional)
            const { error: allocError } = await supabase
                .from('appointment_allocations')
                .insert({
                    appointment_id: appointmentId,
                    professional_id: form.professional_id,
                    starts_at: startDateTime.toISOString(),
                    ends_at: endDateTime.toISOString(),
                });

            if (allocError) {
                // Try to rollback the appointment
                await supabase.from('appointments').delete().eq('id', appointmentId);
                throw new Error("Error asignando profesional: " + allocError.message);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Agendar Cita</h2>
                    <button onClick={onClose} disabled={saving} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {loadingData ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="h-8 w-8 text-teal animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos...</p>
                        </div>
                    ) : (
                        <form id="new-appointment-form" onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            {/* Patient Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Paciente *</label>
                                <CustomSelect
                                    value={form.patient_id}
                                    onChange={(val) => setForm({ ...form, patient_id: val })}
                                    placeholder="Buscar paciente..."
                                    icon={<Users className="w-4 h-4 text-teal" />}
                                    options={patients.map(p => ({ value: p.id, label: p.full_name, sub: p.email || p.phone || '' }))}
                                    onAdd={() => setIsNewPatientModalOpen(true)}
                                    addLabel="Nuevo Paciente"
                                />
                            </div>

                            {/* Service Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Servicio principal *</label>
                                <CustomSelect
                                    value={form.service_id}
                                    onChange={(val) => setForm({ ...form, service_id: val })}
                                    placeholder="Buscar servicio..."
                                    icon={<Briefcase className="w-4 h-4 text-blue-500" />}
                                    options={services.map(s => ({ value: s.id, label: s.name, sub: `${s.duration_minutes} min`, dot: s.color }))}
                                />
                            </div>

                            {/* Professional Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Profesional asignado *</label>
                                <CustomSelect
                                    value={form.professional_id}
                                    onChange={(val) => setForm({ ...form, professional_id: val })}
                                    placeholder="Buscar profesional..."
                                    icon={<UserCog className="w-4 h-4 text-purple-500" />}
                                    options={professionals.map(p => ({ value: p.id, label: p.full_name }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Fecha *</label>
                                    <CustomDatePicker
                                        value={form.date}
                                        onChange={(val) => setForm({ ...form, date: val })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Hora de inicio *</label>
                                    <CustomTimePicker
                                        value={form.time}
                                        onChange={(val) => setForm({ ...form, time: val })}
                                    />
                                </div>
                            </div>



                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Notas (Opcional)</label>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Detalles adicionales sobre la cita..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all resize-none"
                                />
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-3xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="new-appointment-form"
                        disabled={saving || loadingData}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-teal focus:ring-2 focus:ring-teal/20 focus:border-teal rounded-xl shadow-md hover:shadow-lg hover:bg-teal-dark transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                        ) : (
                            <><Save className="w-4 h-4" /> Crear Cita</>
                        )}
                    </button>
                </div>
            </div>

            {isNewPatientModalOpen && (
                <NewPatientModal
                    onClose={() => setIsNewPatientModalOpen(false)}
                    onSuccess={handlePatientCreated}
                />
            )}
        </div>
    );
}

// ─── Custom Date Picker ──────────────────────────────────────────────────────

function CustomDatePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);

    const selected = value ? new Date(value + 'T12:00:00') : null;
    const [viewDate, setViewDate] = useState(selected || new Date());

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const days: (number | null)[] = Array(startPad).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dayNames = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const formatDisplay = (v: string) => {
        if (!v) return '';
        const d = new Date(v + 'T12:00:00');
        return format(d, "d 'de' MMMM, yyyy", { locale: es });
    };

    const handleSelect = (day: number) => {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onChange(`${year}-${m}-${d}`);
        setOpen(false);
    };

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white text-left transition-all ${
                    open ? 'border-teal ring-2 ring-teal/20 shadow-lg' : 'border-gray-300 hover:border-slate-400'
                }`}
            >
                <CalendarIcon className="w-4 h-4 text-teal flex-shrink-0" />
                <span className={`flex-1 truncate ${value ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {value ? formatDisplay(value) : 'Seleccionar fecha...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-80 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-teal to-blue-500 p-4 text-white">
                            <p className="text-xs font-medium opacity-80">Seleccionar fecha</p>
                            <p className="text-lg font-bold mt-1">{value ? formatDisplay(value) : 'Sin seleccionar'}</p>
                        </div>
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <button type="button" onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                                </button>
                                <span className="text-sm font-bold text-slate-800">{monthNames[month]} {year}</span>
                                <button type="button" onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                    <ChevronRight className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2">
                                {dayNames.map(dn => (
                                    <div key={dn} className="text-center text-[11px] font-bold text-slate-400 py-1">{dn}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((day, i) => {
                                    if (day === null) return <div key={`empty-${i}`} />;
                                    const m = String(month + 1).padStart(2, '0');
                                    const d = String(day).padStart(2, '0');
                                    const dateStr = `${year}-${m}-${d}`;
                                    const isSelected = value === dateStr;
                                    const isToday2 = todayStr === dateStr;
                                    const isPast = dateStr < todayStr;
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            disabled={isPast}
                                            onClick={() => handleSelect(day)}
                                            className={`w-9 h-9 mx-auto rounded-full text-sm font-medium transition-all ${
                                                isPast
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-gradient-to-r from-teal to-blue-500 text-white shadow-md'
                                                        : isToday2
                                                            ? 'bg-teal/10 text-teal font-bold ring-2 ring-teal/30'
                                                            : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-1.5 text-sm font-medium text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">Cancelar</button>
                            <button type="button" onClick={() => { const today = format(new Date(), 'yyyy-MM-dd'); onChange(today); setOpen(false); }} className="px-4 py-1.5 text-sm font-semibold text-teal hover:bg-teal/10 rounded-lg transition-colors">Hoy</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Custom Time Picker ──────────────────────────────────────────────────────

function CustomTimePicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false);
    const [tempHour, setTempHour] = useState(() => value ? parseInt(value.split(':')[0]) : 9);
    const [tempMinute, setTempMinute] = useState(() => value ? parseInt(value.split(':')[1]) : 0);

    const formatDisplay = (v: string) => {
        if (!v) return '';
        const h = parseInt(v.split(':')[0]);
        return `${v} ${h < 12 ? 'AM' : 'PM'}`;
    };

    const handleOpen = () => {
        if (value) {
            setTempHour(parseInt(value.split(':')[0]));
            // Snap minute to nearest 15
            const m = parseInt(value.split(':')[1]);
            setTempMinute(Math.round(m / 15) * 15 % 60);
        }
        setOpen(true);
    };

    const incHour = () => setTempHour(h => h >= 20 ? 8 : h + 1);
    const decHour = () => setTempHour(h => h <= 8 ? 20 : h - 1);
    const incMin = () => setTempMinute(m => (m + 15) % 60);
    const decMin = () => setTempMinute(m => (m - 15 + 60) % 60);

    const handleConfirm = () => {
        const hStr = String(tempHour).padStart(2, '0');
        const mStr = String(tempMinute).padStart(2, '0');
        onChange(`${hStr}:${mStr}`);
        setOpen(false);
    };

    return (
        <>
            <button
                type="button"
                onClick={handleOpen}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white text-left transition-all ${
                    open ? 'border-teal ring-2 ring-teal/20 shadow-lg' : 'border-gray-300 hover:border-slate-400'
                }`}
            >
                <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className={`flex-1 truncate ${value ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {value ? formatDisplay(value) : 'Seleccionar hora...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
            </button>

            {open && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-72 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-teal to-blue-500 p-4 text-white text-center">
                            <p className="text-xs font-medium opacity-80">Seleccionar hora</p>
                        </div>
                        <div className="p-6 flex items-center justify-center gap-2">
                            {/* Hour spinner */}
                            <div className="flex flex-col items-center gap-1">
                                <button type="button" onClick={incHour} className="p-2 rounded-xl hover:bg-slate-100 transition-colors group">
                                    <ChevronUp className="w-6 h-6 text-slate-400 group-hover:text-teal transition-colors" />
                                </button>
                                <div className="w-20 h-20 flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-slate-200">
                                    <span className="text-4xl font-bold font-mono text-slate-800">{String(tempHour).padStart(2, '0')}</span>
                                </div>
                                <button type="button" onClick={decHour} className="p-2 rounded-xl hover:bg-slate-100 transition-colors group">
                                    <ChevronDown className="w-6 h-6 text-slate-400 group-hover:text-teal transition-colors" />
                                </button>
                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Hora</span>
                            </div>

                            {/* Separator */}
                            <span className="text-4xl font-bold text-slate-300 mb-8">:</span>

                            {/* Minute spinner */}
                            <div className="flex flex-col items-center gap-1">
                                <button type="button" onClick={incMin} className="p-2 rounded-xl hover:bg-slate-100 transition-colors group">
                                    <ChevronUp className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                </button>
                                <div className="w-20 h-20 flex items-center justify-center bg-slate-50 rounded-2xl border-2 border-slate-200">
                                    <span className="text-4xl font-bold font-mono text-slate-800">{String(tempMinute).padStart(2, '0')}</span>
                                </div>
                                <button type="button" onClick={decMin} className="p-2 rounded-xl hover:bg-slate-100 transition-colors group">
                                    <ChevronDown className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                </button>
                                <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Min</span>
                            </div>
                        </div>
                        <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-1.5 text-sm font-medium text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">Cancelar</button>
                            <button type="button" onClick={handleConfirm} className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-teal to-blue-500 rounded-lg shadow-sm hover:shadow-md transition-all">OK</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Custom Searchable Select ────────────────────────────────────────────────

interface SelectOption {
    value: string;
    label: string;
    sub?: string;
    dot?: string;
}

function CustomSelect({ value, onChange, options, placeholder, icon, onAdd, addLabel }: {
    value: string;
    onChange: (val: string) => void;
    options: SelectOption[];
    placeholder: string;
    icon?: React.ReactNode;
    onAdd?: () => void;
    addLabel?: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.value === value);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
    );

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => { setOpen(!open); setSearch(""); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-white text-left transition-all ${
                    open ? 'border-teal ring-2 ring-teal/20 shadow-lg' : 'border-gray-300 hover:border-slate-400'
                }`}
            >
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className={`flex-1 truncate ${selected ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {selected ? selected.label : placeholder}
                </span>
                {selected && selected.sub && (
                    <span className="text-xs text-slate-400 flex-shrink-0">{selected.sub}</span>
                )}
                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={placeholder}
                                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal/30 focus:border-teal bg-slate-50"
                            />
                        </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-400">Sin resultados</div>
                        ) : (
                            filtered.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { onChange(opt.value); setOpen(false); setSearch(""); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-teal/5 ${
                                        opt.value === value ? 'bg-teal/10 text-teal font-semibold' : 'text-slate-700'
                                    }`}
                                >
                                    {opt.dot && (
                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gradient-to-br ${opt.dot}`} />
                                    )}
                                    <span className="flex-1 truncate">{opt.label}</span>
                                    {opt.sub && <span className="text-xs text-slate-400 flex-shrink-0">{opt.sub}</span>}
                                </button>
                            ))
                        )}
                    </div>
                    {onAdd && (
                        <div className="p-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => { setOpen(false); onAdd(); }}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-gradient-to-r from-teal to-blue-500 rounded-lg hover:shadow-md transition-all"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {addLabel || 'Crear nuevo'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Appointment Edit Modal ──────────────────────────────────────────────────

function AppointmentEditModal({ appointment: apt, onClose, onSuccess }: {
    appointment: Appointment;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loadingData, setLoadingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);

    const [form, setForm] = useState({
        patient_id: apt.patient_id || "",
        service_id: apt.service_id || "",
        professional_id: apt.appointment_allocations?.[0]?.professional_id || "",
        date: format(new Date(apt.starts_at), "yyyy-MM-dd"),
        time: format(new Date(apt.starts_at), "HH:mm"),
        notes: apt.notes || "",
    });

    useEffect(() => {
        async function fetchData() {
            setLoadingData(true);
            try {
                const [ptsRes, srvRes, profRes] = await Promise.all([
                    supabase.from('patients').select('id, full_name, email, phone').order('full_name'),
                    supabase.from('services').select('id, name, duration_minutes, color, is_composite').order('name'),
                    supabase.from('profiles').select('id, full_name').order('full_name'),
                ]);
                if (ptsRes.error) throw ptsRes.error;
                if (srvRes.error) throw srvRes.error;
                if (profRes.error) throw profRes.error;
                setPatients(ptsRes.data || []);
                setServices(srvRes.data || []);
                setProfessionals(profRes.data || []);
            } catch (err: any) {
                setError("Error cargando datos: " + err.message);
            } finally {
                setLoadingData(false);
            }
        }
        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const selectedService = services.find(s => s.id === form.service_id);
            if (!selectedService) throw new Error("Debes seleccionar un servicio válido.");
            if (!form.patient_id) throw new Error("Debes seleccionar un paciente.");
            if (!form.professional_id) throw new Error("Debes seleccionar un profesional.");

            const startDateTime = new Date(`${form.date}T${form.time}:00`);
            const endDateTime = new Date(startDateTime.getTime() + selectedService.duration_minutes * 60000);
            if (isNaN(startDateTime.getTime())) throw new Error("Fecha u hora inválida.");

            const { error: aptError } = await supabase
                .from('appointments')
                .update({
                    patient_id: form.patient_id,
                    service_id: form.service_id,
                    starts_at: startDateTime.toISOString(),
                    ends_at: endDateTime.toISOString(),
                    notes: form.notes || null,
                })
                .eq('id', apt.id);

            if (aptError) throw new Error("Error al actualizar cita: " + aptError.message);

            // Update the allocation if professional changed
            if (apt.appointment_allocations?.[0]) {
                await supabase
                    .from('appointment_allocations')
                    .update({
                        professional_id: form.professional_id,
                        starts_at: startDateTime.toISOString(),
                        ends_at: endDateTime.toISOString(),
                    })
                    .eq('appointment_id', apt.id);
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Editar Cita</h2>
                    <button onClick={onClose} disabled={saving} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {loadingData ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 className="h-8 w-8 text-teal animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos...</p>
                        </div>
                    ) : (
                        <form id="edit-appointment-form" onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">{error}</div>
                            )}

                            {/* Patient Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Paciente *</label>
                                <CustomSelect
                                    value={form.patient_id}
                                    onChange={(val) => setForm({ ...form, patient_id: val })}
                                    placeholder="Buscar paciente..."
                                    icon={<Users className="w-4 h-4 text-teal" />}
                                    options={patients.map(p => ({ value: p.id, label: p.full_name, sub: p.email || p.phone || '' }))}
                                />
                            </div>

                            {/* Service Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Servicio principal *</label>
                                <CustomSelect
                                    value={form.service_id}
                                    onChange={(val) => setForm({ ...form, service_id: val })}
                                    placeholder="Buscar servicio..."
                                    icon={<Briefcase className="w-4 h-4 text-blue-500" />}
                                    options={services.map(s => ({ value: s.id, label: s.name, sub: `${s.duration_minutes} min`, dot: s.color }))}
                                />
                            </div>

                            {/* Professional Dropdown */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Profesional asignado *</label>
                                <CustomSelect
                                    value={form.professional_id}
                                    onChange={(val) => setForm({ ...form, professional_id: val })}
                                    placeholder="Buscar profesional..."
                                    icon={<UserCog className="w-4 h-4 text-purple-500" />}
                                    options={professionals.map(p => ({ value: p.id, label: p.full_name }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Fecha *</label>
                                    <CustomDatePicker
                                        value={form.date}
                                        onChange={(val) => setForm({ ...form, date: val })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Hora de inicio *</label>
                                    <CustomTimePicker
                                        value={form.time}
                                        onChange={(val) => setForm({ ...form, time: val })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1.5">Notas (Opcional)</label>
                                <textarea
                                    rows={3}
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Detalles adicionales sobre la cita..."
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all resize-none"
                                />
                            </div>
                        </form>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-3xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-5 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="edit-appointment-form"
                        disabled={saving || loadingData}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-teal focus:ring-2 focus:ring-teal/20 focus:border-teal rounded-xl shadow-md hover:shadow-lg hover:bg-teal-dark transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                        ) : (
                            <><Save className="w-4 h-4" /> Guardar Cambios</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Inline New Patient Modal ───────────────────────────────────────────────

function NewPatientModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: "",
        rut: "",
        email: "",
        phone: "",
        notes: ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            if (!form.full_name.trim()) throw new Error("El nombre es requerido.");

            const { data, error: insertError } = await supabase
                .from('patients')
                .insert({
                    full_name: form.full_name,
                    rut: form.rut || null,
                    email: form.email || null,
                    phone: form.phone || null,
                    notes: form.notes || null
                })
                .select('id')
                .single();

            if (insertError) throw new Error("Error al crear paciente: " + insertError.message);
            onSuccess(data.id);
        } catch (err: any) {
            setError(err.message);
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-5 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800">Nuevo Paciente</h2>
                    <button onClick={onClose} disabled={saving} className="p-1 text-slate-800/50 hover:text-slate-800 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form id="new-patient-form" onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre Completo *</label>
                            <input
                                type="text"
                                required
                                value={form.full_name}
                                onChange={e => setForm({ ...form, full_name: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal/50"
                                placeholder="Nombre y Apellido"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">RUT</label>
                            <input
                                type="text"
                                value={form.rut}
                                onChange={e => setForm({ ...form, rut: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal/50"
                                placeholder="12345678-9"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal/50"
                                placeholder="correo@ejemplo.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Teléfono</label>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal/50"
                                placeholder="+569XXXXXXXX"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Notas Clínicas</label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={3}
                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-teal/50 resize-none"
                            placeholder="Diagnóstico, alergias, observaciones relevantes..."
                        />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 bg-gradient-to-r from-teal to-blue-500 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-teal/25 transition-all disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {saving ? 'Creando...' : 'Crear Paciente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
