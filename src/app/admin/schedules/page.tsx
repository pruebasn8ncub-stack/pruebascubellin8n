"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Trash2 } from "lucide-react";

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Schedule {
    id: string;
    professional_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    profiles?: { full_name: string };
}

interface Professional {
    id: string;
    full_name: string;
}

const initialForm = {
    professional_id: '',
    day_of_week: 0,
    start_time: '08:00',
    end_time: '18:00',
};

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(initialForm);

    const fetchData = async () => {
        setLoading(true);
        const [schedulesRes, profRes] = await Promise.all([
            supabase
                .from('professional_schedules')
                .select('*, profiles:professional_id (full_name)')
                .order('day_of_week', { ascending: true }),
            supabase
                .from('profiles')
                .select('id, full_name')
                .eq('role', 'professional'),
        ]);

        if (!schedulesRes.error && schedulesRes.data) setSchedules(schedulesRes.data);
        if (!profRes.error && profRes.data) {
            setProfessionals(profRes.data);
            if (profRes.data.length > 0 && !formData.professional_id) {
                setFormData(f => ({ ...f, professional_id: profRes.data[0].id }));
            }
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenModal = () => {
        setFormData({ ...initialForm, professional_id: professionals[0]?.id || '' });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.professional_id) return;
        if (formData.start_time >= formData.end_time) {
            alert("La hora de inicio debe ser anterior a la hora de fin.");
            return;
        }

        setSaving(true);
        const { error } = await supabase.from('professional_schedules').insert([{
            professional_id: formData.professional_id,
            day_of_week: Number(formData.day_of_week),
            start_time: formData.start_time,
            end_time: formData.end_time,
        }]);

        if (!error) {
            fetchData();
            setIsModalOpen(false);
        } else {
            alert("Error al guardar: " + error.message);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Eliminar este bloque de horario?")) {
            const { error } = await supabase.from('professional_schedules').delete().eq('id', id);
            if (!error) fetchData();
            else alert("Error al eliminar: " + error.message);
        }
    };

    // Group schedules by professional for easier reading
    const schedulesByProfessional = schedules.reduce((acc, s) => {
        const name = s.profiles?.full_name || 'Sin nombre';
        if (!acc[name]) acc[name] = [];
        acc[name].push(s);
        return acc;
    }, {} as Record<string, Schedule[]>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                        Horarios Profesionales
                    </h1>
                    <p className="text-blue-100/50 text-sm mt-1">Define los bloques de disponibilidad semanal de cada kinesióloga.</p>
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
                        Añadir Bloque
                    </button>
                </div>
            </div>

            {/* Capacity rule info banner */}
            <div className="flex items-start gap-3 p-4 bg-cyan/5 border border-cyan/20 rounded-2xl">
                <span className="text-cyan text-xl mt-0.5">⚡</span>
                <div>
                    <p className="text-cyan font-semibold text-sm">Lógica de Capacidad Concurrente Activa</p>
                    <p className="text-blue-100/60 text-xs mt-0.5">
                        Una kinesióloga puede atender <strong className="text-white">2 cámaras hiperbáricas simultáneas</strong> (capacidad 0.5 c/u).
                        Los servicios de Kinesiología estándar consumen su capacidad completa (1.0). Esta regla se aplica automáticamente al crear citas.
                    </p>
                </div>
            </div>

            {loading && schedules.length === 0 ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                </div>
            ) : schedules.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center text-blue-100/60">
                    No hay horarios configurados. Añade el primer bloque de disponibilidad.
                </div>
            ) : (
                Object.entries(schedulesByProfessional).map(([profName, profSchedules]) => (
                    <div key={profName} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                                {profName.charAt(0)}
                            </div>
                            <span className="font-semibold text-white">{profName}</span>
                            <span className="ml-auto text-xs text-blue-100/50">{profSchedules.length} bloque(s)</span>
                        </div>
                        <table className="w-full text-left">
                            <thead className="text-blue-100/50 uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-5 py-3 font-medium">Día</th>
                                    <th className="px-5 py-3 font-medium">Hora Entrada</th>
                                    <th className="px-5 py-3 font-medium">Hora Salida</th>
                                    <th className="px-5 py-3 font-medium">Duración Total</th>
                                    <th className="px-5 py-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {profSchedules
                                    .sort((a, b) => a.day_of_week - b.day_of_week)
                                    .map(schedule => {
                                        const [sh, sm] = schedule.start_time.split(':').map(Number);
                                        const [eh, em] = schedule.end_time.split(':').map(Number);
                                        const totalMin = (eh * 60 + em) - (sh * 60 + sm);
                                        const totalH = Math.floor(totalMin / 60);
                                        const remainMin = totalMin % 60;
                                        return (
                                            <tr key={schedule.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-5 py-3 font-semibold text-cyan">{DAYS[schedule.day_of_week]}</td>
                                                <td className="px-5 py-3">{schedule.start_time.slice(0, 5)}</td>
                                                <td className="px-5 py-3">{schedule.end_time.slice(0, 5)}</td>
                                                <td className="px-5 py-3 text-blue-100/60 text-sm">
                                                    {totalH > 0 ? `${totalH}h ` : ''}{remainMin > 0 ? `${remainMin}min` : ''}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDelete(schedule.id)}
                                                        className="p-2 text-red-400/70 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                                        title="Eliminar bloque"
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
                ))
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
                    <div className="bg-[#0b1a2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-5 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">Nuevo Bloque de Horario</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 text-white/50 hover:text-white rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Kinesióloga / Profesional</label>
                                <select
                                    required
                                    value={formData.professional_id}
                                    onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                >
                                    {professionals.length === 0 ? (
                                        <option value="">No hay profesionales registrados (crea usuarios con rol professional)</option>
                                    ) : professionals.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Día de la Semana</label>
                                <select
                                    value={formData.day_of_week}
                                    onChange={(e) => setFormData({ ...formData, day_of_week: Number(e.target.value) })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                >
                                    {DAYS.map((day, i) => (
                                        <option key={i} value={i}>{day}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Hora de Entrada</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.start_time}
                                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Hora de Salida</label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.end_time}
                                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    />
                                </div>
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
                                    disabled={saving || professionals.length === 0}
                                    className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Guardando...' : 'Guardar Bloque'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
