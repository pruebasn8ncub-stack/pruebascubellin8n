/**
 * EXHAUSTIVE SCHEDULING ENGINE TEST SUITE v3
 * 
 * Each test uses an ISOLATED time slot to avoid cross-test resource conflicts.
 * Monday-Friday of the same week, spread across hours so the single box
 * doesn't create test interference.
 * 
 * Resources: 1 Box, 2 Cámaras, 2 Profesionales (Mon-Fri 09:00-19:00 Santiago)
 * Santiago = UTC-3 in March, so 09:00 Santiago = 12:00 UTC
 * 
 * Run: npx tsx test-engine.ts
 */
import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { addMinutes, parseISO, isBefore } from 'date-fns';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing env vars'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ══════════════════════════════════════════════════════════════════════
//  INLINE ENGINE (mirrors availability.service.ts exactly)
// ══════════════════════════════════════════════════════════════════════

interface PhaseAlloc { service_phase_id: string | null; professional_id: string; physical_resource_id: string | null; starts_at: string; ends_at: string; }
interface Phase { id: string; phase_order: number; duration_minutes: number; requires_professional_fraction: number; requires_resource_type: string | null; }
class E extends Error { constructor(msg: string, public code: string, public sc: number) { super(msg); } }

function tp(d: Date) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const p = f.formatToParts(d); const g = (t: string) => p.find(x => x.type === t)?.value || '00';
    const dm: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { time: `${g('hour')}:${g('minute')}:${g('second')}`, day: dm[g('weekday')] ?? -1 };
}

async function engine(sid: string, start: Date): Promise<{ allocs: PhaseAlloc[]; end: Date }> {
    const { data: s } = await supabase.from('services').select('id, name, duration_minutes, required_resource_type, required_professionals, is_active, is_composite').eq('id', sid).single();
    if (!s) throw new E('No encontrado', 'SERVICE_NOT_FOUND', 404);
    if (!s.is_active) throw new E('Inactivo', 'SERVICE_INACTIVE', 409);

    let phases: Phase[];
    const { data: dp } = await supabase.from('service_phases').select('id, phase_order, duration_minutes, requires_professional_fraction, requires_resource_type').eq('service_id', sid).order('phase_order', { ascending: true });
    if (dp && dp.length > 0) { phases = dp; }
    else { phases = [{ id: '__v__', phase_order: 1, duration_minutes: s.duration_minutes, requires_professional_fraction: parseFloat(s.required_professionals.toString()), requires_resource_type: s.required_resource_type }]; }

    const allocs: PhaseAlloc[] = [];
    let cur = new Date(start);

    for (const ph of phases) {
        const end = addMinutes(cur, ph.duration_minutes);
        const si = cur.toISOString(), ei = end.toISOString();
        const frac = parseFloat(ph.requires_professional_fraction.toString());

        // Global blocks
        const { data: gb } = await supabase.from('schedule_exceptions').select('id').is('professional_id', null).is('physical_resource_id', null).lt('starts_at', ei).gt('ends_at', si);
        if (gb && gb.length > 0) throw new E('Bloqueada', 'CLINIC_BLOCKED', 409);

        // Resource
        let rid: string | null = null;
        if (ph.requires_resource_type) {
            const { data: res } = await supabase.from('physical_resources').select('id').eq('is_active', true).eq('type', ph.requires_resource_type);
            if (!res || !res.length) throw new E('Sin recursos', 'NO_RESOURCES', 500);
            const rids = res.map(r => r.id);
            const { data: bk } = await supabase.from('appointment_allocations').select('physical_resource_id, appointments!inner(status)').in('physical_resource_id', rids).lt('starts_at', ei).gt('ends_at', si).neq('appointments.status', 'cancelled');
            const { data: be } = await supabase.from('schedule_exceptions').select('physical_resource_id').in('physical_resource_id', rids).lt('starts_at', ei).gt('ends_at', si);
            const occ = new Set<string>([...(bk?.map((x: any) => x.physical_resource_id).filter(Boolean) || []), ...(be?.map((x: any) => x.physical_resource_id).filter(Boolean) || [])]);
            allocs.forEach(a => { if (a.physical_resource_id) occ.add(a.physical_resource_id); });
            const free = res.find(r => !occ.has(r.id));
            if (!free) throw new E('Ocupado', 'RESOURCE_BUSY', 409);
            rid = free.id;
        }

        // Professional
        let pid: string | null = null;
        if (frac > 0) {
            const { data: profs } = await supabase.from('profiles').select('id').eq('role', 'professional');
            if (!profs?.length) throw new E('Sin profs', 'NO_PROFESSIONALS', 500);
            const sp = tp(cur), ep = tp(end);
            for (const pr of profs) {
                const { data: sc } = await supabase.from('professional_schedules').select('start_time, end_time').eq('professional_id', pr.id).eq('day_of_week', sp.day).single();
                if (!sc || sp.time < sc.start_time || ep.time > sc.end_time) continue;
                const { data: px } = await supabase.from('schedule_exceptions').select('id').eq('professional_id', pr.id).lt('starts_at', ei).gt('ends_at', si);
                if (px?.length) continue;
                const { data: aa } = await supabase.from('appointment_allocations')
                    .select('starts_at, ends_at, service_phase_id, appointments!inner(status, service_id, services(required_professionals)), service_phases(requires_professional_fraction)')
                    .eq('professional_id', pr.id).lt('starts_at', ei).gt('ends_at', si).neq('appointments.status', 'cancelled');
                let cap = true;
                for (let t = cur.getTime(); t < end.getTime(); t += 60_000) {
                    let ld = 0;
                    aa?.forEach((a: any) => { if (t >= new Date(a.starts_at).getTime() && t < new Date(a.ends_at).getTime()) { ld += parseFloat((a.service_phases?.requires_professional_fraction ?? a.appointments?.services?.required_professionals ?? 1).toString()); } });
                    if (ld + frac > 1.0) { cap = false; break; }
                }
                if (!cap) continue;
                pid = pr.id; break;
            }
            if (!pid) throw new E('Ocupados', 'PROFESSIONAL_BUSY', 409);
        } else { const { data: fp } = await supabase.from('profiles').select('id').eq('role', 'professional').limit(1).single(); pid = fp?.id || ''; }

        allocs.push({ service_phase_id: ph.id === '__v__' ? null : ph.id, professional_id: pid!, physical_resource_id: rid, starts_at: si, ends_at: ei });
        cur = end;
    }
    return { allocs, end: cur };
}

