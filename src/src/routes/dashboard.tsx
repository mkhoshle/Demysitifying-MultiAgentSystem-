import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Bot, CheckCircle2, Clipboard, Send, Sparkles } from "lucide-react";
import { TopologyGraph } from "@/components/TopologyGraph";
import alexAvatar from "@/assets/avatar-alex.png";
import jordanAvatar from "@/assets/avatar-jordan.png";
import mayaAvatar from "@/assets/avatar-maya.png";
import {
  AGENTS,
  DEFAULT_STUDENT_ID,
  type AgentOutputs,
  type ChatIntent,
  type ChatMode,
  type ConsensusResult,
  type StudentProfile,
  type StudentSummary,
  fetchAgentOutputs,
  fetchFinalConsensus,
  fetchStudentProfile,
  fetchStudents,
  getSelectedStudentId,
  getStoredLlmApiKey,
  importLlmApiKeyFromUrlHash,
  setStoredLlmApiKey,
  setSelectedStudentId as persistSelectedStudentId,
  startChatMessage,
  waitForChatJob,
} from "@/lib/agents";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - MAS Playground" },
      { name: "description", content: "Chat with the Coordinator agent to explore all agents and the final consensus." },
    ],
  }),
  component: Dashboard,
});

type ChatMessage =
  | { role: "user"; text: string }
  | { role: "coordinator"; text: string }
  | { role: "result"; intent: ChatIntent; mode?: ChatMode; sources?: string[] }
  | { role: "pending"; id: string };

const CHAT_BUILD_ID = "chat-llm-key-panel-2026-06-25-1548";
const STUDENT_AVATAR_IMAGES: Record<string, string> = {
  alex: alexAvatar,
  maya: mayaAvatar,
  jordan: jordanAvatar,
};

