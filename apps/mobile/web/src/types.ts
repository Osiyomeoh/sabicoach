export type Stage = "auth" | "onboarding" | "home" | "capture" | "analysing" | "diagnosis" | "lesson" | "practice" | "success" | "progress";

export type Diagnosis = {
  diagnosis: string;
  misconception: string;
  confidence: number;
  lesson: string[];
  coachQuestion: string;
  expectedAnswer: string;
  topic: string;
  teacherSignal: string;
  recoverableMarks: number;
};

export type RescueState = {
  stage: Stage;
  authenticated: boolean;
  displayName: string;
  examType: "JAMB" | "WAEC" | "NECO";
  imageDataUrl?: string;
  captureError?: string;
  diagnosis: Diagnosis;
  masteryVerified: boolean;
  currentScore: number;
  targetScore: number;
};

export const DEMO_DIAGNOSIS: Diagnosis = {
  diagnosis: "You understand how to collect like terms. The first wrong turn happens when −4 crosses the equals sign: it becomes +4, not −4.",
  misconception: "Sign change during transposition",
  confidence: 0.93,
  lesson: ["Begin with 3x − 4 = 11.", "Add 4 to both sides. Now 3x = 15.", "Divide both sides by 3, so x = 5."],
  coachQuestion: "Try this: 2y − 7 = 9. What is y?",
  expectedAnswer: "8",
  topic: "Linear equations",
  teacherSignal: "This is a procedural slip. A short reteach on balancing equations can fix it.",
  recoverableMarks: 12
};
