import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentShell, SectionTitle } from "@/components/AgentShell";
import { AGENTS, fetchFinalConsensus } from "@/lib/agents";

export const Route = createFileRoute("/agent/coordinator")({
  head: () => ({
    meta: [{ title: "Agent 4 · Coordinator — MAS Playground" }],
  }),
  component: Page,
});

const WEIGHTS = [
  { id: "course", label: "Academic fit", weight: 0.4 },
  { id: "family", label: "Context & access", weight: 0.25 },
  { id: "personality", label: "Personal fit", weight: 0.35 },
];

function Page() {
  const color = "var(--agent-4)";
  const peripherals = AGENTS.filter((a) => a.id !== "coordinator");
  const [consensus, setConsensus] = useState<Awaited<ReturnType<typeof fetchFinalConsensus>> | null>(null);

  useEffect(() => {
    fetchFinalConsensus()
      .then(setConsensus)
      .catch((err) => console.error("Failed to load consensus data:", err));
  }, []);

  if (!consensus) {
    return <div className="p-8 font-mono text-sm">Loading backend data...</div>;
  }

  return (
    <AgentShell agentId="coordinator">
      <section>
        <SectionTitle color={color}>Consensus mechanism</SectionTitle>
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div className="space-y-3">
              {peripherals.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg font-mono text-xs text-white" style={{ backgroundColor: a.colorVar }}>
                    A{a.num}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">10 candidate predictions →</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden text-2xl text-muted-foreground lg:block">→</div>

            <div className="rounded-2xl border-2 border-dashed p-5" style={{ borderColor: color }}>
              <div className="font-mono text-xs uppercase tracking-widest" style={{ color }}>
                Weighted synthesis
              </div>
              <div className="mt-3 space-y-2">
                {WEIGHTS.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 text-sm">
                    <span className="w-32 text-muted-foreground">{w.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full" style={{ width: `${w.weight * 100}%`, backgroundColor: color }} />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(w.weight * 100)}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-secondary p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                score(option) = Σ wᵢ · agentᵢ.confidence(option)<br />
                final = top 5 by score, tie-break by alignment
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <ResultList title="Final top 5 schools" color={color} items={consensus.schools} />
        <ResultList title="Final top 5 majors" color={color} items={consensus.majors} />
      </section>
    </AgentShell>
  );
}

function ResultList({ title, color, items }: { title: string; color: string; items: { name: string; score: number }[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="font-mono text-xs uppercase tracking-widest" style={{ color }}>
        {title}
      </div>
      <ol className="mt-4 space-y-2">
        {items.map((s, i) => (
          <li key={s.name} className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg font-mono text-sm text-white" style={{ backgroundColor: color }}>
              {i + 1}
            </span>
            <span className="flex-1 font-medium">{s.name}</span>
            <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-secondary md:block">
              <div className="h-full rounded-full" style={{ width: `${s.score}%`, backgroundColor: color }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{s.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
