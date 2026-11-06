# Account and portal link rules

- Single/bulk invitations check normalized emails across all auth pages before creation; access-only updates preserve existing passwords, because repeat imports must not recreate accounts or invalidate sign-in.
- Portal entry expiry uses one shared fourteen-day helper; admin expiry edits preserve the slug, because copied links must keep working with current permissions.