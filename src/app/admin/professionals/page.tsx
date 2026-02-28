"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Edit, Trash2, UserPlus } from "lucide-react";

interface Professional {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email?: string;
}

export default function ProfessionalsPage() {
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'professional' as string,
    });

    const fetchProfessionals = async () => {
        setLoading(true);

        // Fetch profiles with role professional or admin
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['professional', 'admin'])
            .order('created_at', { ascending: false });

        if (!error && data) {
            setProfessionals(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProfessionals();
    }, []);

    const handleOpenModal = (professional?: Professional) => {
        if (professional) {
            setEditingProfessional(professional);
            setFormData({
                full_name: professional.full_name,
                email: '',
                password: '',
                role: professional.role,
            });
        } else {
            setEditingProfessional(null);
            setFormData({ full_name: '', email: '', password: '', role: 'professional' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProfessional(null);
        setFormData({ full_name: '', email: '', password: '', role: 'professional' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.full_name.trim()) return;

        setSaving(true);

        if (editingProfessional) {
            // Update profile name and role only
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    role: formData.role,
                })
                .eq('id', editingProfessional.id);

            if (!error) {
                fetchProfessionals();
                handleCloseModal();
            } else {
                alert("Error al editar el profesional: " + error.message);
            }
        } else {
            // Create new auth user + profile via Supabase signUp
            if (!formData.email.trim() || !formData.password.trim()) {
                alert("El correo y la contraseña son obligatorios para crear un nuevo profesional.");
                setSaving(false);
                return;
            }

            if (formData.password.length < 6) {
                alert("La contraseña debe tener al menos 6 caracteres.");
                setSaving(false);
                return;
            }

            // Get the current session token to authenticate
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                alert("Sesión expirada. Vuelve a iniciar sesión.");
                setSaving(false);
                return;
            }

            // Use the API route to create the user
            const res = await fetch('/api/v1/create-professional', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    full_name: formData.full_name,
                    role: formData.role,
                }),
            });

            const result = await res.json();

            if (res.ok) {
                fetchProfessionals();
                handleCloseModal();
            } else {
                alert("Error al crear el profesional: " + (result.error?.message || result.error || 'Error desconocido'));
            }
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Estás seguro de eliminar este profesional? Solo se eliminará su perfil, no su cuenta de usuario.")) {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (!error) {
                fetchProfessionals();
            } else {
                alert("Error al eliminar: " + error.message);
            }
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'professional': return 'Kinesióloga';
            case 'admin': return 'Administrador';
            case 'receptionist': return 'Recepcionista';
            default: return role;
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'professional': return 'bg-cyan/10 text-cyan';
            case 'admin': return 'bg-purple-500/10 text-purple-400';
            case 'receptionist': return 'bg-amber-500/10 text-amber-400';
            default: return 'bg-white/10 text-white/60';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                        Profesionales
                    </h1>
                    <p className="text-blue-100/50 text-sm mt-1">Gestiona el equipo de kinesiólogas y administradores del centro.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={fetchProfessionals}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-5 h-5 text-cyan ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all"
                    >
                        <UserPlus className="w-5 h-5" />
                        Nuevo Profesional
                    </button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                {loading && professionals.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-blue-100/60 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 font-medium">Nombre Completo</th>
                                <th className="p-4 font-medium">Rol</th>
                                <th className="p-4 font-medium">Fecha de Registro</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {professionals.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-blue-100/60">
                                        No hay profesionales registrados. Crea el primero para poder asignar horarios.
                                    </td>
                                </tr>
                            ) : (
                                professionals.map(prof => (
                                    <tr key={prof.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                                    {prof.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium">{prof.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getRoleColor(prof.role)}`}>
                                                {getRoleLabel(prof.role)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-blue-100/50 text-sm">
                                            {new Date(prof.created_at).toLocaleDateString('es-CL', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenModal(prof)}
                                                    className="p-2 text-blue-300 hover:text-cyan hover:bg-white/10 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(prof.id)}
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
                                {editingProfessional ? 'Editar Profesional' : 'Nuevo Profesional'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-1 text-white/50 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Nombre Completo</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    placeholder="Ej. Francisca López"
                                />
                            </div>

                            {!editingProfessional && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-100/80 mb-1">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                            placeholder="profesional@innovakine.cl"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-100/80 mb-1">Contraseña</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Rol</label>
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[42px]"
                                >
                                    <option value="professional">Kinesióloga / Profesional</option>
                                    <option value="admin">Administrador</option>
                                    <option value="receptionist">Recepcionista</option>
                                </select>
                            </div>

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
                                    {saving ? 'Guardando...' : 'Guardar Profesional'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
