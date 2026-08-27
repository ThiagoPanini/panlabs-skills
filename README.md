# panlabs-skills

Home for this house's [Agent Skills](https://agentskills.io), and the gate that measures whether each one is built well enough to ship.

Two things live here. Under `skills/`, one directory per skill — the product. Under `scripts/`, a gate that reads each of those directories and turns red when a skill is malformed. Everything else records *why* the gate measures what it measures.

> **On language.** Code is English — filenames, directories, identifiers, comments, and anything a program prints. Prose is Portuguese — commits, issues, PRs, ADRs, and everything under `docs/`. This README is the exception, written in English for readers arriving from outside. The rule, and the debt it openly declares, is in [`CLAUDE.md`](CLAUDE.md).

## Layout

```
CLAUDE.md                what an agent must know before writing anything here
CONTEXT.md               the glossary — only terms this repo coined or bent
docs/
  adr/                   decisions, each with the trigger that reopens it
  agents/                doctrine: skills, parallel workflow, tracker, labels
  research/              the primary-source research the rules were built from
  reference/             source material a skill is measured against, kept outside skills/
scripts/
  check-skills.sh        the gate
  check-skills.proof.sh  the gate's own proof
  proof.sh               the proof library, sourced by every *.proof.sh
  checks/                one check family per file, each with its proof beside it
skills/                  one directory per skill
workbench/<skill>/       a skill's sibling workspace: the suite, the corpus and the
                         bench that only that skill needs, kept out of what ships
.github/workflows/       the conveyor — the same commands, run by the server
```

## The gate

```bash
scripts/check-skills.sh --list     # the rules in force, straight from the families
scripts/check-skills.sh            # judge every skill against every family
scripts/check-skills.proof.sh      # plant every defect again and demand red
```

The exit code is the whole point: `0` when every skill clears every family, non-zero the moment one does not. Run the first two before opening a pull request — the conveyor runs exactly the same commands, and finding red on your own machine costs seconds instead of a cycle.

Five conventions hold the harness together, and anything added later inherits them.

**A skill is discovered, never registered.** Every directory under `skills/` is a skill by existing. A registry is a place someone forgets to register, and a skill missing from one is a skill nothing measures. Symmetrically, a gate that finds nothing to measure fails loudly instead of reporting a vacuous green.

**A check family is its own file.** `scripts/checks/<name>.sh` is an executable program with two verbs: `--describe` prints one line per rule it enforces, and `<skill-dir>` judges one skill, printing one line per failure. Families are discovered by scanning, the same way skills are, so adding one adds a file and touches nothing shared.

**`--list` is the list.** The runner reads the rules off the families themselves, and no document keeps a copy. A copied list is a second source nobody updates in the same commit as the first, and the stale one is always the one the next reader reads.

**Every family ships with a proof.** `<name>.proof.sh` plants the defect in a throwaway tree and demands the family go red. A check that has only ever been seen green is documentation — it passes by vacuity when its query is wrong, and nothing in the real tree fires it often enough for anyone to notice. The proof is a gate on the server too, for the same reason: a proof no server runs is itself only ever seen green.

**There is no warning tier.** No exemptions, no per-skill config, no baseline of known failures — three names for the same hole, and the one an agent in a hurry uses to switch a check off instead of fixing the diff. A rule not worth failing on is not worth being a check, and belongs in the doctrine instead.

## Two layers of rules

Not everything worth demanding can be demanded by a script. Rules here are split by *who enforces them*, and every new rule declares its layer before it exists — decided in [ADR 0001](docs/adr/0001-estrutura-vira-portao-o-merge-continua-na-mao.md).

| | Structure rule | Session rule |
| --- | --- | --- |
| The question | is this skill well built? | does this merge lie? did this suite break? |
| Answered by | mechanical reading of one tree | judgement, by a person reading two |
| Lives in | a check family; `--list` prints it | prose — `CLAUDE.md` and `docs/agents/` |
| Enforced by | the server, blocking the merge | nobody but you |

The cut is not arbitrary. A gate is worth its lock when the failure names its own fix: *"this skill has no `SKILL.md`"* and *"this path is cited and does not exist"* leave nothing to overrule, so locking them costs no one anything. *"These two branches touched the same file"* does leave something to overrule, and in a one-maintainer repo the person the lock blocks is the same person who would have to do the judging.

## Anatomy of a skill

The only mandatory file is `SKILL.md` at the root of the directory. A skill may hold whatever else its work needs — an empty `references/` created to look conformant is weight without function. The frontmatter carries `name` (which must equal the directory name) and `description`.

What the gate cannot judge matters at least as much as what it can, and the largest item is the `description`: it is loaded on *every* invocation while the body of `SKILL.md` is loaded on *none* until the description earns it, so a description that says only what the skill does is a skill that exists and never fires. That, progressive disclosure, scope, and the concrete damage each check family exists to prevent are in [`docs/agents/skills.md`](docs/agents/skills.md). Read it before creating a skill or editing a `SKILL.md`.

## Adding a rule

Decide the layer first.

- **Worth failing a merge over, and the failure names its own fix?** It is a structure rule. Write `scripts/checks/<name>.sh` with the two verbs, write `<name>.proof.sh` beside it, and `--list` starts printing it. Nothing else changes — there is no registry to update.
- **Needs judgement, or a false positive would cost more than the defect?** It is a session rule. It becomes a section of [`docs/agents/skills.md`](docs/agents/skills.md), carrying the damage that motivated it.

## CI

[`.github/workflows/skills.yml`](.github/workflows/skills.yml) runs `scripts/check-skills.sh` and `scripts/check-skills.proof.sh` — the same commands anyone runs locally. Nothing is reimplemented there: a rule written twice is a rule that eventually diverges, and the day it diverges the gate measures something nobody can reproduce on their own machine.

Both jobs run on every push and every pull request, and both are required checks on `main`. The overlap on a branch with an open pull request is deliberate, because the two runs do not read the same tree: a `push` run checks out what was pushed, a `pull_request` run checks out the *merge result*, which is what would actually land. A branch that is green alone and red once merged is a failure only the second run can see.

## Working here

Several sessions work in this repo at the same time, one ticket each. Issues live in GitHub Issues and are driven entirely through the `gh` CLI. The rules that keep parallel sessions from breaking each other — declare territory before the first write, compare your diff against what landed on `origin/main` while you worked, append to ordered registries at the end and never in the middle, and let a ticket that moves or deletes tracked paths run alone — are in [`docs/agents/workflow.md`](docs/agents/workflow.md), each written against a collision this repo actually took.

Done means the commit is on `main`. A branch is not done, and an open pull request is not done.
