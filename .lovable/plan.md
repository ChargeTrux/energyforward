# Investor portal button and folder permissions

## Changes
- Move the Videos button from the upper-left to a fixed lower-left position so it stays visible between investor sections.
- Keep the Documents button independent and movable.
- Strengthen folder authorization so assigned profiles are returned only to the signed-in user, and every listed subfolder is verified as part of that user's assigned Google Drive folder tree.
- Verify the existing profile assignment is present and test signed-out denial plus the available preview flow.

## Technical details
- Update the investor portal overlay position without changing portal navigation behavior.
- Add server-side ancestry validation to both folder listing and file opening in the `investor-drive` function; never trust a folder or file ID supplied by the browser.
- Deploy the updated function and check the latest build/runtime signals.
