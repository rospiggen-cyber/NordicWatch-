# NordicWatch v0.7.1 background alerts

The browser timer is not a reliable background monitor. This optional Cloudflare Worker uses a Cron Trigger, the shared aircraft classifier, KV-backed deduplication and Web Push. The production monitor is disabled by default.

## Safety gate

Keep `MONITOR_ENABLED=0` until the ADS-B provider, endpoint, automated polling rate, alert use, storage and redistribution terms are documented. Both `ADSB_ENDPOINT_VERIFIED_AT` and `ADSB_TERMS_VERIFIED_AT` are required by the Worker before a scheduled fetch can run.

## Deployment outline

1. Create separate KV namespaces for `SUBSCRIPTIONS` and `ALERT_STATE`.
2. Generate a P-256 VAPID key pair. Store the PKCS#8 private key as the `VAPID_PRIVATE_KEY` Worker Secret; configure the uncompressed public key as `VAPID_PUBLIC_KEY`.
3. Store a random `TEST_TRIGGER_TOKEN` as a Worker Secret.
4. Set the exact HTTPS app origin in `APP_ORIGIN`.
5. Deploy with `MONITOR_ENABLED=0` and `MOCK_MODE=1`.
6. Set `localStorage.NORDICWATCH_BACKGROUND_WORKER` in the app to the exact Worker origin and re-enable alerts.
7. Call `POST /test/flash` with `x-test-token` to test the complete background notification path.

The initial Web Push is deliberately payload-free and displays a generic FLASH notification; opening it loads current details in NordicWatch. Subscription endpoints are restricted to known browser push-service hostnames. Dead subscriptions are removed after HTTP 404/410.

## Production activation

After provider review, set `ADSB_ENDPOINT`, the two verification dates, `MOCK_MODE=0`, and finally `MONITOR_ENABLED=1`. The scheduled handler ignores civilian, state and unknown aircraft and publishes only deduplicated ALERT/FLASH observations derived from MILITARY CONFIRMED or PROBABLE records.

## Local tests

```bash
node tests/aircraft-classifier.test.js
node tests/background-monitor-core.test.js
node tests/maritime-core.test.js
```
