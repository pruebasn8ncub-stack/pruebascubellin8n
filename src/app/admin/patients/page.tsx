"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Edit, Trash2, Search } from "lucide-react";

interface Patient {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    notes: string | null;
    created_at: string;
}

const emptyForm = { full_name: '', email: '', phone: '', notes: '' };

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(emptyForm);

    const fetchPatients = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('patients')
            .select('*')
            .is('deleted_at', null)
            .order('full_name', { ascending: true });
        if (!error && data) setPatients(data);
        setLoading(false);
    };

    useEffect(() => { fetchPatients(); }, []);

    const handleOpenModal = (patient?: Patient) => {
        if (patient) {
            setEditingPatient(patient);
            setFormData({
                full_name: patient.full_name,
                email: patient.email || '',
                phone: patient.phone || '',
                notes: patient.notes || '',
            });
        } else {
            setEditingPatient(null);
            setFormData(emptyForm);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPatient(null);
        setFormData(emptyForm);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name.trim()) return;

        setSaving(true);
        const payload = {
            full_name: formData.full_name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            notes: formData.notes.trim() || null,
        };

        if (editingPatient) {
            const { error } = await supabase
                .from('patients')
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq('id', editingPatient.id);
            if (!error) { fetchPatients(); handleCloseModal(); }
            else alert("Error al editar: " + error.message);
        } else {
            const { error } = await supabase.from('patients').insert([payload]);
            if (!error) { fetchPatients(); handleCloseModal(); }
            else alert("Error al crear: " + error.message);
        }
        setSaving(false);
    };

    const handleSoftDelete = async (id: string) => {
        if (confirm("¿Archivar este paciente? Puedes recuperarlo desde la base de datos.")) {
            const { error } = await supabase
                .from('patients')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', id);
            if (!error) fetchPatients();
            else alert("Error al archivar: " + error.message);
        }
    };

    const filteredPatients = patients.filter(p =>
        p.full_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
        (p.phone && p.phone.includes(search))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                        Pacientes
                    </h1>
                    <p className="text-blue-100/50 text-sm mt-1">{patients.length} paciente(s) registrado(s)</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={fetchPatients}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 text-cyan ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Paciente
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/40" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, email o teléfono..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-blue-100/30 focus:outline-none focus:ring-2 focus:ring-cyan/50"
                />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                {loading && patients.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-blue-100/60 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 font-medium">Nombre Completo</th>
                                <th className="p-4 font-medium">Email</th>
                                <th className="p-4 font-medium">Teléfono</th>
                                <th className="p-4 font-medium">Notas Clínicas</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-blue-100/60">
                                        {search ? 'No se encontraron resultados para tu búsqueda.' : 'No hay pacientes registrados aún.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredPatients.map(patient => (
                                    <tr key={patient.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 font-semibold">{patient.full_name}</td>
                                        <td className="p-4 text-blue-100/70">{patient.email || <span className="text-white/20 italic text-xs">sin email</span>}</td>
                                        <td className="p-4 text-blue-100/70">{patient.phone || <span className="text-white/20 italic text-xs">sin teléfono</span>}</td>
                                        <td className="p-4 max-w-xs">
                                            {patient.notes ? (
                                                <span className="text-blue-100/50 text-sm line-clamp-1" title={patient.notes}>
                                                    {patient.notes}
                                                </span>
                                            ) : (
                                                <span className="text-white/20 italic text-xs">sin notas</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(patient)}
                                                className="p-2 text-blue-300 hover:text-cyan hover:bg-white/10 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSoftDelete(patient.id)}
                                                className="p-2 text-red-300/60 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Archivar paciente"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
                    <div className="bg-[#0b1a2e] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-5 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">
                                {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-1 text-white/50 hover:text-white rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    placeholder="Ej. María González Pérez"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-blue-100/80 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                        placeholder="+56 9 1234 5678"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Notas Clínicas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 resize-none"
                                    placeholder="Diagnóstico, alergias, observaciones relevantes..."
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
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
                                    {saving ? 'Guardando...' : 'Guardar Paciente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
