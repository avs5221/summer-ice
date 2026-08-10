# Summer Ice — Working Environment

Practical reference for the development setup. Not part of the repo; this is for you, not for Claude Code.

---

## 1. Launching WSL

You have three ways in. Pick one and make it a habit.

### Best: pin Ubuntu to the taskbar

Installing the distro created a Start menu app called **Ubuntu 24.04**. Press Start, type `ubuntu`, right-click the result → **Pin to taskbar**. From then on it's one click and you land straight in `/home/michael`.

### Also good: Windows Terminal

Windows Terminal ships with Windows 11. Open it, click the **⌄** next to the `+` tab button, choose **Ubuntu 24.04**.

To make it the default so plain Ctrl+Shift+T opens Linux rather than PowerShell: Settings (Ctrl+,) → Startup → Default profile → Ubuntu 24.04.

### Fallback: from anywhere

`Win+R`, type `wsl`, Enter. Or type `wsl` in any PowerShell window.

> **Watch your prompt.** If it reads `michael@DESKTOP-...:~$` you're in Linux. If it reads `PS C:\...>` you're in PowerShell and Linux commands will fail. This caught you earlier when you were sitting in `/mnt/c/WINDOWS/system32`.

---

## 2. Where files actually live

Two separate filesystems. This is the thing worth internalising.

