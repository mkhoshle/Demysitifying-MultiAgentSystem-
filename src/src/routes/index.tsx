import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ClipboardEvent } from "react";
import { ArrowRight, Check, GitBranch, KeyRound, Network, Trash2, Users } from "lucide-react";
import heroImg from "@/assets/mas-hero.jpg";
import { getStoredLlmApiKey, importLlmApiKeyFromUrlHash, setStoredLlmApiKey } from "@/lib/agents";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MAS Playground — Multi-Agent Systems for Major Selection" },
      { name: "description", content: "An interactive walkthrough of a multi-agent AI system that helps high school students pick a university and major." },
      { property: "og:title", content: "MAS Playground — Multi-Agent Systems for Major Selection" },
      { property: "og:description", content: "An interactive walkthrough of a multi-agent AI system that helps high school students pick a university and major." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">M</span>
            MAS Playground
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Launch demo →
          </Link>
        </div>
      </nav>

      <section className="grid-bg border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Educational walkthrough
              </div>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
                Many minds.
                <br />
                <span className="text-primary">One decision.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-foreground">
                A Multi-Agent System (MAS) is a network of specialized AI agents that
                each see part of a problem, share their findings, and negotiate a
                consensus. Chat with the Coordinator on the dashboard to explore all
                four agents and get a personalized school & major recommendation.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  Example: major selection for high school students
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
              <LlmKeyBox />
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/30 blur-2xl" />
              <img
                src={heroImg}
                alt="Conceptual illustration of a multi-agent system with one central coordinator and three peripheral specialist agents."
                width={1536}
                height={1024}
                className="relative rounded-2xl border border-border shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">How agents interact</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Three building blocks define a multi-agent system. Together they let
          independent agents reason locally and decide globally.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { Icon: Users, title: "Specialized agents", body: "Each agent owns one perspective — academics, context, or self — and runs its own model on its own data slice." },
            { Icon: Network, title: "Communication channel", body: "Agents exchange typed messages with a coordinator, passing predictions and confidence scores back and forth." },
            { Icon: GitBranch, title: "Consensus mechanism", body: "A coordinator weighs every agent's output, resolves conflicts, and produces a single ranked decision." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/20 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold">Ready to see it run?</h3>
              <p className="text-sm text-muted-foreground">
                Open the dashboard and chat with the Coordinator to query every agent.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              Example for major selection <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          MAS Playground · An educational demo
        </div>
      </footer>
    </div>
  );
}

function LlmKeyBox() {
  const [hasApiKey, setHasApiKey] = useState(() => {
    const imported = importLlmApiKeyFromUrlHash();
    return imported || Boolean(getStoredLlmApiKey());
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function savePastedApiKey(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    setError("");
    const nextKey = event.clipboardData.getData("text").trim();
    if (!nextKey) {
      setError("Pasted text is empty");
      return;
    }
    setStoredLlmApiKey(nextKey);
    setHasApiKey(true);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function clearApiKey() {
    setStoredLlmApiKey("");
    setHasApiKey(false);
    setSaved(false);
    setError("");
  }

  return (
    <div className="mt-6 max-w-xl rounded-xl border border-border bg-card/90 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-primary" />
        LLM API key
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div
          role="textbox"
          tabIndex={0}
          aria-label="Paste LLM API key"
          onPaste={savePastedApiKey}
          className="flex min-h-11 flex-1 cursor-text items-center justify-between rounded-lg border border-border bg-background px-3 text-left text-sm outline-none hover:border-primary/50 focus:border-primary/50"
        >
          <span className="text-muted-foreground">
            {hasApiKey ? "LLM key saved in this browser" : "Click here, then paste your key"}
          </span>
          {hasApiKey && <Check className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearApiKey}
            aria-label="Clear LLM API key"
            className="grid min-h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Copy the key first, click the paste area, then press Cmd+V or Ctrl+V.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        If paste fails, open <span className="font-mono">/dashboard#llmKey=YOUR_KEY</span>.
      </p>
      {saved && <p className="mt-2 text-xs text-primary">Saved.</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
