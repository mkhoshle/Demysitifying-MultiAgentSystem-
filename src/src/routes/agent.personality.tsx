import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentShell, Pipeline, SectionTitle } from "@/components/AgentShell";
import { fetchAgentOutputs, fetchStudentProfile } from "@/lib/agents";

export const Route = createFileRoute("/agent/personality")({
  head: () => ({
    meta: [{ title: "Agent 3 · Personality & Hobbies — MAS Playground" }],
  }),
  component: Page,
});

function Page() {
  const color = "var(--agent-3)";
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof fetchStudentProfile>> | null>(null);
  const [outputs, setOutputs] = useState<Awaited<ReturnType<typeof fetchAgentOutputs>> | null>(null);

  useEffect(() => {
    Promise.all([fetchStudentProfile(), fetchAgentOutputs()])
      .then(([profileData, outputsData]) => {
        setProfile(profileData);
        setOutputs(outputsData);
      })
      .catch((err) => console.error("Failed to load agent data:", err));
  }, []);

  if (!profile || !outputs) {
    return <div className="p-8 font-mono text-sm">Loading backend data...</div>;
  }

  const p = profile.personality;

  return (
    <AgentShell agentId="personality">
      <section>
        <SectionTitle color={color}>Processing pipeline</SectionTitle>
        <Pipeline
          color={color}
          steps={[
            "Personality metrics input",
            "AI processing model",
            "Output: top 10 matching schools",
            "Send to coordinator",
          ]}
        />
      </section>

      <section>
        <SectionTitle color={color}>Input data</SectionTitle>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">MBTI</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color }}>{p.mbti}</div>
            <div className="text-xs text-muted-foreground">Introvert {p.introvertScore}/100</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: `${p.introvertScore}%`, backgroundColor: color }} />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Hobbies</div>
            <ul className="mt-2 space-y-1 text-sm">
              {p.hobbies.map((h) => <li key={h}>· {h}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Strengths / growth</div>
            <div className="mt-2 text-sm">
              <div className="text-foreground">{p.strengths.join(", ")}</div>
              <div className="mt-1 text-muted-foreground">↑ {p.weaknesses.join(", ")}</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle color={color}>Agent 3 isolated prediction · Top 10 schools</SectionTitle>
        <ol className="grid gap-2 md:grid-cols-2">
          {outputs.personality.map((school, i) => (
            <li key={school} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="grid h-7 w-7 place-items-center rounded-md font-mono text-xs text-white" style={{ backgroundColor: color }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{school}</span>
              <span className="font-mono text-xs text-muted-foreground">{98 - i * 3}% fit</span>
            </li>
          ))}
        </ol>
      </section>
    </AgentShell>
  );
}
