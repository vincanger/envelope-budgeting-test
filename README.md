# Vibe-Coded Envelope Budgeting App

A full-stack collaborative envelope budgeting application vibe-coded using
- [Wasp](https://wasp.sh), a React, Node.js, and Prisma full-stack framework.
- [Shadcn-Admin](https://github.com/satnaing/shadcn-admin) for the UI.
- Cursor with Google Gemini 2.5 Pro for AI-assisted development.

This project serves as a demo for using Wasp with AI-assisted development tools like Cursor, Windsurf, Copilot, Claude Code, etc.

![Envelope Budgeting App](./public/env-budgeting-vibecode.png)

## Getting Started

1. install Wasp

```bash
curl -sSL https://get.wasp.sh/installer.sh | sh
```

2. start a postgres database (you must have [docker installed](https://www.docker.com/get-started/))

```bash
wasp start db
```

3. migrate the database

```bash
wasp db migrate-dev
```

4. start the development server

```bash
wasp start
```

## AI-Assisted Development

This project leverages AI tools to streamline development.

### The Rules For AI

This project was built using Cursor (with Google Gemini 2.5 Pro).

The Rules For AI files were built for Cursor, but can be easily adapted and used with other AI editors like Windsurf, GitHub Copilot, etc.

If you're using Cursor, you can use the rules within the `.cursor/rules` directory and delete the `.cursorrules` file, as their contents are the same (`.cursor/rules` is simply the `.cursorrules` file broken into separate documents to conform to Cursor's new rules file structure).

If you're using a different AI editor, you can copy and paste the `.cursorrules` file into a new file and modify it to fit your project's needs.

These rules describe:

- Wasp project structure and patterns
- Import rules and common issues
- Database schema guidelines
- Authentication configuration
- Operation implementation patterns

### `ai` Directory

The `ai` directory serves as a knowledge base for the project:

- `ai/plan.md`: Outlines the phased implementation roadmap
- `ai/prd.md`: Contains product requirements
- `ai/docs/*.md`: Phase implementation summaries that document decisions, challenges, and implementation details

These documents help AI assistants understand the project context when assisting with code generation, debugging, or feature implementation, creating a more effective collaboration between developers and AI tools.

### Workflow Suggestions
- Start with a template, like this one for example :)
- Use a battle-tested RULES FOR AI file (also included here)
- Create & revise your PLAN carefully before you begin
- Use the *vertical slice pattern* for implementing features one-by-one
- Ask LLM to test your assumptions and give you 3-5 possible solutions, along with rationale for the best one before you start implementing
- After implementation a feature (e.g. a phase within your plan), ask the LLM to create a new doc in `ai/docs` to summarize the feature.