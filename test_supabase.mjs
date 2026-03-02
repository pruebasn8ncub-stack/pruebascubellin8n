import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase-supabase.wfrhms.easypanel.host';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Logging in...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@admin.com',
        password: 'admin'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }
    console.log("Logged in successfully. User ID:", authData.user.id);

    console.log("Testing insert into patients...");
    const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .insert([{ full_name: 'Test Setup Script', email: 'test@test.com' }])
        .select();

    if (patientError) {
        console.error("Patient insert error:", patientError);
    } else {
        console.log("Patient created successfully:", patientData);
    }
}

test();
