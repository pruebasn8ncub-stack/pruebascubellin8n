import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from '@/services/availability.service';

const mockSupabase = {
    from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => mockSupabase,
}));

describe('InnovaKine Stress Test - Clinic Business Logic', () => {
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
                    if (tableName === 'services') return { data: { id: 'srv-1' }, error: null };
                    if (tableName === 'professional_schedules') return { data: { start_time: '08:00:00', end_time: '20:00:00' }, error: null };
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
        EVALUATION: [{ id: 'pe', duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
        SESSION: [{ id: 'ps', duration_minutes: 45, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
        RECOVERY: [
            { id: 'pr1', duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 },
            { id: 'pr2', duration_minutes: 30, requires_professional_fraction: 0.5, requires_resource_type: 'chamber', phase_order: 2 }
        ]
    };

    const RESOURCES = [
        { id: 'c1', type: 'chamber', is_active: true },
        { id: 'c2', type: 'chamber', is_active: true },
        { id: 'b1', type: 'box', is_active: true }
    ];

    it('STRESS 1: Professional handles 2 Hyperbaric sessions simultaneously (0.5+0.5)', async () => {
        setupMocks({
            phases: PHASES.HYPERBARIC,
            resources: RESOURCES,
            allocations: [{ professional_id: 'p1', starts_at: '2026-03-02T13:00:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 0.5 } }]
        });
        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1');
    });

    it('STRESS 2: Professional rejects 3rd Hyperbaric (Exceeds 1.0)', async () => {
        setupMocks({
            phases: PHASES.HYPERBARIC,
            resources: RESOURCES,
            allocations: [
                { professional_id: 'p1', starts_at: '2026-03-02T13:00:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 0.5 } },
                { professional_id: 'p1', starts_at: '2026-03-02T13:00:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 0.5 } },
                { professional_id: 'p2', starts_at: '2026-03-02T13:00:00Z', ends_at: '2026-03-02T14:00:00Z', service_phases: { requires_professional_fraction: 1.0 } }
            ]
        });
        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'))).rejects.toThrow('No professional has available capacity');
    });

    it('STRESS 3: RECOVERY Phase 2 conflict (Chambers full 30m later)', async () => {
        mockSupabase.from.mockImplementation((tableName) => {
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(() => {
                    if (tableName === 'services') return { data: { id: 's1' }, error: null };
                    if (tableName === 'professional_schedules') return { data: { start_time: '08:00:00', end_time: '20:00:00' }, error: null };
                    return { data: null, error: null };
                }),
                then: (cb: any) => {
                    if (tableName === 'service_phases') cb({ data: PHASES.RECOVERY, error: null });
                    else if (tableName === 'profiles') cb({ data: [{ id: 'p1' }], error: null });
                    else if (tableName === 'physical_resources') cb({ data: RESOURCES, error: null });
                    else if (tableName === 'appointment_allocations') {
                        cb({ data: [{ physical_resource_id: 'c1' }, { physical_resource_id: 'c2' }], error: null });
                    } else cb({ data: [], error: null });
                }
            };
        });

        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'))).rejects.toThrow('No chamber available');
    });

    it('STRESS 4: Box Bottleneck (Only 1 Box available, Session blocks Recovery)', async () => {
        setupMocks({
            phases: PHASES.RECOVERY,
            resources: RESOURCES,
            allocations: [{ physical_resource_id: 'b1' }]
        });
        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T13:00:00Z'))).rejects.toThrow('No box available');
    });
});
