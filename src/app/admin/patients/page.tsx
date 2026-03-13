"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Edit, Trash2, Search } from "lucide-react";

interface Patient {
    id: string;
    full_name: string;
    rut: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    created_at: string;
}

const emptyForm = { full_name: '', rut: '', email: '', phone: '', notes: '' };

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
                rut: patient.rut || '',
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
            rut: formData.rut.trim() || null,
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            notes: formData.notes.trim(),
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
        (p.rut && p.rut.toLowerCase().includes(search.toLowerCase())) ||
        (p.email && p.email.toLowerCase().includes(search.toLowerCase())) ||
        (p.phone && p.phone.includes(search))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-teal-dark">
                        Pacientes
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">{patients.length} paciente(s) registrado(s)</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={fetchPatients}
                        className="p-2 bg-white hover:bg-slate-50 rounded-xl transition-all"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 text-teal ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-gradient-to-r from-teal to-blue-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-teal/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Paciente
                    </button>
                </div>
            </div>

            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por nombre, RUT, email o teléfono..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal/50"
                />
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden ">
                {loading && patients.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-teal animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white text-slate-500 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 font-medium">Nombre Completo</th>
                                <th className="p-4 font-medium">RUT</th>
                                <th className="p-4 font-medium">Email</th>
                                <th className="p-4 font-medium">Teléfono</th>
                                <th className="p-4 font-medium">Notas Clínicas</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">
                                        {search ? 'No se encontraron resultados para tu búsqueda.' : 'No hay pacientes registrados aún.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredPatients.map(patient => (
                                    <tr key={patient.id} className="hover:bg-white transition-colors group">
                                        <td className="p-4 font-semibold">{patient.full_name}</td>
                                        <td className="p-4 text-slate-600 font-mono text-sm">{patient.rut || <span className="text-slate-800/20 italic text-xs">sin RUT</span>}</td>
                                        <td className="p-4 text-slate-600">{patient.email || <span className="text-slate-800/20 italic text-xs">sin email</span>}</td>
                                        <td className="p-4 text-slate-600">{patient.phone || <span className="text-slate-800/20 italic text-xs">sin teléfono</span>}</td>
                                        <td className="p-4 max-w-xs">
                                            {patient.notes ? (
                                                <span className="text-slate-500 text-sm line-clamp-1" title={patient.notes}>
                                                    {patient.notes}
                                                </span>
                                            ) : (
                                                <span className="text-slate-800/20 italic text-xs">sin notas</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(patient)}
                                                className="p-2 text-slate-500 hover:text-teal hover:bg-slate-50 rounded-lg transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSoftDelete(patient.id)}
                                                className="p-2 text-red-300/60 hover:text-red-400 hover:bg-slate-50 rounded-lg transition-colors"
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h2 className="text-base font-semibold text-slate-800">
                                {editingPatient ? 'Editar Paciente' : 'Nuevo Paciente'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombre Completo *</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.full_name}
                                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                                            placeholder="Nombre y Apellido"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">RUT</label>
                                        <input
                                            type="text"
                                            value={formData.rut}
                                            onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                                            placeholder="12345678-9"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                                            placeholder="correo@ejemplo.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono *</label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
                                            placeholder="+569XXXXXXXX"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Notas Clínicas</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all resize-none"
                                        placeholder="Diagnóstico, alergias, observaciones relevantes..."
                                    />
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-3xl">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2.5 text-sm font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-teal text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg hover:bg-teal-dark transition-all disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Guardando...' : (editingPatient ? 'Guardar Cambios' : 'Guardar Paciente')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
