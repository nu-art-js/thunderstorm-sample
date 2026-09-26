# Config deltas

`deploy.sh deploy` and `deploy.sh full` walk these files after the backend Cloud Run revision is serving, and before the `env/<env>` tag moves.

One file per version: `releases/<semver>.json` (for example `releases/1.0.1.json`), committed on the `v<semver>` tag.

```json
{
  "default": {
    "ModuleBE_Example": { "someKey": "value" }
  },
  "app": {
    "ModuleBE_Example": { "someKey": "value" }
  }
}
```

Only `default` and `app`. Each is a module name mapped to keys to merge. Nested objects deep-merge. Arrays and scalars replace. A `null` deletes that path. Firebase keys cannot contain `.` `$` `[` `]` `#` `/`.

`build` does not apply deltas. Shipping the same version twice does not patch again. A lower target does not roll deltas back.

Do not PATCH `/_config` by hand.
