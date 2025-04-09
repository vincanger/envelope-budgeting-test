# Phase Implementation Summaries

These documents summarize the implementation details for each phase of the Envelope Budgeting App.

Their purpose is to provide context for future work, especially for  AI assistants (LLMs, etc.) and human developers maintaining the codebase and to help them make informed decisions.

## Documentation Principles

- **Single Source of Truth:**
  - The `schema.prisma` file in the project root is the definitive source for all data models (`User`, `BudgetProfile`, `Envelope`, `Transaction`, `Invitation`, etc.). Documentation files should *reference* the models in `schema.prisma` but **not** duplicate their definitions.
  - The `main.wasp` (or `main.wasp.ts`) file in the project root is the definitive source for the app's configuration (pages, routes, queries, actions, etc.). Documentation files should *reference* the `main.wasp` file but **not** duplicate its configuration.
- **Avoid Redundancy:** Do not include lengthy code excerpts (e.g., full operation implementations, large Prisma model definitions) directly within these markdown files. Instead, describe the functionality and point to the relevant source code files (e.g., `src/features/.../operations.ts`).
- **Cross-Referencing:** Link between related documentation files. For example, the transaction documentation should link to the core budgeting and foundation documentation where relevant.
- **Focus on Overview & Context:** These documents should provide a high-level summary of *what* was implemented in each phase, *why* certain decisions were made (if notable), key challenges encountered, and how the implementation aligns with the overall plan (`../plan.md`). They bridge the gap between the plan and the code.

## How to instruct the AI assistant to maintain these documents
After finishing the implementation of a phase according to the plan in `./ai/plan.md`, instruct the AI assistant to:

> please create an LLM-friendly Phase Implementation Summary document in `./ai/docs` following the naming convention `{phase-number}-{phase-name}.md`. These names can be found in the `./ai/plan.md` file.
