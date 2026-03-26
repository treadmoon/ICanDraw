import { z } from "zod";

const chartInstanceSchema = z.object({
  id: z.string().describe("Unique chart ID, e.g. chart-1"),
  x: z.number().describe("X position on canvas"),
  y: z.number().describe("Y position on canvas"),
  width: z.number().describe("Chart width in pixels"),
  height: z.number().describe("Chart height in pixels"),
  option: z.record(z.string(), z.unknown()).describe("Complete ECharts option object"),
});

const excalidrawElementSchema = z.object({
  type: z.enum(["arrow", "text", "ellipse", "rectangle", "line"]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  text: z.string().optional(),
  strokeColor: z.string().optional(),
  points: z.array(z.array(z.number())).optional(),
});

const annotationSchema = z.object({
  id: z.string().describe("Unique annotation ID"),
  bindTo: z.string().optional().describe("ID of the chart this annotation relates to"),
  elements: z.array(excalidrawElementSchema),
});

export const aiResponseSchema = z.object({
  charts: z.array(chartInstanceSchema).describe("ECharts instances to render on canvas"),
  annotations: z.array(annotationSchema).describe("Hand-drawn style annotations (arrows, text, circles) to add around charts"),
  summary: z.string().describe("Brief text summary of what was generated or changed, shown in chat"),
});

export type AIResponseSchema = z.infer<typeof aiResponseSchema>;
