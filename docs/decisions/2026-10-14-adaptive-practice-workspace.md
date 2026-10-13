# Adaptive practice workspace

The recovered implementation already includes written/news practice, exam recovery,
local audio interpreting, optional WebLLM, and per-task cloud consent. The takeover
starts from `518c842`, preserving the unpushed reliability fixes after PR #2.

## Direction

Choose a quiet blue/teal study desk over a gamified dashboard or a dense document
manager. A paired source/answer surface is the signature interaction. Desktop uses
a compact collapsible rail and side-by-side panes; phones use bottom navigation
and explicit source/answer switching. System fonts avoid remote font requests and
support CJK, Cyrillic, Devanagari, and Arabic.

Tokens: ink `#172b43`, muted `#52657b`, canvas `#f4f7fb`, surface `#ffffff`,
accent `#175ac0`, secondary `#11776e`. Dark surfaces use `#101a29`/`#18263a`
with pale blue text. Controls have at least 44px touch targets, visible focus,
logical spacing, and reduced-motion support.

## Acceptance

- The complete existing test suite and production build pass.
- Written answers and elapsed time survive reload and navigation; failed storage
  never reports a successful save. Deliberate discard asks before losing an answer.
- Desktop source/answer panes, mobile pane switching, adjustable typography,
  timer pause, and keyboard submission work without altering exam clocks.
- Light/dark/system themes persist; preference changes never enable remote AI.
- Catalog passage selection exposes every available passage, not only the first.
- Local glossary/mistake cards have editable notes, deterministic spaced review,
  deletion, and versioned export; no network is involved in learning tools.
- Home continues saved written work; feedback reveals evidence progressively.
- Phone/tablet/desktop browser QA checks full workflows and overflow in both themes.

## Platform decision

Retain the installable PWA. Introducing a native wrapper before device-specific
WebGPU and microphone qualification would imply support that has not been tested.
Windows browser QA and mobile viewport QA are distinct from physical Android,
Android back/keyboard, native package, and real microphone/model qualification.

Reference entry points consulted: [DeepL](https://www.deepl.com/en/translator),
[Material navigation](https://m3.material.io/components/navigation-bar/overview),
and [Fluent navigation](https://fluent2.microsoft.design/navigation). The latter two
returned a JavaScript-only page and an unavailable page respectively in this
environment, so no unobserved product behavior is claimed from them.

## Remaining plan boundaries

The deterministic portion of personalized practice now includes feedback ratings,
false-positive exclusion, catalog suggestions, mastery status, and temporary
notebook reconstruction. Optional model-generated drills and multilingual
generation quality still require separate measured behavior; catalog selection
and self-review do not qualify a generative model.
Interface translation, physical device QA, native distribution and performance
qualification remain explicit requirements, not completed by visual polish.

## Recovery and storage invariants

The singleton written draft has one held Web Lock owner. Every handoff reads the
authoritative IndexedDB value after acquiring ownership; a stale Home snapshot
cannot overwrite a newer tab's answer. Replacement confirmation covers both
persisted text and the current owner's unsaved text. A failed initial read never
enables persistent autosave. Retirements are serialized and bound to the original
owner and data generation. Successful saved feedback retires the draft while
keeping the current review/revision owner until exit. Data deletion suppresses
new draft opens and writes, rejects call-time stale epochs, and releases the old
owner after its writes drain. Schema 6 and export 5 are additive changes.
