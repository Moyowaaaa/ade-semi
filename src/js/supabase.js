import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function submitRSVP(data) {
  const { name, email, phone, attending, events, message } = data;
  
  const { data: result, error } = await supabase
    .from('rsvps')
    .insert({
      name,
      email,
      phone,
      attending,
      events,
      message,
      created_at: new Date().toISOString()
    })
    .select();
  
  if (error) {
    throw new Error(error.message);
  }
  
  return result;
}
