# Film-first preview and memory measurements

The measured optimization reduced adjustment-burst latency, main-thread long tasks and observed memory peaks. Individual adjustments became slower at both widths, and narrow-screen film changes also became slower; those regressions remain explicit. This report covers issues #14/#15; it does not replace the editor, output, loading or cancellation correctness checks.

## Measured before/after comparison

Root executed the complete workload on 2026-10-01 against frozen correctness revision `47829db`, after the CI-equivalent Chromium suite passed. The snapshot had no Git directory; its measured source/config/lockfile SHA256 is `93a29a2a0d75ca855728bac0615452ecea602ac898ceb9349eda0e20b059c43a`. The lockfile SHA256 is `a4e066ed58d95c0032ecd02ac8b762613a12a011e68e1bf7576947a28f302448`. Browser: headless Linux Chromium `151.0.7922.173`. Reported baseline initial host load averages: `0.00 / 0.53 / 1.07`. Root then ran the identical temporary benchmark and exact fixtures against frozen optimized revision `47b3e44`, source/config/lockfile SHA256 `a2566088cb74b0b59c01854efcf467f1fb408edfce1443948af43b0e21c9900e`, with the same browser and lockfile. The final post-optimization CI-equivalent Chromium run subsequently completed: 165 passed, three skipped, 168 total in 5.0 minutes. The skips and browser/device gates remain separately reported by the release acceptance record; this performance benchmark does not replace those checks.

All before/after 1200×900 and 393×900 CSS-pixel runs completed every action without an action failure. Each viewport used six film changes, six individual adjustments and six eight-key adjustment bursts. The first pair used one full run per revision/viewport with six interaction trials. A second complete paired process run is reported below; two runs do not establish confidence intervals or cross-device distributions.

| Measurement | Before, 1200px | After, 1200px | Before, 393px | After, 393px |
| --- | ---: | ---: | ---: | ---: |
| Film-change median | 523.35 ms | 343.05 ms | 289.10 ms | 345.80 ms |
| Individual Highlight median | 248.80 ms | 290.55 ms | 252.45 ms | 277.10 ms |
| Eight-key Highlight burst median | 1447.70 ms | 455.10 ms | 1434.35 ms | 370.65 ms |
| Main-thread long-task duration, whole workload | 16,366 ms | 1,315 ms | 13,780 ms | 1,293 ms |
| Peak CDP backing storage | 736.87 MB | 394.47 MB | 723.05 MB | 393.69 MB |
| Peak JS used heap | 54.74 MB | 27.63 MB | 53.49 MB | 26.87 MB |
| Peak Chromium process-tree RSS | 2300.48 MB | 1468.84 MB | 2034.95 MB | 1360.42 MB |

Desktop film-change median improved 34.5%, and eight-key bursts improved 68.6% desktop / 74.2% narrow. However, individual Highlight changes regressed 16.8% desktop / 9.8% narrow, and narrow film changes regressed 19.6%. These single-run comparisons do not establish confidence intervals; the residual worker/scheduling latency merits further measurement. Moving preview processing to the existing worker reduced measured main-thread long-task duration 92.0% desktop / 90.6% narrow, which supports improved main-thread availability but does not prove lower total CPU work. Peak backing storage fell 46.5% desktop / 45.6% narrow; process-tree RSS fell 36.2% desktop / 33.1% narrow.

Memory units above are decimal MB, and the three memory measurements describe different scopes. RSS sums resident pages across Chromium processes and can count shared pages more than once. It must not be interpreted as an absolute safe device limit. CDP backing storage includes renderer-observed backing allocations and is distinct from JS used heap; it does not attribute every worker, native-image or GPU buffer.

Advanced opened all 12 Velvia recipe previews: 12 observed recipe-canvas writes, of which 10 intersected the desktop panel and four intersected the narrow panel. Subsequent top/bottom browsing used those cached previews and added no recipe-canvas writes in this run. Opening Advanced contributed a 236 ms desktop / 235 ms narrow main-thread long task. After optimization, opening Advanced wrote 10/ 10 visible desktop previews and 4/ 4 visible narrow previews. Browsing added 6/ 6 visible desktop writes and 12/ 12 visible narrow writes, with no offscreen writes observed. Combined writes therefore total 16 after versus 12 before; visibility-triggered cached repaints are counted, so this is not a unique-job count or proof of increased processing. The observed change defers offscreen work until needed rather than rendering every recipe at open.

