import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentShell, Pipeline, SectionTitle } from "@/components/AgentShell";
import { fetchAgentOutputs, fetchStudentProfile } from "@/lib/agents";

export const Route = createFileRoute("/agent/course")({
  head: () => ({
    meta: [{ title: "Agent 1 · Course Statistics — MAS Playground" }],
  }),
  component: Page,
});

function Page() {
  const color = "var(--agent-1)";
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

  return (
    <AgentShell agentId="course">
      <section>
        <SectionTitle color={color}>Processing pipeline</SectionTitle>
        <Pipeline
          color={color}
          steps={[
            "Raw performance data input",
            "AI processing model",
            "Output: top 10 suitable majors",
            "Send to coordinator",
          ]}
        />
      </section>

      <section>
        <SectionTitle color={color}>Input data</SectionTitle>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Subject</th>
                <th className="px-4 py-2.5 text-right font-medium">Score</th>
                <th className="px-4 py-2.5 text-right font-medium">Percentile</th>
                <th className="px-4 py-2.5 text-left font-medium">Trend</th>
              </tr>
            </thead>
            <tbody>
              {profile.scores.map((s) => (
                <tr key={s.subject} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.subject}</td>
                  <td className="px-4 py-3 text-right font-mono">{s.score}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{s.percentile}</td>
                  <td className="px-4 py-3">
                    <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${s.percentile}%`, backgroundColor: color }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle color={color}>Agent 1 isolated prediction · Top 10 majors</SectionTitle>
        <ol className="grid gap-2 md:grid-cols-2">
          {outputs.course.map((major, i) => (
            <li
              key={major}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <span className="grid h-7 w-7 place-items-center rounded-md font-mono text-xs text-white" style={{ backgroundColor: color }}>
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{major}</span>
              <span className="font-mono text-xs text-muted-foreground">{100 - i * 3}% fit</span>
            </li>
          ))}
        </ol>
      </section>
    </AgentShell>
  );
}
