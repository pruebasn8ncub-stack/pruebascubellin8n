
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
    const email = 'admin@innovakine.com';
    const password = 'admininnovakine';

    console.log(`Creating user: ${email}...`);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('User already exists. You can use it.');
            process.exit(0);
        }
        console.error('Error creating user:', authError);
        process.exit(1);
    }

    const userId = authData.user.id;
    console.log('Auth user created with ID:', userId);

    // 2. Insert profile
    const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
            id: userId,
            full_name: 'Administrador Innovakine',
            role: 'admin'
        }]);

    if (profileError) {
        console.error('Error creating profile:', profileError);
        process.exit(1);
    }

    console.log('Admin profile created successfully!');
    console.log('----------------------------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('----------------------------------------------------');
}

createAdmin();