| | Linux path | Windows path |
|---|---|---|
| Your Linux home | `/home/michael` or `~` | `\\wsl.localhost\Ubuntu-24.04\home\michael` |
| The project | `~/code/summer-ice` | `\\wsl.localhost\Ubuntu-24.04\home\michael\code\summer-ice` |
| Docs folder | `~/code/summer-ice/docs` | ...`\code\summer-ice\docs` |
| Windows C: drive | `/mnt/c` | `C:\` |
| Windows Downloads | `/mnt/c/Users/Michael/Downloads` | `C:\Users\Michael\Downloads` |

**The project lives on the Linux side.** Not on `C:`. The `/mnt/c` bridge is slow — fine for copying a file across, wrong for working in.

### Browsing Linux files from Windows

Open File Explorer. In the left sidebar there's a **Linux** entry with a penguin icon — click through to `Ubuntu-24.04 → home → michael → code → summer-ice`.

Or paste this into the File Explorer address bar:

```
\\wsl.localhost\Ubuntu-24.04\home\michael\code\summer-ice
```

Drag-and-drop into that window works normally. Handy for dropping in a downloaded document or the logo PNG.

### Useful navigation commands

```bash
cd ~/code/summer-ice     # go to the project
pwd                      # where am I?
ls -la                   # list everything, including hidden files
cd ..                    # up one level
cd -                     # back to where I just was
```

`~` always means `/home/michael`. `.` means here. `..` means up one.

---

## 3. Placing a document from this chat into the repo

Two routes. Same result.

### Route A — File Explorer, no terminal

1. Download the file from the chat (it lands in `C:\Users\Michael\Downloads`)
2. Paste `\\wsl.localhost\Ubuntu-24.04\home\michael\code\summer-ice\docs` into File Explorer's address bar
3. Drag the file in, overwrite when prompted

### Route B — terminal

```bash
cd ~/code/summer-ice
cp /mnt/c/Users/Michael/Downloads/ARCHITECTURE.md docs/
chmod 644 docs/*.md
ls -la docs/
```

The `chmod` is because files copied off the Windows disk arrive marked executable, which looks like a mistake in a diff later.

Then confirm git sees the change:

```bash
git status
```

---

## 4. VS Code — yes, use it

Claude Code runs in the terminal, but you want an editor for reading diffs and understanding structure. Reviewing what an agent changed is most of the work.

### One-time setup

1. In VS Code on Windows, install the extension **WSL** (publisher: Microsoft)
2. Also install **Claude Code for VS Code** if you want the sidebar integration

### Daily use

From the Ubuntu terminal, inside the project:

```bash
cd ~/code/summer-ice
code .
```

First run downloads a small server component into WSL. After that it's instant.

The window looks like normal VS Code, but the terminal, extensions and language server all run **inside Linux**. Bottom-left will show `WSL: Ubuntu-24.04` — that's how you know you're on the fast path.

> **Do not** open the project by browsing to `\\wsl.localhost\...` from Windows VS Code, and don't open VS Code from the Start menu and navigate to the folder. Both work but run over the slow bridge, and the integrated terminal will give you PowerShell instead of bash. Always `code .` from the Linux terminal.

### Running commands inside VS Code

`` Ctrl+` `` opens the integrated terminal. In a WSL-connected window it is already bash, already inside Linux, already at the project root. Everything goes here — `git`, `pnpm`, `npx tsc --noEmit`, `npx eslint .`, `claude`.

**Run two terminals.** Click `+` in the terminal panel for a second, and the split-pane icon to view both at once:

- one running `claude`
- one for git, typecheck and lint

Otherwise you have to interrupt a Claude Code session every time you want to check `git status`.

### Reading diffs — the Source Control panel

`Ctrl+Shift+G`. Click any changed file for a side-by-side diff with changes highlighted. This is where VS Code genuinely beats the terminal, and it is the main reason to use it: reviewing what an agent changed is most of the work.

Suggested split: **read in the panel, act in the terminal.** Review visually, then stage and commit with commands so the muscle memory sticks. The panel can stage and commit too if you prefer clicking.

### Claude Code in VS Code

Two options:

1. **Integrated terminal** — just run `claude`. Same as you've been doing. Recommended while the habits are forming.
2. **Extension sidebar** — the Claude Code extension adds a panel with inline diff review.

Start with the terminal. Add the sidebar once the terminal flow feels automatic.

### Useful keys

| Key | Does |
|---|---|
| `` Ctrl+` `` | Toggle terminal |
| `Ctrl+Shift+G` | Source Control panel |
| `Ctrl+P` | Jump to a file by name |
| `Ctrl+Shift+F` | Search across the whole repo |
| `Ctrl+B` | Toggle the sidebar for more room |

---

## 5. Claude Code — the minimum worth knowing

Four things. Everything else can wait.

### Starting a session

```bash
cd ~/code/summer-ice
claude
```

Always from the project root, so it can see `CLAUDE.md`, `docs/` and `.claude/rules/`.

### Modes — `Shift+Tab` cycles

| Mode | What it does |
|---|---|
| **Plan** | Reads and proposes, changes nothing until you approve |
| **Normal** | Asks permission before each action |
| **Auto** | Runs without asking, within configured limits |

**Use Plan mode for anything structural.** For a schema or a concurrency change, let it produce a plan, read the plan, then approve. That's where you catch a wrong approach for free — before any files move.

### Undo — `Esc` twice, or `/rewind`

Checkpoints let you roll back to any earlier point in the session, including file changes. This replaces the `git reset --hard` panic from previous attempts. If a session goes sideways, rewind rather than trying to repair it forward.

### Ending a session

```
/clear
```

One task per session, `/clear` between them. Long sessions drift; fresh context stays on-spec.

### Other commands worth knowing

| Command | Use |
|---|---|
| `/model` | Switch model mid-session |
| `/memory` | View and edit what it remembers about the project |
| `/context` | See what's consuming context |
| `/permissions` | Manage what runs without asking |
| `/feedback` | Report a problem to Anthropic |

---

## 6. What we are deliberately NOT setting up yet

Recorded so it's a decision rather than an oversight.

| Thing | Why not yet |
|---|---|
| **Superpowers plugin** | Most of what it provided — planning, TDD workflows, subagents — is now native. Adding an unfamiliar layer while relearning the tool costs more than it gives. Revisit at Phase 3. |
| **Hooks** | Auto-running `tsc` after edits is genuinely useful, but it's config that fails confusingly. Add once the schema work makes it worth it. |
| **Subagents / agent teams** | For parallel work across a large codebase. There isn't one yet. |
| **MCP servers** | No Supabase or Vercel any more. A GitHub MCP may be worth it later for PR review. |
| **Preview server / visual verification** | Matters from Phase 6, when there's UI to look at. Nothing to see yet. |

The principle: add tooling when a real problem calls for it, not in advance.

---

## 7. Daily routine

```bash
# 1. Open Ubuntu (taskbar)

# 2. Go to the project and open the editor
cd ~/code/summer-ice
code .
```

Everything after that happens inside VS Code. Confirm bottom-left reads `WSL: Ubuntu-24.04`, then `` Ctrl+` `` for a terminal:

```bash
git status
git log --oneline -5
claude          # in one terminal; keep a second free for git
```

After a Claude Code session finishes:

```bash
npx tsc --noEmit        # project-wide, never on single files
npx eslint .
git log --oneline -3    # confirm it committed what it said
git push                # push when you're happy
```

---

## 8. If something goes wrong

| Symptom | Fix |
|---|---|
| `command not found` for node/pnpm/claude | Wrong shell — check the prompt says `michael@...:~$` not `PS C:\>` |
| `command not found` after installing something | `source ~/.bashrc` or close and reopen the terminal |
| Docker commands fail in WSL | Docker Desktop → Settings → Resources → WSL Integration → enable Ubuntu-24.04 |
| Everything feels slow | You're probably in `/mnt/c`. `pwd` to check; the project should be under `~` |
| VS Code terminal shows `PS C:\>` | Window isn't WSL-connected. Close it, `code .` from the Ubuntu terminal |
| Stray `*:Zone.Identifier` files appear | Windows download markers flattened by the WSL boundary. Ignored via `.gitignore` |
| Claude Code session went wrong | `Esc` `Esc` or `/rewind`, don't repair forward |
| Lost track of what changed | `git diff` for unstaged, `git diff HEAD~1` for the last commit |

---

## 9. Current state

- **Repo:** `~/code/summer-ice`, remote `git@github.com:avs5221/summer-ice.git`
- **Node** 24.19.0, **pnpm** 11.20.0, both inside WSL
- **Committed:** scaffold (`53b4dbf`), TypeScript 6.0.3 pin + ESLint
- **Pushed:** `bad3704` on `origin/main`, three commits, `docs/ARCHITECTURE.md` current
- **Next:** Drizzle schema from `DOMAIN-MODEL.md` (Phase 2)
