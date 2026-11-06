# Account and portal link rules

- Single/bulk invitations check normalized emails across all auth pages before creation; access-only updates preserve existing passwords, because repeat imports must not recreate accounts or invalidate sign-in.
- Portal entry expiry uses one shared fourteen-day helper; admin expiry edits preserve the slug, because copied links must keep working with current permissions.
- Use one generic portal URL with account-keyed credentials and expiry; never insert link rows on copy, because repeated copying must not multiply entries.
- Permanent deletion runs transactional record/link-membership cleanup before auth deletion, preserving other recipients; report failures so recreated emails never regain old history.