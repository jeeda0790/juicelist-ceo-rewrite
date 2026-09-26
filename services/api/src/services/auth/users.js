const supabase = require('../../config/supabase');

async function getOrCreateUserByPhone(phone) {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({ phone })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

module.exports = { getOrCreateUserByPhone };
