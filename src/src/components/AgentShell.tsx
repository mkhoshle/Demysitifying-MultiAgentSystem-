import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { AGENTS, type AgentId } from "@/lib/agents";

interface PipelineProps {
  steps: string[];
  color: string;
}

export function Pipeline({ steps, color }: PipelineProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      {steps.map((step, i) => (
        <div key={i} className="flex flex-1 items-stretch gap-3">
          <div
            className="flex flex-1 flex-col rounded-xl border bg-card p-4 shadow-sm"
            style={{ borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
              Step {String(i + 1).padStart(2, "0")}
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">{step}</div>
          </div>
          {i < steps.length - 1 && (
            <div className="hidden items-center md:flex">
              <div className="text-xl" style={{ color }}>→</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AgentShell({
  agentId,
  children,
}: {
  agentId: AgentId;
  children: ReactNode;
}) {
  const agent = AGENTS.find((a) => a.id === agentId)!;
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agent.colorVar }} />
            Agent {agent.num}
          </div>
        </div>
      </div>

      <header className="mx-auto max-w-6xl px-6 pt-10">
        <div className="font-mono text-xs uppercase tracking-widest" style={{ color: agent.colorVar }}>
          Agent {agent.num} · Detail view
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">{agent.name}</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{agent.description}</p>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-6 py-10">{children}</main>
    </div>
  );
}

export function SectionTitle({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: color ?? "var(--muted-foreground)" }}>
        {children}
      </h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
