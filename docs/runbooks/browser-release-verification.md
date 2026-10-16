# Browser release verification

Verified on 2026-10-16 against the takeover source descended from `518c842`.
These results qualify the browser release and record native package builds; they
do not complete physical Android acceptance.

| Gate | Command | Result |
| --- | --- | --- |
| Behavior regression | `npm test` | Exit 0; 111 passed, none failed or skipped |
| TypeScript and production bundle | `npm run build` | Exit 0; 119 modules |
| Production browser journeys | `npm run test:browser` | Exit 0; 108 assertions in installed Chrome 155.0.8059.82 |
| Independent draft review | Focused Node tests and separate Chrome harness | Exit 0; 21 focused tests and six browser assertions |
| Windows desktop packages | `npm run package:windows` | Exit 0; x64 installer and portable EXE; portable smoke process exited 0 |
| Android package | `npm run package:android` | Exit 0; debug APK built and verified with `apksigner`; no emulator or phone was connected |
| Whitespace check | `git diff --check` | Exit 0 |

For setup, use the README's browser-verification commands. The canonical runner
uses disposable contexts, a production preview at `127.0.0.1:4178`, synthetic
microphone data, and a loopback mock provider. No real API credentials, learner
records, cloud provider, or existing browser profile are used.

The 108 assertions comprise 24 practice/privacy/offline checks, 15 extended
migration/feedback/exam/audio/storage journeys, six draft ownership/deletion
checks, and 63 keyboard/responsive/script/manifest checks. The visual matrix
covers six screens at 320, 390, 768 and 1440 pixels in both themes. All twelve
language directions accept input; Arabic direction attributes and Hindi/Arabic
source rendering were inspected. The manifest parses and declares PNG 192/512px
icons. Chrome reports `in-incognito` as the installability restriction in these
disposable contexts; an actual installed PWA is not claimed.

Independent review reproduced and corrected storage races: a stale tab must read
after claiming the editor; cancellation keeps autosave ownership; retirement
must finish before replacement; deletion releases the old owner; unsaved quota-
failed input still prompts and survives cancellation. Initial delayed/failed
recovery-read and retry branches were source reviewed; they were not independently
fault-injected at the IDB-open boundary. The canonical suite separately checks
denied IndexedDB and recovery behavior.

Final source `src/App.tsx` SHA256:
`E33C2D4FA16E50D11F12C6B2156CD2459AC5F30BE4BCC951394BCF9D3E2EE93E`.
Final production entry `index-COHdJw3N.js` SHA256:
`1BACA9C82BADAC4703F9BAC037681FD4D8F7E0A51170AC592A22298E20DB8088`.
The independent harness used the same reviewed App source before the isolated
multilingual word-count helper was added to the final bundle.

Remaining requirements: interface language selection/translated UI; physical
Android keyboard, back, rotation and interruptions; screen-reader testing;
Android on-device compatibility; actual microphone and cloud behavior; Windows
Electron local-model inference; refreshed model download/inference/device
performance; optional generated drills and unqualified model tiers. Interface
copy remains English. The Windows EXEs are unsigned, and the APK is debug-signed
for sideload testing rather than Play Store distribution.
The local model remains pinned and optional. Lazy loading reduces the initial
entry, but the large model runtime/worker chunks are still precached; Vite emits
a chunk-size warning. Export is reference-only, without import/restore.

No deployed app, production browser database, original worktree, or original Git
branch is changed by verification. Preserve a user's export before adopting a new
release: schema 6 is additive, and rolling back to source that only opens schema 4
requires a compatible migration rather than an IndexedDB version downgrade.
