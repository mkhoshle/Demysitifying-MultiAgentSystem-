import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AGENTS, type Agent } from "@/lib/agents";

interface Props {
  size?: number;
  pulse?: boolean;
  className?: string;
}

export function TopologyGraph({ size = 520, pulse = false, className = "" }: Props) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<Agent | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;

  const coordinator = AGENTS.find((a) => a.id === "coordinator")!;
  const peripherals = AGENTS.filter((a) => a.id !== "coordinator");

  const positions = peripherals.map((agent, i) => {
    const angle = (-Math.PI / 2) + (i * (2 * Math.PI)) / peripherals.length;
    return {
      agent,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const nodeR = size * 0.09;
  const centerR = size * 0.115;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-muted-foreground" />
          </marker>
        </defs>

        {positions.map(({ agent, x, y }) => {
          const dx = x - cx;
          const dy = y - cy;
          const len = Math.hypot(dx, dy);
          const ux = dx / len;
          const uy = dy / len;
          const x1 = cx + ux * centerR;
          const y1 = cy + uy * centerR;
          const x2 = x - ux * nodeR;
          const y2 = y - uy * nodeR;
          return (
            <g key={agent.id} className="text-border">
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
              {pulse && (
                <circle r="4" fill={agent.colorVar}>
                  <animateMotion dur="2.4s" repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Center node */}
        <g
          className="cursor-pointer"
          onMouseEnter={() => setHovered(coordinator)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => navigate({ to: coordinator.route })}
        >
          <circle cx={cx} cy={cy} r={centerR + 8} fill={coordinator.colorVar} opacity="0.12" />
          <circle cx={cx} cy={cy} r={centerR} fill={coordinator.colorVar} />
          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white font-semibold" fontSize={size * 0.055}>
            Agent 4
          </text>
          <text x={cx} y={cy + 16} textAnchor="middle" className="fill-white/90" fontSize={size * 0.035}>
            Coordinator
          </text>
        </g>

        {/* Peripheral nodes */}
        {positions.map(({ agent, x, y }) => (
          <g
            key={agent.id}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(agent)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => navigate({ to: agent.route })}
          >
            <circle cx={x} cy={y} r={nodeR + 6} fill={agent.colorVar} opacity="0.12" />
            <circle cx={x} cy={y} r={nodeR} fill={agent.colorVar} />
            <text x={x} y={y - 4} textAnchor="middle" className="fill-white font-semibold" fontSize={size * 0.048}>
              A{agent.num}
            </text>
            <text x={x} y={y + 14} textAnchor="middle" className="fill-white/90" fontSize={size * 0.03}>
              {agent.short}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute z-10 w-64 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg pointer-events-none animate-fade-in"
          style={{ left: "50%", top: -8, transform: "translate(-50%, -100%)" }}
        >
          <div className="mb-1 font-semibold" style={{ color: hovered.colorVar }}>
            Agent {hovered.num} — {hovered.name}
          </div>
          <p className="text-muted-foreground">{hovered.description}</p>
          <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Click to inspect →
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
        {AGENTS.map((a) => (
          <Link
            key={a.id}
            to={a.route}
            className="rounded-full border border-border px-3 py-1 transition hover:border-foreground/30 hover:bg-secondary"
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: a.colorVar }} />
            A{a.num} {a.short}
          </Link>
        ))}
      </div>
    </div>
  );
}
