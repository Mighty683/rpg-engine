# RPG Engine

A web application for running tabletop RPG sessions. This repository currently contains the frontend foundation; session management and persistence have not yet been implemented.

## Development

The project uses Vue 3, TypeScript, Nuxt UI, and the project-local Vite+ toolchain. Node.js and pnpm are required. The pnpm version is specified in `package.json`.

```sh
pnpm install
pnpm dev
```

Run `pnpm build` for type checking and a production build, or `pnpm exec vp check` for formatting and lint checks.

## AI skills and agents

Reusable skills live in `.agents/skills/` in the portable [Agent Skills](https://agentskills.io) format (`SKILL.md` + frontmatter). OpenCode discovers this directory automatically, and other compatible harnesses can use it too. Reviewer subagents are defined in `.opencode/agents/`.
