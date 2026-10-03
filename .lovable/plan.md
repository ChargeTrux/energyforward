# Video descriptions and faster playback

## What will change
- Restyle the title above the active video with a smaller, cleaner hierarchy and improved contrast.
- Show a description with each video on the investor video page.
- Add an administrator editor for reviewing and saving each video's description.
- Automatically prefer a same-named text or Word document from the video folder; use the administrator's saved description only when no matching document exists.
- Improve playback startup by streaming directly with byte-range requests instead of downloading the entire video before playback.

## Technical details
- Add a protected video-description table keyed by Google Drive video ID, with administrator-only write access.
- Extend the authenticated video function to find same-basename `.txt`, `.doc`, or `.docx` files and extract their text through Google Drive; descriptions from matching documents override manual entries.
- Add administrator-only read/save description actions to the existing secure video function.
- Return descriptions with the authorized catalog while keeping Drive file and folder URLs private.
- Replace whole-file Blob loading with authenticated media requests that preserve byte-range streaming for faster startup and seeking.
- Remove autoplay entirely; when a video ends, select the next authorized video but wait for the viewer to press Play.
- Verify signed-out denial, administrator editing, automatic document descriptions, fallback manual descriptions, and desktop/mobile video presentation.
