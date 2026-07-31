# Vaccination

App-side API is in `src/api/vaccinations.ts`.

The shared vaccination center is `app/(tabs)/vaccines.tsx`. It stays available
in both life stages: active pregnancy schedules are shown alongside schedules
for any existing baby profiles, while motherhood shows the baby schedules.

The official T.C. Sağlık Bakanlığı vaccine schedule should be seeded in Supabase by SQL, then personalized rows should be generated through the `create_baby_vaccination_schedule` RPC.
