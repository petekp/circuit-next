import { useMemo } from 'react';
import { isTerminalTarget, STAGE_ORDER, TERMINAL_TARGETS } from '@/lib/spine';
import type { SchematicStep } from '@/lib/types';
import { cn } from '@/lib/utils';

const STAGE_WIDTH = 180;
const STEP_WIDTH = 150;
const STEP_HEIGHT = 44;
const STEP_VGAP = 12;
const PADDING_X = 16;
const PADDING_Y = 28;
const TERMINAL_PAD_W = 110;

type StepBox = {
  step: SchematicStep;
  x: number;
  y: number;
  w: number;
  h: number;
};

type TerminalBox = {
  target: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Edge = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
  sourceId: string;
};

type Layout = {
  width: number;
  height: number;
  stages: { stage: string; x: number; steps: StepBox[] }[];
  stepIndex: Map<string, StepBox>;
  terminals: TerminalBox[];
  edges: Edge[];
};

function buildLayout(steps: readonly SchematicStep[]): Layout {
  const stagesPresent = STAGE_ORDER.filter((stage) =>
    steps.some((s) => s.stage === stage),
  );
  const customStages = [
    ...new Set(steps.map((s) => s.stage).filter((s) => !STAGE_ORDER.includes(s as never))),
  ];
  const orderedStages = [...stagesPresent, ...customStages];

  const stageBoxes: { stage: string; x: number; steps: StepBox[] }[] = [];
  let maxStackY = PADDING_Y;
  orderedStages.forEach((stage, stageIdx) => {
    const stageX = PADDING_X + stageIdx * STAGE_WIDTH;
    const stepX = stageX + (STAGE_WIDTH - STEP_WIDTH) / 2;
    const stageSteps = steps.filter((s) => s.stage === stage);
    const stepBoxes: StepBox[] = stageSteps.map((step, i) => {
      const y = PADDING_Y + i * (STEP_HEIGHT + STEP_VGAP);
      maxStackY = Math.max(maxStackY, y + STEP_HEIGHT);
      return { step, x: stepX, y, w: STEP_WIDTH, h: STEP_HEIGHT };
    });
    stageBoxes.push({ stage, x: stageX, steps: stepBoxes });
  });

  const stepIndex = new Map<string, StepBox>();
  for (const sb of stageBoxes) {
    for (const box of sb.steps) {
      stepIndex.set(box.step.id, box);
    }
  }

  // Terminals stacked along the right edge.
  const terminalsX =
    PADDING_X + orderedStages.length * STAGE_WIDTH + STEP_VGAP;
  const terminals: TerminalBox[] = TERMINAL_TARGETS.map((t, i) => ({
    target: t,
    x: terminalsX,
    y: PADDING_Y + i * (28 + 6),
    w: TERMINAL_PAD_W,
    h: 28,
  }));
  const terminalIndex = new Map(terminals.map((t) => [t.target, t]));

  const edges: Edge[] = [];
  for (const sb of stageBoxes) {
    for (const box of sb.steps) {
      const routes = box.step.routes ?? {};
      for (const [name, target] of Object.entries(routes)) {
        const from = { x: box.x + box.w, y: box.y + box.h / 2 };
        let to: { x: number; y: number } | null = null;
        if (isTerminalTarget(target as string)) {
          const t = terminalIndex.get(target as string);
          if (t) to = { x: t.x, y: t.y + t.h / 2 };
        } else {
          const targetBox = stepIndex.get(target as string);
          if (targetBox) {
            to = { x: targetBox.x, y: targetBox.y + targetBox.h / 2 };
          }
        }
        if (to) edges.push({ from, to, label: name, sourceId: box.step.id });
      }
    }
  }

  const width = terminalsX + TERMINAL_PAD_W + PADDING_X;
  const height = Math.max(maxStackY + PADDING_Y, PADDING_Y + terminals.length * 34 + PADDING_Y);
  return { width, height, stages: stageBoxes, stepIndex, terminals, edges };
}

function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = Math.max(40, (to.x - from.x) * 0.5);
  return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
}

type Props = {
  steps: readonly SchematicStep[];
  selectedStepId: string | null;
  onSelect: (id: string) => void;
};

export function RouteMap({ steps, selectedStepId, onSelect }: Props) {
  const layout = useMemo(() => buildLayout(steps), [steps]);

  if (steps.length === 0) {
    return (
      <p className="text-muted-foreground p-3 text-xs">No steps to map.</p>
    );
  }

  return (
    <div className="h-full">
      <div className="text-muted-foreground border-border flex items-center gap-2 border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider">
        Route map
      </div>
      <div className="overflow-auto" style={{ height: 'calc(100% - 28px)' }}>
        <svg
          width={layout.width}
          height={layout.height}
          className="block"
          aria-label="Route map"
        >
          <defs>
            <marker
              id="route-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
            </marker>
          </defs>

          {/* Stage column headers */}
          {layout.stages.map(({ stage, x }) => (
            <text
              key={stage}
              x={x + STAGE_WIDTH / 2}
              y={16}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider"
            >
              {stage}
            </text>
          ))}

          {/* Edges */}
          {layout.edges.map((edge, i) => (
            <g key={`${edge.sourceId}-${edge.label}-${i}`}>
              <path
                d={bezierPath(edge.from, edge.to)}
                fill="none"
                className="stroke-muted-foreground/40"
                strokeWidth={1.25}
                markerEnd="url(#route-arrow)"
              />
              <text
                x={(edge.from.x + edge.to.x) / 2}
                y={(edge.from.y + edge.to.y) / 2 - 4}
                textAnchor="middle"
                className="fill-muted-foreground/80 font-mono text-[9px]"
              >
                {edge.label}
              </text>
            </g>
          ))}

          {/* Step boxes */}
          {layout.stages.flatMap(({ steps: stepBoxes }) =>
            stepBoxes.map((box) => {
              const selected = selectedStepId === box.step.id;
              return (
                <g
                  key={box.step.id}
                  transform={`translate(${box.x}, ${box.y})`}
                  onClick={() => onSelect(box.step.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width={box.w}
                    height={box.h}
                    rx={6}
                    className={cn(
                      'stroke-border fill-card transition-colors',
                      selected ? 'stroke-ring' : 'hover:stroke-foreground/40',
                    )}
                    strokeWidth={selected ? 2 : 1}
                  />
                  <text
                    x={10}
                    y={18}
                    className="fill-foreground text-[11px] font-medium"
                  >
                    {truncate(box.step.title, 22)}
                  </text>
                  <text
                    x={10}
                    y={32}
                    className="fill-muted-foreground font-mono text-[9px]"
                  >
                    {box.step.id}
                  </text>
                </g>
              );
            }),
          )}

          {/* Terminal pads */}
          {layout.terminals.map((t) => (
            <g key={t.target} transform={`translate(${t.x}, ${t.y})`}>
              <rect
                width={t.w}
                height={t.h}
                rx={t.h / 2}
                className="fill-muted/50 stroke-border"
                strokeWidth={1}
              />
              <text
                x={t.w / 2}
                y={t.h / 2 + 3}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {t.target}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
