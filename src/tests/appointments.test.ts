import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from '@/services/availability.service';

const mockSupabase = {
    from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => mockSupabase,
}));

describe('AvailabilityService - Multi-Phase Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupMockSupabase = (
        phasesConfig: any[],
        profWorkloads: any[] = [],
        chamberBooked: boolean = false,
        boxBooked: boolean = false
    ) => {
        mockSupabase.from.mockImplementation((tableName) => {
            const builder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(() => {
                    if (tableName === 'services') return { data: { id: 'srv-1' }, error: null };
                    return { data: null, error: null };
                }),
                is: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                then: (cb: any) => {
                    if (tableName === 'service_phases') {
                        cb({ data: phasesConfig, error: null });
                    } else if (tableName === 'schedule_exceptions') {
                        cb({ data: [], error: null });
                    } else if (tableName === 'physical_resources') {
                        // we must filter by type if .eq('type', type) was called on the mock chain
                        // but the mock is too simple right now, so we will return ALL items and let AvailabilityService find() it.
                        // AvailabilityService checks `phaseData.requires_resource_type` before finding.
                        cb({
                            data: [
                                { id: 'chamber-1', type: 'chamber' },
                                { id: 'chamber-2', type: 'chamber' },
                                { id: 'box-1', type: 'box' }
                            ], error: null
                        });
                    } else if (tableName === 'appointment_allocations') {
                        // Simulate resources currently busy at the specific requested time
                        let busy: any[] = [];
                        if (chamberBooked) {
                            busy.push({ physical_resource_id: 'chamber-1' });
                            busy.push({ physical_resource_id: 'chamber-2' }); // both full
                        }
                        if (boxBooked) {
                            busy.push({ physical_resource_id: 'box-1' });
                        }
                        // Include workloads if passed
                        cb({ data: [...busy, ...profWorkloads], error: null });
                    } else if (tableName === 'profiles') {
                        cb({ data: [{ id: 'prof-1' }, { id: 'prof-2' }], error: null });
                    } else {
                        cb({ data: [], error: null });
                    }
                }
            };
            return builder;
        });
    };

    it('should allocate Recovery (30m Box + 30m Chamber) to the same professional', async () => {
        const recoveryPhases = [
            { id: 'phase-1', phase_order: 1, duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: 'box' },
            { id: 'phase-2', phase_order: 2, duration_minutes: 30, requires_professional_fraction: 0.5, requires_resource_type: 'chamber' }
        ];
        setupMockSupabase(recoveryPhases);

        const result = await AvailabilityService.allocateResourcesForService('srv-1', new Date('2026-03-01T10:00:00Z'));

        expect(result.allocations).toHaveLength(2);
        expect(result.allocations[0].physical_resource_id).toBe('box-1');
        expect(result.allocations[0].professional_id).toBe('prof-1');
        expect(result.allocations[1].physical_resource_id).toBe('chamber-1');
        expect(result.allocations[1].professional_id).toBe('prof-1'); // Engine enforced same professional!
    });

    it('should reject Recovery if Box is available but Chambers are fully booked 30m later', async () => {
        const recoveryPhases = [
            { id: 'phase-1', phase_order: 1, duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: 'box' },
            { id: 'phase-2', phase_order: 2, duration_minutes: 30, requires_professional_fraction: 0.5, requires_resource_type: 'chamber' }
        ];
        setupMockSupabase(recoveryPhases, [], true, false); // chambers booked

        await expect(
            AvailabilityService.allocateResourcesForService('srv-1', new Date('2026-03-01T10:00:00Z'))
        ).rejects.toThrow('No chamber available at this specific time frame');
    });

    it('should accept 2 simultaneous Hyperbaric sessions with the same professional (0.5 + 0.5 = 1.0)', async () => {
        const hyperbaricPhases = [
            { id: 'phase-1', phase_order: 1, duration_minutes: 60, requires_professional_fraction: 0.5, requires_resource_type: 'chamber' },
        ];
        // Prof-1 has 1 chamber already booked at 0.5 workload
        const workload = [{
            service_phases: { requires_professional_fraction: 0.5 }
        }];

        setupMockSupabase(hyperbaricPhases, workload, false, false);

        const result = await AvailabilityService.allocateResourcesForService('srv-1', new Date('2026-03-01T10:00:00Z'));

        expect(result.allocations).toHaveLength(1);
        expect(result.allocations[0].professional_id).toBe('prof-1'); // Engine placed 2nd patient with same doctor beautifully
    });
});
