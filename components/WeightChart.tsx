// components/WeightChart.tsx
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";

export type WeightPoint = { date: string; weight: number }; // date: "YYYY-MM-DD"

type Props = {
  data: WeightPoint[];
  height?: number;
};

/** Utility: generate ticks every ~5 days across [minDate, maxDate] */
function buildDateTicks(dates: Date[], stepDays = 5) {
  if (dates.length === 0) return [];
  const min = dates[0].getTime();
  const max = dates[dates.length - 1].getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  // if the range is tiny, show at least min/max
  if (max - min <= 2 * stepDays * oneDay) {
    return [new Date(min), new Date(max)];
  }

  const ticks: Date[] = [];
  let cursor = new Date(min);
  ticks.push(new Date(cursor));
  while (cursor.getTime() + stepDays * oneDay < max) {
    cursor = new Date(cursor.getTime() + stepDays * oneDay);
    ticks.push(new Date(cursor));
  }
  ticks.push(new Date(max));
  return ticks;
}

export default function WeightChart({ data, height = 200 }: Props) {
  const colors = useColors();

  // Sort and map to Dates
  const sorted = useMemo(
    () =>
      [...data]
        .filter((d) => isFinite(d.weight))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data]
  );

  const dates = sorted.map((d) => new Date(d.date));
  const weights = sorted.map((d) => d.weight);

  // Guards
  if (sorted.length === 0) {
    return (
      <View
        style={{
          height,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.textMuted }}>No weight entries yet.</Text>
      </View>
    );
  }

  // padding for axes
  const PAD_LEFT = 40;
  const PAD_RIGHT = 16;
  const PAD_BOTTOM = 26;
  const PAD_TOP = 16;
  const width = Math.max(320, 0); // real width comes from parent; SVG is responsive

  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const yMin = Math.floor(minW - 0.5); // a small headroom
  const yMax = Math.ceil(maxW + 0.5);

  const minT = dates[0].getTime();
  const maxT = dates[dates.length - 1].getTime();
  const xSpan = Math.max(1, maxT - minT);
  const ySpan = Math.max(1e-3, yMax - yMin);

  // date ticks in ~5-day steps
  const ticks = buildDateTicks(dates, 5);

  // map helpers
  const X = (t: number, W: number) =>
    PAD_LEFT + ((W - PAD_LEFT - PAD_RIGHT) * (t - minT)) / xSpan;
  const Y = (w: number, H: number) =>
    H - PAD_BOTTOM - ((H - PAD_TOP - PAD_BOTTOM) * (w - yMin)) / ySpan;

  // build the polyline path (smoothed a bit using cubic)
  function buildPath(W: number, H: number) {
    if (sorted.length === 1) {
      const x = X(dates[0].getTime(), W);
      const y = Y(weights[0], H);
      return `M ${x} ${y} L ${x + 0.01} ${y}`;
    }
    let d = "";
    for (let i = 0; i < sorted.length; i++) {
      const x = X(dates[i].getTime(), W);
      const y = Y(weights[i], H);
      if (i === 0) d += `M ${x} ${y}`;
      else {
        const px = X(dates[i - 1].getTime(), W);
        const py = Y(weights[i - 1], H);
        const cx = (px + x) / 2;
        d += ` C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
      }
    }
    return d;
  }

  // We rely on viewBox to scale; set an arbitrary w=400
  const W = 400;
  const H = height;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
      }}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* axes gridlines for ticks */}
        {ticks.map((d, i) => {
          const x = X(d.getTime(), W);
          return (
            <Line
              key={`vx-${i}`}
              x1={x}
              y1={PAD_TOP}
              x2={x}
              y2={H - PAD_BOTTOM}
              stroke={colors.border}
              strokeDasharray="2 6"
              strokeWidth={1}
            />
          );
        })}

        {/* Y-axis min/max labels */}
        {[yMin, yMax].map((yy, i) => {
          const y = Y(yy, H);
          return (
            <React.Fragment key={`y-${i}`}>
              <Line
                x1={PAD_LEFT - 6}
                y1={y}
                x2={W - PAD_RIGHT}
                y2={y}
                stroke={colors.border}
                strokeDasharray="4 8"
                strokeWidth={1}
              />
              <SvgText
                x={PAD_LEFT - 10}
                y={y + 4}
                fontSize="10"
                fill={colors.textMuted}
                textAnchor="end"
              >
                {yy}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* line */}
        <Path d={buildPath(W, H)} stroke={colors.primary} strokeWidth={2} fill="none" />

        {/* points */}
        {sorted.map((p, i) => {
          const x = X(new Date(p.date).getTime(), W);
          const y = Y(p.weight, H);
          return <Circle key={i} cx={x} cy={y} r={3} fill={colors.primary} />;
        })}

        {/* x tick labels */}
        {ticks.map((d, i) => {
          const x = X(d.getTime(), W);
          const label = d.toISOString().slice(5, 10); // MM-DD
          return (
            <SvgText
              key={`lbl-${i}`}
              x={x}
              y={H - 6}
              fontSize="10"
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
