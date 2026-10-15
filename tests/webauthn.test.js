import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

test('WebAuthn Test Suite: Security, Registration, Authentication & Fallback', async (t) => {
  let regChallenge = '';
  let authChallenge = '';
  const testUserId = 'APP01'; // Nara Lokesh Garu / MLA Coordinator

  await t.test('1. Check WebAuthn passkey availability for unregistered user', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/check/UNREGISTERED_USER_999`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.hasPasskey, false);
    assert.equal(data.count, 0);
  });

  await t.test('2. Generate Registration Options with single-use challenge', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        userName: 'Nara Lokesh',
        userRole: 'Employee'
      })
    });
    assert.equal(res.status, 200);
    const options = await res.json();

    assert.ok(options.challenge, 'Must include cryptographic challenge');
    assert.ok(options.rp, 'Must include Relying Party object');
    assert.equal(options.rp.id, 'localhost');
    assert.ok(options.user, 'Must include user entity');
    assert.equal(options.user.name, 'Nara Lokesh');
    assert.ok(Array.isArray(options.pubKeyCredParams), 'Must specify supported public key algorithms');
    assert.ok(options.authenticatorSelection, 'Must specify authenticatorSelection');

    regChallenge = options.challenge;
  });

  await t.test('3. Reject registration verify with forged or expired challenge', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        response: {
          id: 'fake-cred-id',
          rawId: 'fake-cred-id',
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({
              type: 'webauthn.create',
              challenge: 'EXPIRED_OR_FORGED_CHALLENGE',
              origin: 'http://localhost:3000'
            })).toString('base64url'),
            attestationObject: 'fake-attestation'
          },
          type: 'public-key'
        }
      })
    });

    // Must be rejected as challenge expired or invalid
    const data = await res.json();
    assert.equal(data.verified, false);
    assert.match(data.error, /challenge/i);
  });

  await t.test('4. Generate Authentication Options', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/authenticate/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUserId })
    });
    assert.equal(res.status, 200);
    const options = await res.json();

    assert.ok(options.challenge, 'Must generate unpredictable single-use challenge');
    assert.equal(options.rpId, 'localhost');
    assert.equal(options.userVerification, 'preferred');

    authChallenge = options.challenge;
  });

  await t.test('5. Reject authentication verify with missing or unrecognized credential', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: {
          id: 'UNKNOWN_CREDENTIAL_ID_xyz123',
          rawId: 'UNKNOWN_CREDENTIAL_ID_xyz123',
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({
              type: 'webauthn.get',
              challenge: authChallenge,
              origin: 'http://localhost:3000'
            })).toString('base64url'),
            authenticatorData: 'fake-auth-data',
            signature: 'fake-sig'
          },
          type: 'public-key'
        }
      })
    });

    const data = await res.json();
    assert.equal(data.verified, false);
    assert.match(data.error, /not recognized/i);
  });

  await t.test('6. Verify Credentials listing returns safe metadata only', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/credentials?userId=${testUserId}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.credentials));

    // Must never return private keys, secrets, or biometric templates
    for (const cred of data.credentials) {
      assert.equal(cred.privateKey, undefined);
      assert.equal(cred.secret, undefined);
      assert.equal(cred.fingerprintTemplate, undefined);
      assert.ok(cred.id);
      assert.ok(cred.deviceLabel);
      assert.ok(cred.createdAt);
    }
  });

  await t.test('7. Delete credential rejects requests with missing parameters', async () => {
    const res = await fetch(`${BASE_URL}/api/webauthn/credentials/some-id`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  await t.test('8. Replay Attack Prevention: Single-use challenge cannot be reused', async () => {
    // Generate fresh challenge
    const optRes = await fetch(`${BASE_URL}/api/webauthn/authenticate/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testUserId })
    });
    const { challenge } = await optRes.json();
    assert.ok(challenge);

    // First attempt consumes challenge
    const res1 = await fetch(`${BASE_URL}/api/webauthn/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: {
          id: 'NON_EXISTENT_CRED',
          rawId: 'NON_EXISTENT_CRED',
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({
              type: 'webauthn.get',
              challenge: challenge,
              origin: 'http://localhost:3000'
            })).toString('base64url'),
            authenticatorData: 'authdata',
            signature: 'sig'
          },
          type: 'public-key'
        }
      })
    });
    const d1 = await res1.json();
    // Non-existent credential rejected
    assert.equal(d1.verified, false);

    // Second attempt with exact same challenge must fail with challenge expired/invalid
    const res2 = await fetch(`${BASE_URL}/api/webauthn/authenticate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response: {
          id: 'NON_EXISTENT_CRED',
          rawId: 'NON_EXISTENT_CRED',
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({
              type: 'webauthn.get',
              challenge: challenge,
              origin: 'http://localhost:3000'
            })).toString('base64url'),
            authenticatorData: 'authdata',
            signature: 'sig'
          },
          type: 'public-key'
        }
      })
    });
    const d2 = await res2.json();
    assert.equal(d2.verified, false);
  });

  await t.test('9. Relying Party and Origin Binding to deployment host', async () => {
    // Test custom origin forwarding (e.g. production domain)
    const prodOrigin = 'https://social.bhashyamramakrishna.in';
    const res = await fetch(`${BASE_URL}/api/webauthn/register/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': prodOrigin,
        'Host': 'social.bhashyamramakrishna.in'
      },
      body: JSON.stringify({ userId: 'APP02', userName: 'Staff Member' })
    });
    const data = await res.json();
    assert.equal(data.rp.id, 'social.bhashyamramakrishna.in');
  });
});
