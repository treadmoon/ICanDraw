"use client";

import { useCallback, useState } from "react";
import Papa from "papaparse";
import type { CsvSchema, CsvColumn } from "@/types";

const MAX_CSV_SIZE = 10 * 1024 * 1024;

function analyzeCsv(results: Papa.ParseResult<Record<string, string>>): CsvSchema {
  const data = results.data;
  const fields = results.meta.fields ?? [];
  const columns: CsvColumn[] = fields.map((name) => {
    const values = data.map((row) => row[name]).filter(Boolean);
    const nums = values.map(Number).filter((n) => !isNaN(n));
    if (nums.length > values.length * 0.5) {
      let min = Infinity, max = -Infinity, sum = 0;
      for (const n of nums) {
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }
      return { name, type: "number" as const, min, max, mean: Math.round((sum / nums.length) * 100) / 100 };
    }
    return { name, type: "string" as const };
  });
  return { columns, rowCount: data.length, preview: data.slice(0, 3) };
}

export default function CsvUpload({ onDataReady }: { onDataReady: (text: string) => void }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith(".csv")) return;

      if (file.size > MAX_CSV_SIZE) {
        onDataReady(`CSV 文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请上传 10MB 以内的文件`);
        return;
      }

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const schema = analyzeCsv(results);
          const prompt = `我上传了一个 CSV 文件（${schema.rowCount} 行），列信息：${schema.columns
            .map((c) => `${c.name}(${c.type}${c.type === "number" ? `, min=${c.min}, max=${c.max}, mean=${c.mean}` : ""})`)
            .join(", ")}。前3行预览：${JSON.stringify(schema.preview)}。请帮我选择合适的图表类型并生成可视化。`;
          onDataReady(prompt);
        },
      });
    },
    [onDataReady]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      className={`mx-3 mb-2 rounded-xl border-2 border-dashed p-2 text-center text-[11px] transition-colors ${
        dragOver
          ? "border-blue-400 bg-blue-50 text-blue-500 dark:bg-blue-950 dark:border-blue-600"
          : "border-gray-200 text-gray-400 hover:border-gray-300 dark:border-gray-700"
      }`}
    >
      {dragOver ? "松开以上传" : "拖拽 CSV 文件到这里"}
    </div>
  );
}
