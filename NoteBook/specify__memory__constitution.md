# ICanDraw Constitution

## Core Principles

### I. AI-Native Product
AI is the core driver, not an enhancement. Every feature must be designed around AI-first interaction — users express intent in natural language, AI generates structured visual output. No feature should require users to manually configure charts or draw diagrams.

### II. Structured Output, Never Images
LLM output MUST always be structured JSON (ECharts option + Excalidraw elements), never generated images. This ensures all content is editable, reversible, and incrementally modifiable by both users and AI.

### III. Local-First Data Privacy
User data (CSV/Excel/JSON) MUST be processed in the browser via WASM (DuckDB-WASM) or Web Workers. Only desensitized schema/statistics are sent to LLM APIs. No raw user data leaves the browser.

### IV. Dual-Engine Rendering
The rendering layer combines Excalidraw (hand-drawn style canvas) and ECharts (interactive data charts) as two independent but composable engines. Neither engine should be replaced or abstracted away — leverage each library's full API surface.

### V. Incremental Generation
AI must support incremental canvas updates. Each user instruction modifies the existing canvas state rather than regenerating from scratch. Canvas state is a persistent JSON document that AI reads and patches.

### VI. Simplicity & YAGNI
Start with the minimal viable interaction loop. No premature abstractions, no over-engineering. Every added complexity must be justified by a concrete user scenario from spec3.md.

## Technical Standards

- Language: TypeScript (strict mode)
- Framework: Next.js (App Router)
- Styling: Tailwind CSS
- State Management: Zustand
- AI Integration: Vercel AI SDK with streaming
- Package Manager: pnpm
- Code Quality: ESLint + Prettier, enforced via pre-commit

## Development Workflow

- Feature branches off `master`
- Each user story is independently testable and deployable
- Commit after each logical task completion
- No dead code — remove unused imports, variables, and files immediately

## Governance

This constitution supersedes all other development practices. Any deviation requires explicit justification documented in the relevant spec or plan file.

**Version**: 1.0 | **Ratified**: 2026-03-26
