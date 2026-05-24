"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface ChartContainerProps {
  height: number;
  children: (size: { width: number; height: number }) => ReactNode;
}

/**
 * Renders a fixed-height container and supplies measured pixel width to children.
 * Avoids Recharts' "ResponsiveContainer width=-1" first-render warning.
 */
export function ChartContainer({ height, children }: ChartContainerProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const update = () => setWidth(el.clientWidth || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 && children({ width, height })}
    </div>
  );
}
