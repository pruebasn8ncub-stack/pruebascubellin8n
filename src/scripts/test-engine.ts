import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createAdminClient } from '../lib/supabase/admin';
import { AppointmentsService } from '../services/appointments.service';
import { addDays, setHours, setMinutes, startOfMinute } from 'date-fns';

const supabase = createAdminClient();

async function runTests() {
    console.log('🧪 Iniciando batería de pruebas del Motor de Agendamiento...');

    try {
        // --- 1. SETUP & WIPE ---
        console.log('\n🧹 [Paso 1] Limpiando base de datos (Wipe de citas)...');
        // Delete all allocations first (due to foreign key constraints, though ON DELETE CASCADE might be on)
        await supabase.from('appointment_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('✅ Base de datos limpia.');

        // Get prerequisites
        console.log('\n🔍 [Paso 2] Cargando datos base...');
        const { data: patients } = await supabase.from('patients').select('id').limit(1);
        if (!patients || patients.length === 0) throw new Error('No se encontraron pacientes para probar.');
        const testPatientId = patients[0].id;

        const { data: simpleServices } = await supabase.from('services').select('id, name, duration_minutes').eq('is_composite', false).eq('is_active', true).limit(1);
        if (!simpleServices || simpleServices.length === 0) throw new Error('No se encontró un servicio simple activo.');
        const simpleService = simpleServices[0];

        const { data: compositeServices } = await supabase.from('services').select('id, name').eq('is_composite', true).eq('is_active', true).limit(1);
        if (!compositeServices || compositeServices.length === 0) throw new Error('No se encontró un servicio compuesto activo.');
        const compositeService = compositeServices[0];

        console.log(`Paciente Test: ${testPatientId}`);
        console.log(`Servicio Simple: ${simpleService.name} (${simpleService.id})`);
        console.log(`Servicio Compuesto: ${compositeService.name} (${compositeService.id})`);

        // Find a valid day to test (Lunes, 2 de marzo de 2026 a las 10:00 AM)
        const testDate = startOfMinute(setMinutes(setHours(new Date('2026-03-02T13:00:00.000Z'), 10), 0));
        console.log(`\n📅 Hora base de las pruebas: ${testDate.toISOString()} (Lunes a las 10:00)`);


        // --- TEST 1: Cita Simple ---
        console.log(`\n▶️  [Test 1] Agendando Cita Simple (${simpleService.name})...`);
        const appt1 = await AppointmentsService.createAppointment({
            patient_id: testPatientId,
            service_id: simpleService.id,
            starts_at: testDate.toISOString(),
            notes: 'Test Cita Simple'
        });
        console.log('✅ Cita simple agendada exitosamente:', appt1.id);


        // --- TEST 2: Cita Compuesta ---
        const testDate2 = startOfMinute(setMinutes(setHours(new Date('2026-03-02T13:00:00.000Z'), 11), 0));
        console.log(`\n▶️  [Test 2] Agendando Cita Compuesta (${compositeService.name}) a las 11:00...`);
        // This should pass if there are enough resources (Box is free again)
        const appt2 = await AppointmentsService.createAppointment({
            patient_id: testPatientId,
            service_id: compositeService.id,
            starts_at: testDate2.toISOString(),
            notes: 'Test Cita Compuesta'
        });
        console.log('✅ Cita compuesta agendada exitosamente (con sus fases):', appt2.id);
        console.log(`   └─ Se asignaron ${(appt2 as any).allocations?.length} fases/recursos correctamente.`);


        // --- TEST 3: Choque de Recursos Físicos ---
        console.log('\n▶️  [Test 3] Provocando Choque de Recursos Físicos...');
        // Let's assume there are only 2 Camaras or 1 Box. 
        // We will try to flood the system at `testDate` with simple services until it throws an error.
        let successCount = 0;
        let caughtError = false;
        try {
            console.log('Intentando agendar citas repetitivamente para agotar recursos...');
            for (let i = 0; i < 5; i++) {
                await AppointmentsService.createAppointment({
                    patient_id: testPatientId,
                    service_id: simpleService.id,
                    starts_at: testDate.toISOString()
                });
                successCount++;
                console.log(`   ├─ Cita adicional ${i + 1} agendada con éxito`);
            }
        } catch (error: any) {
            console.log(`   └─ ⛔ Error capturado correctamente: ${error.message}`);
            caughtError = true;
            if (error.code === 'RESOURCE_BUSY' || error.code === 'PROFESSIONAL_BUSY') {
                console.log(`✅ Test superado: El motor detuvo el agendamiento después de ${successCount} citas exitosas por falta de capacidad.`);
            } else {
                throw new Error(`Error inesperado: ${error.message}`);
            }
        }
        if (!caughtError) throw new Error('El sistema no bloqueó las sobre-citas. El test falló.');


        // --- TEST 5: Clínica Cerrada (Excepción Global) ---
        const testDateBlocked = startOfMinute(setMinutes(setHours(new Date('2026-03-03T13:00:00.000Z'), 14), 0)); // Martes a las 14:00
        console.log(`\n▶️  [Test 5] Validando Bloqueo Global de Clínica (${testDateBlocked.toISOString()})...`);

        // Bloquear clínica insertando excepción que dure 1 hora
        const blockEndsAt = new Date(testDateBlocked);
        blockEndsAt.setHours(blockEndsAt.getHours() + 1);

        const { error: blockErr, data: exceptionData } = await supabase
            .from('schedule_exceptions')
            .insert([{
                reason: 'TEST_BLOQUEO_GLOBAL',
                starts_at: testDateBlocked.toISOString(),
                ends_at: blockEndsAt.toISOString()
            }]).select().single();

        if (blockErr) throw new Error(`Error creando excepción: ${blockErr.message}`);

        let caughtBlockError = false;
        try {
            await AppointmentsService.createAppointment({
                patient_id: testPatientId,
                service_id: simpleService.id,
                starts_at: testDateBlocked.toISOString()
            });
        } catch (error: any) {
            console.log(`   └─ ⛔ Error capturado correctamente: ${error.message}`);
            if (error.code === 'CLINIC_BLOCKED') {
                console.log(`✅ Test superado: El motor impidió agendar durante cierre de clínica.`);
                caughtBlockError = true;
            }
        }
        if (!caughtBlockError) throw new Error('El sistema permitió agendar a pesar del bloqueo. El test falló.');

        // Limpiar la excepción
        await supabase.from('schedule_exceptions').delete().eq('id', exceptionData.id);


        // --- TEST 6: Reagendamiento Rollback ---
        console.log('\n▶️  [Test 6] Validando Rollback en Reagendamiento...');
        // Intentaremos mover appt1 a la misma hora exacta donde saturamos el sistema (testDate)
        // Pero primero saturemos el sistema de nuevo (en una nueva fecha para probar limpio)

        const testDateRollback = startOfMinute(setMinutes(setHours(new Date('2026-03-04T13:00:00.000Z'), 11), 0)); // Miercoles a las 11:00
        console.log(`   ├─ Llenando la hora ${testDateRollback.toISOString()} para generar choque...`);

        while (true) {
            try {
                await AppointmentsService.createAppointment({
                    patient_id: testPatientId,
                    service_id: simpleService.id,
                    starts_at: testDateRollback.toISOString()
                });
            } catch (e) {
                break; // Sistema lleno
            }
        }

        // Ahora intentamos mover appt1 a esa hora ocupada
        let caughtRollbackError = false;
        try {
            console.log(`   ├─ Intentando reagendar appt1 en el horario ocupado...`);
            await AppointmentsService.rescheduleAppointment(appt1.id, {
                starts_at: testDateRollback.toISOString()
            });
        } catch (error: any) {
            console.log(`   └─ ⛔ Error capturado correctamente: ${error.message}`);
            caughtRollbackError = true;

            // Validate the appointment still exists and at the original time
            const { data: verifyAppt } = await supabase.from('appointments').select('*').eq('id', appt1.id).single();
            if (verifyAppt.starts_at === appt1.starts_at) {
                console.log(`✅ Test superado: La cita falló al reagendarse, pero su estado original intacto y no fue modificada ni cancelada (Rollback Exitoso).`);
            } else {
                throw new Error('La cita fue alterada a pesar del fallo. ROLLBACK FALLÓ.');
            }
        }
        if (!caughtRollbackError) throw new Error('El reagendamiento debió fallar. Rollback no aplicable. Test falló.');


        console.log('\n🎉 TODOS LOS TESTS HAN SIDO SUPERADOS CON ÉXITO 🎉');
        console.log('El motor de agendamiento respondió perfectamente a las reglas matemáticas e imprevistos de la clínica.');

    } catch (error: any) {
        console.error('\n❌ ERROR EN LOS TESTS:', error);
    }
}

runTests();
