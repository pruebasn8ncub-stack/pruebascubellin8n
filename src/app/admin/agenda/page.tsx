"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    Loader2, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight,
    Filter, UserCircle, AlertTriangle, ArrowLeft, List, LayoutGrid, CalendarDays,
    Activity, ClipboardList, Phone, Mail, Plus, X, Save
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
                                <button onClick={goToToday} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-teal/10 text-teal border border-teal/20 hover:bg-teal/20 transition-colors">
                                    Hoy
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
                    <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 px-3 border border-slate-200">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className="bg-transparent border-none text-slate-700 text-sm font-medium py-1.5 focus:outline-none focus:ring-0 appearance-none cursor-pointer"
                        >
                            <option value="all" className="bg-white text-sm">Todas ({appointments.length})</option>
                            <option value="scheduled" className="bg-white text-sm">Agendadas</option>
                            <option value="overdue" className="bg-white text-sm">Vencidas ({overdueCount})</option>
                            <option value="completed" className="bg-white text-sm">Completadas</option>
                            <option value="cancelled" className="bg-white text-sm">Canceladas</option>
                            <option value="no_show" className="bg-white text-sm">No Asistió</option>
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
                />
            )}

            {isFormModalOpen && (
                <AppointmentFormModal
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

                            {/* Appointment Count Badge */}
                            {hasAppointments && (
                                <div className={`
                                    mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                                    transition-all group-hover:scale-105
                                    ${overdueApts.length > 0
                                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                                        : "bg-teal-light text-teal-dark border border-teal/20"
                                    }
                                `}>
                                    <CalendarIcon className="w-3 h-3" />
                                    <span>{dayApts.length}</span>
                                    <span className="hidden sm:inline">{dayApts.length === 1 ? "cita" : "citas"}</span>
                                </div>
                            )}

                            {/* Overdue indicator */}
                            {overdueApts.length > 0 && (
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{overdueApts.length} vencida{overdueApts.length > 1 ? "s" : ""}</span>
                                </div>
                            )}

                            {/* Empty day subtle indicator */}
                            {!hasAppointments && isCurrentMonth && (
                                <div className="mt-2 w-2 h-2 rounded-full bg-slate-200 group-hover:bg-teal-300 transition-colors" />
                            )}
                        </button>
                    );
                })}
            </div>
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
    const HOUR_HEIGHT = 90;

    const dayAppointments = appointments.filter(a =>
        isSameDay(new Date(a.starts_at), date)
    );

    // Dynamic hour range based on actual appointments
    const { startHour, endHour } = useMemo(() => {
        if (dayAppointments.length === 0) return { startHour: 8, endHour: 18 };
        let earliest = 23;
        let latest = 0;
        dayAppointments.forEach(apt => {
            const s = new Date(apt.starts_at);
            const e = new Date(apt.ends_at);
            earliest = Math.min(earliest, s.getHours());
            latest = Math.max(latest, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
        });
        // Add 1 hour padding on each side
        return { startHour: Math.max(0, earliest - 1), endHour: Math.min(24, latest + 1) };
    }, [dayAppointments]);

    const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

    // Empty state
    if (dayAppointments.length === 0) {
        return (
            <div className="h-full flex flex-col bg-slate-50">
                <div className="sticky top-0 z-40 bg-white/90 border-b border-slate-200 py-4 px-6 flex items-center gap-4 shadow-sm">
                    <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl ${isToday(date) ? "bg-teal text-white shadow-lg shadow-teal/30" : "bg-slate-100 text-slate-700"} flex-shrink-0`}>
                        <span className="text-xs uppercase font-bold tracking-wider">{format(date, "EEE", { locale: es })}</span>
                        <span className="text-2xl font-black">{format(date, "d")}</span>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            {isToday(date) ? "Agenda de Hoy" : format(date, "EEEE, d 'de' MMMM", { locale: es })}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" />
                            0 citas programadas
                        </p>
                    </div>
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
        <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 relative">
            {/* Day Header - Sticky */}
            <div className="sticky top-0 z-40 bg-white/90  border-b border-slate-200 py-4 px-6 flex items-center gap-4 shadow-sm">
                <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl ${isToday(date) ? "bg-teal text-white shadow-lg shadow-teal/30" : "bg-slate-100 text-slate-700"} flex-shrink-0`}>
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
                    const top = (hour - startHour) * HOUR_HEIGHT;
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
                    const minutesSinceStart = (now.getHours() - startHour) * 60 + now.getMinutes();
                    const top = (minutesSinceStart / 60) * HOUR_HEIGHT;
                    if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
                    return (
                        <div className="absolute left-20 right-0 z-30 flex items-center pointer-events-none" style={{ top }}>
                            <div className="w-3 h-3 rounded-full bg-teal shadow-md ring-4 ring-teal/20 -ml-1.5" />
                            <div className="flex-1 h-0.5 bg-teal/80" />
                        </div>
                    );
                })()}

                {/* Cards */}
                <div className="absolute left-24 right-6 top-0 bottom-0">
                    {calculateOverlapLayout(dayAppointments).map(({ appointment: apt, columnIndex, totalColumns }) => {
                        const start = new Date(apt.starts_at);
                        const end = new Date(apt.ends_at);
                        const topMin = (start.getHours() - startHour) * 60 + start.getMinutes();
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
                                    transition-all duration-300 ease-out hover:shadow-2xl hover:z-50 focus:outline-none focus:ring-2 focus:ring-teal
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
                                    <div className={`flex items-center gap-1.5 flex-shrink-0 text-left bg-black/10 px-2 py-1 rounded-md shadow-inner border border-slate-200 ${blockStyle.textClassName}`}>
                                        <Clock className="w-3.5 h-3.5 opacity-80" />
                                        <span className="text-xs md:text-sm font-black tracking-tight leading-none drop-shadow-sm">{format(start, "HH:mm")}</span>
                                        {height >= 40 && (
                                            <>
                                                <span className="text-[10px] md:text-sm font-semibold opacity-60">-</span>
                                                <span className="text-xs md:text-sm font-semibold opacity-90 leading-none drop-shadow-sm">{format(end, "HH:mm")}</span>
                                            </>
                                        )}
                                    </div>

                                    {height >= 40 && <div className="w-px h-6 bg-white/20 hidden sm:block"></div>}

                                    <div className={`flex flex-row items-center flex-wrap sm:flex-nowrap gap-x-4 gap-y-1 overflow-hidden w-full ${blockStyle.textClassName}`}>
                                        <div className="flex items-center gap-2 min-w-0 shrink-0">
                                            <span className="text-sm md:text-base font-bold truncate leading-tight drop-shadow-md">
                                                {apt.patients?.full_name || "Paciente no especificado"}
                                            </span>
                                        </div>

                                        {height >= 40 && (
                                            <div className="flex items-center gap-3 min-w-0 opacity-90 text-[11px] md:text-xs font-medium">
                                                <span className="flex items-center gap-1.5 truncate drop-shadow-sm bg-black/5 px-2 py-0.5 rounded-full border border-slate-200 hidden md:flex">
                                                    <Activity className="w-3 h-3" /> <span className="truncate">{apt.services?.name}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 truncate drop-shadow-sm text-slate-800/80">
                                                    <UserCircle className="w-3.5 h-3.5" /> <span className="truncate">{getProfessionalName(apt)}</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {isOverdue(apt) && (
                                        <AlertTriangle className="absolute top-1/2 -translate-y-1/2 right-2 w-4 h-4 text-slate-800 drop-shadow-sm" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}


// ─── Appointment Detail Modal ───────────────────────────────────────────────

function AppointmentDetail({
    appointment: apt,
    onClose,
    onDeleted,
}: {
    appointment: Appointment;
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [isClosing, setIsClosing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

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
    const serviceColorVal = apt.services?.color || "bg-teal-500";
    const isServiceTw = serviceColorVal.startsWith("bg-");
    const textColor = isServiceTw ? "text-white" : "text-slate-800";

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40  p-4 duration-200 ease-in-out
                ${isClosing ? "animate-out fade-out opacity-0" : "animate-in fade-in"}`}
            onClick={handleClose}
        >
            <div
                className={`w-full max-w-md shadow-2xl overflow-hidden rounded-sm duration-200 ease-in-out relative ${isServiceTw ? serviceColorVal : ''}
                    ${isClosing ? "animate-out zoom-out-95 opacity-0 scale-95" : "animate-in zoom-in-105 scale-100"}`}
                onClick={(e) => e.stopPropagation()}
                style={isServiceTw ? undefined : { backgroundColor: serviceColorVal }}
            >
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-bl-lg" style={{ boxShadow: "-2px 2px 5px rgba(0,0,0,0.1)" }}></div>

                <div className={`p-6 pb-2 relative ${textColor}`}>
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        {confirmDelete ? (
                            <>
                                <span className={`text-xs font-bold ${textColor} opacity-80`}>¿Borrar cita?</span>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-2.5 py-1 text-xs font-bold bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                                >
                                    {deleting ? '...' : 'Sí, borrar'}
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={deleting}
                                    className={`px-2.5 py-1 text-xs font-bold ${textColor} bg-black/20 hover:bg-black/40 rounded-full transition-colors shadow-sm`}
                                >
                                    No
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                className={`w-8 h-8 flex items-center justify-center ${textColor} bg-black/20 hover:bg-red-500 hover:text-white rounded-full transition-colors shadow-sm ring-1 ring-white/20`}
                                title="Eliminar cita"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                            </button>
                        )}
                        <button onClick={handleClose} className={`w-8 h-8 flex items-center justify-center ${textColor} bg-black/20 hover:bg-black/40 rounded-full transition-colors font-bold text-center shadow-sm ring-1 ring-white/20`}>
                            &times;
                        </button>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <span className={`text-xs font-bold ${isServiceTw ? 'text-white/90' : 'text-slate-800/90'} bg-black/10 px-2 py-1 rounded-sm  shadow-sm ring-1 ring-white/20`}>
                            {format(new Date(apt.starts_at), "dd MMM yy")}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-800 px-2 py-1 rounded-sm border border-white/30 bg-slate-50">
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

                <div className="p-6 pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <DetailCard textColor={textColor} icon={<Clock />} title="Horario" value={`${format(new Date(apt.starts_at), "HH:mm")} - ${format(new Date(apt.ends_at), "HH:mm")}`} />
                        <DetailCard textColor={textColor} icon={<UserCircle />} title="Profesional" value={getProfessionalName(apt)} />
                        {getResourceName(apt) && (
                            <DetailCard textColor={textColor} icon={<LayoutGrid />} title="Recurso" value={getResourceName(apt)!} />
                        )}
                        {apt.patients?.phone && (
                            <DetailCard textColor={textColor} icon={<Phone />} title="Teléfono" value={apt.patients.phone} />
                        )}
                        {apt.patients?.email && (
                            <DetailCard textColor={textColor} icon={<Mail />} title="Correo Electrónico" value={apt.patients.email} />
                        )}
                    </div>

                    {apt.services?.is_composite && apt.appointment_allocations && apt.appointment_allocations.length > 0 && (
                        <div className={`bg-black/10 rounded-sm p-4 border border-white/20 mt-4 shadow-inner ${textColor}`}>
                            <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-4 opacity-70">
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
                                        const phaseColorVal = subService?.color || "bg-black/20";
                                        const isPhaseTw = phaseColorVal.startsWith("bg-");
                                        const phaseTextColor = isPhaseTw ? "text-white" : "text-slate-800";
                                        const profName = alloc.profiles?.full_name || "Sin asignar";
                                        const resName = alloc.physical_resources?.name || "";

                                        return (
                                            <div
                                                key={alloc.id}
                                                className={`relative flex flex-col p-3 rounded-sm shadow-sm border border-white/20 transition-transform hover:-translate-y-0.5 ${isPhaseTw ? phaseColorVal : ''} ${phaseTextColor}`}
                                                style={isPhaseTw ? undefined : { backgroundColor: phaseColorVal }}
                                            >
                                                <div className="absolute top-0 right-0 w-3 h-3 bg-white/20 rounded-bl-sm" style={{ boxShadow: "-1px 1px 2px rgba(0,0,0,0.1)" }}></div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black/20 text-[10px] font-black shrink-0 shadow-inner">
                                                            {idx + 1}
                                                        </span>
                                                        <h5 className="font-bold text-sm drop-shadow-sm">{phaseLabel}</h5>
                                                    </div>
                                                    <div className="text-[10px] bg-black/20 px-2 py-0.5 rounded-sm font-bold tracking-widest text-right shrink-0 border border-slate-200 shadow-inner">
                                                        {format(allocStart, "HH:mm")} - {format(allocEnd, "HH:mm")}
                                                    </div>
                                                </div>
                                                <div className="flex gap-4 text-[10px] font-semibold mt-1 bg-black/10 p-2 rounded-sm border border-slate-200 shadow-inner flex-wrap">
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
                        <div className={`bg-black/10 rounded-sm p-4 border border-white/20 mt-4 shadow-inner ${textColor}`}>
                            <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 mb-2 opacity-70">
                                <ClipboardList className="w-4 h-4" /> Notas
                            </h4>
                            <p className="text-sm font-medium whitespace-pre-wrap">{apt.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DetailCard({ icon, title, value, textColor = "text-slate-800" }: { icon: React.ReactNode; title: string; value: string; textColor?: string }) {
    return (
        <div className={`flex items-start gap-2.5 p-3 rounded-sm bg-black/10 border border-white/20 shadow-sm ${textColor}`}>
            <div className={`p-1.5 bg-white/20 rounded shadow-inner ${textColor}`}>
                {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4 drop-shadow-sm" })}
            </div>
            <div className={`min-w-0 ${textColor}`}>
                <p className={`text-[9px] font-black uppercase tracking-wider mb-0.5 opacity-70`}>{title}</p>
                <p className="text-xs font-bold truncate drop-shadow-sm">{value}</p>
            </div>
        </div>
    );
}

// ─── Manual Appointment Form Modal ──────────────────────────────────────────

function AppointmentFormModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
    const [loadingData, setLoadingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);

    const [patients, setPatients] = useState<Patient[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);

    const [form, setForm] = useState({
        patient_id: "",
        service_id: "",
        professional_id: "",
        date: format(new Date(), "yyyy-MM-dd"),
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4">
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

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-bold text-slate-700">Paciente <span className="text-red-500">*</span></label>
                                    <button
                                        type="button"
                                        onClick={() => setIsNewPatientModalOpen(true)}
                                        className="text-xs font-semibold text-teal hover:text-teal-dark flex items-center gap-1 bg-teal/10 px-2 py-1 rounded"
                                    >
                                        <Plus className="w-3 h-3" /> Nuevo Paciente
                                    </button>
                                </div>
                                <select
                                    required
                                    value={form.patient_id}
                                    onChange={e => setForm({ ...form, patient_id: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all"
                                >
                                    <option value="">-- Seleccionar Paciente --</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Servicio principal <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={form.service_id}
                                    onChange={e => setForm({ ...form, service_id: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all"
                                >
                                    <option value="">-- Seleccionar Servicio --</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes} min)</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Profesional asignado <span className="text-red-500">*</span></label>
                                <select
                                    required
                                    value={form.professional_id}
                                    onChange={e => setForm({ ...form, professional_id: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all"
                                >
                                    <option value="">-- Seleccionar Profesional --</option>
                                    {professionals.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha <span className="text-red-500">*</span></label>
                                    <input
                                        type="date"
                                        required
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Hora de inicio <span className="text-red-500">*</span></label>
                                    <input
                                        type="time"
                                        required
                                        value={form.time}
                                        onChange={e => setForm({ ...form, time: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Notas (Opcional)</label>
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
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
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

// ─── Inline New Patient Modal ───────────────────────────────────────────────

function NewPatientModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        full_name: "",
        rut: "",
        email: "",
        phone: "",
        address: ""
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
                    address: form.address || null
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
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">Crear Nuevo Paciente</h2>
                    <button onClick={onClose} disabled={saving} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    <form id="new-patient-form" onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-medium">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                            <input
                                required
                                value={form.full_name}
                                onChange={e => setForm({ ...form, full_name: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">RUT (Opcional)</label>
                            <input
                                value={form.rut}
                                onChange={e => setForm({ ...form, rut: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Email <span className="text-slate-400 font-normal">(Opcional)</span></label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono <span className="text-slate-400 font-normal">(Opcional)</span></label>
                                <input
                                    value={form.phone}
                                    onChange={e => setForm({ ...form, phone: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal/20 focus:border-teal outline-none transition-all text-sm"
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="new-patient-form"
                        disabled={saving}
                        className="px-4 py-2 text-sm font-bold text-white bg-teal focus:ring-2 focus:ring-teal/20 focus:border-teal rounded-lg shadow-sm hover:shadow hover:bg-teal-dark transition-all flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? "Creando..." : "Crear Paciente"}
                    </button>
                </div>
            </div>
        </div>
    );
}