Both before/after single exports decoded as JPEG at 3000×4000 pixels after quarter-turn and fine-angle editing. Both ZIPs contained exactly four JPEGs: the edited first photo at 3000×4000 and the other three at 4000×3000. Each member retained 12 MP in every run. Root also compared the actual saved files with Python hashlib/zipfile: the before/after single JPEGs were byte-for-byte identical at both widths, SHA256 `af556b2513393e560e4d8f83dced30502293e740d1752d5c9c5dbfc5155d502a`, size 1,733,490 bytes. All four ZIP member names and complete JPEG member bytes were identical before/after at both widths; member sizes were 1,733,490 / 1,580,830 / 2,662,471 / 1,911,426 bytes. This is exact output evidence for this fixture/workload and does not establish identity for every possible input or edit. Completion/export checks in this workload examine actual downloaded JPEG dimensions and ZIP membership; broader pixel, metadata, audio and cancellation acceptance belongs to the correctness suites.

Complete raw action trials, long-task entries, sampled memory, per-phase peaks, observed buffer allocation shapes/liveness and output metadata are retained in [feature-preopt.json](measurements/feature-preopt.json) and [optimized.json](measurements/optimized.json). This compact JSON preserves the entire dataset rather than only summary numbers. Artifact and fixture paths were relocated to filenames/repository-relative source paths for portability; measurement values were not changed. JPEGs, ZIPs and generated fixtures are not committed.

## Second complete paired run

Root then executed the portable checked-in runner sequentially on an idle host for both revisions, with the same fixtures, Chromium 151.0.7922.173, lockfile and before/after source hashes as the first pair. Runner SHA256: `2efc988b7068d139668c2346b52a757dc1be5f779527d9ab132984554e9fb05b`. The before checkout had clean Git HEAD `47829dbf4c940a44fbbd4c69f1c98398bf1ed18a`; the copied optimized snapshot was labeled `47b3e44`. Host-load averages were 0.08 / 0.11 / 0.39 before and 0.04 / 0.11 / 0.31 after. Both processes exited successfully; all 30 actions at each width completed without an action failure.

| Repeat measurement | Before, 1200px | After, 1200px | Before, 393px | After, 393px |
| --- | ---: | ---: | ---: | ---: |
| Film-change median | 484.55 ms | 336.00 ms | 298.95 ms | 358.95 ms |
| Individual Highlight median | 239.30 ms | 285.25 ms | 289.70 ms | 284.75 ms |
| Eight-key Highlight burst median | 1460.90 ms | 381.15 ms | 1492.65 ms | 427.15 ms |
| Main-thread long-task duration, whole workload | 16,458 ms | 1,330 ms | 14,419 ms | 1,464 ms |
| Peak CDP backing storage | 736.86 MB | 394.47 MB | 723.04 MB | 477.00 MB |
| Peak JS used heap | 49.49 MB | 26.83 MB | 52.79 MB | 30.89 MB |
| Peak Chromium process-tree RSS | 2194.59 MB | 1465.23 MB | 2040.77 MB | 1361.67 MB |

The repeat supports the direction of burst/main-thread/memory improvements and the desktop single-adjustment / narrow film-change regressions. Desktop individual-adjustment median regressed 19.2%, and narrow film-change median regressed 20.1% in the repeat. Every eight-key burst produced six preview paints before and one after, at both widths, supporting actual coalescing at the observed Preview boundary. Burst medians improved 73.9% desktop / 71.4% narrow. However, the narrow individual-adjustment comparison changed direction: first pair was 9.8% slower after, while the repeat was 1.7% faster after. Those observations do not support a stable narrow single-adjustment latency claim.

The optimized narrow backing peak also varied materially: 393.69 MB in the first run versus 477.00 MB in the repeat, both during ZIP export. The repeat peak was 34.0% below its corresponding 723.04 MB baseline, rather than the first pair's 45.6% reduction. RSS remained approximately 1362 MB in the repeat. Sampling, garbage collection, worker/native allocations and browser retention affect these scopes; neither result establishes a portable safe memory limit. Report both runs instead of choosing the smaller peak.

