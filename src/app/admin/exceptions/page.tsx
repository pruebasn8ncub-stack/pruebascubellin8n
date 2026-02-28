"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Trash2, CalendarOff, Building2, User, Wrench } from "lucide-react";

interface Exception {
    id: string;
    professional_id: string | null;
    physical_resource_id: string | null;
    starts_at: string;
    ends_at: string;
    reason: string | null;
    created_at: string;
    profiles?: { full_name: string } | null;
    physical_resources?: { name: string } | null;
}

interface Professional {
    id: string;
    full_name: string;
}

interface Resource {
    id: string;
    name: string;
}

type ExceptionType = 'clinic' | 'professional' | 'resource';

const initialForm = {
    type: 'clinic' as ExceptionType,
    professional_id: '',
    physical_resource_id: '',
    start_date: '',
    start_time: '08:00',
    end_date: '',
    end_time: '20:00',
    reason: '',
};

export default function ExceptionsPage() {
    const [exceptions, setExceptions] = useState<Exception[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(initialForm);

    const fetchData = async () => {
        setLoading(true);
        const [excRes, profRes, resRes] = await Promise.all([
            supabase
                .from('schedule_exceptions')
                .select('*, profiles:professional_id (full_name), physical_resources:physical_resource_id (name)')
                .order('starts_at', { ascending: false }),
            supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'professional'),
            supabase
                .from('physical_resources')
                .select('id, name'),
        ]);

        if (!excRes.error && excRes.data) setExceptions(excRes.data);
        if (!profRes.error && profRes.data) setProfessionals(profRes.data);
        if (!resRes.error && resRes.data) setResources(resRes.data);
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenModal = () => {
        setFormData({
            ...initialForm,
            professional_id: professionals[0]?.id || '',
            physical_resource_id: resources[0]?.id || '',
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.start_date || !formData.start_time || !formData.end_date || !formData.end_time) return;

        setSaving(true);

        const starts_at = `${formData.start_date}T${formData.start_time}:00`;
        const ends_at = `${formData.end_date}T${formData.end_time}:00`;

        if (new Date(ends_at) <= new Date(starts_at)) {
            alert('La fecha/hora de fin debe ser posterior a la de inicio.');
            setSaving(false);
            return;
        }

        const insertData: Record<string, unknown> = {
            starts_at,
            ends_at,
            reason: formData.reason || null,
            professional_id: null,
            physical_resource_id: null,
        };

        if (formData.type === 'professional') {
            insertData.professional_id = formData.professional_id || null;
        } else if (formData.type === 'resource') {
            insertData.physical_resource_id = formData.physical_resource_id || null;
        }

        const { error } = await supabase.from('schedule_exceptions').insert([insertData]);

        if (!error) {
            fetchData();
            setIsModalOpen(false);
        } else {
            alert('Error al guardar: ' + error.message);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Eliminar esta excepción / bloqueo?")) {
            const { error } = await supabase.from('schedule_exceptions').delete().eq('id', id);
            if (!error) fetchData();
            else alert("Error al eliminar: " + error.message);
        }
    };

    const getExceptionTypeInfo = (exc: Exception) => {
        if (exc.professional_id && exc.profiles) {
            return {
                icon: <User className="w-4 h-4" />,
                label: exc.profiles.full_name,
                color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                type: 'Profesional ausente',
            };
        }
        if (exc.physical_resource_id && exc.physical_resources) {
            return {
                icon: <Wrench className="w-4 h-4" />,
                label: exc.physical_resources.name,
                color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                type: 'Recurso bloqueado',
            };
        }
        return {
            icon: <Building2 className="w-4 h-4" />,
            label: 'Toda la clínica',
            color: 'bg-red-500/10 text-red-400 border-red-500/20',
            type: 'Clínica cerrada',
        };
    };

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-CL', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
        }) + ' ' + d.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const isSameDay = (a: string, b: string) => {
        return new Date(a).toDateString() === new Date(b).toDateString();
    };

    // Separate into upcoming and past
    const now = new Date();
    const upcoming = exceptions.filter(e => new Date(e.ends_at) >= now);
    const past = exceptions.filter(e => new Date(e.ends_at) < now);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                        Excepciones y Bloqueos
                    </h1>
                    <p className="text-blue-100/50 text-sm mt-1">
                        Feriados, ausencias de profesionales y mantención de equipos.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={fetchData}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 text-cyan ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={handleOpenModal}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Bloqueo
                    </button>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 p-4 bg-cyan/5 border border-cyan/20 rounded-2xl">
                <CalendarOff className="w-5 h-5 text-cyan mt-0.5 flex-shrink-0" />
                <div>
                    <p className="text-cyan font-semibold text-sm">¿Cómo funcionan los bloqueos?</p>
                    <p className="text-blue-100/60 text-xs mt-0.5">
                        <strong className="text-white">Clínica cerrada:</strong> Bloquea toda la agenda (feriados, vacaciones colectivas).{' '}
                        <strong className="text-white">Profesional ausente:</strong> Solo bloquea la agenda de esa kinesióloga.{' '}
                        <strong className="text-white">Recurso bloqueado:</strong> Impide agendar ese equipo (mantención).
                    </p>
                </div>
            </div>

            {loading && exceptions.length === 0 ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                </div>
            ) : exceptions.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-blue-100/60">
                    No hay excepciones configuradas. Crea la primera para bloquear un feriado o una ausencia.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Upcoming / Active */}
                    {upcoming.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-blue-100/50 uppercase tracking-wider mb-3">
                                Vigentes y Próximas ({upcoming.length})
                            </h2>
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-blue-100/60 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="p-4 font-medium">Tipo</th>
                                            <th className="p-4 font-medium">Afecta a</th>
                                            <th className="p-4 font-medium">Periodo</th>
                                            <th className="p-4 font-medium">Motivo</th>
                                            <th className="p-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {upcoming.map(exc => {
                                            const info = getExceptionTypeInfo(exc);
                                            return (
                                                <tr key={exc.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${info.color}`}>
                                                            {info.icon}
                                                            {info.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-medium">{info.label}</td>
                                                    <td className="p-4 text-sm">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-green-400 text-[10px] font-bold uppercase">Desde</span>
                                                                <span>{formatDateTime(exc.starts_at)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-red-400 text-[10px] font-bold uppercase">Hasta</span>
                                                                <span>{formatDateTime(exc.ends_at)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-sm text-blue-100/50 max-w-[200px] truncate">
                                                        {exc.reason || '—'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleDelete(exc.id)}
                                                            className="p-2 text-red-400/70 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Past */}
                    {past.length > 0 && (
                        <div>
                            <h2 className="text-sm font-semibold text-blue-100/30 uppercase tracking-wider mb-3">
                                Pasadas ({past.length})
                            </h2>
                            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm opacity-60">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 text-blue-100/40 uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="p-4 font-medium">Tipo</th>
                                            <th className="p-4 font-medium">Afecta a</th>
                                            <th className="p-4 font-medium">Fecha</th>
                                            <th className="p-4 font-medium">Motivo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {past.map(exc => {
                                            const info = getExceptionTypeInfo(exc);
                                            return (
                                                <tr key={exc.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${info.color}`}>
                                                            {info.icon}
                                                            {info.type}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-medium text-sm">{info.label}</td>
                                                    <td className="p-4 text-sm">{formatDateTime(exc.starts_at)} → {formatDateTime(exc.ends_at)}</td>
                                                    <td className="p-4 text-sm text-blue-100/40">{exc.reason || '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
                    <div className="bg-[#0b1a2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-5 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">Nuevo Bloqueo</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 text-white/50 hover:text-white rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Exception Type */}
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-2">Tipo de Bloqueo</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { value: 'clinic', label: 'Clínica', icon: Building2, desc: 'Cierre total' },
                                        { value: 'professional', label: 'Profesional', icon: User, desc: 'Ausencia' },
                                        { value: 'resource', label: 'Recurso', icon: Wrench, desc: 'Mantención' },
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: opt.value })}
                                            className={`p-3 rounded-xl border text-center transition-all ${formData.type === opt.value
                                                ? 'border-cyan bg-cyan/10 text-white'
                                                : 'border-white/10 bg-white/5 text-blue-100/60 hover:bg-white/10'
                                                }`}
                                        >
                                            <opt.icon className="w-5 h-5 mx-auto mb-1" />
                                            <span className="text-xs font-medium block">{opt.label}</span>
                                            <span className="text-[10px] opacity-60">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Professional selector */}
                            {formData.type === 'professional' && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Profesional</label>
                                    <select
                                        required
                                        value={formData.professional_id}
                                        onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                    >
                                        {professionals.length === 0 ? (
                                            <option value="">No hay profesionales registrados</option>
                                        ) : professionals.map(p => (
                                            <option key={p.id} value={p.id}>{p.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Resource selector */}
                            {formData.type === 'resource' && (
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Recurso Físico</label>
                                    <select
                                        required
                                        value={formData.physical_resource_id}
                                        onChange={(e) => setFormData({ ...formData, physical_resource_id: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                    >
                                        {resources.length === 0 ? (
                                            <option value="">No hay recursos registrados</option>
                                        ) : resources.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Start datetime */}
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Inicio del bloqueo</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-100/60 mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.start_date}
                                            onChange={(e) => setFormData({ ...formData, start_date: e.target.value, end_date: formData.end_date || e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-100/60 mb-1">Hora</label>
                                        <input
                                            type="time"
                                            required
                                            value={formData.start_time}
                                            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* End datetime */}
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Fin del bloqueo</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-100/60 mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.end_date}
                                            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                            min={formData.start_date}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-100/60 mb-1">Hora</label>
                                        <input
                                            type="time"
                                            required
                                            value={formData.end_time}
                                            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Motivo (opcional)</label>
                                <input
                                    type="text"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    placeholder="Ej. Feriado Nacional, Licencia médica..."
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-blue-100/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Guardando...' : 'Crear Bloqueo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
