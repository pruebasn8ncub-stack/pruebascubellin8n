import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://supabase-supabase.wfrhms.easypanel.host';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ.DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixAdminRole() {
    console.log("Fetching admin user...");
    // Find the user id for admin@admin.com from auth.users via admin api
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
        console.error("Error listing users:", usersError);
        return;
    }

    const adminUser = usersData.users.find(u => u.email === 'admin@admin.com');
    if (!adminUser) {
        console.log("admin@admin.com not found!");
        return;
    }

    console.log("Admin User ID:", adminUser.id);

    // Check if profile exists
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', adminUser.id)
        .single();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error("Error checking profile:", profileError);
    }

    if (!profileData) {
        console.log("Profile missing. Creating profile with admin role...");
        const { error: insertError } = await supabase
            .from('profiles')
            .insert([{ id: adminUser.id, full_name: 'Administrador General', role: 'admin' }]);
        if (insertError) console.error("Insert error:", insertError);
        else console.log("Profile created successfully!");
    } else {
        console.log("Profile exists. Updating role to admin...");
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', adminUser.id);
        if (updateError) console.error("Update error:", updateError);
        else console.log("Profile role updated to admin!");
    }
}

fixAdminRole();
