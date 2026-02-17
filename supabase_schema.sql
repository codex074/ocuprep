-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pha_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial users
INSERT INTO public.users (name, pha_id, password, role, active)
VALUES 
    ('ภก.สมชาย เภสัชกร', 'PHA001', '1234', 'admin', true),
    ('ภญ.สมหญิง ยาดี', 'PHA002', '1234', 'user', true),
    ('ภก.วิชัย ตาสว่าง', 'PHA003', '1234', 'user', true)
ON CONFLICT (pha_id) DO NOTHING;

-- 2. FORMULAS TABLE
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

-- Seed initial formulas
INSERT INTO public.formulas (name, description, concentration, expiry_days, category, price, ingredients, method)
VALUES
    ('Fortified Cefazolin Eye Drops', 'ยาหยอดตาปฏิชีวนะ Cefazolin ความเข้มข้นสูง', '50 mg/mL', 7, 'antibiotic', 150, '- Cefazolin 1g vial x 1\n- Artificial Tears 15 mL x 1', '1. เตรียมในตู้ปลอดเชื้อ\n2. ละลาย Cefazolin ด้วย Artificial Tears\n3. ดูดยาใส่ขวดหยอดตา\n4. ติดฉลาก เก็บในตู้เย็น 2-8°C'),
    ('Fortified Gentamicin Eye Drops', 'ยาหยอดตาปฏิชีวนะ Gentamicin ความเข้มข้นสูง', '14 mg/mL', 7, 'antibiotic', 120, '- Gentamicin Inj 80mg/2mL x 1\n- Artificial Tears 15 mL x 1', '1. เตรียมในตู้ปลอดเชื้อ\n2. ดูด Gentamicin injection\n3. ผสมกับ Artificial Tears\n4. ติดฉลาก เก็บตู้เย็น 2-8°C'),
    ('Fortified Vancomycin Eye Drops', 'ยาหยอดตาปฏิชีวนะ Vancomycin', '25 mg/mL', 7, 'antibiotic', 350, '- Vancomycin 500mg vial x 1\n- SWFI 10 mL\n- Artificial Tears 15 mL', '1. ละลาย Vancomycin ด้วย SWFI 10 mL\n2. ดูด 5 mL ผสม Artificial Tears 15 mL\n3. บรรจุขวดหยอดตา\n4. เก็บตู้เย็น 2-8°C'),
    ('Amphotericin B Eye Drops', 'ยาหยอดตาต้านเชื้อรา', '1.5 mg/mL', 7, 'antifungal', 280, '- Amphotericin B 50mg vial x 1\n- SWFI 10 mL\n- D5W 15 mL', '1. ละลาย Amphotericin B ด้วย SWFI\n2. เจือจางด้วย D5W\n3. กรอง 0.22 µm filter\n4. บรรจุขวด ห่อฟอยล์กันแสง'),
    ('Autologous Serum Eye Drops', 'ยาหยอดตาจาก Serum ผู้ป่วย', '20%', 30, 'lubricant', 0, '- เลือดผู้ป่วย (clotted blood)\n- NSS (Normal Saline)', '1. เจาะเลือด 20 mL\n2. ปั่นเหวี่ยง 3000 rpm 10 นาที\n3. ดูด Serum เจือจาง NSS 1:4\n4. บรรจุขวด เก็บ -20°C'),
    ('Voriconazole Eye Drops', 'ยาหยอดตาต้านเชื้อรา Voriconazole', '10 mg/mL (1%)', 14, 'antifungal', 500, '- Voriconazole 200mg vial x 1\n- SWFI 19 mL', '1. ละลาย Voriconazole 200mg ด้วย SWFI 19 mL\n2. ได้ ~10 mg/mL\n3. บรรจุขวดหยอดตา\n4. เก็บตู้เย็น 2-8°C');

-- 3. PREPS TABLE
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

-- Enable Row Level Security (RLS) - Optional for now but good practice
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preps ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (since we are responding to "Disable Auth" request in a way)
-- Ideally you should properly configure policies, but for this step we want to make it work seamlessly with the provided key.
CREATE POLICY "Enable all for users" ON public.users FOR ALL USING (true);
CREATE POLICY "Enable all for formulas" ON public.formulas FOR ALL USING (true);
CREATE POLICY "Enable all for preps" ON public.preps FOR ALL USING (true);
