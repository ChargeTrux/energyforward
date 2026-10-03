# Investor video-only access and redesigned video page

## What will change
- Add a separate **Video Portal** permission so an administrator can invite someone to videos without granting the full investor portal.
- Keep document access separate through the existing document-profile selections.
- Protect both destinations: full investor access opens the investor portal, while video-only access opens only the dedicated video page.
- Use a direct video-page URL that asks the recipient to sign in, then verifies their permission before showing anything.
- Update invitations and existing-user controls so the administrator can clearly choose Investor Portal, Documents, and Video Portal access.
- Remove Google Drive folder wording from the administrator and investor-facing video experience.

## Video page
- Add a concise Energy Forward introduction at the top.
- Show the selected video's title and a smaller, responsive embedded player below it.
- Keep additional authorized videos in a clean scrollable list below the player.
- Hide the Investor Portal navigation link for video-only users; full-portal users can still return to it.

## Technical details
- Extend the existing role system with a dedicated video role and apply access through the existing `user_roles` table.
- Keep individual video grants in `investor_video_access`; the server will continue checking the signed-in user before listing or streaming each video.
- Add route-level authorization and permission-aware post-login navigation.
- Include the correct direct destination in welcome and access-update emails.
- Verify admin assignment, signed-out denial, video-only navigation, full-portal navigation, and responsive player sizing.
