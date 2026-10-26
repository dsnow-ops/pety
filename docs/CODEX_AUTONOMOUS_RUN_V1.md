# 归爪自主质量收敛 V1

## Current Goal
遵照 2026-09-06 用户附件：保留已验证架构与成果，先审计形象主链路、对话及 Similar Case，再实施低风险 P0/P1，循环测试、编译、工程/UX/QA 审查。禁止 commit/push、真实配置改动、uni_modules 改动和无必要付费调用。

## Baseline
- Branch: `feature/calendar-persona-auth-polish-v1`; starting `git status --short`: empty.
- `node --test tests/*.test.cjs tests/*.test.mjs`: 24/24 test files passed.
- Existing docs contain historical mock/future/memorial descriptions; current code and user's current/deceased requirements take precedence.
- Read-only agents: engineering/async, product/UX, QA/security. Main agent alone edits.
- Real provider calls: Wan initial 0, Wan revision 0, DeepSeek search 0, VIAPI 0.

## State flow and plan
1. Photo slots → `uploadAvatarSourceImages` → `createAvatarJob` → api_pet_avatar create/processor → Wan → status polling → candidate cloud save → local session merge.
2. Candidate canonical fileId → separate URL caches → hidden image preload → same mounted particle canvas → reveal → history selection → confirm final copy/verify → pet-store + handoff → home → asynchronous cutout/cleanup → quality-ranked Hero.
3. Audit ownership at every async boundary, stale URL recovery, preload identity, confirm exclusivity, revision master/receipts/quality gate.
4. Audit DeepSeek capability scope/persona; Similar Case claim/normalize-once/status/open-original.
5. Implement independently reproducible P0/P1 with behavioral regression tests; run full tests, static checks, diff review, secret-safe tracked-file checks, locked prompt hash, Android/H5 compile.
6. Repeat engineer, UX and adversarial QA review; address new findings and rerun relevant/full validation before final report.

## P0
- Closed: stale home cutout/hydration responses cannot update another pet or a newer final image.
- Closed: candidate hydration, preload events and reveal timers are identity-bound; switching B while A finishes cannot reveal A.
- Closed: avatar create has client single-flight plus server atomic lock; confirm is locked and idempotent.
- Closed: Similar Case requires a persisted rate-limit authorization before an atomic provider claim, and only verified citation/source URLs are rendered.

## P1
- Closed: expired Hero URLs rehydrate once, then fall through the quality-ranked asset list without showing another pet.
- Closed: avatar errors are localized safe copy; photo permission denial has a system-settings recovery route.
- Closed: leaving chat during an in-flight response persists an explicit retryable interruption instead of leaving a dangling user message.
- Closed: reduced-motion mode stops particle movement, reveal/spinner motion and chat/search loading animation; primary new controls meet the 88rpx touch target used for 44px designs.

## P2
- Existing calendar draft recovery and broader legacy screen localization remain product polish. No new menu, service or architecture was added.

## Fixed
- Storage normalization and migration now produce only `current` or `deceased`; legacy `future` pets and chat sessions migrate to `current`. No `memorial` relationshipStage was added.
- Avatar candidate history uses stable copies, preserves the current master while the next candidate preloads, ignores stale events/timers, bounds preload to 20 seconds, and resumes a hidden-page preload on return.
- Home Hero is keyed by pet, validates every async owner boundary, keeps a same-pet placeholder/previous asset while loading, refreshes expired URLs, and isolates cutout cleanup per pet/job.
- `createAvatarJob` is single-flight on the client. The cloud function uses insert-or-compare-and-swap locking, so simultaneous create requests cannot both invoke Wan.
- Repeated avatar confirmation reuses an existing verified final file and preserves completed cutout state. Job polling retains main-asset metadata.
- Similar Case now distinguishes results with links, results without links and no results. Unverified annotation/query URLs, credential-bearing URLs, malformed HTTPS URLs and unsafe schemes cannot become source buttons.
- Similar Case pending jobs cannot be claimed before rate-limit authorization is persisted, cannot start after expiry, and terminal 400/403/404 status errors stop polling.
- DeepSeek scope accepts ordinary Chinese and English pet care, feeding, behavior, grooming and health questions. Product-use questions bypass pet persona decoration and do not create medical records.
- Chat locks before urgent-risk confirmation to prevent double sends, isolates late Similar Case results by pet, and records an interruption when the user leaves during a response.
- New permission, loading, retry and interruption copy is available in Chinese and English. Provider/internal errors are not shown directly.

## Verified
- Baseline: 24 test files passed before edits.
- Final automated run: `node --test tests/*.test.cjs tests/*.test.mjs` passed 34 tests with zero failures.
- Added behavioral regressions for inverse-order candidate hydration, stale image/reveal events, preload timeout/unload, cross-pet cutout/hydration, chat double tap, stale confirmation, cross-pet Similar Case completion, chat leave recovery, and simultaneous avatar lock acquisition.
- HBuilderX Vue 3 App resource build completed successfully at `unpackage/autonomous-v1/batch1-app`.
- `git diff --check` passed; changed paths contain no `uni_modules`, environment/config file or detected credential pattern.
- Independent locked-prompt check: length `1705`; SHA-256 `d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378`.
- Provider parameters remain `wan2.7-image-pro`, `2K`, `n=1`, `watermark=false`; main candidate/final storage preserves the provider master and creates derivatives separately.
- Real provider calls: Wan initial 0, Wan revision 0, DeepSeek search 0, VIAPI 0.

## Deferred
- Revision semantic/visual model defects and real output quality require authorized provider samples; no speculative paid retries were made.
- Similar Case schema and function changes require deployment in this order: `similar_case_search_jobs.schema.json`, then `api_deepseek`. This run did not change live cloud state.
- APK packaging/signing and physical-device validation require the local signing/device environment.

## Hard Blockers
- H5 compilation remains blocked by HBuilderX reporting the Sass compiler plugin as unavailable, even though the local plugin directory exists and module alias resolution was retried. App resource compilation succeeds.
- No real Wan/DeepSeek/VIAPI request was made because deterministic engineering evidence did not require a paid call.

## Manual Verification Needed
- Actual device visual quality, particle continuity, haptics, platform browser launch, 360/390/412px layout, keyboard/safe area and reduced-motion behavior.
- Real generated master identity/cleanliness, revision fidelity, final Hero composition and live Similar Case provider citations.
- Automated checks are not treated as real device or provider verification.
