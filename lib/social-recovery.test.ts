import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClassroomNudges,
  computeClassroomCompletion,
  splitGroupsByMembership,
} from "./social-recovery";

test("classroom nudges target only students without a verified or manual completion", () => {
  const nudges = buildClassroomNudges({
    actorId: "teacher-1",
    assignmentId: "assignment-1",
    assignmentTitle: "Cell Biology",
    classroomId: "classroom-1",
    classroomName: "Year 10 Science",
    completedUserIds: ["student-2"],
    members: [
      { userId: "teacher-1", role: "teacher" },
      { userId: "student-1", role: "student" },
      { userId: "student-2", role: "student" },
    ],
  });

  assert.deepEqual(nudges, [
    {
      actor_id: "teacher-1",
      assignment_id: "assignment-1",
      classroom_id: "classroom-1",
      href: "/classrooms/classroom-1",
      message: 'Your teacher sent a reminder to study "Cell Biology" in Year 10 Science.',
      title: "Study reminder",
      type: "classroom_nudge",
      user_id: "student-1",
    },
  ]);
});

test("classroom completion uses fetched assignments and student membership only", () => {
  const result = computeClassroomCompletion({
    assignmentIds: ["a-1", "a-2"],
    studentUserIds: ["s-1", "s-2"],
    completions: [
      { assignmentId: "a-1", userId: "s-1" },
      { assignmentId: "a-1", userId: "teacher-1" },
      { assignmentId: "deleted-assignment", userId: "s-2" },
    ],
  });

  assert.deepEqual(result, { completed: 1, expected: 4, percent: 25 });
});

test("private memberships are restored independently from public discovery", () => {
  const result = splitGroupsByMembership({
    memberships: [
      { groupId: "private-1", role: "member" },
      { groupId: "public-joined", role: "admin" },
    ],
    memberCounts: { "private-1": 3, "public-joined": 4, "public-new": 2 },
    membershipGroups: [
      { id: "private-1", name: "Private", is_public: false },
      { id: "public-joined", name: "Joined", is_public: true },
    ],
    publicGroups: [
      { id: "public-joined", name: "Joined", is_public: true },
      { id: "public-new", name: "Discover", is_public: true },
    ],
  });

  assert.deepEqual(result.myGroups.map((group) => [group.id, group.my_role, group.member_count]), [
    ["private-1", "member", 3],
    ["public-joined", "admin", 4],
  ]);
  assert.deepEqual(result.publicGroups.map((group) => group.id), ["public-new"]);
});
