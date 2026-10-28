import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { compact, cop } from "@/lib/plaza";

type Point = { label: string } & Record<string, number | string>;

/** Gráfica de área de 30 días con una o dos series. */
export function TrendChart({
  data,
  series,
  money = false,
  height = 240,
}: {
  data: Point[];
  series: { key: string; label: string; color: string }[];
  money?: boolean;
  height?: number;
}) {
  const config = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  ) satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${s.key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => (money ? `$${compact(v)}` : compact(v))}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(v, name) => [
                money ? cop(Number(v)) : String(v),
                " ",
                config[name as string]?.label ?? name,
              ]}
            />
          }
        />
        {series.map((s) => (
          <Area
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            fill={`url(#fill-${s.key})`}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
