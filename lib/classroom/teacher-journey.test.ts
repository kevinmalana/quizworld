import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildClassroomInviteText, buildTeacherClassroomJourney } from "./teacher-journey";

test("new teachers are guided to prepare content first", () => {
  const journey = buildTeacherClassroomJourney({
    studentCount: 0,
    quizCount: 0,
    assignmentCount: 0,
    currentAssignmentCompletionCount: 0,
  });

  assert.equal(journey.completedCount, 0);
  assert.equal(journey.progressPercent, 0);
  assert.equal(journey.nextAction.kind, "create_quiz");
  assert.deepEqual(journey.steps.map(step => step.completed), [false, false, false]);
});

test("teachers with reusable content are guided to assign it", () => {
  const journey = buildTeacherClassroomJourney({
    studentCount: 0,
    quizCount: 3,
    assignmentCount: 0,
    currentAssignmentCompletionCount: 0,
  });

  assert.equal(journey.nextAction.kind, "assign_quiz");
  assert.equal(journey.completedCount, 1);
  assert.equal(journey.progressPercent, 33);
});

test("teachers with an assignment are guided to invite students", () => {
  const journey = buildTeacherClassroomJourney({
    studentCount: 0,
    quizCount: 3,
    assignmentCount: 1,
    currentAssignmentCompletionCount: 0,
  });

  assert.equal(journey.nextAction.kind, "share_code");
  assert.equal(journey.completedCount, 2);
  assert.equal(journey.progressPercent, 67);
});

test("existing classroom assignments count as prepared content for co-teachers", () => {
  const journey = buildTeacherClassroomJourney({
    studentCount: 8,
    quizCount: 0,
    assignmentCount: 1,
    currentAssignmentCompletionCount: 0,
  });

  assert.equal(journey.steps[0].completed, true);
  assert.equal(journey.nextAction.kind, "review_progress");
});

test("completed setup turns student activity into a progress and insights retention loop", () => {
  const waitingForActivity = buildTeacherClassroomJourney({
    studentCount: 12,
    quizCount: 3,
    assignmentCount: 2,
    currentAssignmentCompletionCount: 0,
  });
  assert.equal(waitingForActivity.nextAction.kind, "review_progress");
  assert.equal(waitingForActivity.progressPercent, 100);

  const retained = buildTeacherClassroomJourney({
    studentCount: 12,
    quizCount: 3,
    assignmentCount: 2,
    currentAssignmentCompletionCount: 1,
  });
  assert.equal(retained.nextAction.kind, "review_insights");
  assert.equal(retained.progressPercent, 100);
  assert.equal(retained.completedCount, 3);
});

test("classroom invite copy includes the class, code, and join destination", () => {
  const invite = buildClassroomInviteText({ classroomName: "Year 10 Science", joinCode: "ABC123" });

  assert.match(invite, /Year 10 Science/);
  assert.match(invite, /ABC123/);
  assert.match(invite, /https:\/\/www\.quizworld\.xyz\/classrooms/);
});

test("classroom insights offer a concrete next activity", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../app/classrooms/[id]/page.tsx"), "utf8");

  assert.match(source, /Turn insight into action/);
  assert.match(source, /\/host\?quiz=/);
  assert.match(source, /setShowAssign\(true\)/);
});

test("dashboard keeps classrooms visible as a teacher return path", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../app/dashboard/page.tsx"), "utf8");

  assert.match(source, /href="\/classrooms"[^>]*>Classrooms<\/Link>/);
});

test("classroom creation takes a teacher directly into the guided classroom", () => {
  const source = readFileSync(resolve(import.meta.dirname, "../../app/classrooms/page.tsx"), "utf8");

  assert.match(source, /const \[creating, setCreating\] = useState\(false\)/);
  assert.match(source, /rpc\("create_classroom_with_teacher"/);
  assert.doesNotMatch(source, /from\("classrooms"\)\.insert/);
  assert.match(source, /router\.push\(`\/classrooms\/\$\{room\.id\}`\)/);
});
