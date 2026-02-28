import { createAdminClient as createClient } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import { addMinutes } from 'date-fns';

/**
 * MOTOR DE AGENDAMIENTO v2 — Capacidad Concurrente + Multifase
 *
 * Soporta tanto servicios simples como compuestos (multifase).
 *
 * Para servicios SIMPLES (is_composite=false):
 *   - Se crea una fase virtual a partir del servicio directamente
 *   - Se busca 1 profesional + 1 recurso (si aplica)
 *
 * Para servicios COMPUESTOS (is_composite=true):
 *   - Se cargan las fases desde service_phases
 *   - Cada fase se procesa secuencialmente (una tras otra)
 *   - Cada fase tiene su propia asignación de profesional + recurso
 *   - El profesional puede cambiar entre fases si no hay disponibilidad continua
 *
 * Validaciones por cada fase:
 *   1. La clínica no esté bloqueada (schedule_exceptions globales)
 *   2. Hay recurso físico disponible del tipo requerido
 *   3. El recurso no está bloqueado por excepción
 *   4. Hay un profesional que:
 *      a. Trabaja ese día (professional_schedules)
 *      b. Su horario cubre la fase completa
 *      c. No tiene excepción/ausencia activa
 *      d. Su carga fraccional + la del nuevo servicio <= 1.0
 */

interface PhaseAllocation {
    service_phase_id: string | null;
    professional_id: string;
    physical_resource_id: string | null;
    starts_at: string;
    ends_at: string;
}

interface ServicePhase {
    id: string;
    phase_order: number;
    duration_minutes: number;
    requires_professional_fraction: number;
    requires_resource_type: string | null;
}

export class AvailabilityService {

