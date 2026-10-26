# Avatar preflight recovery — 2026-09-27

## Follow-up: workbench top strip

- `PetPortraitStage` applies its `workbench` variant class to its root. The parent page also used `.workbench` for action-panel spacing; Vue parent scoped styles reach child roots, so the image stage acquired the panel's `margin-top:24rpx`.
- Renamed only the page action panel to `workbench-actions`. A headless browser check with the actual component/page styles reproduced a 12px offset at a 375px viewport before the fix and 0px afterward, preserving the full square image frame. No generated image was edited.

## Follow-up: Android preview stuck after successful generation

- The current pet's task and candidate were already SUCCEEDED. On the real phone, two consecutive `DirectoryReader.readEntries` calls returned one identical file each, rather than an empty second page.
- Native cache initialization treated this API as paginated and repeatedly enumerated the same snapshot, blocking candidate hydration. Both inventory and missing-file checks now deduplicate directory entries and stop on empty or repeated batches while retaining the unique-entry limit.
- A regression test models the Android repeated snapshot. 53 cache/integration tests and 5 persistence/retention/syntax checks passed.
- After synchronization, the actual Android workbench displayed the generated dog, enabled its use button, and reported a fully decoded local image at 2048 x 2048. Screenshot: `unpackage/avatar-preview-verified.png`. This verifies preview rendering, not merely server status. Saving was covered by regression tests; the phone switched to another app before the final live save action, so live confirmation/home rendering remains unverified.
- The temporary startup navigation was removed. No new image generation was submitted.

## Follow-up: successful provider task failed during persistence

- The 20:00 report had an existing RUNNING task. A read-only provider query confirmed that exact task was SUCCEEDED with an image; both database receipts remained RUNNING.
- Local reproduction using the same result and database write returned FaasError 100104: `Cannot create field 'alphaBoundingBox' in element {mainAssetMetadata: null}`. `updateActiveAvatarJob` and the candidate update used recursive object merges against an initial null value.
- Both writes now replace `mainAssetMetadata` and `qualityGateResult` using `db.command.set`. The quota integration mock now rejects nested merges into null, matching the real failure.
- Status-query failures retain diagnostics, retry the existing task at most four times, and preserve pet/job state. Exhausted queries show an accurate progress-unavailable message. Account/pet/job changes discard stale results. No additional provider generation was submitted.
- The fixed `api_pet_avatar` was deployed. At 20:15:53 the actual signed-in Android client queried the same original task and returned `{status:"SUCCEEDED",hasImage:true}`, saving its candidate/session through the normal client path. Temporary startup recovery and local probe code were removed, together with the temporary session token file.

The second screenshot shows a toast on the photo-selection screen. The page used a generic generation-failed toast for non-authentication entitlement errors and discarded their diagnostics. A failed entitlement check did not imply a provider task had started.

## Observed runtime evidence

- Confirmed root cause of the latest failure: the page called both entitlement entry points with `this.petId`, a property that does not exist. The page stores identity in `this.pet.id`. Android diagnostics and deployed function logs at 19:42:06/09/15 report `ENTITLEMENT / INVALID_PET_ID`; no provider task started for those requests.
- The earlier manual startup probes supplied a valid ID explicitly, so their success did not exercise the broken page calls. The old test fixture also invented `petId`. Removing that fixture property and asserting both actual request arguments reproduced `[undefined, undefined]` before the fix and passed with `['cat', 'cat']` afterward.

- At 18:58:28 the Android runtime reported that the client could not connect to the HBuilderX local uniCloud debugger and automatically switched to deployed cloud functions.
- After rebuilding/reconnecting, the actual signed-in Android client returned `{ok:true, allowed:true}` for the entitlement request at 19:01:56, 19:02:19, and 19:04:02.
- At 19:04:04 the same client successfully uploaded and completed server-side validation for one selected source photo. Its authorized source IDs were retained in its existing account-scoped generation session for reuse.
- No image-generation provider task was submitted by this investigation. The original screenshot's exact error was not retained by the old UI, so the observed debugger disconnect cannot conclusively identify that historical request's error.
- The remote schema listing omitted the new quota and source-receipt schemas. This was NOT sufficient evidence of failure: real reads, isolated writes, quota initialization, and source ticket issuance all succeeded. Diagnostic rows were removed immediately. No schemas were deployed based on that hypothesis.

## Permanent changes

- Both page entry points now read `this.pet.id`, capture it before awaiting, and discard results after the pet changes. The entitlement client rejects missing or invalid IDs before making cloud requests.

- Entitlement transport failures retain their error code and `ENTITLEMENT` stage.
- Interactive entitlement failures show a persistent, accurate preflight message instead of a vanishing generic generation-failed toast.
- Preflight failure preserves existing avatar/job state; a failed page no longer says it is still generating.
- Account-scoped sessions retain only bounded stage/code/timestamp diagnostics across page closure. No tokens, raw transport messages, or signed URLs are persisted in this record.
- Fresh generation clears the old diagnostic. Existing active jobs and generated candidates retain restoration priority.

## Verification and cleanup

- 58 tests passed across entitlement recovery, source upload retries, quotas, source ownership, account-scope races, guest import, restart recovery, and Vue script syntax.
- HBuilderX App compilation succeeded and synchronized to the connected phone.
- Temporary startup probes and the local-only diagnostic cloud function were removed. They were not deployed. Real configuration files and model settings were not changed.
- Remaining runtime verification: user-initiated generation through the provider and final image display. Passing preflight/upload does not prove provider success.