function Dashboard() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedStudentId, setSelectedStudentIdState] = useState(() => getSelectedStudentId() || DEFAULT_STUDENT_ID);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [outputs, setOutputs] = useState<AgentOutputs | null>(null);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [hasLlmApiKey, setHasLlmApiKey] = useState(false);
  const isChatBusyRef = useRef(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const imported = importLlmApiKeyFromUrlHash();
    setHasLlmApiKey(imported || Boolean(getStoredLlmApiKey()));
    fetchStudents()
      .then((studentList) => {
        setStudents(studentList);
        const stored = getSelectedStudentId();
        const nextStudentId = studentList.some((student) => student.id === stored)
          ? stored!
          : studentList[0]?.id || DEFAULT_STUDENT_ID;
        setSelectedStudentIdState(nextStudentId);
        persistSelectedStudentId(nextStudentId);
      })
      .catch((err) => console.error("Failed to load students:", err));
  }, []);

  useEffect(() => {
    function refreshKeyStatus() {
      setHasLlmApiKey(Boolean(getStoredLlmApiKey()));
    }

    window.addEventListener("focus", refreshKeyStatus);
    window.addEventListener("storage", refreshKeyStatus);
    return () => {
      window.removeEventListener("focus", refreshKeyStatus);
      window.removeEventListener("storage", refreshKeyStatus);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    setProfile(null);
    setOutputs(null);
    setConsensus(null);
    setMessages([]);

    Promise.all([
      fetchStudentProfile(selectedStudentId),
      fetchAgentOutputs(selectedStudentId),
      fetchFinalConsensus(selectedStudentId),
    ])
      .then(([profileData, outputsData, consensusData]) => {
        if (ignore) return;
        setProfile(profileData);
        setOutputs(outputsData);
        setConsensus(consensusData);
        setMessages([
          {
            role: "coordinator",
            text: `Hello ${profileData.name}. I'm the Coordinator. This profile is loaded across all four agents. Ask me about academics, family context, personality, individual predictions, the final consensus, or anything else.`,
          },
        ]);
      })
      .catch((err) => console.error("Failed to load dashboard data:", err));

    return () => {
      ignore = true;
    };
  }, [selectedStudentId]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    isChatBusyRef.current = isChatBusy;
  }, [isChatBusy]);

  const suggestions = useMemo(() => {
    const topSchool = consensus?.schools[0]?.name || "the top school";
    return [
      "What is my name?",
      `Why do you recommend ${topSchool}?`,
      "What agents are in the system?",
      "Show me my course scores",
      "What's my family background?",
      "What's my personality profile?",
      "Show each agent's predictions",
      "Give me the full consensus",
      "What is reinforcement learning?",
    ];
  }, [consensus]);

  function selectStudent(studentId: string) {
    if (studentId === selectedStudentId || isChatBusyRef.current) return;
    setSelectedStudentIdState(studentId);
    persistSelectedStudentId(studentId);
  }

  function replacePendingMessage(id: string, nextMessages: ChatMessage[]) {
    setMessages((current) => {
      const index = current.findIndex((m) => m.role === "pending" && m.id === id);
      if (index === -1) {
        return [...current, ...nextMessages];
      }

      return [
        ...current.slice(0, index),
        ...nextMessages,
        ...current.slice(index + 1),
      ];
    });
  }

  async function send(value: string) {
    const message = value.trim();
    if (!message || isChatBusyRef.current || !profile) return;

    isChatBusyRef.current = true;
    setIsChatBusy(true);

    const pendingId = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setMessages((m) => [...m, { role: "user", text: message }, { role: "pending", id: pendingId }]);

    try {
      const started = await startChatMessage(message, {
        studentId: profile.id,
        apiKey: getStoredLlmApiKey(),
      });
      const response = 'reply' in started ? started : await waitForChatJob(started.jobId);
      replacePendingMessage(pendingId, [
        { role: "coordinator", text: response.reply },
        {
          role: "result",
          intent: response.intent,
          mode: response.mode,
          sources: response.sources,
        },
      ]);
    } catch (err) {
      console.error("Chat failed:", err);
      replacePendingMessage(pendingId, [
        { role: "coordinator", text: "Sorry, I couldn't reach the coordinator backend. Make sure Flask is running on port 5055." },
      ]);
    } finally {
      isChatBusyRef.current = false;
      setIsChatBusy(false);
    }
  }

  const activeStudent = students.find((student) => student.id === selectedStudentId);

  if (!profile || !outputs || !consensus) {
    return <div className="p-8 font-mono text-sm">Loading backend data...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Landing
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <span>Coordinator chat</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
            <span>{hasLlmApiKey ? "Browser LLM key" : "Local fallback ready"}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        <section>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Student cases</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Choose a student avatar</h1>
          <StudentSwitcher
            students={students}
            selectedStudentId={selectedStudentId}
            onSelect={selectStudent}
            disabled={isChatBusy}
          />
        </section>

        <section id="chat">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Coordinator</div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">Chat with the multi-agent system</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Ask the Coordinator about {profile.name}, compare recommendations, or use the LLM path for open-ended questions.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
                <AvatarBadge
                  initials={profile.avatarInitials}
                  color={activeStudent?.color || "var(--agent-4)"}
                  imageSrc={STUDENT_AVATAR_IMAGES[profile.id]}
                  label={profile.name}
                  size="lg"
                />
                <div>
                  <div className="text-sm font-semibold">Coordinator Agent</div>
                  <div className="text-xs text-muted-foreground">Selected profile: {profile.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Build {CHAT_BUILD_ID}
                  </div>
                </div>
              </div>

              <div ref={chatRef} className="h-[520px] overflow-y-auto px-6 py-4 space-y-3">
                {messages.map((m, i) => (
                  <MessageBubble
                    key={i}
                    m={m}
                    profile={profile}
                    outputs={outputs}
                    consensus={consensus}
                  />
                ))}
              </div>

              <ChatComposer onSend={send} isBusy={isChatBusy} />
            </div>

            <aside className="space-y-2">
              <LlmKeyPanel
                hasLlmApiKey={hasLlmApiKey}
                onStatusChange={() => setHasLlmApiKey(Boolean(getStoredLlmApiKey()))}
              />
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Suggested prompts</div>
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isChatBusy}
                  onClick={() => send(q)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition hover:border-foreground/30 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </aside>
          </div>
        </section>

        <section>
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Agent network</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Topology & specialists</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Hover any node for a description. Click to inspect that agent in detail.
          </p>

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
            <div className="grid-bg flex justify-center rounded-2xl border border-border bg-card p-6">
              <TopologyGraph size={520} />
            </div>
            <div className="space-y-2">
              {AGENTS.map((a) => (
                <Link
                  key={a.id}
                  to={a.route}
                  className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-foreground/30"
                >
                  <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg font-mono text-xs font-semibold text-white" style={{ backgroundColor: a.colorVar }}>
                    A{a.num}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function LlmKeyPanel({
  hasLlmApiKey,
  onStatusChange,
}: {
  hasLlmApiKey: boolean;
  onStatusChange: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function savePastedApiKey(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    setError("");
    const apiKey = event.clipboardData.getData("text").trim();
    if (!apiKey) {
      setError("Pasted text is empty");
      return;
    }

    setStoredLlmApiKey(apiKey);
    onStatusChange();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function clearApiKey() {
    setStoredLlmApiKey("");
    onStatusChange();
    setSaved(false);
    setError("");
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">LLM key</div>
        <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${hasLlmApiKey ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
          {hasLlmApiKey ? "Saved" : "Missing"}
        </span>
      </div>
      <div
        role="textbox"
        tabIndex={0}
        aria-label="Paste LLM API key"
        onPaste={savePastedApiKey}
        className="mt-3 min-h-16 cursor-text rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none hover:border-primary/50 focus:border-primary/50"
      >
        {hasLlmApiKey ? "Paste a new key here to replace it." : "Click here, then paste your API key."}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Paste with Cmd+V or Ctrl+V.</p>
        <button
          type="button"
          onClick={clearApiKey}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Clear
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        If paste fails, use <span className="font-mono">/dashboard#llmKey=YOUR_KEY</span>.
      </p>
      {saved && <p className="mt-2 text-xs text-primary">Key saved for this browser.</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StudentSwitcher({
  students,
  selectedStudentId,
  onSelect,
  disabled,
}: {
  students: StudentSummary[];
  selectedStudentId: string;
  onSelect: (studentId: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-3">
      {students.map((student) => {
        const selected = student.id === selectedStudentId;
        return (
          <button
            key={student.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(student.id)}
            className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-foreground/30 disabled:opacity-60"
            style={{ borderColor: selected ? student.color : undefined }}
          >
            <div className="flex items-start gap-3">
              <AvatarBadge
                initials={student.avatarInitials}
                color={student.color}
                imageSrc={STUDENT_AVATAR_IMAGES[student.id]}
                label={student.name}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold">{student.name}</div>
                  {selected && <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: student.color }} />}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{student.tagline}</div>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs text-muted-foreground">
              <div>{student.academicFocus}</div>
              <div>{student.familyRegion}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AvatarBadge({
  initials,
  color,
  imageSrc,
  label,
  size = "md",
}: {
  initials: string;
  color: string;
  imageSrc?: string;
  label?: string;
  size?: "md" | "lg";
}) {
  const classes = size === "lg" ? "h-12 w-12 text-sm" : "h-11 w-11 text-xs";
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-mono font-semibold text-white shadow-sm ring-2 ring-background ${classes}`}
      style={{ backgroundColor: color }}
    >
      {imageSrc ? (
        <img src={imageSrc} alt={label ? `${label} avatar` : `${initials} avatar`} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function MessageBubble({
  m,
  profile,
  outputs,
  consensus,
}: {
  m: ChatMessage;
  profile: StudentProfile;
  outputs: AgentOutputs;
  consensus: ConsensusResult;
}) {
  if (m.role === "pending") {
    return <ThinkingIndicator />;
  }

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {m.text}
        </div>
      </div>
    );
  }

  if (m.role === "coordinator") {
    return (
      <div className="flex items-start gap-2">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5 text-sm">
          {m.text}
        </div>
      </div>
    );
  }

  switch (m.intent) {
    case "help":
      return (
        <ResultCard title="Coordinator help" color="var(--agent-4)" mode={m.mode}>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>Course scores: Agent 1 academic record</li>
            <li>Family background: Agent 2 demographic context</li>
            <li>Personality: Agent 3 MBTI and hobbies</li>
            <li>Agent predictions: isolated top-10 lists</li>
            <li>Consensus: final top 5 schools and majors</li>
          </ul>
        </ResultCard>
      );
    case "profile": {
      const strongestSubject = [...profile.scores].sort((a, b) => b.score - a.score)[0];

      return (
        <ResultCard title="Loaded profile" color="var(--agent-4)" mode={m.mode}>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <Row k="Name" v={profile.name} />
            <Row k="Region" v={profile.family.region} />
            <Row k="Academic signal" v={`${strongestSubject.subject} (${strongestSubject.score})`} />
            <Row k="Personality" v={profile.personality.mbti} />
          </dl>
        </ResultCard>
      );
    }
    case "agents":
      return (
        <ResultCard title="All agents" color="var(--agent-4)" mode={m.mode}>
          <div className="space-y-3">
            {AGENTS.map((a) => (
              <div key={a.id} className="flex gap-3 rounded-lg border border-border p-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md font-mono text-xs text-white" style={{ backgroundColor: a.colorVar }}>
                  A{a.num}
                </div>
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        </ResultCard>
      );
    case "school_reason": {
      const topSubjects = [...profile.scores].sort((a, b) => b.score - a.score).slice(0, 2);
      return (
        <ResultCard title={`Why ${consensus.schools[0].name} ranks first`} color="var(--agent-4)" mode={m.mode}>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="font-medium text-foreground">Academic fit:</span>{" "}
              {topSubjects.map((s) => `${s.subject} (${s.score})`).join(" and ")} support the top major set.
            </li>
            <li>
              <span className="font-medium text-foreground">Context fit:</span> Agent 2 uses the {profile.family.region} region,
              {` ${profile.family.incomeTier.toLowerCase()} income context, and family education background.`}
            </li>
            <li>
              <span className="font-medium text-foreground">Personal fit:</span>{" "}
              {profile.personality.hobbies.slice(0, 2).join(" and ")} connect with {profile.personality.strengths[0].toLowerCase()}.
            </li>
            <li>
              <span className="font-medium text-foreground">Final score:</span> {consensus.schools[0].name} has the top consensus score of{" "}
              {consensus.schools[0].score}.
            </li>
          </ul>
        </ResultCard>
      );
    }
    case "insight":
      return (
        <ResultCard title="Response context" color="var(--agent-4)" mode={m.mode}>
          <SourceList sources={m.sources ?? ["Student profile", "Agent outputs", "Final consensus rankings"]} />
        </ResultCard>
      );
    case "outputs":
      return (
        <div className="space-y-3">
          <OutputList title="Agent 1 - Top majors" color="var(--agent-1)" items={outputs.course} mode={m.mode} />
          <OutputList title="Agent 2 - Top schools" color="var(--agent-2)" items={outputs.family} />
          <OutputList title="Agent 3 - Top schools" color="var(--agent-3)" items={outputs.personality} />
        </div>
      );
    case "scores":
      return (
        <ResultCard title="Course scores - Agent 1" color="var(--agent-1)" mode={m.mode}>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr><th className="text-left font-normal">Subject</th><th className="text-right font-normal">Score</th><th className="text-right font-normal">%ile</th></tr>
            </thead>
            <tbody>
              {profile.scores.map((s) => (
                <tr key={s.subject} className="border-t border-border">
                  <td className="py-1.5">{s.subject}</td>
                  <td className="py-1.5 text-right font-mono">{s.score}</td>
                  <td className="py-1.5 text-right font-mono text-muted-foreground">{s.percentile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResultCard>
      );
    case "family":
      return (
        <ResultCard title="Family background - Agent 2" color="var(--agent-2)" mode={m.mode}>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <Row k="Income tier" v={profile.family.incomeTier} />
            <Row k="Region" v={profile.family.region} />
            <Row k="Parent education" v={profile.family.parentEducation} />
            <Row k="Siblings" v={String(profile.family.siblings)} />
            <Row k="First-generation" v={profile.family.firstGen ? "Yes" : "No"} />
          </dl>
        </ResultCard>
      );
    case "personality":
      return (
        <ResultCard title="Personality - Agent 3" color="var(--agent-3)" mode={m.mode}>
          <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
            <Row k="MBTI" v={profile.personality.mbti} />
            <Row k="Introvert score" v={`${profile.personality.introvertScore}/100`} />
            <Row k="Hobbies" v={profile.personality.hobbies.join(", ")} />
            <Row k="Strengths" v={profile.personality.strengths.join(", ")} />
            <Row k="Growth areas" v={profile.personality.weaknesses.join(", ")} />
          </dl>
        </ResultCard>
      );
    case "full":
      return (
        <div className="space-y-3">
          <ResultCard title="Academics - Agent 1" color="var(--agent-1)" mode={m.mode}>
            <p className="mb-2 text-sm text-muted-foreground">{profile.scores.length} subjects on file</p>
            <div className="flex flex-wrap gap-2">
              {profile.scores.map((s) => (
                <span key={s.subject} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">
                  {s.subject}: {s.score}
                </span>
              ))}
            </div>
          </ResultCard>
          <ResultCard title="Family - Agent 2" color="var(--agent-2)">
            <p className="text-sm">{profile.family.region} / {profile.family.incomeTier} income / {profile.family.parentEducation}</p>
          </ResultCard>
          <ResultCard title="Personality - Agent 3" color="var(--agent-3)">
            <p className="text-sm">{profile.personality.mbti} / hobbies: {profile.personality.hobbies.join(", ")}</p>
          </ResultCard>
          <OutputList title="Isolated predictions" color="var(--agent-4)" items={[
            `Majors: ${outputs.course.slice(0, 3).join(", ")}...`,
            `Schools (family): ${outputs.family.slice(0, 3).join(", ")}...`,
            `Schools (personality): ${outputs.personality.slice(0, 3).join(", ")}...`,
          ]} />
          <ConsensusCard consensus={consensus} />
        </div>
      );
    case "consensus":
    default:
      return <ConsensusCard consensus={consensus} mode={m.mode} />;
  }
}

function ConsensusCard({ consensus, mode }: { consensus: ConsensusResult; mode?: ChatMode }) {
  return (
    <ResultCard title="Consensus - Agent 4" color="var(--agent-4)" mode={mode}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">Top 5 schools</div>
          <ol className="space-y-1.5 text-sm">
            {consensus.schools.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs">{i + 1}</span>
                <span className="flex-1">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.score}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className="mb-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">Top 5 majors</div>
          <ol className="space-y-1.5 text-sm">
            {consensus.majors.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs">{i + 1}</span>
                <span className="flex-1">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </ResultCard>
  );
}

function OutputList({ title, color, items, mode }: { title: string; color: string; items: string[]; mode?: ChatMode }) {
  return (
    <ResultCard title={title} color={color} mode={mode}>
      <ol className="space-y-1.5 text-sm">
        {items.map((item, i) => (
          <li key={item} className="flex items-center gap-3">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs">{i + 1}</span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ol>
    </ResultCard>
  );
}

function ChatComposer({
  onSend,
  isBusy,
}: {
  onSend: (message: string) => void | Promise<void>;
  isBusy: boolean;
}) {
  const [pastedMessage, setPastedMessage] = useState("");
  const [error, setError] = useState("");

  function submitMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    sendPastedMessage();
  }

  function capturePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    setError("");
    const message = event.clipboardData.getData("text").trim();
    if (!message) {
      setError("Pasted text is empty");
      return;
    }
    setPastedMessage(message);
  }

  function sendPastedMessage() {
    if (isBusy) return;
    const message = pastedMessage.trim();
    if (!message) {
      setError("Paste a message first");
      return;
    }
    setPastedMessage("");
    void onSend(message);
  }

  return (
    <form onSubmit={submitMessage} className="border-t border-border bg-background px-4 py-3">
      <div className="flex items-center gap-2">
        <div
          role="textbox"
          tabIndex={0}
          aria-label="Paste message to Coordinator"
          onPaste={capturePaste}
          className="flex min-h-11 flex-1 cursor-text items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground outline-none hover:border-primary/50 focus:border-primary/50"
        >
          <Clipboard className="h-4 w-4 shrink-0" />
          <span className="line-clamp-1">
            {pastedMessage ? pastedMessage : "Click here, paste a message, then send."}
          </span>
        </div>
        <button
          type="submit"
          aria-label="Send pasted message"
          disabled={isBusy || !pastedMessage.trim()}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          <span className="hidden sm:inline">{isBusy ? "Sending" : "Send"}</span>
        </button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">Copy your message first, click the paste area, then press Cmd+V or Ctrl+V.</div>
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </>
  );
}

function ResultCard({
  title,
  color,
  mode,
  children,
}: {
  title: string;
  color: string;
  mode?: ChatMode;
  children: ReactNode;
}) {
  return (
    <div
      className="animate-fade-in rounded-xl border bg-card p-4"
      style={{ borderColor: `color-mix(in oklab, ${color} 35%, transparent)` }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest" style={{ color }}>
          <Sparkles className="h-3 w-3" />
          {title}
        </div>
        {mode && <ModeBadge mode={mode} />}
      </div>
      {children}
    </div>
  );
}

function SourceList({ sources }: { sources: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((source) => (
        <span key={source} className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
          {source}
        </span>
      ))}
    </div>
  );
}

function ModeBadge({ mode }: { mode: ChatMode }) {
  const label = mode === "llm" ? "LLM" : mode === "local_insights" ? "Local insight" : "Local";
  return (
    <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-2xl border border-border bg-card px-4 py-2.5">
        Coordinator is preparing a reply...
      </div>
    </div>
  );
}