    /**
     * Allocates professionals + physical resources for ALL phases of a service.
     * Returns an array of allocations (one per phase) and the overall end time.
     */
    static async allocateResourcesForService(
        serviceId: string,
        requestedStartTime: Date
    ): Promise<{ allocations: PhaseAllocation[]; ends_at: Date }> {
        const supabase = createClient();

        // ── 1. Load service ─────────────────────────────────────────────
        const { data: service, error: sErr } = await supabase
            .from('services')
            .select('id, name, duration_minutes, required_resource_type, required_professionals, is_active, is_composite')
            .eq('id', serviceId)
            .single();

        if (sErr || !service) throw new AppError('Servicio no encontrado', 404, 'SERVICE_NOT_FOUND');
        if (!service.is_active) throw new AppError('Este servicio no está disponible actualmente', 409, 'SERVICE_INACTIVE');

        // ── 2. Load phases ──────────────────────────────────────────────
        let phases: ServicePhase[];

        if (service.is_composite) {
            const { data: dbPhases, error: phErr } = await supabase
                .from('service_phases')
                .select('id, phase_order, duration_minutes, requires_professional_fraction, requires_resource_type')
                .eq('service_id', serviceId)
                .order('phase_order', { ascending: true });

            if (phErr || !dbPhases || dbPhases.length === 0) {
                throw new AppError('El servicio compuesto no tiene fases configuradas', 500, 'NO_PHASES');
            }
            phases = dbPhases;
        } else {
            // Simple service → create a virtual single phase
            // Check if there's a phase in DB already (for simple services with explicit phase)
            const { data: existingPhases } = await supabase
                .from('service_phases')
                .select('id, phase_order, duration_minutes, requires_professional_fraction, requires_resource_type')
                .eq('service_id', serviceId)
                .order('phase_order', { ascending: true });

            if (existingPhases && existingPhases.length > 0) {
                phases = existingPhases;
            } else {
                // Virtual phase from service-level fields
                phases = [{
                    id: '__virtual__',
                    phase_order: 1,
                    duration_minutes: service.duration_minutes,
                    requires_professional_fraction: parseFloat(service.required_professionals.toString()),
                    requires_resource_type: service.required_resource_type,
                }];
            }
        }

        // ── 3. Allocate each phase sequentially ─────────────────────────
        const allocations: PhaseAllocation[] = [];
        let currentStart = new Date(requestedStartTime);

        for (const phase of phases) {
            const phaseEnd = addMinutes(currentStart, phase.duration_minutes);
            const startIso = currentStart.toISOString();
            const endIso = phaseEnd.toISOString();
            const requiredProfFraction = parseFloat(phase.requires_professional_fraction.toString());

            // 3a. Check global clinic blocks
            const { data: globalBlocks } = await supabase
                .from('schedule_exceptions')
                .select('id')
                .is('professional_id', null)
                .is('physical_resource_id', null)
                .lt('starts_at', endIso)
                .gt('ends_at', startIso);

            if (globalBlocks && globalBlocks.length > 0) {
                throw new AppError(
                    `La clínica está cerrada/bloqueada durante la fase ${phase.phase_order}`,
                    409,
                    'CLINIC_BLOCKED'
                );
            }

            // 3b. Allocate physical resource (if needed)
            let allocatedResourceId: string | null = null;

            if (phase.requires_resource_type) {
                const { data: allResources } = await supabase
                    .from('physical_resources')
                    .select('id, name, type')
                    .eq('is_active', true)
                    .eq('type', phase.requires_resource_type);

                if (!allResources || allResources.length === 0) {
                    throw new AppError(
                        `No hay recursos de tipo "${phase.requires_resource_type}" activos`,
                        500,
                        'NO_RESOURCES'
                    );
                }

                const allResourceIds = allResources.map(r => r.id);

                // Resources already booked by other appointments
                const { data: bookedAllocations } = await supabase
                    .from('appointment_allocations')
                    .select('physical_resource_id, appointments!inner(status)')
                    .in('physical_resource_id', allResourceIds)
                    .lt('starts_at', endIso)
                    .gt('ends_at', startIso)
                    .neq('appointments.status', 'cancelled');

                // Resources blocked by exceptions
                const { data: blockedByException } = await supabase
                    .from('schedule_exceptions')
                    .select('physical_resource_id')
                    .in('physical_resource_id', allResourceIds)
                    .lt('starts_at', endIso)
                    .gt('ends_at', startIso);

                const occupiedIds = new Set<string>([
                    ...(bookedAllocations?.map((b: any) => b.physical_resource_id).filter(Boolean) || []),
                    ...(blockedByException?.map((e: any) => e.physical_resource_id).filter(Boolean) || []),
                ]);

                // Also exclude resources already allocated in earlier phases of this same appointment
                allocations.forEach(a => {
                    if (a.physical_resource_id) occupiedIds.add(a.physical_resource_id);
                });

                const freeResource = allResources.find(r => !occupiedIds.has(r.id));

                if (!freeResource) {
                    throw new AppError(
                        `Todos los recursos de tipo "${phase.requires_resource_type}" están ocupados durante la fase ${phase.phase_order}. Intenta otro horario.`,
                        409,
                        'RESOURCE_BUSY'
                    );
                }

                allocatedResourceId = freeResource.id;
            }

            // 3c. Allocate professional (if needed — fraction > 0)
            let assignedProfessionalId: string | null = null;

            if (requiredProfFraction > 0) {
                const { data: allProfessionals } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('role', 'professional');

                if (!allProfessionals || allProfessionals.length === 0) {
                    throw new AppError('No hay profesionales configurados', 500, 'NO_PROFESSIONALS');
                }

                const startParts = getTimeParts(currentStart);
                const endParts = getTimeParts(phaseEnd);

                for (const prof of allProfessionals) {
                    // Does the professional work on this day?
                    const { data: schedule } = await supabase
                        .from('professional_schedules')
                        .select('start_time, end_time')
                        .eq('professional_id', prof.id)
                        .eq('day_of_week', startParts.dayIndex)
                        .single();

                    if (!schedule) continue;

                    // Does the phase fall within their working hours?
                    if (startParts.time < schedule.start_time || endParts.time > schedule.end_time) continue;

                    // Is the professional not on exception/absence?
                    const { data: profExceptions } = await supabase
                        .from('schedule_exceptions')
                        .select('id')
                        .eq('professional_id', prof.id)
                        .lt('starts_at', endIso)
                        .gt('ends_at', startIso);

                    if (profExceptions && profExceptions.length > 0) continue;

                    // Capacity check: load from existing appointments
                    // Query includes the fraction data from service_phases or services
                    const { data: activeAllocations } = await supabase
                        .from('appointment_allocations')
                        .select(`
                            starts_at, 
                            ends_at, 
                            service_phase_id,
                            appointments!inner(status, service_id, services(required_professionals)),
                            service_phases(requires_professional_fraction)
                        `)
                        .eq('professional_id', prof.id)
                        .lt('starts_at', endIso)
                        .gt('ends_at', startIso)
                        .neq('appointments.status', 'cancelled');

                    // Also account for allocations from earlier phases of THIS appointment
                    const priorPhaseAllocations = allocations.filter(a => a.professional_id === prof.id);

                    let hasCapacity = true;
                    const startMs = currentStart.getTime();
                    const endMs = phaseEnd.getTime();

                    for (let t = startMs; t < endMs; t += 60_000) {
                        let loadAtMinute = 0;

                        // Load from existing DB allocations
                        activeAllocations?.forEach((alloc: any) => {
                            const allocStart = new Date(alloc.starts_at).getTime();
                            const allocEnd = new Date(alloc.ends_at).getTime();
                            if (t >= allocStart && t < allocEnd) {
                                // Get the actual professional fraction
                                const fraction = alloc.service_phases?.requires_professional_fraction
                                    ?? alloc.appointments?.services?.required_professionals
                                    ?? 1;
                                loadAtMinute += parseFloat(fraction.toString());
                            }
                        });

                        // Load from earlier phases of this same appointment
                        priorPhaseAllocations.forEach(a => {
                            const aStart = new Date(a.starts_at).getTime();
                            const aEnd = new Date(a.ends_at).getTime();
                            if (t >= aStart && t < aEnd) {
                                // This phase of the same appointment also uses this professional
                                // Find the fraction for that phase
                                const priorPhase = phases.find(p => {
                                    const pStart = new Date(requestedStartTime);
                                    let offset = 0;
                                    for (const pp of phases) {
                                        if (pp.id === p.id) break;
                                        offset += pp.duration_minutes;
                                    }
                                    const phaseStart = addMinutes(pStart, offset).getTime();
                                    const phaseEnd = addMinutes(pStart, offset + p.duration_minutes).getTime();
                                    return t >= phaseStart && t < phaseEnd;
                                });
                                loadAtMinute += priorPhase
                                    ? parseFloat(priorPhase.requires_professional_fraction.toString())
                                    : 1;
                            }
                        });

                        if (loadAtMinute + requiredProfFraction > 1.0) {
                            hasCapacity = false;
                            break;
                        }
                    }

                    if (!hasCapacity) continue;

                    assignedProfessionalId = prof.id;
                    break;
                }

                if (!assignedProfessionalId) {
                    throw new AppError(
                        `No hay profesionales disponibles durante la fase ${phase.phase_order}. Todos al máximo de capacidad o fuera de turno.`,
                        409,
                        'PROFESSIONAL_BUSY'
                    );
                }
            } else {
                // Phase doesn't require a professional (fraction = 0)
                // Still needs someone supervising — pick the first available
                // For now, use a dummy approach: reuse last phase's professional or first available
                assignedProfessionalId = allocations.length > 0
                    ? allocations[allocations.length - 1].professional_id
                    : (await getFirstAvailableProfessional(supabase)) || '';
            }

            allocations.push({
                service_phase_id: phase.id === '__virtual__' ? null : phase.id,
                professional_id: assignedProfessionalId,
                physical_resource_id: allocatedResourceId,
                starts_at: startIso,
                ends_at: endIso,
            });

            // Move start to the end of this phase for the next one
            currentStart = phaseEnd;
        }

        return {
            allocations,
            ends_at: currentStart,
        };
    }

