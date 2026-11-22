/**
 * Pure-logic tests for RBAC and poll visibility rules. No database, no
 * network, no personal data — only fake fixtures.
 *
 *   npm run test:polls
 */
import assert from "node:assert/strict";

import { parseCsv, parseRosterJson } from "../features/polls/lib/csv-parse";
import {
  type StudentContext,
  csvCell,
  inAudience,
  studentPollState,
  toCsv,
} from "../features/polls/lib/rules";
import {
  type Permission,
  type RoleName,
  parseRoles,
  rolesHavePermission,
  serializeRoles,
} from "../lib/permissions/roles";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

// ── Role → permission matrix (the agreed design) ────────────────────────────

const ALL: Permission[] = [
  "poll:respond",
  "poll:manage",
  "poll:export",
  "roster:read",
  "roster:write",
  "roster:export",
  "quiz:manage",
  "experience:verify",
  "experience:moderate",
  "experience:templates",
  "access:manage-roles",
  "access:ban",
  "access:revoke-sessions",
  "audit:read",
];

const EXPECTED: Record<RoleName, Permission[]> = {
  student: ["poll:respond"],
  faculty: [
    "poll:respond",
    "poll:manage",
    "poll:export",
    "roster:read",
    "roster:write",
    "roster:export",
  ],
  placement_coordinator: [
    "poll:respond",
    "poll:manage",
    "roster:read",
    "roster:write",
    "experience:verify",
    "experience:moderate",
    "experience:templates",
  ],
  activity_coordinator: [
    "poll:respond",
    "poll:manage",
    "roster:read",
    "quiz:manage",
  ],
  admin: ALL,
};

for (const [role, allowed] of Object.entries(EXPECTED) as [
  RoleName,
  Permission[],
][]) {
  test(`role matrix: ${role}`, () => {
    for (const permission of ALL) {
      assert.equal(
        rolesHavePermission([role], permission),
        allowed.includes(permission),
        `${role} → ${permission}`,
      );
    }
  });
}

test("multiple roles combine", () => {
  const roles: RoleName[] = ["placement_coordinator", "activity_coordinator"];
  assert.ok(rolesHavePermission(roles, "quiz:manage"));
  assert.ok(rolesHavePermission(roles, "experience:verify"));
  assert.ok(rolesHavePermission(roles, "roster:write"));
  assert.ok(!rolesHavePermission(roles, "roster:export"));
  assert.ok(!rolesHavePermission(roles, "access:manage-roles"));
});

test("parseRoles / serializeRoles", () => {
  assert.deepEqual(parseRoles(null), ["student"]);
  assert.deepEqual(parseRoles(""), ["student"]);
  assert.deepEqual(parseRoles("student"), ["student"]);
  assert.deepEqual(parseRoles(" faculty , admin "), ["faculty", "admin"]);
  assert.deepEqual(parseRoles("hacker,faculty,faculty"), ["faculty"]);
  assert.deepEqual(parseRoles("superuser"), ["student"]);
  assert.equal(serializeRoles([]), "student");
  assert.equal(serializeRoles(["student", "faculty"]), "faculty");
  assert.equal(serializeRoles(["admin", "admin", "faculty"]), "admin,faculty");
});

// ── Poll visibility / respond rules ─────────────────────────────────────────

