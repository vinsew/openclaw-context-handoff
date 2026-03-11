# Behavior

## New session behavior

At session bootstrap, the plugin injects a virtual policy file telling the
assistant:

- do not read handoff files by default
- only read a handoff file when the user clearly indicates continuation intent
- read only the latest matching handoff file

This keeps fresh sessions fresh unless the user explicitly wants continuity.

## Warning behavior

Once context usage reaches the warning threshold, the plugin injects a prompt
that tells the assistant context is getting high.

This warning is advisory.

## Critical behavior

Once context usage reaches the critical threshold:

- the plugin writes a handoff file automatically
- the assistant is instructed to move the user toward a new session
- later user additions in the same session can be appended to that handoff file

## Manual handoff behavior

If the user says something like:

- `write handoff`
- `generate handoff`
- `save handoff`

the plugin writes the handoff immediately.

## Handoff file naming

By default:

- directory: `memory/handoff`
- prefix: `context-handoff`
- timestamp: enabled

Typical filename:

```text
context-handoff-202603111945.md
```