    /**
     * Returns available time slots for a given service on a given date.
     * Works for both simple and composite services.
     */
    static async getAvailableSlots(serviceId: string, date: string): Promise<string[]> {
        const supabase = createClient();

        const { data: service } = await supabase
            .from('services')
            .select('duration_minutes')
            .eq('id', serviceId)
            .single();

        if (!service) return [];

        const slots: string[] = [];

        // Try every 15-minute slot from 08:00 to 20:00
        for (let h = 8; h < 20; h++) {
            for (let m = 0; m < 60; m += 15) {
                const slotStart = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
                const slotEnd = addMinutes(slotStart, service.duration_minutes);

                // Don't try slots that go past 20:00
                if (slotEnd.getHours() >= 20 && slotEnd.getMinutes() > 0) continue;

                try {
                    await AvailabilityService.allocateResourcesForService(serviceId, slotStart);
                    slots.push(slotStart.toISOString());
                } catch {
                    // Not available, skip
                }
            }
        }

        return slots;
    }
}

// ── Helper functions ────────────────────────────────────────────────────

/**
 * Converts a Date to Santiago timezone time parts for schedule comparison
 */
function getTimeParts(date: Date): { time: string; dayIndex: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Santiago',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';

    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return {
        time: `${get('hour')}:${get('minute')}:${get('second')}`,
        dayIndex: dayMap[get('weekday')] ?? -1,
    };
}

/**
 * Gets the first available professional (fallback for phases with 0 professional fraction)
 */
async function getFirstAvailableProfessional(supabase: any): Promise<string | null> {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'professional')
        .limit(1)
        .single();
    return data?.id || null;
}
