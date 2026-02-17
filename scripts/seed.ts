import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ksgvuqserhzwraleyymq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzZ3Z1cXNlcmh6d3JhbGV5eW1xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTE0NDkzNSwiZXhwIjoyMDg2NzIwOTM1fQ.Xz1xszlhHuVzzxvzbVsXt69oDzFvs6PfBLjOqgVyOZU';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  db: { schema: 'public' },
});

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pha_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.formulas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    concentration TEXT,
    expiry_days INTEGER DEFAULT 7,
    category TEXT,
    price INTEGER DEFAULT 0,
    ingredients TEXT,
    method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.preps (
    id SERIAL PRIMARY KEY,
    formula_id INTEGER REFERENCES public.formulas(id),
    formula_name TEXT,
    concentration TEXT,
    mode TEXT CHECK (mode IN ('patient', 'stock')),
    target TEXT,
    hn TEXT,
    patient_name TEXT,
    dest_room TEXT,
    lot_no TEXT,
    date DATE,
    expiry_date DATE,
    qty INTEGER DEFAULT 1,
    note TEXT,
    prepared_by TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preps ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Enable all for users" ON public.users FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Enable all for formulas" ON public.formulas FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Enable all for preps" ON public.preps FOR ALL USING (true);
`;

async function setup() {
  // Try executing SQL via rpc (requires a helper function in Supabase)
  // Since we can't run raw SQL directly, let's try to use the tables
  // and if they don't exist, guide the user

  console.log('Attempting to check tables...');
  
  // Check if users table exists
  const { error: usersCheck } = await supabase.from('users').select('id').limit(1);
  
  if (usersCheck && usersCheck.code === 'PGRST205') {
    console.log('❌ Tables do not exist. Creating them via SQL...');
    
    // Try using the pg-meta endpoint
    const res = await fetch(`${supabaseUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ query: SCHEMA_SQL }),
    });
    
    if (!res.ok) {
      // Try alternative endpoint
      const res2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({ sql: SCHEMA_SQL }),
      });
      
      if (!res2.ok) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║  กรุณาสร้างตารางผ่าน Supabase Dashboard SQL Editor  ║');
        console.log('╠══════════════════════════════════════════════════════╣');
        console.log('║                                                      ║');
        console.log('║  1. เปิด Supabase Dashboard                         ║');
        console.log('║  2. ไปที่ SQL Editor                                 ║');
        console.log('║  3. คัดลอก SQL จากไฟล์ supabase_schema.sql           ║');
        console.log('║  4. รัน SQL แล้วกลับมารัน script นี้อีกครั้ง         ║');
        console.log('║                                                      ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log('');
        console.log('URL: https://supabase.com/dashboard/project/ksgvuqserhzwraleyymq/sql/new');
        process.exit(1);
      }
      const data2 = await res2.json();
      console.log('SQL via RPC result:', data2);
    } else {
      const data = await res.json();
      console.log('SQL result:', data);
    }
    
    // Re-check
    const { error: recheck } = await supabase.from('users').select('id').limit(1);
    if (recheck) {
      console.log('Tables still not found after SQL execution. Please create them manually.');
      process.exit(1);
    }
  }
  
  console.log('✅ Tables exist!');
  
  // Seed Admin user
  console.log('Inserting Admin user...');
  const { data: adminData, error: adminErr } = await supabase
    .from('users')
    .upsert(
      { name: 'Admin', pha_id: 'Admin', password: '1234', role: 'admin', active: true },
      { onConflict: 'pha_id' }
    )
    .select();
    
  if (adminErr) {
    console.error('❌ Error:', adminErr.message);
  } else {
    console.log('✅ Admin user:', adminData);
  }

  // Seed sample formulas
  console.log('Inserting sample formulas...');
  const formulas = [
    {name:'Fortified Cefazolin Eye Drops',description:'ยาหยอดตาปฏิชีวนะ Cefazolin ความเข้มข้นสูง',concentration:'50 mg/mL',expiry_days:7,category:'antibiotic',price:150,ingredients:'- Cefazolin 1g vial x 1\n- Artificial Tears 15 mL x 1',method:'1. เตรียมในตู้ปลอดเชื้อ\n2. ละลาย Cefazolin ด้วย Artificial Tears\n3. ดูดยาใส่ขวดหยอดตา\n4. ติดฉลาก เก็บในตู้เย็น 2-8°C'},
    {name:'Fortified Gentamicin Eye Drops',description:'ยาหยอดตาปฏิชีวนะ Gentamicin ความเข้มข้นสูง',concentration:'14 mg/mL',expiry_days:7,category:'antibiotic',price:120,ingredients:'- Gentamicin Inj 80mg/2mL x 1\n- Artificial Tears 15 mL x 1',method:'1. เตรียมในตู้ปลอดเชื้อ\n2. ดูด Gentamicin injection\n3. ผสมกับ Artificial Tears\n4. ติดฉลาก เก็บตู้เย็น 2-8°C'},
    {name:'Fortified Vancomycin Eye Drops',description:'ยาหยอดตาปฏิชีวนะ Vancomycin',concentration:'25 mg/mL',expiry_days:7,category:'antibiotic',price:350,ingredients:'- Vancomycin 500mg vial x 1\n- SWFI 10 mL\n- Artificial Tears 15 mL',method:'1. ละลาย Vancomycin ด้วย SWFI 10 mL\n2. ดูด 5 mL ผสม Artificial Tears 15 mL\n3. บรรจุขวดหยอดตา\n4. เก็บตู้เย็น 2-8°C'},
    {name:'Amphotericin B Eye Drops',description:'ยาหยอดตาต้านเชื้อรา',concentration:'1.5 mg/mL',expiry_days:7,category:'antifungal',price:280,ingredients:'- Amphotericin B 50mg vial x 1\n- SWFI 10 mL\n- D5W 15 mL',method:'1. ละลาย Amphotericin B ด้วย SWFI\n2. เจือจางด้วย D5W\n3. กรอง 0.22 µm filter\n4. บรรจุขวด ห่อฟอยล์กันแสง'},
    {name:'Autologous Serum Eye Drops',description:'ยาหยอดตาจาก Serum ผู้ป่วย',concentration:'20%',expiry_days:30,category:'lubricant',price:0,ingredients:'- เลือดผู้ป่วย (clotted blood)\n- NSS (Normal Saline)',method:'1. เจาะเลือด 20 mL\n2. ปั่นเหวี่ยง 3000 rpm 10 นาที\n3. ดูด Serum เจือจาง NSS 1:4\n4. บรรจุขวด เก็บ -20°C'},
    {name:'Voriconazole Eye Drops',description:'ยาหยอดตาต้านเชื้อรา Voriconazole',concentration:'10 mg/mL (1%)',expiry_days:14,category:'antifungal',price:500,ingredients:'- Voriconazole 200mg vial x 1\n- SWFI 19 mL',method:'1. ละลาย Voriconazole 200mg ด้วย SWFI 19 mL\n2. ได้ ~10 mg/mL\n3. บรรจุขวดหยอดตา\n4. เก็บตู้เย็น 2-8°C'},
  ];

  const { data: fData, error: fErr } = await supabase
    .from('formulas')
    .upsert(formulas, { onConflict: 'name' })
    .select('id, name');
  
  if (fErr) {
    // If upsert fails because no unique constraint on name, try insert with ignore
    console.log('Upsert failed, trying insert...');
    const { data: existing } = await supabase.from('formulas').select('name');
    const existingNames = new Set((existing || []).map((f: any) => f.name));
    const newFormulas = formulas.filter(f => !existingNames.has(f.name));
    if (newFormulas.length > 0) {
      const { error: insertErr } = await supabase.from('formulas').insert(newFormulas);
      if (insertErr) console.error('Formula insert error:', insertErr.message);
      else console.log(`✅ Inserted ${newFormulas.length} formulas`);
    } else {
      console.log('✅ All formulas already exist');
    }
  } else {
    console.log('✅ Formulas:', fData?.map((f: any) => f.name));
  }

  // Final check
  const { data: allUsers } = await supabase.from('users').select('id, name, pha_id, role, active');
  const { data: allFormulas } = await supabase.from('formulas').select('id, name');
  console.log('\n===== Database Status =====');
  console.log('Users:', allUsers);
  console.log('Formulas:', allFormulas?.length, 'items');
  console.log('===========================');
}

setup();
