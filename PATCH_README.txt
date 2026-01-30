PATCH3 Apply & Verify

1) Apply (im Projekt-Root):
   unzip -o Mobile-APK-Builder-PATCH3.zip
   rm Mobile-APK-Builder-PATCH3.zip

2) GitHub Secret (optional):
   SUPABASE_APK_BUCKET = apk-builds   (oder anderer Bucketname)

3) Supabase Storage Bucket einmalig anlegen:
   - Supabase Dashboard → Storage → New bucket → Name: apk-builds
   - Private bucket empfohlen (wir erzeugen signed URLs)

4) Tests lokal:
   npm run typecheck
   npm run lint:ci
   npm run test:silent

5) Commit + Push:
   git add -A
   git commit -m "feat(build): add APK download_url via Supabase Storage"
   git push origin build

6) Deploy Edge Function:
   supabase functions deploy check-eas-build

7) E2E Verify:
   - In-App Build starten
   - Supabase build_jobs: download_url gefüllt
   - App zeigt Button “⬇️ APK Download” und öffnet den Link
