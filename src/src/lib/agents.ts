export type AgentId = "course" | "family" | "personality" | "coordinator";

export interface ScoreEntry {
  subject: string;
  score: number;
  percentile: number;
}

export interface StudentSummary {
  id: string;
  name: string;
  avatarInitials: string;
  tagline: string;
  academicFocus: string;
  familyRegion: string;
  color: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  avatarInitials: string;
  scores: ScoreEntry[];
  family: {
    incomeTier: string;
    region: string;
    parentEducation: string;
    siblings: number;
    firstGen: boolean;
  };
  personality: {
    mbti: string;
    introvertScore: number;
    hobbies: string[];
    strengths: string[];
    weaknesses: string[];
  };
}

export interface AgentOutputs {
  course: string[];
  family: string[];
  personality: string[];
}

export interface ConsensusResult {
  schools: { name: string; score: number }[];
  majors: { name: string; score: number }[];
}

export interface Agent {
  id: AgentId;
  num: number;
  name: string;
  short: string;
  description: string;
  route: string;
  colorVar: string;
}

export const AGENTS: Agent[] = [
  {
    id: "course",
    num: 1,
    name: "Course Statistics Agent",
    short: "Academics",
    description: "Ingests subject scores, GPA trends, and exam metrics. Outputs the top 10 majors that match the student's academic strengths.",
    route: "/agent/course",
    colorVar: "var(--agent-1)",
  },
  {
    id: "family",
    num: 2,
    name: "Family Background Agent",
    short: "Context",
    description: "Models household income, parental education, and geography to surface schools that fit financial and logistical constraints.",
    route: "/agent/family",
    colorVar: "var(--agent-2)",
  },
  {
    id: "personality",
    num: 3,
    name: "Personality & Hobbies Agent",
    short: "Self",
    description: "Reads MBTI, interests, and skill signals. Outputs schools whose culture and programs align with the student's temperament.",
    route: "/agent/personality",
    colorVar: "var(--agent-3)",
  },
  {
    id: "coordinator",
    num: 4,
    name: "Coordinator Agent",
    short: "Consensus",
    description: "Weighs every peripheral agent's prediction, resolves conflicts, and produces the final top 5 schools and majors.",
    route: "/agent/coordinator",
    colorVar: "var(--agent-4)",
  },
];

export const DEFAULT_STUDENT_ID = "alex";
export const SELECTED_STUDENT_STORAGE_KEY = "mas-playground-student-id";
export const LLM_API_KEY_STORAGE_KEY = "mas-playground-llm-api-key";

function hasBrowserStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function studentQuery(studentId?: string) {
  return `?studentId=${encodeURIComponent(studentId || getSelectedStudentId() || DEFAULT_STUDENT_ID)}`;
}

export function getSelectedStudentId(): string | null {
  if (!hasBrowserStorage()) return null;
  return window.localStorage.getItem(SELECTED_STUDENT_STORAGE_KEY);
}

export function setSelectedStudentId(studentId: string) {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(SELECTED_STUDENT_STORAGE_KEY, studentId);
}

export function getStoredLlmApiKey(): string {
  if (!hasBrowserStorage()) return "";
  return window.localStorage.getItem(LLM_API_KEY_STORAGE_KEY) || "";
}

export function setStoredLlmApiKey(apiKey: string) {
  if (!hasBrowserStorage()) return;
  const trimmed = apiKey.trim();
  if (trimmed) {
    window.localStorage.setItem(LLM_API_KEY_STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(LLM_API_KEY_STORAGE_KEY);
  }
}

export function importLlmApiKeyFromUrlHash(): boolean {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const rawKey = params.get("llmKey") || params.get("apiKey");
  const apiKey = rawKey?.trim();
  if (!apiKey) return false;

  setStoredLlmApiKey(apiKey);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

export async function fetchStudents(): Promise<StudentSummary[]> {
  const response = await fetch('/api/students');
  if (!response.ok) throw new Error('Students fetch failed');
  return response.json();
}

export async function fetchStudentProfile(studentId?: string): Promise<StudentProfile> {
  const response = await fetch(`/api/profile${studentQuery(studentId)}`);
  if (!response.ok) throw new Error('Profile fetch failed');
  return response.json();
}

export async function fetchAgentOutputs(studentId?: string): Promise<AgentOutputs> {
  const response = await fetch(`/api/outputs${studentQuery(studentId)}`);
  if (!response.ok) throw new Error('Agent outputs fetch failed');
  return response.json();
}

export async function fetchFinalConsensus(studentId?: string): Promise<ConsensusResult> {
  const response = await fetch(`/api/consensus${studentQuery(studentId)}`);
  if (!response.ok) throw new Error('Consensus fetch failed');
  return response.json();
}

export type ChatIntent =
  | 'help'
  | 'profile'
  | 'agents'
  | 'outputs'
  | 'scores'
  | 'family'
  | 'personality'
  | 'consensus'
  | 'school_reason'
  | 'insight'
  | 'full';

export type ChatMode = 'llm' | 'local' | 'local_insights';

export interface ChatResponse {
  reply: string;
  intent: ChatIntent;
  mode?: ChatMode;
  sources?: string[];
  studentId?: string;
  agents: {
    id: AgentId;
    num: number;
    name: string;
    short: string;
    description: string;
    color: string;
  }[];
}

export type ChatJobStart = {
  jobId: string;
  status: 'pending' | 'running' | 'done' | 'error';
  intent: ChatIntent;
  studentId?: string;
};

type ChatJobStatus =
  | (ChatJobStart & { status: 'pending' | 'running' })
  | (ChatResponse & { jobId: string; status: 'done' })
  | (Partial<ChatJobStart> & { jobId: string; status: 'error'; error?: string });

export interface ChatRequestOptions {
  studentId?: string;
  apiKey?: string;
}

const CHAT_POLL_INTERVAL_MS = 400;
const CHAT_REQUEST_TIMEOUT_MS = 25000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForChatJob(jobId: string): Promise<ChatResponse> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CHAT_REQUEST_TIMEOUT_MS) {
    const response = await fetch(`/api/chat/${jobId}`);
    const job = (await response.json()) as ChatJobStatus;

    if (!response.ok) {
      throw new Error(('error' in job && job.error) || 'Chat status request failed');
    }

    if (job.status === 'done') {
      const { status, jobId: _jobId, ...chatResponse } = job;
      return chatResponse;
    }

    if (job.status === 'error') {
      throw new Error(job.error || 'Chat job failed');
    }

    await wait(CHAT_POLL_INTERVAL_MS);
  }

  throw new Error('Chat request timed out');
}

export async function sendChatMessage(message: string, options: ChatRequestOptions = {}): Promise<ChatResponse> {
  const job = await startChatMessage(message, options);
  if ('reply' in job) {
    return job;
  }

  return waitForChatJob(job.jobId);
}

export async function startChatMessage(
  message: string,
  options: ChatRequestOptions = {},
): Promise<ChatJobStart | ChatResponse> {
  const apiKey = options.apiKey ?? getStoredLlmApiKey();
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      studentId: options.studentId ?? getSelectedStudentId() ?? DEFAULT_STUDENT_ID,
      apiKey,
    }),
  });
  if (!response.ok) throw new Error('Chat request failed');

  return response.json();
}
