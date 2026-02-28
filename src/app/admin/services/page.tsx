"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, RefreshCw, X, Edit, Trash2, ChevronDown, ChevronUp, Layers, Package } from "lucide-react";

interface Phase {
    id?: string;
    phase_order: number;
    duration_minutes: number;
    requires_professional_fraction: number;
    requires_resource_type: string | null;
    sub_service_id: string | null;
    label: string | null;
}

interface Service {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    is_composite: boolean;
    duration_minutes: number;
    required_resource_type: string | null;
    required_professionals: number;
    created_at: string;
    phases?: Phase[];
}

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_active: true,
        is_composite: false,
        // Simple service fields
        duration_minutes: 30,
        required_resource_type: '' as string | null,
        required_professionals: 1,
    });

    // Composite phases (references to existing services)
    const [compositePhases, setCompositePhases] = useState<{ sub_service_id: string; duration_minutes: number }[]>([]);

    // Expanded row
    const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

    const fetchServices = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('is_composite', { ascending: true })
            .order('created_at', { ascending: false });

        if (!error && data) {
            const { data: allPhases } = await supabase
                .from('service_phases')
                .select('*')
                .order('phase_order', { ascending: true });

            const servicesWithPhases = data.map(s => ({
                ...s,
                phases: (allPhases || []).filter(p => p.service_id === s.id),
            }));
            setServices(servicesWithPhases);
        }
        setLoading(false);
    };

    useEffect(() => { fetchServices(); }, []);

    // Only simple (non-composite) services can be used as building blocks
    const simpleServices = services.filter(s => !s.is_composite);

    const handleOpenModal = (service?: Service) => {
        if (service) {
            setEditingService(service);
            setFormData({
                name: service.name,
                description: service.description || '',
                is_active: service.is_active,
                is_composite: service.is_composite,
                duration_minutes: service.duration_minutes,
                required_resource_type: service.required_resource_type ?? '',
                required_professionals: service.required_professionals,
            });
            if (service.is_composite && service.phases) {
                setCompositePhases(service.phases.map(p => ({
                    sub_service_id: p.sub_service_id || '',
                    duration_minutes: p.duration_minutes,
                })));
            } else {
                setCompositePhases([]);
            }
        } else {
            setEditingService(null);
            setFormData({
                name: '', description: '', is_active: true, is_composite: false,
                duration_minutes: 30, required_resource_type: '', required_professionals: 1,
            });
            setCompositePhases([]);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    const handleToggleActive = async (id: string, currentValue: boolean) => {
        setServices(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentValue } : s));
        const { error } = await supabase
            .from('services')
            .update({ is_active: !currentValue })
            .eq('id', id);
        if (error) {
            setServices(prev => prev.map(s => s.id === id ? { ...s, is_active: currentValue } : s));
            alert('Error: ' + error.message);
        }
    };

    // Composite phase handlers
    const addCompositePhase = () => {
        const firstSimple = simpleServices[0];
        if (!firstSimple) {
            alert('Primero crea al menos un servicio simple para poder armar un compuesto.');
            return;
        }
        setCompositePhases(prev => [...prev, { sub_service_id: firstSimple.id, duration_minutes: firstSimple.duration_minutes }]);
    };

    const removeCompositePhase = (index: number) => {
        if (compositePhases.length <= 1) return;
        setCompositePhases(prev => prev.filter((_, i) => i !== index));
    };

    const updateCompositePhase = (index: number, serviceId: string) => {
        const svc = getServiceById(serviceId);
        setCompositePhases(prev => prev.map((p, i) => i === index ? { sub_service_id: serviceId, duration_minutes: svc?.duration_minutes || p.duration_minutes } : p));
    };

    const updatePhaseDuration = (index: number, duration: number) => {
        setCompositePhases(prev => prev.map((p, i) => i === index ? { ...p, duration_minutes: duration } : p));
    };

    // Calculate composite totals
    const getServiceById = (id: string) => simpleServices.find(s => s.id === id);
    const compositeTotalDuration = compositePhases.reduce((sum, p) => sum + p.duration_minutes, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;

        setSaving(true);

        if (formData.is_composite) {
            // Composite service
            if (compositePhases.length === 0) {
                alert('Agrega al menos un servicio al compuesto.');
                setSaving(false);
                return;
            }

            const servicePayload = {
                name: formData.name,
                description: formData.description.trim() || null,
                is_active: formData.is_active,
                is_composite: true,
                duration_minutes: compositeTotalDuration,
                required_resource_type: null,
                required_professionals: Math.max(...compositePhases.map(p => getServiceById(p.sub_service_id)?.required_professionals || 1)),
            };

            let serviceId: string;

            if (editingService) {
                const { error } = await supabase.from('services').update(servicePayload).eq('id', editingService.id);
                if (error) { alert('Error: ' + error.message); setSaving(false); return; }
                serviceId = editingService.id;
                await supabase.from('service_phases').delete().eq('service_id', serviceId);
            } else {
                const { data, error } = await supabase.from('services').insert([servicePayload]).select().single();
                if (error || !data) { alert('Error: ' + (error?.message || 'Error')); setSaving(false); return; }
                serviceId = data.id;
            }

            // Create phases referencing sub-services
            const phasesPayload = compositePhases.map((p, i) => {
                const svc = getServiceById(p.sub_service_id);
                return {
                    service_id: serviceId,
                    phase_order: i + 1,
                    sub_service_id: p.sub_service_id,
                    label: svc?.name || null,
                    duration_minutes: p.duration_minutes,
                    requires_professional_fraction: svc?.required_professionals || 1,
                    requires_resource_type: svc?.required_resource_type || null,
                };
            });

            const { error: phaseError } = await supabase.from('service_phases').insert(phasesPayload);
            if (phaseError) alert('Error en fases: ' + phaseError.message);

        } else {
            // Simple service
            const servicePayload = {
                name: formData.name,
                description: formData.description.trim() || null,
                is_active: formData.is_active,
                is_composite: false,
                duration_minutes: formData.duration_minutes,
                required_resource_type: formData.required_resource_type || null,
                required_professionals: formData.required_professionals,
            };

            if (editingService) {
                const { error } = await supabase.from('services').update(servicePayload).eq('id', editingService.id);
                if (error) { alert('Error: ' + error.message); setSaving(false); return; }
            } else {
                const { error } = await supabase.from('services').insert([servicePayload]);
                if (error) { alert('Error: ' + error.message); setSaving(false); return; }
            }
        }

        fetchServices();
        handleCloseModal();
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        if (confirm("¿Eliminar este servicio y todas sus fases?")) {
            await supabase.from('service_phases').delete().eq('service_id', id);
            const { error } = await supabase.from('services').delete().eq('id', id);
            if (!error) fetchServices();
            else alert("Error: " + error.message);
        }
    };

    const getResourceLabel = (type: string | null) => {
        if (!type) return null;
        return type === 'chamber' ? 'Cámara' : type === 'box' ? 'Box' : type;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold font-head text-transparent bg-clip-text bg-gradient-to-r from-cyan to-blue-400">
                        Servicios
                    </h1>
                    <p className="text-blue-100/50 text-sm mt-1">
                        Crea servicios simples y combínalos en servicios compuestos.
                    </p>
                </div>
                <div className="flex gap-4">
                    <button onClick={fetchServices} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all" title="Actualizar">
                        <RefreshCw className={`w-5 h-5 text-cyan ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-4 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Servicio
                    </button>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                {loading && services.length === 0 ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
                    </div>
                ) : services.length === 0 ? (
                    <div className="p-12 text-center text-blue-100/60">No hay servicios registrados.</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-blue-100/60 uppercase text-xs tracking-wider">
                            <tr>
                                <th className="p-4 font-medium w-8"></th>
                                <th className="p-4 font-medium">Nombre</th>
                                <th className="p-4 font-medium text-center">Tipo</th>
                                <th className="p-4 font-medium text-center">Duración</th>
                                <th className="p-4 font-medium text-center">Recurso / Prof.</th>
                                <th className="p-4 font-medium text-center">Activo</th>
                                <th className="p-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {services.map(service => {
                                const isExpanded = expandedServiceId === service.id;
                                const phaseCount = service.phases?.length || 0;
                                return (
                                    <>
                                        <tr key={service.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                {service.is_composite && phaseCount > 0 && (
                                                    <button
                                                        onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                                                        className="p-1 text-blue-100/40 hover:text-cyan transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className="font-medium">{service.name}</span>
                                                {service.description && (
                                                    <p className="text-xs text-blue-100/40 mt-0.5 line-clamp-1">{service.description}</p>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                {service.is_composite ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                        <Layers className="w-3 h-3" />
                                                        Compuesto ({phaseCount})
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan/10 text-cyan border border-cyan/20">
                                                        <Package className="w-3 h-3" />
                                                        Simple
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center font-mono text-sm">{service.duration_minutes} min</td>
                                            <td className="p-4 text-center text-xs">
                                                {service.is_composite ? (
                                                    <span className="text-blue-100/40">Ver fases ↓</span>
                                                ) : (
                                                    <div className="space-y-0.5">
                                                        {service.required_resource_type && (
                                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-xs block w-fit mx-auto">
                                                                {getResourceLabel(service.required_resource_type)}
                                                            </span>
                                                        )}
                                                        <span className={`block ${service.required_professionals < 1 ? 'text-amber-400' : 'text-green-400'}`}>
                                                            {service.required_professionals === 1 ? '1 prof.' : `${service.required_professionals} prof.`}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleToggleActive(service.id, service.is_active)}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${service.is_active ? 'bg-green-500' : 'bg-red-500/70'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${service.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleOpenModal(service)} className="p-2 text-blue-300 hover:text-cyan hover:bg-white/10 rounded-lg transition-colors" title="Editar">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(service.id)} className="p-2 text-red-300 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="Eliminar">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Expanded composite phases */}
                                        {isExpanded && service.phases && service.phases.length > 0 && (
                                            <tr key={`${service.id}-phases`}>
                                                <td colSpan={7} className="px-4 pb-4">
                                                    <div className="ml-8 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                                                        <div className="p-3 bg-white/5 border-b border-white/5">
                                                            <span className="text-[10px] text-blue-100/40 uppercase tracking-wider font-semibold">Composición del servicio</span>
                                                        </div>
                                                        {service.phases.map((phase, i) => (
                                                            <div key={phase.id || i} className="flex items-center gap-4 p-3 border-b border-white/5 last:border-0">
                                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex-shrink-0">
                                                                    {phase.phase_order}
                                                                </span>
                                                                <div className="flex-1">
                                                                    <span className="text-sm font-medium">{phase.label || `Fase ${phase.phase_order}`}</span>
                                                                </div>
                                                                <span className="text-xs font-mono text-blue-100/60">{phase.duration_minutes} min</span>
                                                                <span className={`text-xs ${phase.requires_professional_fraction < 1 ? 'text-amber-400' : 'text-green-400'}`}>
                                                                    {phase.requires_professional_fraction} prof.
                                                                </span>
                                                                {phase.requires_resource_type && (
                                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-xs">
                                                                        {getResourceLabel(phase.requires_resource_type)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/80 backdrop-blur-sm">
                    <div className="bg-[#0b1a2e] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white">
                                {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-1 text-white/50 hover:text-white rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1">Nombre del Servicio</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                    placeholder="Ej. Masaje, Recovery, etc."
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-1 flex items-center gap-1.5">
                                    Descripción para Agente IA
                                    <span className="text-xs bg-cyan/10 text-cyan border border-cyan/20 px-1.5 py-0.5 rounded-md font-normal">🤖 IA</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50 resize-none"
                                    placeholder="Describe el servicio para el asistente IA."
                                />
                            </div>

                            {/* Type toggle: Simple vs Composite */}
                            <div>
                                <label className="block text-sm font-medium text-blue-100/80 mb-2">Tipo de Servicio</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setFormData({ ...formData, is_composite: false }); setCompositePhases([]); }}
                                        className={`p-3 rounded-xl border text-center transition-all ${!formData.is_composite ? 'border-cyan bg-cyan/10 text-white' : 'border-white/10 bg-white/5 text-blue-100/60 hover:bg-white/10'}`}
                                    >
                                        <Package className="w-5 h-5 mx-auto mb-1" />
                                        <span className="text-xs font-medium block">Simple</span>
                                        <span className="text-[10px] opacity-60">Un solo recurso y duración</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, is_composite: true });
                                            if (compositePhases.length === 0 && simpleServices.length > 0) {
                                                setCompositePhases([{ sub_service_id: simpleServices[0].id, duration_minutes: simpleServices[0].duration_minutes }]);
                                            }
                                        }}
                                        className={`p-3 rounded-xl border text-center transition-all ${formData.is_composite ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-white/10 bg-white/5 text-blue-100/60 hover:bg-white/10'}`}
                                    >
                                        <Layers className="w-5 h-5 mx-auto mb-1" />
                                        <span className="text-xs font-medium block">Compuesto</span>
                                        <span className="text-[10px] opacity-60">Combina servicios simples</span>
                                    </button>
                                </div>
                            </div>

                            {/* === SIMPLE SERVICE FIELDS === */}
                            {!formData.is_composite && (
                                <div className="space-y-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-xs font-semibold text-cyan uppercase tracking-wider">Configuración del servicio</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-medium text-blue-100/50 mb-1 uppercase tracking-wider">Duración (min)</label>
                                            <input
                                                type="number"
                                                required
                                                min="5"
                                                step="5"
                                                value={formData.duration_minutes}
                                                onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-blue-100/50 mb-1 uppercase tracking-wider">Profesional</label>
                                            <select
                                                value={formData.required_professionals}
                                                onChange={(e) => setFormData({ ...formData, required_professionals: Number(e.target.value) })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[34px]"
                                            >
                                                <option value={1}>1 completo</option>
                                                <option value={0.5}>0.5 (compartido)</option>
                                                <option value={0.25}>0.25</option>
                                                <option value={0}>No requiere</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-medium text-blue-100/50 mb-1 uppercase tracking-wider">Recurso</label>
                                            <select
                                                value={formData.required_resource_type || ''}
                                                onChange={(e) => setFormData({ ...formData, required_resource_type: e.target.value || null })}
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black text-sm focus:outline-none focus:ring-2 focus:ring-cyan/50 h-[34px]"
                                            >
                                                <option value="">Ninguno</option>
                                                <option value="box">Box</option>
                                                <option value="chamber">Cámara</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* === COMPOSITE SERVICE FIELDS === */}
                            {formData.is_composite && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white">Servicios que lo componen</p>
                                            <p className="text-xs text-blue-100/40">
                                                Duración total: <span className="text-purple-400 font-semibold">{compositeTotalDuration} min</span>
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addCompositePhase}
                                            className="flex items-center gap-1 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Agregar
                                        </button>
                                    </div>

                                    {simpleServices.length === 0 ? (
                                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                                            <p className="text-amber-400 text-sm font-medium">No hay servicios simples disponibles</p>
                                            <p className="text-xs text-blue-100/40 mt-1">Primero crea servicios simples (como "Masaje", "Cámara") para poder combinarlos.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {compositePhases.map((phase, index) => {
                                                const selectedService = getServiceById(phase.sub_service_id);
                                                const defaultDuration = selectedService?.duration_minutes || 30;
                                                const isCustomDuration = phase.duration_minutes !== defaultDuration;
                                                return (
                                                    <div key={index} className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold flex-shrink-0">
                                                                {index + 1}
                                                            </span>
                                                            <select
                                                                value={phase.sub_service_id}
                                                                onChange={(e) => updateCompositePhase(index, e.target.value)}
                                                                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-[34px]"
                                                            >
                                                                {simpleServices.map(s => (
                                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                                ))}
                                                            </select>
                                                            {compositePhases.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeCompositePhase(index)}
                                                                    className="p-1 text-red-400/50 hover:text-red-400 rounded transition-colors flex-shrink-0"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 ml-9">
                                                            <div className="flex items-center gap-1.5">
                                                                <label className="text-[10px] text-blue-100/50 uppercase tracking-wider whitespace-nowrap">Duración:</label>
                                                                <input
                                                                    type="number"
                                                                    min="5"
                                                                    step="5"
                                                                    value={phase.duration_minutes}
                                                                    onChange={(e) => updatePhaseDuration(index, Number(e.target.value))}
                                                                    className="w-16 bg-white border border-gray-300 rounded-lg px-2 py-1 text-black text-xs text-center focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                                />
                                                                <span className="text-[10px] text-blue-100/40">min</span>
                                                                {isCustomDuration && (
                                                                    <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                                                        personalizado (original: {defaultDuration}m)
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {selectedService && (
                                                                <div className="flex items-center gap-2 text-[10px] text-blue-100/50 ml-auto">
                                                                    {selectedService.required_resource_type && (
                                                                        <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded">
                                                                            {getResourceLabel(selectedService.required_resource_type)}
                                                                        </span>
                                                                    )}
                                                                    <span className={selectedService.required_professionals < 1 ? 'text-amber-400' : 'text-green-400'}>
                                                                        {selectedService.required_professionals} prof.
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Active toggle */}
                            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <div>
                                    <span className="font-medium text-white text-sm">Estado</span>
                                    <p className="text-xs text-blue-100/50">Disponible para agendar</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-white/20'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm font-medium text-blue-100/80 hover:text-white hover:bg-white/5 rounded-xl transition-colors">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-gradient-to-r from-cyan to-blue-500 text-white px-6 py-2 rounded-xl font-medium shadow-lg hover:shadow-cyan/25 transition-all disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Guardando...' : 'Guardar Servicio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