Root again compared actual outputs: single JPEGs and all four ZIP member JPEG bytes/names were byte-for-byte identical between revisions at both widths, with the same single JPEG SHA256 recorded above. Complete repeat evidence is preserved in [feature-preopt-repeat.json](measurements/feature-preopt-repeat.json) and [optimized-repeat.json](measurements/optimized-repeat.json), including all trials, long tasks, buffer telemetry and phase peaks.

Navigation samples cross two separately awaited reads: CDP heap usage and page buffer telemetry. The repeat's first `disposed` sample sometimes included the old context's backing storage while weak telemetry already described the new page, so the phase maximum is not post-GC retained memory. Subsequent final samples were 3811/ 3805 bytes before and 3815/ 3809 bytes after at desktop/narrow respectively, with zero observed live RGBA backing. These transitions stay visible in raw evidence; they are not inferred leaks or total native-cleanup guarantees.

## Buffer lifetime evidence

| Phase | Before, 1200px | After, 1200px | Before, 393px | After, 393px |
| --- | ---: | ---: | ---: | ---: |
| Four-photo load | 386.07 MB | 57.49 MB | 386.07 MB | 57.47 MB |
| Approved rotation | 507.74 MB | 92.76 MB | 469.34 MB | 99.66 MB |
| Fine-angle draft | 569.18 MB | 123.47 MB | 530.78 MB | 130.38 MB |
| Geometry commit | 573.02 MB | 100.44 MB | 626.78 MB | 130.38 MB |
| Single full-resolution export | 669.02 MB | 340.44 MB | 671.51 MB | 331.98 MB |
| Four-photo ZIP export | 736.87 MB | 394.47 MB | 723.05 MB | 393.69 MB |
| Post-export observation | 624.33 MB | 251.57 MB | 624.33 MB | 250.79 MB |
| Navigation away plus explicit GC | 0.0038 MB | 0.0038 MB | 0.0038 MB | 0.0038 MB |

The peak occurred during ZIP export at both widths in both revisions. Weakly observed main-thread RGBA backing reached 705.78 MB before and 377.19 MB desktop / 376.41 MB narrow after in that phase. After navigating away and requesting GC, weakly observed RGBA backing was zero. Chromium process-tree RSS after navigation/GC remained approximately 1122.96 MB desktop / 987.64 MB narrow before, and 846.36 MB desktop / 741.50 MB narrow after; allocator/browser retention and shared pages are outside the weak ImageData attribution, so this is not proof of an application leak or of total native cleanup.

The before-revision eager ownership model had four 12 MP originals totaling 192,000,000 RGBA bytes and four 1600×1200 previews totaling 30,720,000 bytes. Unchanged transformed buffers alias their originals/previews, so those unique owned buffers alone total 222,720,000 bytes. A separately materialized transform for one photo can add 55,680,000 bytes before intermediate buffers, worker transfers, decoded native images, canvases, processing outputs and encoded files. Those values are structural arithmetic, not measured allocation peaks. The optimized ImageItem owns compressed files, source dimensions, previews and edit state, without retained full-resolution original/transformed-original buffers. Four source previews alone total 30,720,000 RGBA bytes; approved transformed previews, current processed preview, recipe/strip caches and transient buffers are additional. Full-resolution decoding/geometry happens on demand for single export and sequentially for batch members. The measured load-phase backing peak fell from 386.07 MB to about 57.5 MB, while full-resolution export still produced 12 MP outputs and transient peaks around 332–394 MB. The raw traces record observed allocation shapes and their phases; worker-internal and native allocations remain only partially attributed. The optimized raw artifact retains the runner's legacy `computedRGBA` arithmetic verbatim, with an explicit annotation that it is the old eager model and not optimized storage or measured memory.

Measurements do not justify raising current upload limits. On-demand decoding must preserve atomic loading, every-photo export, per-photo geometry/color state and exact Retry/cancellation behavior; the measured output workload supports those export/geometry checks, while the wider lifecycle regressions remain separate evidence. A browser RSS peak is not a portable rejection threshold.

## Reproduce the comparison

Install the lockfile dependencies and run the app server separately. The portable runner resolves dependencies and real photo sources from its repository location. It does not start a server, publish anything or add an editor testing API.

