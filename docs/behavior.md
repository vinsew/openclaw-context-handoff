# Behavior

## System prompt behavior

On user-triggered runs, the plugin injects a handoff policy into the system
prompt. That policy tells the assistant:

- do not read handoff files by default
- only read a handoff file when the user clearly indicates continuation intent
- when writing a handoff, use a workspace-relative path and report that
  relative path back to the user
- when the user says to continue, treat the latest handoff report as the main
  continuation context and read it in full instead of relying on a tiny summary

The plugin provides the rules and trigger conditions. Once a handoff trigger
fires, the Agent must write or update the handoff instead of deciding whether
the conversation is "worth" handing off.

The handoff is expected to be a full continuation report rather than a short
summary. It should be detailed enough for a fresh AI instance to continue
without rereading the earlier conversation.

Detail preservation is the priority. If the assistant is unsure whether a
detail may matter later, it should keep that detail instead of compressing it
away.

## Warning behavior

Once context usage reaches the warning threshold, the plugin injects a prompt
that tells the assistant context is getting high.

This warning is advisory, but it is meant to push the assistant to start
organizing a high-quality handoff before the critical threshold is reached.

## Critical behavior

Once context usage reaches the critical threshold:

- the plugin injects a stronger reminder
- the assistant is instructed that handoff execution is mandatory
- the handoff should be written as a comprehensive Markdown report
- even chat, brainstorming, or idea exploration must still be handed off with
  enough detail to continue later

## Handoff file naming

By default:

- directory: `memory/handoff`
- prefix: `context-handoff`
- timestamp: enabled

Typical filename:

```text
context-handoff-202603111945123-session.md
```
