# Configuration

Configure this plugin through:

```json
{
  "plugins": {
    "entries": {
      "openclaw-context-handoff": {
        "enabled": true,
        "config": {
          "warnPercent": 50,
          "criticalPercent": 75
        }
      }
    }
  }
}
```

## Fields

### `showAlways`

- Type: `boolean`
- Default: `false`
- Use it when you want every user-triggered turn to include context usage, even before warning
  threshold.

### `warnPercent`

- Type: `number`
- Default: `50`
- The assistant starts warning once usage reaches this percentage.

### `criticalPercent`

- Type: `number`
- Default: `75`
- Once usage reaches this threshold, the plugin injects a stronger reminder
  and the Agent decides whether to create a handoff.

### `handoffEnabled`

- Type: `boolean`
- Default: `true`
- Enables handoff policy injection in the system prompt.

### `handoffDir`

- Type: `string`
- Default: `memory/handoff`
- Must be a workspace-relative path.

### `handoffFilePrefix`

- Type: `string`
- Default: `context-handoff`
- Used in the filename pattern the Agent is instructed to follow.

### `handoffUseTimestamp`

- Type: `boolean`
- Default: `true`
- Controls whether the suggested filename pattern includes a timestamp suffix.

### `handoffInstruction`

- Type: `string`
- Default: built-in instruction
- Lets you override the injected handoff policy text if your workflow needs
  different wording.
- The plugin automatically prepends an internal verification marker, so custom
  wording still shows up as `present` in debug logs when injection succeeds.

## Recommended approach

Start with defaults. Only customize when you have a clear workflow reason.

The safest defaults for most users are:

- `warnPercent = 50`
- `criticalPercent = 75`
- `handoffEnabled = true`
- `handoffDir = memory/handoff`