const fakeStudent = {
  id: "s1",
  name: "Test Student",
  usn: "1XX25MC001",
  email: "test.student@example.edu",
  batch: "2025-27",
  section: "A",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function ctx(overrides: Partial<StudentContext> = {}): StudentContext {
  return {
    user: {} as StudentContext["user"],
    student: fakeStudent,
    memberPollIds: new Set(),
    excludedPollIds: new Set(),
    grants: new Map(),
    responses: new Map(),
    ...overrides,
  };
}

const response = {
  id: "r1",
  textAnswer: null,
  submittedAt: new Date(),
  optionIds: ["o1"],
};

type Row = Parameters<typeof studentPollState>[0];
const poll = (overrides: Partial<Row> = {}): Row => ({
  id: "p1",
  status: "open",
  audienceMode: "all",
  kind: "quick",
  allowVoteChange: false,
  ...overrides,
});
const rule = (batch: string, section: string | null) => ({ batch, section });

test("drafts are never visible", () => {
  const s = studentPollState(poll({ status: "draft" }), null, ctx());
  assert.equal(s.visible, false);
});

test("open poll for everyone", () => {
  const s = studentPollState(poll(), null, ctx());
  assert.deepEqual([s.visible, s.canRespond], [true, true]);
});

test("'all' audience works even without a roster entry", () => {
  const s = studentPollState(poll(), null, ctx({ student: null }));
  assert.equal(s.canRespond, true);
});

test("group: other batch is hidden", () => {
  const s = studentPollState(
    poll({ audienceMode: "group" }),
    rule("2024-26", null),
    ctx(),
  );
  assert.equal(s.visible, false);
});

test("group: whole batch (no section) matches any section", () => {
  assert.ok(
    inAudience(poll({ audienceMode: "group" }), rule("2025-27", null), ctx()),
  );
});

test("group: other section is hidden", () => {
  const s = studentPollState(
    poll({ audienceMode: "group" }),
    rule("2025-27", "B"),
    ctx(),
  );
  assert.equal(s.visible, false);
});

test("group: excluded student is hidden", () => {
  const s = studentPollState(
    poll({ audienceMode: "group" }),
    rule("2025-27", "A"),
    ctx({ excludedPollIds: new Set(["p1"]) }),
  );
  assert.equal(s.visible, false);
});

test("group: not in roster is hidden", () => {
  const s = studentPollState(
    poll({ audienceMode: "group" }),
    rule("2025-27", null),
    ctx({ student: null }),
  );
  assert.equal(s.visible, false);
});

test("group with missing rule is hidden", () => {
  const s = studentPollState(poll({ audienceMode: "group" }), null, ctx());
  assert.equal(s.visible, false);
});

test("custom: member sees it, non-member doesn't", () => {
  const p = poll({ audienceMode: "custom" });
  assert.equal(
    studentPollState(p, null, ctx({ memberPollIds: new Set(["p1"]) }))
      .canRespond,
    true,
  );
  assert.equal(studentPollState(p, null, ctx()).visible, false);
});

test("closed poll without grant: visible, can't respond", () => {
  const s = studentPollState(poll({ status: "closed" }), null, ctx());
  assert.deepEqual(
    [s.visible, s.canRespond, s.blockedReason],
    [true, false, "This poll is closed."],
  );
});

test("closed poll with grant: can respond once, via grant", () => {
  const s = studentPollState(
    poll({ status: "closed" }),
    null,
    ctx({ grants: new Map([["p1", "g1"]]) }),
  );
  assert.deepEqual([s.canRespond, s.viaGrant, s.grantId], [true, true, "g1"]);
});

test("closed poll with grant but already responded: blocked", () => {
  const s = studentPollState(
    poll({ status: "closed" }),
    null,
    ctx({
      grants: new Map([["p1", "g1"]]),
      responses: new Map([["p1", response]]),
    }),
  );
  assert.equal(s.canRespond, false);
});

test("grant on closed poll never allows changing an answer", () => {
  const s = studentPollState(
    poll({ status: "closed", allowVoteChange: true }),
    null,
    ctx({
      grants: new Map([["p1", "g1"]]),
      responses: new Map([["p1", response]]),
    }),
  );
  assert.equal(s.canRespond, false);
});

test("grant admits a student outside the audience", () => {
  const s = studentPollState(
    poll({ audienceMode: "group" }),
    rule("2024-26", null),
    ctx({ grants: new Map([["p1", "g1"]]) }),
  );
  assert.deepEqual([s.visible, s.canRespond, s.viaGrant], [true, true, true]);
});

test("quick poll: vote change only when allowed", () => {
  const answered = ctx({ responses: new Map([["p1", response]]) });
  assert.equal(
    studentPollState(poll({ allowVoteChange: true }), null, answered)
      .canRespond,
    true,
  );
  assert.equal(
    studentPollState(poll({ allowVoteChange: false }), null, answered)
      .canRespond,
    false,
  );
});

test("seatlock: a locked seat can never change", () => {
  const s = studentPollState(
    poll({ kind: "seatlock", allowVoteChange: true }),
    null,
    ctx({ responses: new Map([["p1", response]]) }),
  );
  assert.deepEqual(
    [s.canRespond, s.blockedReason],
    [false, "Your seat is locked."],
  );
});

test("answered, then removed from audience: still sees own answer, can't respond", () => {
  const s = studentPollState(
    poll({ audienceMode: "custom", allowVoteChange: true }),
    null,
    ctx({ responses: new Map([["p1", response]]) }),
  );
  assert.deepEqual([s.visible, s.canRespond], [true, false]);
});

// ── CSV ─────────────────────────────────────────────────────────────────────

test("csvCell blocks spreadsheet formula injection", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1"), "'-1");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell("a,b"), `"a,b"`);
  assert.equal(csvCell("line\nbreak"), `"line\nbreak"`);
});

test("toCsv uses CRLF rows", () => {
  assert.equal(toCsv(["a", "b"], [[1, "x"]]), "a,b\r\n1,x");
});

test("parseCsv handles BOM, quotes, commas, CRLF and header case", () => {
  const rows = parseCsv(
    '﻿Name,USN,Email\r\n"Doe, Jane",1XX1,"a""b@x.edu"\r\n\r\nSam,1XX2,s@x.edu\n',
  );
  assert.deepEqual(rows, [
    { name: "Doe, Jane", usn: "1XX1", email: 'a"b@x.edu' },
    { name: "Sam", usn: "1XX2", email: "s@x.edu" },
  ]);
  assert.deepEqual(parseCsv("name,usn\n"), []);
});

test("parseRosterJson accepts both shapes", () => {
  assert.equal(parseRosterJson('[{"name":"A"}]').length, 1);
  const rows = parseRosterJson(
    '{"batch":"2025-27","students":[{"name":"A"},{"name":"B","batch":"2024-26"}]}',
  );
  assert.deepEqual(
    rows.map((r) => r.batch),
    ["2025-27", "2024-26"],
  );
  assert.throws(() => parseRosterJson('{"nope":1}'));
});

console.log(`✓ ${passed} poll/RBAC logic tests passed`);
