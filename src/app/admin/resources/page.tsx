"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Edit, Trash2 } from "lucide-react";

export default function ResourcesPage() {
    const [resources, setResources] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResource, setEditingResource] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ name: '', type: 'chamber', is_active: true });

    const fetchResources = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('physical_resources').select('*').order('created_at', { ascending: false });
        if (!error && data) {
            setResources(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchResources();
    }, []);

    const handleOpenModal = (resource?: any) => {
        if (resource) {
            setEditingResource(resource);
            setFormData({ name: resource.name, type: resource.type, is_active: resource.is_active });
        } else {
            setEditingResource(null);
            setFormData({ name: '', type: 'chamber', is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingResource(null);
        setFormData({ name: '', type: 'chamber', is_active: true });
    };

    const handleToggleActive = async (id: string, currentValue: boolean) => {
        // Optimistic UI: update locally first for instant feedback
        setResources(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentValue } : r));
        const { error } = await supabase
            .from('physical_resources')
            .update({ is_active: !currentValue })
            .eq('id', id);
        if (error) {
            // Revert on failure
            setResources(prev => prev.map(r => r.id === id ? { ...r, is_active: currentValue } : r));
            alert('Error al cambiar el estado: ' + error.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSaving(true);
        if (editingResource) {
            // Update
            const { error } = await supabase
                .from('physical_resources')
                .update({ name: formData.name, type: formData.type, is_active: formData.is_active })
                .eq('id', editingResource.id);
            if (!error) {
                fetchResources();
                handleCloseModal();
            } else {
                alert("Error al editar el recurso: " + error.message);
            }
        } else {
            // Create
            const { error } = await supabase
                .from('physical_resources')
                .insert([{ name: formData.name, type: formData.type, is_active: formData.is_active }]);
            if (!error) {
                fetchResources();
                handleCloseModal();
            } else {
                alert("Error al crear el recurso: " + error.message);
            }
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este recurso físico? No podrás hacerlo si ya está vinculado a alguna cita pasada o futura.")) {
            const { error } = await supabase.from('physical_resources').delete().eq('id', id);
            if (!error) {
                fetchResources();
            } else {
                alert("Error al eliminar: " + error.message);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                    Recursos Físicos
                </h1>
                <div className="flex gap-4">
                    <button
                        onClick={fetchResources}
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
                        Nuevo Recurso
                    </button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                {loading && resources.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-blue-100/60 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 font-medium">Nombre (ej. Box 1)</th>
                                <th className="p-4 font-medium">Tipo (Box/Cámara)</th>
                                <th className="p-4 font-medium">Estado</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {resources.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-blue-100/60">
                                        No hay recursos registrados.
                                    </td>
                                </tr>
                            ) : (
                                resources.map(resource => (
                                    <tr key={resource.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 font-medium">{resource.name}</td>
                                        <td className="p-4 capitalize">{resource.type === 'chamber' ? 'Cámara Hiperbárica' : 'Box Kinesiológico'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => handleToggleActive(resource.id, resource.is_active)}
                                                    title={resource.is_active ? 'Deshabilitar recurso' : 'Habilitar recurso'}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${resource.is_active ? 'bg-green-500' : 'bg-red-500/70'}`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${resource.is_active ? 'translate-x-6' : 'translate-x-1'}`}
                                                    />
                                                </button>
                                                {resource.is_active ?
                                                    <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded-md text-xs font-medium">Operativo</span> :
                                                    <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded-md text-xs font-medium">En Mantención</span>
                                                }
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(resource)}
                                                    className="p-2 text-blue-300 hover:text-cyan hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(resource.id)}
                                                    className="p-2 text-red-300 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
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
                    <div className="bg-[#0b1a2e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">
                                {editingResource ? 'Editar Recurso' : 'Nuevo Recurso Físico'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-1 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Nombre del Recurso</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    placeholder="Ej. Cámara A, Box 2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Tipo de Instalación</label>
                                <select
                                    required
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                >
                                    <option value="chamber" className="text-black">Cámara Hiperbárica</option>
                                    <option value="box" className="text-black">Box Clínico</option>
                                </select>
                            </div>

                            <label className="flex items-center gap-3 p-4 bg-navy/30 border border-white/5 rounded-xl cursor-pointer hover:bg-navy/50 transition-colors">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan"></div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">Recurso Operativo</p>
                                    <p className="text-xs text-blue-100/60">Apágalo si requiere mantenimiento.</p>
                                </div>
                            </label>

                            <div className="pt-4 flex justify-end gap-3">
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
                                    {saving ? 'Guardando...' : 'Guardar Recurso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
