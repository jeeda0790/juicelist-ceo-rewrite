const express = require('express');
const router = express.Router();
const { requestOtp, verifyOtp } = require('../services/auth/otp');
const { getOrCreateUserByPhone } = require('../services/auth/users');
const { issueSessionToken } = require('../services/auth/tokens');

router.post('/request-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await requestOtp(phone);

    res.json({
      success: true,
      phone: result.phone,
      expiresAt: result.expiresAt,
      // devCode is only present while OTP_DEV_MODE is on (no SMS provider
      // configured yet). It is never included once a real SMS provider is
      // wired up - see services/auth/otp.js.
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const { phone: normalizedPhone } = await verifyOtp(phone, code);

    const user = await getOrCreateUserByPhone(normalizedPhone);
    const token = issueSessionToken(user.id);

    res.json({
      success: true,
      token,
      user: { id: user.id, phone: user.phone },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
  }
});

module.exports = router;
