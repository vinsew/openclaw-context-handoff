# Behavior

## System prompt behavior

On user-triggered runs, the plugin injects a handoff policy into the system
prompt. That policy tells the assistant:

- do not read handoff files by default
- only read a handoff file when the user clearly indicates continuation intent
- when writing a handoff, use a workspace-relative path and report that
  relative path back to the user

The plugin provides the rules; the Agent decides whether a handoff should
actually be written.

## Warning behavior

Once context usage reaches the warning threshold, the plugin injects a prompt
that tells the assistant context is getting high.

This warning is advisory.

## Critical behavior

Once context usage reaches the critical threshold:

- the plugin injects a stronger reminder
- the assistant is instructed to judge whether the current progress should be
  preserved as a handoff
- if the assistant decides to write one, it follows the injected handoff policy

## Handoff file naming

By default:

- directory: `memory/handoff`
- prefix: `context-handoff`
- timestamp: enabled

Typical filename:

```text
context-handoff-202603111945123-session.md
```