async function book(patient: string, service: string, time: string) {
    const s = parseISO(time);
    if (isBefore(s, new Date())) throw new E('Pasado', 'INVALID_TIME_RANGE', 400);
    const { allocs, end } = await engine(service, s);
    const { data: a, error: e1 } = await supabase.from('appointments').insert([{ patient_id: patient, service_id: service, starts_at: s.toISOString(), ends_at: end.toISOString(), status: 'scheduled' }]).select().single();
    if (e1) throw new E(e1.message, 'DB_ERROR', 500);
    const rows = allocs.map(x => ({ appointment_id: a.id, ...x }));
    const { error: e2 } = await supabase.from('appointment_allocations').insert(rows);
    if (e2) { await supabase.from('appointments').delete().eq('id', a.id); throw new E('Alloc fail', 'ALLOC_ERROR', 500); }
    return { ...a, allocations: allocs };
}

async function reschedule(id: string, newTime?: string, newSvc?: string) {
    const { data: o } = await supabase.from('appointments').select('*').eq('id', id).single();
    if (!o) throw new E('No encontrada', 'NOT_FOUND', 404);
    if (o.status === 'cancelled') throw new E('Cancelada', 'CANCELLED', 409);
    if (o.status === 'completed') throw new E('Completada', 'COMPLETED', 409);
    const sv = newSvc || o.service_id, st = newTime || o.starts_at;
    const start = new Date(st);
    if (isBefore(start, new Date())) throw new E('Pasado', 'INVALID_TIME_RANGE', 400);
    const { data: oaList } = await supabase.from('appointment_allocations').select('*').eq('appointment_id', id);
    const snap = { service_id: o.service_id, starts_at: o.starts_at, ends_at: o.ends_at, status: o.status };
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    try {
        const { allocs, end } = await engine(sv, start);
        await supabase.from('appointment_allocations').delete().eq('appointment_id', id);
        await supabase.from('appointment_allocations').insert(allocs.map(x => ({ appointment_id: id, ...x })));
        await supabase.from('appointments').update({ service_id: sv, starts_at: start.toISOString(), ends_at: end.toISOString(), status: 'scheduled' }).eq('id', id);
        return { id, allocs, starts_at: start.toISOString(), ends_at: end.toISOString() };
    } catch (err: any) {
        await supabase.from('appointments').update(snap).eq('id', id);
        const { data: ca } = await supabase.from('appointment_allocations').select('id').eq('appointment_id', id);
        if (!ca?.length && oaList?.length) { await supabase.from('appointment_allocations').insert(oaList.map(a => ({ appointment_id: a.appointment_id, service_phase_id: a.service_phase_id, professional_id: a.professional_id, physical_resource_id: a.physical_resource_id, starts_at: a.starts_at, ends_at: a.ends_at }))); }
        throw err;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  TEST FRAMEWORK
// ══════════════════════════════════════════════════════════════════════
let pass = 0, fail = 0;
const cids: string[] = [], eids: string[] = [];
function ok(c: boolean, n: string, d?: string) { if (c) { console.log(`  ✅ ${n}`); pass++; } else { console.log(`  ❌ ${n}${d ? ` — ${d}` : ''}`); fail++; } }

let P1 = '', P2 = '', P3 = '', P4 = '';
let CAMARA = '', EVAL = '', KINESIO = '', MASAJE = '', RECOVERY = '';

// Each test gets its own day/time slot to avoid resource conflicts
// Mon=02, Tue=03, Wed=04, Thu=05, Fri=06 (March 2026)
// Santiago UTC-3: 09:00=12:00Z, 10:00=13:00Z, ..., 18:00=21:00Z
const slot = (day: number, h: number, m = 0) => `2026-03-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;

async function init() {
    const { data: pts } = await supabase.from('patients').select('id').order('full_name').limit(4);
    if (!pts || pts.length < 4) { console.error('❌ Need 4 patients'); process.exit(1); }
    [P1, P2, P3, P4] = pts.map(p => p.id);
    const { data: svcs } = await supabase.from('services').select('id, name').eq('is_active', true);
    if (!svcs) { console.error('❌ No services'); process.exit(1); }
    const f = (k: string) => svcs.find(s => s.name.toLowerCase().includes(k))?.id || '';
    CAMARA = f('camara'); EVAL = f('evaluacion'); KINESIO = f('kinesiolog'); MASAJE = f('masaje'); RECOVERY = f('recovery');
    console.log(`📦 ${pts.length} pacientes, ${svcs.length} servicios\n`);
}

async function cleanup() {
    console.log('\n🧹 Limpiando...');
    for (const id of cids) { await supabase.from('appointment_allocations').delete().eq('appointment_id', id); await supabase.from('appointments').delete().eq('id', id); }
    for (const id of eids) { await supabase.from('schedule_exceptions').delete().eq('id', id); }
    console.log(`   ${cids.length} citas + ${eids.length} excepciones eliminadas.`);
}

// ══════════════════════════════════════════════════════════════════════
async function run() {
    await init();
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MOTOR v2 — SUITE EXHAUSTIVA FINAL');
    console.log('═══════════════════════════════════════════════════════════');

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B1: CREACIÓN ━━━\n');

    // T1 — Simple | Mon 09:00 Santiago (12:00Z)
    console.log('T1: Servicio simple (Evaluación 30min)');
    try {
        const r = await book(P1, EVAL, slot(2, 12)); cids.push(r.id);
        ok(true, 'Creada'); ok(r.allocations.length === 1, '1 alloc');
        ok(r.allocations[0].physical_resource_id != null, 'Box'); ok(r.allocations[0].professional_id != null, 'Prof');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T2 — Cámara | Mon 10:00 Santiago (13:00Z) — different hour, no box conflict
    console.log('\nT2: Cámara hiperbárica (60min, 0.5 prof)');
    try { const r = await book(P2, CAMARA, slot(2, 13)); ok(true, 'Creada'); cids.push(r.id); }
    catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T3 — 2nd cámara simultánea | Mon 10:00 (same as T2)
    console.log('\nT3: 2da cámara simultánea → cámara diferente');
    try { const r = await book(P3, CAMARA, slot(2, 13)); ok(true, 'Creada (cám 2)'); cids.push(r.id); }
    catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T4 — 3rd cámara → must fail | Mon 10:00
    console.log('\nT4: 3ra cámara → RESOURCE_BUSY');
    try { await book(P4, CAMARA, slot(2, 13)); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'RESOURCE_BUSY', 'RESOURCE_BUSY'); }

    // T5 — Composite | Mon 14:00 Santiago (17:00Z) — isolated
    console.log('\nT5: Servicio compuesto (Recovery)');
    try {
        const r = await book(P1, RECOVERY, slot(2, 17)); cids.push(r.id);
        ok(true, 'Creado'); ok(r.allocations.length === 2, '2 allocs');
        if (r.allocations.length === 2) {
            ok(r.allocations[0].service_phase_id != null, 'F1 phase_id');
            ok(r.allocations[1].service_phase_id != null, 'F2 phase_id');
            ok(r.allocations[0].physical_resource_id !== r.allocations[1].physical_resource_id, 'Recursos ≠');
            ok(r.allocations[0].ends_at === r.allocations[1].starts_at, 'Secuenciales');
        }
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T6 — Fractional capacity (0.5+0.5) | Mon 15:00 Santiago (18:00Z) — isolated
    console.log('\nT6: Capacidad fraccional (0.5+0.5 mismo prof)');
    try {
        const r1 = await book(P1, CAMARA, slot(2, 18)); cids.push(r1.id);
        const r2 = await book(P2, CAMARA, slot(2, 18)); cids.push(r2.id);
        ok(true, '2 cámaras simultáneas');
        const same = r1.allocations[0].professional_id === r2.allocations[0].professional_id;
        console.log(`  ℹ️ ${same ? 'MISMO prof ✅' : 'Profs diferentes'}`);
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T7 — Masaje simple | Mon 16:30 Santiago (19:30Z) — isolated
    console.log('\nT7: Masaje (30min, box, 1 prof)');
    try { const r = await book(P3, MASAJE, slot(2, 19, 30)); ok(true, 'Creado'); cids.push(r.id); }
    catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B2: VALIDACIONES ━━━\n');

    // T8 — Fuera de horario
    console.log('T8: Fuera de horario (06:00 Santiago = 09:00 UTC)');
    try { await book(P1, EVAL, slot(2, 9)); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'PROFESSIONAL_BUSY', 'PROFESSIONAL_BUSY'); }

    // T9 — Sábado
    console.log('\nT9: Sábado');
    try { await book(P1, EVAL, '2026-03-07T15:00:00.000Z'); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'PROFESSIONAL_BUSY', 'PROFESSIONAL_BUSY'); }

    // T10 — Domingo
    console.log('\nT10: Domingo');
    try { await book(P1, EVAL, '2026-03-08T15:00:00.000Z'); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'PROFESSIONAL_BUSY', 'PROFESSIONAL_BUSY'); }

    // T11 — Pasado
    console.log('\nT11: Fecha pasada');
    try { await book(P1, EVAL, '2020-01-01T12:00:00.000Z'); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'INVALID_TIME_RANGE', 'INVALID_TIME_RANGE'); }

    // T12 — Servicio inexistente
    console.log('\nT12: Servicio inexistente');
    try { await book(P1, '00000000-0000-0000-0000-000000000000', slot(2, 14)); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'SERVICE_NOT_FOUND', 'SERVICE_NOT_FOUND'); }

    // T13 — Excede horario (18:30+60=19:30 > 19:00)
    console.log('\nT13: Excede horario (18:30+60min = 19:30)');
    try { await book(P1, CAMARA, slot(3, 21, 30)); ok(false, 'Debió fallar'); }
    catch (e: any) { ok(e.code === 'PROFESSIONAL_BUSY', 'PROFESSIONAL_BUSY'); }

    // T14 — Box saturado | Tue 09:00 (14:00Z) — we need 2 box services at same time
    console.log('\nT14: Box saturado (solo 1 box)');
    try {
        const r1 = await book(P1, KINESIO, slot(3, 12)); cids.push(r1.id); // uses box
        try { await book(P2, EVAL, slot(3, 12)); ok(false, 'Debió fallar'); } // same time, needs box
        catch (e2: any) { ok(e2.code === 'RESOURCE_BUSY', 'RESOURCE_BUSY'); }
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T15 — Límite exacto (18:00+60=19:00) | Tue 18:00 Santiago (21:00Z)
    console.log('\nT15: Límite exacto (18:00+60min = 19:00)');
    try { const r = await book(P3, CAMARA, slot(3, 21)); ok(true, 'OK (19:00 exacto)'); cids.push(r.id); }
    catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B3: EXCEPCIONES ━━━\n');

    // T16 — Feriado (bloqueo global) | Wed 10:00
    console.log('T16: Feriado (bloqueo clínica)');
    try {
        const { data: b } = await supabase.from('schedule_exceptions').insert([{ professional_id: null, physical_resource_id: null, starts_at: slot(4, 12), ends_at: slot(4, 16), reason: 'TEST: Feriado' }]).select().single();
        if (b) eids.push(b.id);
        try { await book(P1, EVAL, slot(4, 14)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'CLINIC_BLOCKED', 'CLINIC_BLOCKED'); }
    } catch (e: any) { ok(false, `Error: ${e.message}`); }

    // T17 — Ausencia 1 prof → asigna al otro | Wed 14:00 Santiago (17:00Z)
    console.log('\nT17: Ausencia 1 prof → asigna otro');
    try {
        const { data: profs } = await supabase.from('profiles').select('id').eq('role', 'professional');
        const p1 = profs![0].id;
        const { data: b } = await supabase.from('schedule_exceptions').insert([{ professional_id: p1, starts_at: slot(4, 17), ends_at: slot(4, 19), reason: 'TEST: Ausencia' }]).select().single();
        if (b) eids.push(b.id);
        const r = await book(P1, EVAL, slot(4, 17, 30)); cids.push(r.id);
        ok(true, 'Asignó al otro prof');
        ok(r.allocations[0].professional_id !== p1, 'Prof ≠ bloqueado');
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // T18 — Ambos profs ausentes | Thu 09:00
    console.log('\nT18: AMBOS profs ausentes');
    try {
        const { data: profs } = await supabase.from('profiles').select('id').eq('role', 'professional');
        for (const p of profs!) {
            const { data: b } = await supabase.from('schedule_exceptions').insert([{ professional_id: p.id, starts_at: slot(5, 12), ends_at: slot(5, 14), reason: 'TEST: Ambos' }]).select().single();
            if (b) eids.push(b.id);
        }
        try { await book(P1, EVAL, slot(5, 13)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'PROFESSIONAL_BUSY', 'PROFESSIONAL_BUSY'); }
    } catch (e: any) { ok(false, `Error: ${e.message}`); }

    // T19 — Ambas cámaras en mantenimiento | Thu 14:00 Santiago (17:00Z)
    console.log('\nT19: Cámaras en mantenimiento');
    try {
        const { data: ch } = await supabase.from('physical_resources').select('id').eq('type', 'chamber');
        for (const c of ch!) {
            const { data: b } = await supabase.from('schedule_exceptions').insert([{ physical_resource_id: c.id, starts_at: slot(5, 17), ends_at: slot(5, 19), reason: 'TEST: Mant.' }]).select().single();
            if (b) eids.push(b.id);
        }
        try { await book(P1, CAMARA, slot(5, 18)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'RESOURCE_BUSY', 'RESOURCE_BUSY'); }
    } catch (e: any) { ok(false, `Error: ${e.message}`); }

    // T20 — Cierre temprano (bloqueo parcial del día) | Fri 15:00-19:00 Santiago
    console.log('\nT20: Cierre temprano (15:00-19:00 bloqueado)');
    try {
        const { data: b } = await supabase.from('schedule_exceptions').insert([{ professional_id: null, physical_resource_id: null, starts_at: slot(6, 18), ends_at: slot(6, 22), reason: 'TEST: Cierre' }]).select().single();
        if (b) eids.push(b.id);
        // 14:00 Santiago = 17:00 UTC → OK
        const r = await book(P1, EVAL, slot(6, 17)); cids.push(r.id);
        ok(true, '14:00 OK (antes del cierre)');
        // 15:30 Santiago = 18:30 UTC → BLOCKED
        try { await book(P2, EVAL, slot(6, 18, 30)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'CLINIC_BLOCKED', 'CLINIC_BLOCKED (cierre)'); }
    } catch (e: any) { ok(false, `Error: ${e.code || e.message}`); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B4: CANCELACIÓN Y STATUS ━━━\n');

    // T21 — Cancel + reuse slot | Tue 12:00 Santiago (15:00Z)
    console.log('T21: Cancelar libera recursos');
    try {
        const r = await book(P1, EVAL, slot(3, 15)); cids.push(r.id);
        await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', r.id);
        const { data: c } = await supabase.from('appointments').select('status').eq('id', r.id).single();
        ok(c?.status === 'cancelled', 'Cancelada');
        const r2 = await book(P4, EVAL, slot(3, 15)); cids.push(r2.id);
        ok(true, 'Slot reutilizado');
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // T22 — Complete
    console.log('\nT22: Completar cita');
    try {
        const r = await book(P1, EVAL, slot(3, 16)); cids.push(r.id);
        await supabase.from('appointments').update({ status: 'completed' }).eq('id', r.id);
        const { data: c } = await supabase.from('appointments').select('status').eq('id', r.id).single();
        ok(c?.status === 'completed', 'completed');
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // T23 — No-show
    console.log('\nT23: No-show');
    try {
        const r = await book(P2, CAMARA, slot(3, 17)); cids.push(r.id);
        await supabase.from('appointments').update({ status: 'no_show' }).eq('id', r.id);
        const { data: c } = await supabase.from('appointments').select('status').eq('id', r.id).single();
        ok(c?.status === 'no_show', 'no_show');
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B5: REAGENDAMIENTO ━━━\n');

    // T24 — Reagendar a otro horario | Tue 13:00→16:00 Santiago
    console.log('T24: Reagendar evaluación a otro horario');
    try {
        const r = await book(P1, EVAL, slot(3, 16, 30)); cids.push(r.id);
        const res = await reschedule(r.id, slot(3, 19)); // 16:00 Santiago
        ok(new Date(res.starts_at).getTime() === new Date(slot(3, 19)).getTime(), 'Horario actualizado');
        const { data: al } = await supabase.from('appointment_allocations').select('starts_at').eq('appointment_id', r.id);
        ok(al?.length === 1, '1 alloc'); ok(new Date(al?.[0]?.starts_at).getTime() === new Date(slot(3, 19)).getTime(), 'Alloc nueva');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code || e.message}`); }

    // T25 — Reagendar a slot ocupado → rollback | Tue 10:00 vs 09:00
    console.log('\nT25: Reagendar a slot ocupado → rollback');
    try {
        // T14 already occupies Tue 09:00 (slot(3,12)) box with Kinesio
        const r = await book(P2, EVAL, slot(3, 13)); cids.push(r.id); // Tue 10:00, box free
        const origStart = r.starts_at;
        try {
            await reschedule(r.id, slot(3, 12)); // Try Tue 09:00 → box busy
            ok(false, 'Debió fallar');
        } catch (e: any) {
            ok(e.code === 'RESOURCE_BUSY' || e.code === 'PROFESSIONAL_BUSY', `Rechazó: ${e.code}`);
            const { data: c } = await supabase.from('appointments').select('starts_at, status').eq('id', r.id).single();
            ok(c?.status === 'scheduled', 'Status restaurado');
            ok(new Date(c?.starts_at).getTime() === new Date(origStart).getTime(), 'Horario original intacto');
            const { data: al } = await supabase.from('appointment_allocations').select('id').eq('appointment_id', r.id);
            ok((al?.length || 0) > 0, 'Allocations restauradas');
        }
    } catch (e: any) { ok(false, `Error: ${e.code || e.message}`); }

    // T26 — Cambiar servicio | Fri 09:00: Eval→Cámara
    console.log('\nT26: Cambiar servicio (Eval → Cámara)');
    try {
        const r = await book(P3, EVAL, slot(6, 12)); cids.push(r.id);
        await reschedule(r.id, undefined, CAMARA);
        const { data: c } = await supabase.from('appointments').select('service_id').eq('id', r.id).single();
        ok(c?.service_id === CAMARA, 'Servicio actualizado');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T27 — Simple → Compuesto | Fri 11:00
    console.log('\nT27: Simple → Compuesto (Eval → Recovery)');
    try {
        const r = await book(P1, EVAL, slot(6, 14)); cids.push(r.id);
        ok(r.allocations.length === 1, 'Original: 1 alloc');
        await reschedule(r.id, undefined, RECOVERY);
        const { data: al } = await supabase.from('appointment_allocations').select('*').eq('appointment_id', r.id);
        ok(al?.length === 2, 'Ahora: 2 allocs (compuesto)');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T28 — Reagendar cancelada → error
    console.log('\nT28: Reagendar cancelada → error');
    try {
        const r = await book(P4, EVAL, slot(6, 15)); cids.push(r.id);
        await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', r.id);
        try { await reschedule(r.id, slot(6, 16)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'CANCELLED', 'Rechazó cancelada'); }
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // T29 — Reagendar completada → error
    console.log('\nT29: Reagendar completada → error');
    try {
        const r = await book(P1, CAMARA, slot(6, 16)); cids.push(r.id);
        await supabase.from('appointments').update({ status: 'completed' }).eq('id', r.id);
        try { await reschedule(r.id, slot(6, 13)); ok(false, 'Debió fallar'); }
        catch (e: any) { ok(e.code === 'COMPLETED', 'Rechazó completada'); }
    } catch (e: any) { ok(false, `Error: ${e.code}`); }

    // T30 — Cambiar horario + servicio simultáneamente | Fri 12:00
    console.log('\nT30: Cambiar horario + servicio simultáneamente');
    try {
        const r = await book(P2, EVAL, slot(6, 12, 30)); cids.push(r.id); // Fri 09:30 Santiago
        const res = await reschedule(r.id, slot(6, 13), CAMARA); // Fri 10:00 Santiago (before block)
        const { data: c } = await supabase.from('appointments').select('service_id, starts_at').eq('id', r.id).single();
        ok(c?.service_id === CAMARA, 'Servicio cambiado');
        ok(new Date(c?.starts_at).getTime() === new Date(slot(6, 13)).getTime(), 'Horario cambiado');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T31 — Reagendar servicio compuesto | Wed 16:00→17:00 Santiago
    console.log('\nT31: Reagendar servicio compuesto (Recovery)');
    try {
        const r = await book(P3, RECOVERY, slot(4, 19)); cids.push(r.id); // Wed 16:00 Santiago
        ok(r.allocations.length === 2, 'Original: 2 fases');
        const res = await reschedule(r.id, slot(4, 20)); // Wed 17:00 Santiago
        const { data: al } = await supabase.from('appointment_allocations').select('starts_at, ends_at').eq('appointment_id', r.id).order('starts_at');
        ok(al?.length === 2, 'Mantiene 2 allocs');
        if (al?.length === 2) { ok(al[0].ends_at === al[1].starts_at, 'Secuenciales post-reschedule'); }
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('\n━━━ B6: EDGE CASES ━━━\n');

    // T32 — Cancel-reuse x3 | Mon 17:00 Santiago (20:00Z)
    console.log('T32: Cancel-reuse slot 3 veces');
    try {
        for (let i = 0; i < 3; i++) {
            const r = await book(P1, EVAL, slot(5, 20)); cids.push(r.id); // Thu 17:00 Santiago — clean slot
            await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', r.id);
        }
        const final = await book(P1, EVAL, slot(5, 20)); cids.push(final.id);
        ok(true, 'Reutilizado 3x');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T33 — Overlap parcial (cámara 09:00-10:00 + eval 09:15-09:45) | Mon 12:15Z
    console.log('\nT33: Overlap parcial (cámara + evaluación en paralelo)');
    try {
        // T2 already has cámara at Mon 10:00 (13:00Z). Use Mon 17:30 Santiago (20:30Z)
        const r1 = await book(P1, CAMARA, slot(2, 14)); cids.push(r1.id); // Mon 11:00 Santiago, cámara
        const r2 = await book(P2, EVAL, slot(2, 14, 15)); cids.push(r2.id); // Mon 11:15, eval (box), overlap parcial
        ok(true, 'Ambas creadas (recursos ≠, overlap parcial OK)');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // T34 — Compuesto → Simple (Recovery → Evaluación) via reschedule
    console.log('\nT34: Compuesto → Simple (Recovery → Eval)');
    try {
        const r = await book(P4, RECOVERY, slot(3, 18)); cids.push(r.id);
        const { data: al1 } = await supabase.from('appointment_allocations').select('id').eq('appointment_id', r.id);
        ok(al1?.length === 2, 'Original: 2 allocs');
        await reschedule(r.id, undefined, EVAL);
        const { data: al2 } = await supabase.from('appointment_allocations').select('id').eq('appointment_id', r.id);
        ok(al2?.length === 1, 'Después: 1 alloc (simple)');
    } catch (e: any) { ok(false, `FALLÓ: ${e.code}`); }

    // ━━━ CLEANUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    await cleanup();
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`  RESULTADOS: ${pass} PASSED ✅  |  ${fail} FAILED ❌`);
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
