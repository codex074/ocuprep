export interface User {
  id: number;
  name: string;
  pha_id: string;
  password: string;
  role: "admin" | "user";
  active: boolean;
  must_change_password?: boolean;
  profile_image?: string;
  created_at?: string;
}

export interface Formula {
  id: number;
  code?: string; // Add code
  name: string;
  short_name?: string;
  description: string | null;
  concentration: string | null;
  expiry_days: number;
  category: string | null;
  price: number;
  storage?: string;
  ingredients: string | null;
  method: string | null;
  short_prep?: string | null;
  package_size?: string;
  created_at?: string;
}

export interface Prep {
  id: number;
  formula_id: number;
  formula_name: string;
  concentration: string | null;
  mode: "patient" | "stock";
  target: string;
  hn: string;
  patient_name: string;
  dest_room: string;
  lot_no: string;
  date: string;
  expiry_date: string;
  qty: number;
  note: string;
  prepared_by: string;
  user_pha_id?: string;
  location: string;
  created_at?: string;
}
