import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AvailabilityService } from '@/services/availability.service';
import { addMinutes } from 'date-fns';

const mockSupabase = {
    from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => mockSupabase,
}));

describe('InnovaKine Exhaustive Edge Cases Test', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupMocks = (config: any) => {
        mockSupabase.from.mockImplementation((tableName) => {
            let currentProfId = '';
            let currentPhysicalTypeId = '';
            let isProfNull = false;
            let isResNull = false;
            const chain = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockImplementation((col: string, val: any) => {
                    if (col === 'professional_id') currentProfId = val;
                    if (col === 'type') currentPhysicalTypeId = val;
                    return chain;
                }),
                order: vi.fn().mockReturnThis(),
                is: vi.fn().mockImplementation((col: string, val: any) => {
                    if (col === 'professional_id' && val === null) isProfNull = true;
                    if (col === 'physical_resource_id' && val === null) isResNull = true;
                    return chain;
                }),
                lt: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                single: vi.fn().mockImplementation(() => {
                    if (tableName === 'services') return { data: { id: config.serviceId || 's1' }, error: null };
                    if (tableName === 'professional_schedules') return { data: config.schedule || { start_time: '09:00:00', end_time: '17:00:00' }, error: null };
                    return { data: null, error: null };
                }),
                then: (cb: any) => {
                    if (tableName === 'service_phases') cb({ data: config.phases || [], error: null });
                    else if (tableName === 'profiles') cb({ data: config.profiles || [{ id: 'p1' }, { id: 'p2' }], error: null });
                    else if (tableName === 'physical_resources') {
                        if (currentPhysicalTypeId) {
                            cb({ data: (config.resources || []).filter((r: any) => r.type === currentPhysicalTypeId), error: null });
                        } else {
                            cb({ data: config.resources || [], error: null });
                        }
                    }
                    else if (tableName === 'appointment_allocations') cb({ data: config.allocations || [], error: null });
                    else if (tableName === 'schedule_exceptions') {
                        let res = config.exceptions || [];
                        if (isProfNull) {
                            res = res.filter((e: any) => e.professional_id === null || e.professional_id === undefined);
                        } else if (currentProfId) {
                            res = res.filter((e: any) => e.professional_id === currentProfId);
                        }
                        if (isResNull) {
                            res = res.filter((e: any) => e.physical_resource_id === null || e.physical_resource_id === undefined);
                        }
                        cb({ data: res, error: null });
                    }
                    else cb({ data: [], error: null });
                }
            };
            return chain;
        });
    };

    const RESOURCES = [
        { id: 'c1', type: 'chamber', is_active: true },
        { id: 'b1', type: 'box', is_active: true }
    ];

    it('EDGE 1: Exact End Time Boundary (Booking until exactly 17:00:00 should pass)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 60, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
            resources: RESOURCES,
            schedule: { start_time: '09:00:00', end_time: '17:00:00' }
        });

        // 16:00 UTC-3 is 19:00 UTC. So we book at 19:00Z to test 16:00 Santiago time.
        // Wait, date-fns and Intl will process the date. 19:00 UTC is 16:00 Santiago.
        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T19:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1');
    });

    it('EDGE 2: Exact End Time Boundary Violation (Booking until 17:01:00 should fail)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 61, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
            resources: RESOURCES,
            schedule: { start_time: '09:00:00', end_time: '17:00:00' }
        });

        // 16:00 UTC-3 + 61 mins = 17:01 -> out of hours
        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T19:00:00Z'))).rejects.toThrow('No professional has available capacity during this phase');
    });

    it('EDGE 3: Phase Requires NO Physical Resource (e.g., Home visit or Telemedicine)', async () => {
        setupMocks({
            // requires_resource_type is null
            phases: [{ id: 'ph1', duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: null, phase_order: 1 }],
            resources: RESOURCES,
        });

        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T15:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1');
        expect(result.allocations[0].physical_resource_id).toBeNull();
    });

    it('EDGE 4: Multiple small concurrent fractions (4 * 0.25 = 1.0 limit test)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 60, requires_professional_fraction: 0.25, requires_resource_type: null, phase_order: 1 }],
            allocations: [
                { professional_id: 'p1', starts_at: '2026-03-02T15:00:00Z', ends_at: '2026-03-02T16:00:00Z', service_phases: { requires_professional_fraction: 0.25 } },
                { professional_id: 'p1', starts_at: '2026-03-02T15:00:00Z', ends_at: '2026-03-02T16:00:00Z', service_phases: { requires_professional_fraction: 0.25 } },
                { professional_id: 'p1', starts_at: '2026-03-02T15:00:00Z', ends_at: '2026-03-02T16:00:00Z', service_phases: { requires_professional_fraction: 0.25 } }
            ]
        });
        // We add the 4th booking to 'p1' (0.25 + 0.75 = 1.0). 'p1' should handle it.
        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T15:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1');
    });

    it('EDGE 5: Resource blocked strictly by a schedule_exception (Maintenance)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 60, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
            resources: [{ id: 'b1', type: 'box', is_active: true }], // Only 1 Box
            exceptions: [
                // Exception for Box 1
                { id: 'exc1', physical_resource_id: 'b1', starts_at: '2026-03-02T14:30:00Z', ends_at: '2026-03-02T15:30:00Z' }
            ]
        });

        // Try booking 14:00Z to 15:00Z (Overlaps exception at 14:30Z)
        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T14:00:00Z'))).rejects.toThrow('No box available');
    });

    it('EDGE 6: Clinic blocked globally by an exception (Global Holiday)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 60, requires_professional_fraction: 1.0, requires_resource_type: 'box', phase_order: 1 }],
            exceptions: [
                // Global exception (both null)
                { id: 'exc1', professional_id: null, physical_resource_id: null, starts_at: '2026-03-02T00:00:00Z', ends_at: '2026-03-02T23:59:00Z' }
            ]
        });

        await expect(AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T14:00:00Z'))).rejects.toThrow('The clinic is closed or blocked during this time');
    });

    it('EDGE 7: Perfectly adjacent phases do NOT overlap in Minute-by-Minute (Rounding sanity)', async () => {
        setupMocks({
            phases: [{ id: 'ph1', duration_minutes: 30, requires_professional_fraction: 1.0, requires_resource_type: null, phase_order: 1 }],
            allocations: [
                // Allocation ENDS at 15:00Z exactly
                { professional_id: 'p1', starts_at: '2026-03-02T14:30:00Z', ends_at: '2026-03-02T15:00:00Z', service_phases: { requires_professional_fraction: 1.0 } }
            ]
        });
        // We want to book starting at exactly 15:00Z. It should succeed with 'p1' because the other one ends right as this starts.
        const result = await AvailabilityService.allocateResourcesForService('s1', new Date('2026-03-02T15:00:00Z'));
        expect(result.allocations[0].professional_id).toBe('p1');
    });
});