```bash
node scripts/benchmark-editor.mjs generate=true out=/tmp/photochrome-benchmark
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/benchmark-editor.mjs mode=integrated label=feature-preopt url=http:// 127.0.0.1:5176 repo=/path/to/frozen-correctness out=/tmp/photochrome-benchmark widths=1200,393 trials=6
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/benchmark-editor.mjs mode=integrated label=optimized url=http:// 127.0.0.1:5173 repo=/path/to/optimized-checkout out=/tmp/photochrome-benchmark widths=1200,393 trials=6
```

`out` defaults to the system temporary directory's `photochrome-benchmark` folder. `executable=/path/to/chromium` overrides the environment variable; otherwise Playwright's installed browser is used. Arguments accept `key=value` or `--key=value`; unknown arguments are rejected. `revision=<label>` can identify copied snapshots without Git metadata. `fixtures=asymmetric` selects the separate diagnostic images; do not compare different fixture sets as optimization evidence. The historical baseline selector branch is not the integrated comparison protocol.

The original measured temporary runner was used for the optimized comparison with the same fixtures and arguments. The checked-in runner retains the same actions, latency rule and sampling workload while adding portable path/configuration and argument handling. Future reproductions should serve isolated checkouts of `47829db` and `47b3e44`, and invoke this checked-in runner for both sides with `repo` pointing to each served checkout and identical fixtures, browser instrumentation and dependencies. The second completed pair used this portable runner; further repetitions remain useful for estimating variance. The runner records its methodology/script hash, server source/config/lockfile hashes and fixture hashes. Specify `repo` accurately: the runner cannot infer source files from a URL.

Use an idle host; do not overlap unit tests, E2E suites, builds or other benchmarks. Repeating both full runs assesses host/GC noise. The runner reports failed actions separately and exits unsuccessfully if the workload aborts or an action fails; exclude failed actions from latency claims.

The default real-photo fixtures use three repository Unsplash WebP photos plus an alternate crop of the first, resized/cropped to 4000×3000 and JPEG quality 92. They provide real photo content at 48 MP total, but are resampled inputs, not native 12 MP camera captures. Compressed sizes are 1,178,952 / 1,100,126 / 1,781,210 / 1,346,311 bytes; source dimensions and SHA256 values are in the evidence. All remain within existing upload limits. Generated asymmetric diagnostic fixtures remain separate.

The exact integrated workload is: import four photos; alternate Provia/Velvia six times; open Advanced Recipes and scroll top/bottom four times; switch to Manual; six Highlight changes and six eight-key bursts; Cancel; use R for approved quarter-turn; open Crop and adjust fine angle; commit; blur focused controls and Ctrl+S for single export; return to editor; Apply color to all; export every photo as ZIP; return to editor; sample post-export; navigate away and explicitly request GC. Ctrl+S exercises the normal single-export command even when the narrow batch toolbar exposes Export all.

## Measurement boundaries and pending gates

Latency is action start to the last existing Preview canvas `putImageData`, followed by a 250 ms quiet period. The quiet period establishes settlement but is excluded from reported latency. This measures CPU canvas-write completion, not GPU display presentation or physical-device touch-to-photon latency. Non-paint actions retain elapsed times with a fixed observation window and must not be presented as rendering latency. Long tasks are entries starting between action start/end; a task that starts just before the timestamp can be excluded.

Memory samples run approximately every 150 ms and can miss briefer peaks. ImageData-constructor and Canvas-getImageData wrappers record deduplicated ArrayBuffer shapes and weak liveness on the main thread. They exclude detached buffers, do not retain image buffers strongly, and do not observe every worker-internal/native/GPU allocation. WeakRef sampling can influence object liveness during each sampling job; use identical instrumentation in both runs. A navigation-time sample reported a destroyed execution context; all workload actions nevertheless completed, and later disposal samples succeeded.

Two complete paired process runs have now been recorded. More repetitions, confidence intervals and follow-up on the observed latency regressions remain pending; this evidence does not imply a cross-device performance distribution. Failure, cancellation, atomic append/replace, stale operations and exact-request Retry require their existing lifecycle tests, not inferred success from this measurement. Physical mobile-device performance/memory, Firefox/Safari comparisons, native allocation attribution, varied real camera inputs and portable device-safe budgets remain unverified.
