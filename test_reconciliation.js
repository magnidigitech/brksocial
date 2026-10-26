/**
 * Automated Verification Test Suite for Instagram Full-List Reconciliation System
 * Tests all 14 Mandatory Test Cases specified in requirements.
 */

import assert from 'assert';
import { 
  normalizeInstagramUsername, 
  processFollowerPayload 
} from './src/services/instagramUtils.js';

const BASE_URL = 'http://localhost:3000';
const ADMIN_RESET_PASSWORD = process.env.ADMIN_RESET_PASSWORD || 'Magni@3939';

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch (_) {
    return { status: res.status, ok: res.ok, data: text };
  }
}

function getSubsList(res) {
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.data?.submissions)) return res.data.submissions;
  return [];
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log(' BRK SOCIAL - 14 MANDATORY TEST CASES FOR RECONCILIATION');
  console.log('=============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function record(title, passed, extra = '') {
    if (passed) {
      console.log(`  [PASS] ${title}${extra ? ` (${extra})` : ''}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] ${title}${extra ? ` (${extra})` : ''}`);
      failedCount++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test Case 13: Unauthorized users cannot execute reset endpoint
    // -------------------------------------------------------------
    console.log('--- TEST 13: Unauthorized Access Prevention on Reset Endpoint ---');
    const unauthRes1 = await api('/api/admin/reset-followers-database', {
      method: 'POST',
      body: JSON.stringify({ password: 'WrongPassword123', confirmation: 'RESET' })
    });
    record('Reject invalid password', unauthRes1.status === 401 && !unauthRes1.data.success);

    const unauthRes2 = await api('/api/admin/reset-followers-database', {
      method: 'POST',
      body: JSON.stringify({ password: ADMIN_RESET_PASSWORD, confirmation: 'WRONG_CONFIRMATION' })
    });
    record('Reject without explicit RESET confirmation', unauthRes2.status === 400 && !unauthRes2.data.success);

    // Now execute an authorized reset to establish fresh state
    const resetRes = await api('/api/admin/reset-followers-database', {
      method: 'POST',
      body: JSON.stringify({ password: ADMIN_RESET_PASSWORD, confirmation: 'RESET' })
    });
    record('Authorized reset with ADMIN_RESET_PASSWORD succeeds', resetRes.ok && resetRes.data.success);

    // Verify stats after reset are 0 active followers
    const statsAfterReset = await api('/api/instagram/followers/reconciliation/stats');
    const curActive = statsAfterReset.data.currentActiveFollowers ?? statsAfterReset.data.stats?.currentActiveFollowers;
    record('Database is at 0 followers after reset', curActive === 0);

    // -------------------------------------------------------------
    // Test Case 1: Baseline import with 20,700 unique usernames
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Baseline Import with 20,700 Unique Usernames ---');
    console.log('Generating 20,700 mock followers payload...');
    const baseline20700 = [];
    for (let i = 1; i <= 20700; i++) {
      baseline20700.push({ username: `user_${i}`, timestamp: 1700000000 + i });
    }

    // Seed submissions for user_1 and user_100
    await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({
        id: 'SUB-TEST-1',
        taskId: 'TASK-INSTA-001',
        employeeId: 'APP13',
        employeeName: 'Ravi Kumar',
        username: 'user_1',
        status: 'Pending Submission',
        submittedAt: new Date().toISOString()
      })
    });

    await api('/api/submissions', {
      method: 'POST',
      body: JSON.stringify({
        id: 'SUB-TEST-100',
        taskId: 'TASK-INSTA-001',
        employeeId: 'APP13',
        employeeName: 'Ravi Kumar',
        username: 'user_100',
        status: 'Pending Submission',
        submittedAt: new Date().toISOString()
      })
    });

    const baselineImportRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'BASELINE',
        operator: 'Admin',
        payload: baseline20700
      })
    });

    const baseCount = baselineImportRes.data.currentActiveFollowers ?? baselineImportRes.data.activeCount;
    record(
      'Baseline import 20,700 followers',
      baselineImportRes.ok && 
      baselineImportRes.data.validUnique === 20700 && 
      baseCount === 20700,
      `activeCount = ${baseCount}`
    );

    // Verify submission user_1 is now active / Valid Submission
    const subsAfterBaseline = getSubsList(await api('/api/submissions'));
    const sub1 = subsAfterBaseline.find(s => s.username === 'user_1');
    record('Submitted user_1 matched and activated in baseline', sub1 && (sub1.status === 'Valid Submission' || sub1.isValid));

    // -------------------------------------------------------------
    // Test Case 2: Next list has 20,300 usernames, 400 missing -> 400 unfollows
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Daily Reconciliation with 400 Unfollows (20,700 -> 20,300) ---');
    // Drop 400 users (e.g. user_100 to user_499 missing)
    const daily20300 = [];
    for (let i = 1; i <= 20700; i++) {
      if (i >= 100 && i < 500) {
        continue;
      }
      daily20300.push({ username: `user_${i}`, timestamp: 1700000000 + i });
    }

    const dailyImportRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'RECONCILIATION',
        operator: 'Admin',
        payload: daily20300
      })
    });

    const dailyActive = dailyImportRes.data.currentActiveFollowers ?? dailyImportRes.data.activeCount;
    record(
      'Identify 400 unfollows and update count to 20,300',
      dailyImportRes.ok &&
      dailyImportRes.data.newUnfollowers === 400 &&
      dailyImportRes.data.retainedFollowers === 20300 &&
      dailyActive === 20300,
      `unfollowers = ${dailyImportRes.data?.newUnfollowers}, activeCount = ${dailyActive}`
    );

    // -------------------------------------------------------------
    // Test Case 3: Retained user remains active without duplicates
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Retained User Remains Active Without Duplicates ---');
    const checkUser1 = await api('/api/instagram/followers/check/user_1');
    const subsCheck = getSubsList(await api('/api/submissions'));
    const user1Subs = subsCheck.filter(s => s.username === 'user_1');

    record('user_1 remains active follower', checkUser1.data.exists && checkUser1.data.status === 'active');
    record('No duplicate submissions created for user_1', user1Subs.length === 1);

    // -------------------------------------------------------------
    // Test Case 4: A new username appears -> added once, count increases once
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: New Username Appears (Count Increases Once) ---');
    const listWithNewUser = [...daily20300, { username: 'brand_new_follower_999' }];
    const beforeCount = dailyActive;

    const newFollowerImportRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'RECONCILIATION',
        operator: 'Admin',
        payload: listWithNewUser
      })
    });

    const countAfterNew = newFollowerImportRes.data.currentActiveFollowers ?? newFollowerImportRes.data.activeCount;
    record(
      'New user detected (+1) and active count increases by exactly 1',
      newFollowerImportRes.data.newFollowers === 1 &&
      countAfterNew === beforeCount + 1,
      `newFollowers = ${newFollowerImportRes.data?.newFollowers}, count = ${countAfterNew}`
    );

    // -------------------------------------------------------------
    // Test Case 5: Active submitted username disappears -> marked unfollowed
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Active Submitted Follower Disappears ---');
    const sub100 = subsCheck.find(s => s.username === 'user_100');
    record(
      'Linked submission marked Unfollowed when follower disappears',
      sub100 && (sub100.status === 'unfollowed' || sub100.status === 'Unfollowed') && !sub100.isValid,
      `status = ${sub100?.status}`
    );

    // -------------------------------------------------------------
    // Test Case 6: Unfollowed username reappears -> reactivated once
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Unfollowed User Reappears (Reactivated Once) ---');
    const listWithReappearing = [...listWithNewUser, { username: 'user_100' }];
    const returnImportRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'RECONCILIATION',
        operator: 'Admin',
        payload: listWithReappearing
      })
    });

    const subsAfterReturn = getSubsList(await api('/api/submissions'));
    const sub100AfterReturn = subsAfterReturn.find(s => s.username === 'user_100');
    const sub100Count = subsAfterReturn.filter(s => s.username === 'user_100').length;

    record(
      'Reappearing user reactivated once with re_followed_at',
      sub100AfterReturn && 
      (sub100AfterReturn.status === 'Valid Submission' || sub100AfterReturn.isValid) &&
      (!!sub100AfterReturn.re_followed_at || !!sub100AfterReturn.reFollowedAt),
      `status = ${sub100AfterReturn?.status}`
    );
    record('No duplicate submission created upon return', sub100Count === 1);

    // -------------------------------------------------------------
    // Test Case 7: Same JSON imported twice -> idempotent (no duplicate events)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Idempotent Double Import ---');
    const countBeforeDup = returnImportRes.data.currentActiveFollowers ?? returnImportRes.data.activeCount;
    const secondImportRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'RECONCILIATION',
        operator: 'Admin',
        payload: listWithReappearing
      })
    });

    const countAfterDup = secondImportRes.data.currentActiveFollowers ?? secondImportRes.data.activeCount;
    record(
      'Identical second import generates 0 new and 0 unfollowers',
      secondImportRes.data.newFollowers === 0 &&
      secondImportRes.data.newUnfollowers === 0 &&
      countAfterDup === countBeforeDup,
      `+${secondImportRes.data?.newFollowers}, -${secondImportRes.data?.newUnfollowers}, total = ${countAfterDup}`
    );

    // -------------------------------------------------------------
    // Test Case 8: Malformed or incomplete JSON does not alter DB
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Malformed / Incomplete JSON Rejection ---');
    const countBeforeMalformed = countAfterDup;
    const malformedRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'RECONCILIATION',
        operator: 'Admin',
        payload: { invalid_structure: "no followers array or handles" }
      })
    });

    const statsAfterMalformed = await api('/api/instagram/followers/reconciliation/stats');
    const countAfterMalformed = statsAfterMalformed.data.currentActiveFollowers ?? statsAfterMalformed.data.stats?.currentActiveFollowers;
    record(
      'Malformed payload rejected with 400 and preserves active count',
      !malformedRes.ok && countAfterMalformed === countBeforeMalformed
    );

    // -------------------------------------------------------------
    // Test Case 9: Duplicate usernames in JSON count as one unique follower
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Duplicate Usernames in Single JSON Payload ---');
    const payloadWithDuplicates = [
      { username: 'duplicate_user_alpha' },
      { username: '@duplicate_user_alpha' },
      { username: 'https://instagram.com/duplicate_user_alpha' },
      { username: 'DUPLICATE_USER_ALPHA' }
    ];
    const parsedRes = processFollowerPayload(payloadWithDuplicates);
    record(
      'Case, @, and URL duplicates deduplicate to 1 unique record',
      parsedRes.validUnique === 1 && parsedRes.uniqueMap.has('duplicate_user_alpha'),
      `unique = ${parsedRes.validUnique}`
    );

    // -------------------------------------------------------------
    // Test Case 10: Follower without submission is tracked but uncredited
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Follower Without Submission Uncredited ---');
    const organicUserCheck = await api('/api/instagram/followers/check/brand_new_follower_999');
    const organicSubs = getSubsList(await api('/api/submissions')).filter(s => s.username === 'brand_new_follower_999');

    record(
      'Organic follower tracked in database without assigning arbitrary employee credit',
      organicUserCheck.data.exists && organicUserCheck.data.status === 'active' && organicSubs.length === 0
    );

    // -------------------------------------------------------------
    // Test Case 11: Employee historical submission preserved after unfollow
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Preservation of Historical Submissions After Unfollow ---');
    const allSubs = getSubsList(await api('/api/submissions'));
    const empSubmissions = allSubs.filter(s => s.employeeId === 'APP13');
    record(
      'Historical submission record preserved (not deleted) after unfollow',
      empSubmissions.length >= 2,
      `emp submissions count = ${empSubmissions.length}`
    );

    // -------------------------------------------------------------
    // Test Case 12: Database transaction rollback on error
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Transaction Integrity / Safety on Error ---');
    const statsBeforeRollback = await api('/api/instagram/followers/reconciliation/stats');
    const countBeforeRollback = statsBeforeRollback.data.currentActiveFollowers ?? statsBeforeRollback.data.stats?.currentActiveFollowers;
    const errorRes = await api('/api/instagram/followers/reconcile-commit', {
      method: 'POST',
      body: JSON.stringify({ mode: 'RECONCILIATION', payload: [] })
    });
    const statsAfterRollback = await api('/api/instagram/followers/reconciliation/stats');
    const countAfterRollback = statsAfterRollback.data.currentActiveFollowers ?? statsAfterRollback.data.stats?.currentActiveFollowers;

    record(
      'Empty or erroneous import rejected and rolls back cleanly',
      !errorRes.ok && countBeforeRollback === countAfterRollback,
      `before = ${countBeforeRollback}, after = ${countAfterRollback}`
    );

    // -------------------------------------------------------------
    // Test Case 14: Re-following does not erase previous unfollow history
    // -------------------------------------------------------------
    console.log('\n--- TEST 14: Event History Preservation (Unfollow + Refollow) ---');
    const eventsRes = await api('/api/instagram/followers/events');
    const allEvents = eventsRes.data.events || [];
    const user100Events = allEvents.filter(e => e.username === 'user_100');
    const hasUnfollowEvent = user100Events.some(e => e.eventType === 'UNFOLLOW' || e.event_type === 'UNFOLLOW');
    const hasFollowEvent = user100Events.some(e => e.eventType === 'RE_FOLLOW' || e.eventType === 'FOLLOW' || e.event_type === 'RE_FOLLOW' || e.event_type === 'FOLLOW');

    record(
      'Events table preserves historical UNFOLLOW and subsequent RE_FOLLOW events',
      hasUnfollowEvent && hasFollowEvent,
      `user_100 events: ${user100Events.map(e => e.eventType || e.event_type).join(', ')}`
    );

  } catch (err) {
    console.error('\nUnexpected test suite error:', err);
    failedCount++;
  }

  console.log('\n=============================================================');
  console.log(` RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('=============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite();
