import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from '@/services/availability.service';

const mockSupabase = {
    from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => mockSupabase,
}));

describe('InnovaKine Deep Stress Test - Edge Cases & Logic Flaws', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupMocks = (config: any) => {
        mockSupabase.from.mockImplementation((tableName) => {
            const chain = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(() => {
                    if (tableName === 'services') return { data: { id: 's1' }, error: null };
                    if (tableName === 'professional_schedules') return { data: { start_time: '09:00:00', end_time: '17:00:00' }, error: null };
                    return { data: null, error: null };
                }),
                then: (cb: any) => {
                    if (tableName === 'service_phases') cb({ data: config.phases || [], error: null });
                    else if (tableName === 'profiles') cb({ data: config.profiles || [{ id: 'p1' }, { id: 'p2' }], error: null });
                    else if (tableName === 'physical_resources') cb({ data: config.resources || [], error: null });
                    else if (tableName === 'appointment_allocations') cb({ data: config.allocations || [], error: null });
                    else cb({ data: [], error: null });
                }
            };
            return chain;
        });
    };

    const PHASES = {
        HYPERBARIC: [{ id: 'ph', duration_minutes: 60, requires_professional_fraction: 0.5, requires_resource_type: 'chamber', phase_order: 1 }],
        RECOVERY: [
            { id: 'pr1', duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 },
            { id: 'pr2', duration_minutes: 30, requires_professional_fraction: 0.5, requires_resource_type: 'chamber', phase_order: 2 }
        ]
    };

    const RESOURCES = [
        { id: 'c1', type: 'chamber', is_active: true },
        { id: 'box1', type: 'box', is_active: true }
    ];

    it('FLAW 1: Greedy Professional Assignment (False Negative)', async () => {
        // Setup: Recovery (Box 30m, then Chamber 30m)
        // Prof 1 is FREE for Phase 1, but BUSY in Phase 2
        // Prof 2 is FREE for BOTH phases
        // Will it assign Prof 2, or crash because it greedily picked Prof 1?
        mockSupabase.from.mockImplementation((tableName) => {
            let currentProfId = '';
            const chain = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                    if (col === 'professional_id') currentProfId = val;
                    return chain;
                }),
                order: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(() => {
                    if (tableName === 'services') return { data: { id: 's1' }, error: null };
                    if (tableName === 'professional_schedules') return { data: { start_time: '09:00:00', end_time: '17:00:00' }, error: null };
                    return { data: null, error: null };
                }),
                then: (cb: any) => {
                    if (tableName === 'service_phases') cb({ data: PHASES.RECOVERY, error: null });
                    else if (tableName === 'profiles') cb({ data: [{ id: 'p1' }, { id: 'p2' }], error: null });
                    else if (tableName === 'physical_resources') cb({ data: RESOURCES, error: null });
                    else if (tableName === 'appointment_allocations') {
                        if (currentProfId === 'p2') cb({ data: [], error: null });
                        else cb({ data: [{ professional_id: 'p1', starts_at: '2026-03-02T13:30:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 1.0 } }], error: null });
                    } else cb({ data: [], error: null });
                }
            };
            return chain;
        });

        // We expect it to SUCCEED and pick 'p2' because 'p1' fails phase 2.
        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p2');
    });

    it('FLAW 2: False Accumulation of Fractional Load (False Negative)', async () => {
        // Setup: We need a chamber (60m) that takes 0.5 professional fraction. 10:00 to 11:00.
        // Existing allocations for the professional:
        // Appt A: 10:00 to 10:30 (0.5 workload)
        // Appt B: 10:40 to 11:00 (0.5 workload)
        // Notice Appt A and B DO NOT overlap each other.
        // Peak load is 0.5. Adding the new 60m (0.5) will make peak load 1.0. This is PERFECTLY VALID.

        setupMocks({
            phases: PHASES.HYPERBARIC,
            resources: RESOURCES,
            allocations: [
                { professional_id: 'p1', starts_at: '2026-03-02T13:00:00Z', ends_at: '2026-03-02T13:30:00Z', service_phases: { requires_professional_fraction: 0.5 } },
                { professional_id: 'p1', starts_at: '2026-03-02T13:40:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 0.5 } }
            ]
        });

        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1'); // Should succeed
    });

});
