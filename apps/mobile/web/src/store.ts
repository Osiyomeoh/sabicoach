import { DEMO_DIAGNOSIS, type RescueState, type Stage } from "./types.js";

const STORAGE_KEY = "sabicoach-rescue-state-v2";
const initialState = (): RescueState => ({ stage: "auth", authenticated: false, displayName: "Amara", examType: "JAMB", diagnosis: DEMO_DIAGNOSIS, masteryVerified: false, currentScore: 234, targetScore: 280 });

export function loadState(): RescueState {
  try { return { ...initialState(), ...JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") } as RescueState; }
  catch { return initialState(); }
}

export function saveState(state: RescueState): void { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function updateStage(state: RescueState, stage: Stage): RescueState { const next = { ...state, stage }; saveState(next); return next; }
