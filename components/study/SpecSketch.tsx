import type { Spec } from "@/lib/study/dimensions.ts";
import { sentence } from "@/lib/study/describe.ts";

// A schematic of an interface spec: overview layout and where details open.
export function SpecSketch({ spec, size = "large" }: { spec: Spec; size?: "small" | "large" }) {
  const W = 160;
  const H = 104;
  const side = spec.openIn === "side";
  const ow = side ? 100 : W - 12;
  const x0 = 6;
  const y0 = 8;
  const marks: React.ReactNode[] = [];

  if (spec.overviewType === "list") {
    for (let i = 0, y = y0; y + 14 <= H - 6; i++) {
      const expanded = spec.openIn === "inplace" && i === 1;
      const h = expanded ? 30 : 14;
      marks.push(<rect key={`r${i}`} x={x0} y={y} width={ow} height={h} className="sk-item" />);
      marks.push(<rect key={`t${i}`} x={x0 + 4} y={y + 4} width={ow * 0.45} height={3} className="sk-ink" />);
      if (expanded) marks.push(<rect key="e" x={x0 + 4} y={y + 14} width={ow - 8} height={12} className="sk-detail" />);
      y += h + 4;
    }
  } else if (spec.overviewType === "grid") {
    const cols = side ? 2 : 3;
    const tw = (ow - (cols - 1) * 4) / cols;
    for (let i = 0; i < cols * 2; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      marks.push(<rect key={`g${i}`} x={x0 + c * (tw + 4)} y={y0 + r * 44} width={tw} height={40} className="sk-item" />);
      marks.push(<rect key={`gt${i}`} x={x0 + c * (tw + 4) + 4} y={y0 + r * 44 + 5} width={tw * 0.6} height={3} className="sk-ink" />);
    }
    if (spec.openIn === "inplace") marks.push(<rect key="ge" x={x0} y={y0 + 44} width={ow} height={40} className="sk-detail" />);
  } else {
    marks.push(<rect key="th" x={x0} y={y0} width={ow} height={8} className="sk-ink-soft" />);
    for (let i = 0, y = y0 + 11; y + 8 <= H - 6; i++) {
      marks.push(<rect key={`tr${i}`} x={x0} y={y} width={ow} height={8} className="sk-item" />);
      for (let c = 0; c < 4; c++) marks.push(<rect key={`tc${i}${c}`} x={x0 + 4 + c * (ow / 4)} y={y + 3} width={ow / 8} height={2} className="sk-ink" />);
      y += 10;
      if (spec.openIn === "inplace" && i === 2) {
        marks.push(<rect key="te" x={x0} y={y} width={ow} height={22} className="sk-detail" />);
        y += 24;
      }
    }
  }

  return (
    <figure className={`sketch sketch-${size}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${sentence(spec.overviewType)} ${sentence(spec.openIn)}`}>
        <rect x={0} y={0} width={W} height={H} className="sk-frame" />
        {marks}
        {side && <rect x={x0 + ow + 6} y={y0} width={W - ow - 18} height={H - 16} className="sk-detail" />}
        {spec.openIn === "popup" && (
          <>
            <rect x={0} y={0} width={W} height={H} className="sk-scrim" />
            <rect x={36} y={18} width={88} height={68} className="sk-detail sk-dialog" />
          </>
        )}
      </svg>
    </figure>
  );
}
