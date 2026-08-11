# UX Requirements: Shower Studio — Main Page

This document describes the functional and interaction requirements of the main page, independent of any specific visual design. It is meant as input for designing a new UI — it specifies *what information must be shown*, *what actions must be available*, and *how the interface should behave*, but not layout, sizing, color, or positioning.

## Persistent Elements
Available on every screen regardless of connection state:
- App identity/branding.
- A way to open **Settings** (token/config entry point) at all times.
- A way to trigger a manual **re-sync** with Raindrop — only relevant/available once a connection exists.

## Connection States
The page has three top-level states. Only one is shown at a time.

### 1. Initializing
Transient state while local state (token, cached data) is being read. Communicates that loading is happening. No user actions available.

### 2. Not Connected
Shown when no Raindrop token is present. Must communicate:
- What connecting unlocks (the app imports characters and style packs, and lets the user assemble a generation payload).
- Two distinct paths to connect: an OAuth login flow, and a manual-token entry path (via Settings). Both must be independently discoverable and clearly distinguished as alternatives to each other.
- OAuth path must reflect an in-progress/connecting status while the redirect is being requested.

### 3. Connected (Workspace)
The main working state. Must communicate sync status after any fetch/refresh (success with a summary of what was loaded, or an error with a way to jump to Settings to fix it). The workspace itself is organized around three sequential concerns, in order:

1. Choose one or more **characters**.
2. Choose one **style**.
3. Define **composition parameters** and hand off the result.

The page should convey that step 3 depends on / follows from steps 1–2, but user is free to revisit and change earlier choices at any time (state is not locked once "used").

## Functional Requirements by Concern

### Character Selection
- Display all synced characters, each with: an image (or a placeholder if none), a name, and optional descriptive text.
- Support selecting **multiple** characters; selection state must be visually distinguishable per item and the current count of selections must be visible somewhere.
- Support clearing all selections at once.
- Support filtering/narrowing the character set **by tag** — tags are derived from character metadata, each tag shows how many characters carry it, and selecting a tag should bulk-select (or bulk-deselect, if already fully selected) every character with that tag.
- Support adding a new character: name (required), descriptive text, an image (upload), and tags (freeform, added incrementally, removable before saving). This must work whether or not the user is connected to Raindrop (falls back to a local-only entry when there's no token).
- Support editing an existing character's same fields (name, description, image, tags).
- Support deleting a character, gated behind an explicit confirmation step since it's irreversible (for Raindrop-backed items).
- Handle and surface: empty state (no characters synced yet, with guidance on how to get some), loading state (fetch in progress), and per-action errors (e.g., add/edit/delete failed).

### Style Selection
- Display all synced style packs, each with: a preview image (or placeholder), a name, and a short excerpt of its style prompt.
- Support selecting **only one** style at a time; choosing a new one replaces the previous choice. Support clearing the selection entirely.
- Support inspecting a style in more detail without changing the selection — full style prompt text, any extra style instructions, and any additional reference images associated with it. This must be a separate action from selecting, so users can browse/compare before committing.
- Handle empty and loading states, matching the character section's pattern conceptually (not necessarily visually).
- Selecting a style should give the user a cue that they can now proceed to the next step (mechanism is up to the new design — does not have to be a scroll).

### Composition & Handoff
- Summarize the current selections (which characters, which style) so the user can confirm their choices before writing a prompt, including an explicit empty/"none selected" state for each.
- Provide a free-text field for describing the desired composition (scene, action, framing, mood). Support clearing it, and recall previously-used prompts (a short history) so users can reuse or delete past entries.
- Provide choices for: generation model, output aspect ratio, and output text language — each a fixed set of options.
- Provide two outputs from this data:
  1. **Copy** the assembled parameters (characters, style, model, ratio, language, instruction) as structured data to the clipboard, with confirmation that the copy succeeded.
  2. **Open** an external image-generation app in a new context, passing the same assembled parameters along — requires a valid connection; surface a clear error if the app URL can't be resolved or no token is available.
- Provide a way to reset every input in this section (and the upstream selections) back to empty/default in one action.
- Support a keyboard shortcut for the primary "open app" action while composing the prompt.

## Cross-Cutting Behaviors
- **Persistence**: settings/token, synced characters & styles, current selections, and prompt history should all survive a page reload without requiring the user to redo work or re-fetch unnecessarily.
- **Errors are actionable**: any error state related to missing/invalid configuration should offer a direct path to Settings, not just a message.
- **Non-destructive by default**: only deletion (character) and full reset require explicit confirmation or are otherwise clearly signposted as irreversible; everything else (selecting, editing text, changing dropdowns) is freely reversible.
- **Independent secondary actions**: "view details" (style inspect, character edit) must never be conflated with the primary selection action — a user should be able to inspect/edit an item without accidentally changing what's selected for generation.

## Explicitly Out of Scope for This Doc
Visual hierarchy, spacing, color, iconography, grid/column counts, modal vs. inline patterns, animation, and exact copy/wording are all left to the new design — only the underlying information and interactions above must be preserved.
