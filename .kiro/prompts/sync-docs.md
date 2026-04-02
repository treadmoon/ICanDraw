---
description: "Sync spec documents (plan.md, tasks.md, spec.md) with actual codebase. Detects drift and updates docs to match current implementation."
---

# Sync Docs — 文档与代码一致性同步

## Goal

对比 `specs/` 目录下的规划文档与 `src/` 目录下的实际代码，找出不一致之处并更新文档。

## Pre-Execution

1. Read all spec documents:
   - `specs/001-canvas-mvp/plan.md`
   - `specs/001-canvas-mvp/tasks.md`
   - `specs/001-canvas-mvp/spec.md`

2. Read all source files to understand current implementation:
   - `src/types/index.ts`
   - `src/app/page.tsx`
   - `src/app/api/chat/route.ts`
   - `src/app/layout.tsx`
   - `src/components/*.tsx` (all components)
   - `src/stores/*.ts` (all stores)
   - `src/lib/**/*.ts` (all lib files)
   - `package.json`

## Execution Steps

### Step 1: Diff Analysis

Compare docs vs code across these dimensions and output a markdown table of findings:

| Dimension | What to check |
|-----------|--------------|
| **Tech stack** | Dependencies in plan.md vs actual package.json; framework versions |
| **File structure** | Files listed in plan.md vs actual files in src/ (missing, extra, renamed) |
| **Architecture decisions** | Rendering strategy, API approach, state management described in plan.md vs actual implementation |
| **Task completion** | Tasks marked `[ ]` in tasks.md that are actually done in code; tasks marked `[x]` whose target files don't exist |
| **Missing tasks** | Features implemented in code that have no corresponding task in tasks.md |
| **Requirements** | FR-xxx in spec.md vs actual behavior (layout direction, streaming, etc.) |
| **Assumptions** | Assumptions in spec.md that no longer hold |

Present the diff table to the user. Ask: "以上是检测到的不一致项，确认要更新文档吗？"

### Step 2: Update Documents

After user confirms, update each document:

**plan.md updates:**
- Fix Technical Context (dependencies, versions)
- Fix Project Structure (add/remove/rename files)
- Fix Key Technical Decisions (rendering strategy, API approach)
- Add new decisions for changes not previously documented
- Keep the document's existing structure and formatting style

**tasks.md updates:**
- Mark completed tasks as `[x]` if the target file exists and implements the described functionality
- Update task descriptions if the implementation approach changed (e.g., "Vercel AI SDK" → "direct fetch")
- Add new tasks for features that were implemented but not in the original task list (i18n, drawings, EChartEmbeddable, etc.) — mark them as `[x]` with a note like "(added post-MVP)"
- Do NOT remove or renumber existing tasks — only append and update

**spec.md updates:**
- Fix factual errors in Requirements (e.g., layout direction)
- Mark unimplemented requirements with a note (e.g., "FR-006: [未实现] 流式响应")
- Update Assumptions that no longer hold
- Do NOT change User Stories or Acceptance Scenarios — these are the original requirements

### Step 3: Summary

Output a summary of all changes made, grouped by file.

## Rules

- NEVER delete content from documents — only update, annotate, or append
- Preserve original task numbering (T001, T002, ...) — new tasks use the next available number
- When updating decisions, keep the original text as context and add "**[Updated]**" prefix with new description
- If unsure whether something changed intentionally or is a bug, flag it as "⚠️ 需确认" instead of auto-fixing
