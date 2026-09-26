const crypto = require('crypto');
const supabase = require('../../config/supabase');

const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;

// Development mode: no SMS provider is configured yet, so instead of sending
// a text message, requestOtp() hands the freshly-generated code straight
// back to the caller (the API response). Once a real SMS provider is wired
// up (Twilio or otherwise) later, only sendSms() below needs to change -
// nothing in the request/verify flow or the routes/mobile app needs to move.
function isDevMode() {
  return process.env.OTP_DEV_MODE !== 'false';
}

function normalizePhone(rawPhone) {
  const trimmed = String(rawPhone || '').trim();
  // Keep a leading + but strip everything else that isn't a digit, so
  // "+962 79 123 4567" and "00962791234567" don't count as different phones.
  return trimmed.replace(/(?!^\+)[^\d]/g, '');
}

function generateOtpCode() {
  const max = 10 ** OTP_LENGTH;
  const code = crypto.randomInt(0, max);
  return String(code).padStart(OTP_LENGTH, '0');
}

function hashCode(phone, code) {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

async function sendSms(phone, code) {
  // Placeholder for the future real SMS provider integration. Intentionally
  // does nothing right now - see isDevMode() above.
  console.log(`[otp] (dev mode, no SMS sent) code for ${phone}: ${code}`);
}

async function requestOtp(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone || phone.length < 8) {
    const error = new Error('A valid phone number is required');
    error.statusCode = 400;
    throw error;
  }

  const code = generateOtpCode();
  const codeHash = hashCode(phone, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: insertError } = await supabase.from('otp_codes').insert({
    phone,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) throw insertError;

  if (isDevMode()) {
    // No SMS provider configured yet: hand the code back directly so the
    // mobile app (or Postman, while testing) can use it immediately.
    return { phone, devCode: code, expiresAt };
  }

  await sendSms(phone, code);
  return { phone, expiresAt };
}

async function verifyOtp(rawPhone, submittedCode) {
  const phone = normalizePhone(rawPhone);
  const code = String(submittedCode || '').trim();

  if (!phone || !code) {
    const error = new Error('Phone and code are required');
    error.statusCode = 400;
    throw error;
  }

  const { data: candidates, error: selectError } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('consumed', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (selectError) throw selectError;

  const latest = candidates?.[0];
  if (!latest) {
    const error = new Error('No pending code for this phone number. Request a new one.');
    error.statusCode = 400;
    error.code = 'OTP_NOT_FOUND';
    throw error;
  }

  if (new Date(latest.expires_at).getTime() < Date.now()) {
    const error = new Error('This code has expired. Request a new one.');
    error.statusCode = 400;
    error.code = 'OTP_EXPIRED';
    throw error;
  }

  if (latest.attempts >= MAX_VERIFY_ATTEMPTS) {
    const error = new Error('Too many incorrect attempts. Request a new code.');
    error.statusCode = 429;
    error.code = 'OTP_TOO_MANY_ATTEMPTS';
    throw error;
  }

  const submittedHash = hashCode(phone, code);
  const isMatch = submittedHash === latest.code_hash;

  if (!isMatch) {
    await supabase
      .from('otp_codes')
      .update({ attempts: latest.attempts + 1 })
      .eq('id', latest.id);

    const error = new Error('Incorrect code');
    error.statusCode = 400;
    error.code = 'OTP_INCORRECT';
    throw error;
  }

  await supabase.from('otp_codes').update({ consumed: true }).eq('id', latest.id);

  return { phone };
}

module.exports = { requestOtp, verifyOtp, normalizePhone };
