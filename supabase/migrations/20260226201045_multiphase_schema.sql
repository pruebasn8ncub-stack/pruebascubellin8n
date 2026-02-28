-- Profiles table extending auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text not null,
  role text not null check (role in ('admin', 'professional', 'receptionist')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Patients table
create table public.patients (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text,
  phone text not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-------------------------------------------------------------------------------
-- RESOURCE & SERVICE DEFINITIONS (MULTI-PHASE)
-------------------------------------------------------------------------------

-- Physical Resources (e.g. "Chamber 1", "Chamber 2", "Box 1")
create table public.physical_resources (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('chamber', 'box')),
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Services offered by the clinic (e.g. "Hyperbaric Session", "Recovery")
-- The total duration is now calculated by summing its phases.
create table public.services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Phases of a service. e.g. "Recovery" -> Phase 1: 30m Box, Phase 2: 30m Chamber.
create table public.service_phases (
  id uuid default gen_random_uuid() primary key,
  service_id uuid references public.services(id) on delete cascade not null,
  phase_order integer not null, -- 1, 2, 3... defines the sequence
  duration_minutes integer not null,
  requires_professional_fraction numeric(3,2) not null, -- 1.00 (Full), 0.50 (Half/Chamber)
  requires_resource_type text check (requires_resource_type in ('chamber', 'box', null)),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(service_id, phase_order)
);

-------------------------------------------------------------------------------
-- APPOINTMENTS & GRANULAR ALLOCATIONS
-------------------------------------------------------------------------------

-- Core Appointments Table
create table public.appointments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete restrict not null,
  service_id uuid references public.services(id) on delete restrict not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null, -- Total end time (start + sum of phases)
  status text not null check (status in ('scheduled', 'cancelled', 'completed', 'no_show')) default 'scheduled',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Link Table: Locking resources and professionals to specific PHASES of an appointment
-- The engine now queries this to determine overlaps at specific minute marks
create table public.appointment_allocations (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references public.appointments(id) on delete cascade not null,
  service_phase_id uuid references public.service_phases(id) on delete restrict not null,
  professional_id uuid references public.profiles(id) on delete restrict not null,
  physical_resource_id uuid references public.physical_resources(id) on delete restrict, -- Nullable if phase requires no room
  starts_at timestamp with time zone not null, -- Specific start of THIS phase
  ends_at timestamp with time zone not null,   -- Specific end of THIS phase
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-------------------------------------------------------------------------------
-- SCHEDULES & EXCEPTIONS
-------------------------------------------------------------------------------

-- Base weekly schedules for professionals
create table public.professional_schedules (
  id uuid default gen_random_uuid() primary key,
  professional_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(professional_id, day_of_week)
);

-- Exceptions (Absences, vacations, blocked days for maintenance)
create table public.schedule_exceptions (
  id uuid default gen_random_uuid() primary key,
  professional_id uuid references public.profiles(id) on delete cascade, -- if null, clinic is closed
  physical_resource_id uuid references public.physical_resources(id) on delete cascade, -- if null, not a room issue
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.physical_resources enable row level security;
alter table public.services enable row level security;
alter table public.service_phases enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_allocations enable row level security;
alter table public.professional_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;

-- Global read access for authenticated backend
create policy "Authenticated users can read all" on profiles for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on patients for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on physical_resources for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on services for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on service_phases for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on appointments for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on appointment_allocations for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on professional_schedules for select using (auth.role() = 'authenticated');
create policy "Authenticated users can read all" on schedule_exceptions for select using (auth.role() = 'authenticated');

-- Triggers for updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

create trigger on_patients_updated
  before update on public.patients
  for each row execute procedure public.handle_updated_at();

create trigger on_appointments_updated
  before update on public.appointments
  for each row execute procedure public.handle_updated_at();
