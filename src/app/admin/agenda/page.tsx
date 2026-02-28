"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
    Loader2, Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight,
    Filter, UserCircle, AlertTriangle, ArrowLeft, List, LayoutGrid, CalendarDays
} from "lucide-react";
import Link from "next/link";
import {
    format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
    startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, eachHourOfInterval, isSameDay, isToday, isPast,
    differenceInMinutes, setHours, setMinutes, getDay
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
    service_phases?: { phase_order: number; duration_minutes: number; label: string | null } | null;
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
    services?: { name: string; duration_minutes: number };
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
    scheduled: { label: "Agendada", bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
    confirmed: { label: "Confirmada", bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
    completed: { label: "Completada", bg: "bg-gray-500/20", text: "text-gray-400", border: "border-gray-500/30" },
    cancelled: { label: "Cancelada", bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" },
    no_show: { label: "No Asistió", bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" },
};

/** Color palette for appointment blocks in calendar views */
const BLOCK_COLORS = [
    { bg: "bg-cyan/20", border: "border-cyan/40", text: "text-cyan" },
    { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-400" },
    { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-400" },
    { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-400" },
    { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-400" },
    { bg: "bg-sky-500/20", border: "border-sky-500/40", text: "text-sky-400" },
];

function getBlockColor(apt: Appointment): typeof BLOCK_COLORS[0] {
    if (apt.status === "cancelled") return { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400/60" };
    if (isOverdue(apt)) return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400" };
    // Use service name hash for consistent colors
    const hash = (apt.services?.name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return BLOCK_COLORS[hash % BLOCK_COLORS.length];
}

const WORK_START_HOUR = 8;
const WORK_END_HOUR = 21;

// ─── Overlap Layout Algorithm ───────────────────────────────────────────────

interface LayoutInfo {
    appointment: Appointment;
    columnIndex: number;
    totalColumns: number;
}

/**
 * Calculates non-overlapping column positions for appointments.
 * Appointments that overlap in time are placed side-by-side in columns.
 * Uses a greedy algorithm similar to Google Calendar's layout engine.
 */
function calculateOverlapLayout(appointments: Appointment[]): LayoutInfo[] {
    if (appointments.length === 0) return [];

    // Sort by start time, then by duration (longer first)
    const sorted = [...appointments].sort((a, b) => {
        const startDiff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
        if (startDiff !== 0) return startDiff;
        // Longer appointments first so they get earlier columns
        return differenceInMinutes(new Date(b.ends_at), new Date(b.starts_at))
            - differenceInMinutes(new Date(a.ends_at), new Date(a.starts_at));
    });

    // Build collision groups: connected sets of overlapping appointments
    const groups: Appointment[][] = [];
    let currentGroup: Appointment[] = [];
    let groupEnd = 0;

    for (const apt of sorted) {
        const aptStart = new Date(apt.starts_at).getTime();
        const aptEnd = new Date(apt.ends_at).getTime();

        if (currentGroup.length === 0 || aptStart < groupEnd) {
            // Overlaps with current group
            currentGroup.push(apt);
            groupEnd = Math.max(groupEnd, aptEnd);
        } else {
            // New group
            groups.push(currentGroup);
            currentGroup = [apt];
            groupEnd = aptEnd;
        }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    // For each group, assign columns using greedy column assignment
    const result: LayoutInfo[] = [];

    for (const group of groups) {
        const columns: Appointment[][] = []; // columns[i] = list of apts in column i

        for (const apt of group) {
            const aptStart = new Date(apt.starts_at).getTime();
            let placed = false;

            // Try to place in existing column where there's no conflict
            for (let col = 0; col < columns.length; col++) {
                const lastInCol = columns[col][columns[col].length - 1];
                const lastEnd = new Date(lastInCol.ends_at).getTime();
                if (aptStart >= lastEnd) {
                    columns[col].push(apt);
                    placed = true;
                    break;
                }
            }

            // If no column available, create a new one
            if (!placed) {
                columns.push([apt]);
            }
        }

        const totalColumns = columns.length;

        // Map back to LayoutInfo
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

    /** Compute date range based on view mode */
    const dateRange = useMemo(() => {
        switch (viewMode) {
            case "day":
                return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) };
            case "week":
                return {
                    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
                    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
                };
            case "month":
                return {
                    start: startOfMonth(selectedDate),
                    end: endOfMonth(selectedDate)
                };
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

    /** Filter appointments by status */
    const filteredAppointments = useMemo(() => {
        if (statusFilter === "all") return appointments;
        if (statusFilter === "overdue") return appointments.filter(a => isOverdue(a));
        if (statusFilter === "scheduled") return appointments.filter(a => a.status === "scheduled" && !isOverdue(a));
        return appointments.filter(a => a.status === statusFilter);
    }, [appointments, statusFilter]);

    const overdueCount = appointments.filter(a => isOverdue(a)).length;

    // Navigation handlers
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
            case "day":
                return format(selectedDate, "EEEE dd 'de' MMMM, yyyy", { locale: es });
            case "week": {
                const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
                const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
                return `${format(ws, "dd MMM", { locale: es })} — ${format(we, "dd MMM yyyy", { locale: es })}`;
            }
            case "month":
                return format(selectedDate, "MMMM yyyy", { locale: es });
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
        <div className="space-y-4 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                <div>
                    <Link href="/admin/dashboard" className="text-cyan text-sm mb-1 flex items-center hover:underline">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
                    </Link>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <CalendarIcon className="w-7 h-7 text-cyan" />
                        Agenda de Citas
                    </h1>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                    {([
                        { mode: "day" as ViewMode, icon: List, label: "Día" },
                        { mode: "week" as ViewMode, icon: CalendarDays, label: "Semana" },
                        { mode: "month" as ViewMode, icon: LayoutGrid, label: "Mes" },
                    ]).map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === mode
                                ? "bg-cyan text-white shadow-lg shadow-cyan/20"
                                : "text-blue-100/60 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toolbar: Navigation + Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/5 border border-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button onClick={goBack} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="text-center min-w-[220px]">
                        <div className="text-base font-bold text-white capitalize">{dateLabel}</div>
                    </div>
                    <button onClick={goForward} className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                    {!isCurrentPeriod && (
                        <button onClick={goToToday} className="ml-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan/20 text-cyan border border-cyan/30 hover:bg-cyan/30 transition-colors">
                            Hoy
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm text-blue-100/50">
                        <span className="font-bold text-white">{filteredAppointments.length}</span> cita{filteredAppointments.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-blue-100/40" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan/50 appearance-none cursor-pointer"
                        >
                            <option value="all" className="bg-[#0f172a]">Todos</option>
                            <option value="scheduled" className="bg-[#0f172a]">Agendadas</option>
                            <option value="overdue" className="bg-[#0f172a]">⚠ Vencidas ({overdueCount})</option>
                            <option value="completed" className="bg-[#0f172a]">Completadas</option>
                            <option value="cancelled" className="bg-[#0f172a]">Canceladas</option>
                            <option value="no_show" className="bg-[#0f172a]">No Asistió</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">{error}</div>
            )}

            {/* Calendar View */}
            <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center h-full min-h-[400px]">
                        <Loader2 className="h-8 w-8 text-cyan animate-spin" />
                    </div>
                ) : (
                    <>
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
                                onNavigateToDay={(d) => { setSelectedDate(d); setViewMode("day"); }}
                            />
                        )}
                    </>
                )}
            </div>

            {/* Detail Modal */}
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
    const HOUR_HEIGHT = 72; // pixels per hour

    const dayAppointments = appointments.filter(a =>
        isSameDay(new Date(a.starts_at), date)
    );

    return (
        <div className="overflow-y-auto h-full max-h-[calc(100vh-280px)]">
            <div className="relative" style={{ minHeight: hours.length * HOUR_HEIGHT + 40 }}>
                {/* Hour lines */}
                {hours.map((hour) => {
                    const top = (hour - WORK_START_HOUR) * HOUR_HEIGHT;
                    return (
                        <div key={hour} className="absolute left-0 right-0 flex" style={{ top }}>
                            <div className="w-16 flex-shrink-0 text-right pr-3 text-xs text-blue-100/40 font-mono -mt-2">
                                {String(hour).padStart(2, "0")}:00
                            </div>
                            <div className="flex-1 border-t border-white/5" />
                        </div>
                    );
                })}

                {/* Now indicator */}
                {isToday(date) && (() => {
                    const now = new Date();
                    const minutesSinceStart = (now.getHours() - WORK_START_HOUR) * 60 + now.getMinutes();
                    const top = (minutesSinceStart / 60) * HOUR_HEIGHT;
                    if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
                    return (
                        <div className="absolute left-16 right-0 z-20 flex items-center" style={{ top }}>
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1" />
                            <div className="flex-1 h-0.5 bg-red-500/60" />
                        </div>
                    );
                })()}

                {/* Appointment blocks with overlap handling */}
                <div className="absolute left-16 right-4 top-0 bottom-0">
                    {calculateOverlapLayout(dayAppointments).map(({ appointment: apt, columnIndex, totalColumns }) => {
                        const start = new Date(apt.starts_at);
                        const end = new Date(apt.ends_at);
                        const topMin = (start.getHours() - WORK_START_HOUR) * 60 + start.getMinutes();
                        const durationMin = differenceInMinutes(end, start);
                        const top = (topMin / 60) * HOUR_HEIGHT;
                        const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 28);
                        const color = getBlockColor(apt);
                        const widthPercent = 100 / totalColumns;
                        const leftPercent = columnIndex * widthPercent;

                        return (
                            <button
                                key={apt.id}
                                onClick={() => onSelectAppointment(apt)}
                                className={`absolute rounded-lg border px-2 py-1.5 overflow-hidden cursor-pointer transition-all hover:brightness-125 hover:z-20 ${color.bg} ${color.border} text-left`}
                                style={{
                                    top,
                                    height,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    width: `calc(${widthPercent}% - 4px)`,
                                    zIndex: 5 + columnIndex,
                                }}
                                title={`${apt.patients?.full_name} — ${apt.services?.name}`}
                            >
                                <div className={`text-xs font-bold truncate ${color.text}`}>
                                    {format(start, "HH:mm")} - {format(end, "HH:mm")}
                                </div>
                                {height > 32 && (
                                    <div className="text-[10px] text-blue-100/60 truncate mt-0.5">
                                        {apt.services?.name || "Servicio"}
                                    </div>
                                )}
                                {height > 48 && (
                                    <div className="text-[10px] text-white/80 font-semibold truncate">
                                        {apt.patients?.full_name || "Paciente"}
                                    </div>
                                )}
                                {isOverdue(apt) && (
                                    <AlertTriangle className="absolute top-1.5 right-1.5 w-3 h-3 text-amber-400" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Empty state */}
                {dayAppointments.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <CalendarIcon className="w-12 h-12 text-blue-100/15 mx-auto mb-3" />
                            <p className="text-blue-100/40 text-sm">No hay citas para este día</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── WEEK VIEW (7-column grid) ──────────────────────────────────────────────

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
    const HOUR_HEIGHT = 60;

    return (
        <div className="overflow-auto h-full max-h-[calc(100vh-280px)]">
            {/* Day headers */}
            <div className="sticky top-0 z-30 bg-[#0c1528] border-b border-white/10 flex">
                <div className="w-14 flex-shrink-0" />
                {weekDays.map((day) => {
                    const today = isToday(day);
                    return (
                        <div key={day.toISOString()} className="flex-1 text-center py-2 border-l border-white/5">
                            <button
                                onClick={() => onNavigateToDay(day)}
                                className={`hover:bg-white/5 rounded-lg px-2 py-1 transition-colors ${today ? "ring-1 ring-cyan/50" : ""}`}
                            >
                                <div className="text-[10px] text-blue-100/50 uppercase font-bold">
                                    {format(day, "EEE", { locale: es })}
                                </div>
                                <div className={`text-sm font-bold ${today ? "text-cyan" : "text-white"}`}>
                                    {format(day, "dd")}
                                </div>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Time grid */}
            <div className="relative flex" style={{ minHeight: hours.length * HOUR_HEIGHT }}>
                {/* Hour labels */}
                <div className="w-14 flex-shrink-0">
                    {hours.map((hour) => (
                        <div
                            key={hour}
                            className="text-right pr-2 text-[10px] text-blue-100/35 font-mono"
                            style={{ height: HOUR_HEIGHT, lineHeight: "16px" }}
                        >
                            {String(hour).padStart(2, "0")}:00
                        </div>
                    ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day) => {
                    const dayApts = appointments.filter(a => isSameDay(new Date(a.starts_at), day));
                    const today = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            className={`flex-1 relative border-l border-white/5 ${today ? "bg-cyan/[0.03]" : ""}`}
                        >
                            {/* Hour grid lines */}
                            {hours.map((hour) => (
                                <div
                                    key={hour}
                                    className="border-t border-white/5"
                                    style={{ height: HOUR_HEIGHT }}
                                />
                            ))}

                            {/* Now line (only for today) */}
                            {today && (() => {
                                const now = new Date();
                                const minutesSinceStart = (now.getHours() - WORK_START_HOUR) * 60 + now.getMinutes();
                                const top = (minutesSinceStart / 60) * HOUR_HEIGHT;
                                if (top < 0 || top > hours.length * HOUR_HEIGHT) return null;
                                return (
                                    <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top }}>
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <div className="flex-1 h-px bg-red-500/60" />
                                    </div>
                                );
                            })()}

                            {/* Appointment blocks with overlap handling */}
                            {calculateOverlapLayout(dayApts).map(({ appointment: apt, columnIndex, totalColumns }) => {
                                const start = new Date(apt.starts_at);
                                const end = new Date(apt.ends_at);
                                const topMin = (start.getHours() - WORK_START_HOUR) * 60 + start.getMinutes();
                                const durationMin = differenceInMinutes(end, start);
                                const top = (topMin / 60) * HOUR_HEIGHT;
                                const height = Math.max((durationMin / 60) * HOUR_HEIGHT, 22);
                                const color = getBlockColor(apt);
                                const widthPercent = 100 / totalColumns;
                                const leftPercent = columnIndex * widthPercent;

                                return (
                                    <button
                                        key={apt.id}
                                        onClick={() => onSelectAppointment(apt)}
                                        className={`absolute rounded-md border px-1 py-0.5 overflow-hidden cursor-pointer transition-all hover:brightness-125 hover:z-20 ${color.bg} ${color.border} text-left`}
                                        style={{
                                            top,
                                            height,
                                            left: `calc(${leftPercent}% + 1px)`,
                                            width: `calc(${widthPercent}% - 2px)`,
                                            zIndex: 5 + columnIndex,
                                        }}
                                        title={`${apt.patients?.full_name} — ${apt.services?.name}`}
                                    >
                                        <div className={`text-[10px] font-bold truncate ${color.text}`}>
                                            {format(start, "HH:mm")}-{format(end, "HH:mm")}
                                        </div>
                                        {height > 26 && (
                                            <div className="text-[9px] text-blue-100/55 truncate">
                                                {apt.services?.name}
                                            </div>
                                        )}
                                        {height > 40 && (
                                            <div className="text-[9px] text-white/70 font-medium truncate">
                                                {apt.patients?.full_name?.split(" ").slice(0, 2).join(" ") || ""}
                                            </div>
                                        )}
                                        {isOverdue(apt) && (
                                            <AlertTriangle className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-amber-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── MONTH VIEW (Calendar grid) ─────────────────────────────────────────────

function MonthView({
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

    const weekDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    /** Group appointments by day */
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
        <div className="h-full flex flex-col overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-white/10">
                {weekDayLabels.map((day) => (
                    <div key={day} className="text-center py-2 text-[10px] text-blue-100/50 font-bold uppercase tracking-wider border-l border-white/5 first:border-l-0">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                {calendarDays.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayApts = appointmentsByDay.get(dayKey) || [];
                    const isCurrentMonth = day.getMonth() === date.getMonth();
                    const today = isToday(day);
                    const hasOverdue = dayApts.some(a => isOverdue(a));
                    const scheduledCount = dayApts.filter(a => a.status === "scheduled" && !isOverdue(a)).length;
                    const cancelledCount = dayApts.filter(a => a.status === "cancelled").length;

                    return (
                        <button
                            key={dayKey}
                            onClick={() => onNavigateToDay(day)}
                            className={`border-l border-b border-white/5 first:border-l-0 p-1.5 text-left transition-colors hover:bg-white/5 cursor-pointer min-h-[90px] ${!isCurrentMonth ? "opacity-30" : ""
                                } ${today ? "bg-cyan/[0.05] ring-1 ring-inset ring-cyan/20" : ""}`}
                        >
                            {/* Day number */}
                            <div className={`text-xs font-bold mb-1 ${today ? "text-cyan" : isCurrentMonth ? "text-white" : "text-blue-100/30"}`}>
                                {format(day, "d")}
                            </div>

                            {/* Appointment indicators */}
                            {dayApts.length > 0 && (
                                <div className="space-y-0.5">
                                    {dayApts.slice(0, 3).map((apt) => {
                                        const color = getBlockColor(apt);
                                        return (
                                            <div
                                                key={apt.id}
                                                className={`text-[9px] px-1 py-0.5 rounded truncate ${color.bg} ${color.text} border ${color.border}`}
                                            >
                                                {format(new Date(apt.starts_at), "HH:mm")}-{format(new Date(apt.ends_at), "HH:mm")} {apt.patients?.full_name?.split(" ")[0] || "Cita"}
                                            </div>
                                        );
                                    })}
                                    {dayApts.length > 3 && (
                                        <div className="text-[9px] text-blue-100/40 font-medium pl-1">
                                            +{dayApts.length - 3} más
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status indicators */}
                            {dayApts.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                    {scheduledCount > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" title={`${scheduledCount} agendadas`} />
                                    )}
                                    {hasOverdue && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Hay vencidas" />
                                    )}
                                    {cancelledCount > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" title={`${cancelledCount} canceladas`} />
                                    )}
                                </div>
                            )}
                        </button>
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
    const overdue = isOverdue(apt);
    const statusCfg = overdue
        ? { label: "Vencida", bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" }
        : STATUS_CONFIG[apt.status] || { label: apt.status, bg: "bg-white/10", text: "text-white/70", border: "border-white/20" };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                            {overdue && <AlertTriangle className="w-3 h-3" />}
                            {statusCfg.label}
                        </span>
                        <h2 className="text-xl font-black text-white mt-2">
                            {apt.patients?.full_name || "Paciente"}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-blue-100/40 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                {/* Details */}
                <div className="space-y-3">
                    <DetailRow icon={<CalendarIcon className="w-4 h-4 text-cyan" />} label="Fecha">
                        {format(new Date(apt.starts_at), "EEEE dd 'de' MMMM, yyyy", { locale: es })}
                    </DetailRow>
                    <DetailRow icon={<Clock className="w-4 h-4 text-cyan" />} label="Hora">
                        {format(new Date(apt.starts_at), "HH:mm")} — {format(new Date(apt.ends_at), "HH:mm")}
                    </DetailRow>
                    <DetailRow icon={<CalendarDays className="w-4 h-4 text-cyan" />} label="Servicio">
                        {apt.services?.name || "—"}
                    </DetailRow>
                    <DetailRow icon={<UserCircle className="w-4 h-4 text-cyan" />} label="Profesional">
                        {getProfessionalName(apt)}
                    </DetailRow>
                    {getResourceName(apt) && (
                        <DetailRow icon={<LayoutGrid className="w-4 h-4 text-cyan" />} label="Recurso">
                            {getResourceName(apt)}
                        </DetailRow>
                    )}
                    {apt.patients?.phone && (
                        <DetailRow icon={<User className="w-4 h-4 text-cyan" />} label="Teléfono">
                            {apt.patients.phone}
                        </DetailRow>
                    )}
                    {apt.patients?.email && (
                        <DetailRow icon={<User className="w-4 h-4 text-cyan" />} label="Email">
                            {apt.patients.email}
                        </DetailRow>
                    )}
                    {apt.notes && (
                        <div className="pt-2 border-t border-white/10">
                            <p className="text-xs text-blue-100/40 mb-1">Notas</p>
                            <p className="text-sm text-blue-100/70">{apt.notes}</p>
                        </div>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-blue-100/70 hover:bg-white/10 transition-colors"
                >
                    Cerrar
                </button>
            </div>
        </div>
    );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5">{icon}</div>
            <div>
                <p className="text-[10px] text-blue-100/40 uppercase tracking-wider font-bold">{label}</p>
                <p className="text-sm text-white">{children}</p>
            </div>
        </div>
    );
}
