# Configuration

Configure this plugin through:

```json
{
  "plugins": {
    "entries": {
      "context-monitor": {
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
- Use it when you want every turn to include context usage, even before warning
  threshold.

### `warnPercent`

- Type: `number`
- Default: `50`
- The assistant starts warning once usage reaches this percentage.

### `criticalPercent`

- Type: `number`
- Default: `75`
- Once usage reaches this threshold, the plugin writes a handoff file
  automatically and pushes the conversation toward a fresh session.

### `handoffEnabled`

- Type: `boolean`
- Default: `true`
- Enables startup bootstrap policy injection for new sessions.

### `handoffDir`

- Type: `string`
- Default: `memory/handoff`
- Relative paths resolve from the OpenClaw state directory.

### `handoffFilePrefix`

- Type: `string`
- Default: `context-handoff`
- Used when generating handoff filenames.

### `handoffUseTimestamp`

- Type: `boolean`
- Default: `true`
- Adds a timestamp suffix to generated handoff files.

### `handoffInstruction`

- Type: `string`
- Default: built-in instruction
- Lets you override the bootstrap policy if your workflow needs different
  wording.

## Recommended approach

Start with defaults. Only customize when you have a clear workflow reason.

The safest defaults for most users are:

- `warnPercent = 50`
- `criticalPercent = 75`
- `handoffEnabled = true`
- `handoffDir = memory/handoff`
