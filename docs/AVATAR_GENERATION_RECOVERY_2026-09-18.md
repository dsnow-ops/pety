# Avatar generation recovery — 2026-09-18

- Device evidence: current pet pet_1789729998612_9r0iqq, failed task ad2c7be7-cb1e-4a03-9d14-6b3dd238e789.
- Photo upload succeeded. Provider returned InvalidParameter: failed to download the system master-style-v1.jpg from cloudstatic (connection timeout). This task did not report quota exhaustion.
- Change: initial generation reads ordered style/pet bytes through cloud storage, validates JPEG/PNG and size limits, then sends data URLs to Wan. Revision and transparent Hero paths remain unchanged. Reference reads have one bounded retry; failed preparation never submits a provider task.
- Also replaced Vue 2 $set in the Vue 3 upload-progress callback, with a pet ownership check after upload.
- Real storage read: style JPEG 786272 bytes; current pet JPEG 74593 bytes. One subsequent read failed before provider submission, then succeeded on the next diagnostic run.
- Real Wan submission: exactly one generation, task d2a9d11a-99e3-4c9b-92f7-cdc37663e055, SUCCEEDED. Result downloaded to unpackage/reference-provider-result.png. Polls reused the recorded task ID. No segmentation or other image-model calls. Whether the call consumed free allowance or billed balance was not queried.
- api_pet_avatar deployed successfully through HBuilderX to existing alipay space ali01. Real config content not edited. Temporary local diagnostic function was never deployed and was removed.
- Full suite: 103/103; final reference-preparation focused suite: 3/3. App build passed; diff --check passed.
- Base prompt length 1705; SHA256 d4bc2b10df557435b9386d9b015cde348b9a4ff9da90d80f06dc08b40fa3a378.
- Limit: the successful verification used the real failed job inputs and actual Provider, but did not replace the user's candidate or confirm a new Hero. Phone was locked during validation. User needs to retry once in the foreground to verify the deployed full UI flow.
- API reference: https://help.aliyun.com/zh/model-studio/wan-image-generation-and-editing-api-reference
