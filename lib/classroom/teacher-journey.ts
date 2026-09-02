export type TeacherJourneyActionKind =
  | "share_code"
  | "create_quiz"
  | "assign_quiz"
  | "review_progress"
  | "review_insights";

export type TeacherJourneyStep = {
  id: "prepare" | "assign" | "invite";
  label: string;
  description: string;
  completed: boolean;
};

export type TeacherJourneyAction = {
  kind: TeacherJourneyActionKind;
  label: string;
  description: string;
};

type TeacherJourneyInput = {
  studentCount: number;
  quizCount: number;
  assignmentCount: number;
  currentAssignmentCompletionCount: number;
};

export function buildClassroomInviteText({ classroomName, joinCode }: { classroomName: string; joinCode: string }) {
  return `Join “${classroomName}” on QuizWorld. Open https://www.quizworld.xyz/classrooms and enter code ${joinCode}.`;
}

export function buildTeacherClassroomJourney({
  studentCount,
  quizCount,
  assignmentCount,
  currentAssignmentCompletionCount,
}: TeacherJourneyInput) {
  const hasPreparedContent = quizCount > 0 || assignmentCount > 0;
  const steps: TeacherJourneyStep[] = [
    {
      id: "prepare",
      label: "Prepare a quiz",
      description: hasPreparedContent
        ? quizCount > 0
          ? `${quizCount} quiz${quizCount === 1 ? "" : "zes"} ready to use`
          : "This classroom already has assigned content"
        : "Create or generate your first quiz",
      completed: hasPreparedContent,
    },
    {
      id: "assign",
      label: "Set the first assignment",
      description: assignmentCount > 0 ? `${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"} ready` : "Choose a quiz for independent practice",
      completed: assignmentCount > 0,
    },
    {
      id: "invite",
      label: "Invite your class",
      description: studentCount > 0 ? `${studentCount} student${studentCount === 1 ? "" : "s"} joined` : "Share the join code with students",
      completed: studentCount > 0,
    },
  ];

  const completedCount = steps.filter(step => step.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  let nextAction: TeacherJourneyAction;
  if (!hasPreparedContent) {
    nextAction = {
      kind: "create_quiz",
      label: "Create a quiz",
      description: "Build or generate the material you want students to practise.",
    };
  } else if (assignmentCount === 0) {
    nextAction = {
      kind: "assign_quiz",
      label: "Assign your first quiz",
      description: "Turn one of your quizzes into trackable class practice.",
    };
  } else if (studentCount === 0) {
    nextAction = {
      kind: "share_code",
      label: "Copy student join code",
      description: "Invite students once their first activity is ready.",
    };
  } else if (currentAssignmentCompletionCount === 0) {
    nextAction = {
      kind: "review_progress",
      label: "Track the first assignment",
      description: "Watch for the first responses and remind students who need a nudge.",
    };
  } else {
    nextAction = {
      kind: "review_insights",
      label: "Review class insights",
      description: "See who needs help and choose the next activity.",
    };
  }

  return { steps, completedCount, progressPercent, nextAction };
}
