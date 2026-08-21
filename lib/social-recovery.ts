export type ClassroomMemberRef = {
  userId: string;
  role: string;
};

export type ClassroomNudge = {
  actor_id: string;
  assignment_id: string;
  classroom_id: string;
  href: string;
  message: string;
  title: string;
  type: "classroom_nudge";
  user_id: string;
};

export function buildClassroomNudges({
  actorId,
  assignmentId,
  assignmentTitle,
  classroomId,
  classroomName,
  completedUserIds,
  members,
}: {
  actorId: string;
  assignmentId: string;
  assignmentTitle: string;
  classroomId: string;
  classroomName: string;
  completedUserIds: Iterable<string>;
  members: ClassroomMemberRef[];
}): ClassroomNudge[] {
  const completed = new Set(completedUserIds);

  return members
    .filter((member) => member.role === "student" && !completed.has(member.userId))
    .map((member) => ({
      actor_id: actorId,
      assignment_id: assignmentId,
      classroom_id: classroomId,
      href: `/classrooms/${classroomId}`,
      message: `Your teacher sent a reminder to study "${assignmentTitle}" in ${classroomName}.`,
      title: "Study reminder",
      type: "classroom_nudge" as const,
      user_id: member.userId,
    }));
}

export function computeClassroomCompletion({
  assignmentIds,
  studentUserIds,
  completions,
}: {
  assignmentIds: string[];
  studentUserIds: string[];
  completions: { assignmentId: string; userId: string }[];
}) {
  const assignments = new Set(assignmentIds);
  const students = new Set(studentUserIds);
  const unique = new Set(
    completions
      .filter((completion) => assignments.has(completion.assignmentId) && students.has(completion.userId))
      .map((completion) => `${completion.assignmentId}:${completion.userId}`)
  );
  const expected = assignments.size * students.size;

  return {
    completed: unique.size,
    expected,
    percent: expected === 0 ? 0 : Math.round((unique.size / expected) * 100),
  };
}

type GroupBase = {
  id: string;
  is_public: boolean;
};

type Membership = { groupId: string; role: string };

export function splitGroupsByMembership<T extends GroupBase>({
  memberships,
  memberCounts,
  membershipGroups,
  publicGroups,
}: {
  memberships: Membership[];
  memberCounts: Record<string, number>;
  membershipGroups: T[];
  publicGroups: T[];
}) {
  const membershipMap = new Map(memberships.map((membership) => [membership.groupId, membership.role]));

  return {
    myGroups: membershipGroups.map((group) => ({
      ...group,
      member_count: memberCounts[group.id] ?? 0,
      my_role: membershipMap.get(group.id),
    })),
    publicGroups: publicGroups
      .filter((group) => !membershipMap.has(group.id))
      .map((group) => ({ ...group, member_count: memberCounts[group.id] ?? 0 })),
  };
}
