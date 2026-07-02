import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentShell, Pipeline, SectionTitle } from "@/components/AgentShell";
import { fetchAgentOutputs, fetchStudentProfile } from "@/lib/agents";

export const Route = createFileRoute("/agent/family")({
  head: () => ({
    meta: [{ title: "Agent 2 · Family Background — MAS Playground" }],
  }),
  component: Page,
});

function Page() {
  const color = "var(--agent-2)";
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

  const f = profile.family;
  const rows: [string, string][] = [
    ["Income tier", f.incomeTier],
    ["Region", f.region],
    ["Parental education", f.parentEducation],
    ["Siblings", String(f.siblings)],
    ["First-generation student", f.firstGen ? "Yes" : "No"],
  ];

  return (
    <AgentShell agentId="family">
      <section>
        <SectionTitle color={color}>Processing pipeline</SectionTitle>
        <Pipeline
          color={color}
          steps={[
            "Demographic data input",
            "AI processing model",
            "Output: top 10 matching schools",
            "Send to coordinator",
          ]}
        />
      </section>

      <section>
        <SectionTitle color={color}>Input data</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{k}</div>
              <div className="mt-1 text-base font-medium">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle color={color}>Agent 2 isolated prediction · Top 10 schools</SectionTitle>
        <ol className="grid gap-2 md:grid-cols-2">
          {outputs.family.map((school, i) => (
            <li key={school} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="grid h-7 w-7 place-items-center rounded-md font-mono text-xs text-white" style={{ backgroundColor: color }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{school}</span>
              <span className="font-mono text-xs text-muted-foreground">{96 - i * 4}% fit</span>
            </li>
          ))}
        </ol>
      </section>
    </AgentShell>
  );
}
