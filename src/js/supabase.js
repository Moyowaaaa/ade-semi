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

export async function submitClaim(data) {
  const { itemId, itemName, guestName, guestEmail, claimType, amount, message } = data;
  
  const { data: result, error } = await supabase
    .from('claims')
    .insert({
      item_id: itemId,
      item_name: itemName,
      guest_name: guestName,
      guest_email: guestEmail,
      claim_type: claimType,
      amount: amount || null,
      message: message || null,
      status: 'pending'
    })
    .select();
  
  if (error) {
    throw new Error(error.message);
  }
  
  return result;
}
