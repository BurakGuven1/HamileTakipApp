# Vaccination

App-side API is in `src/api/vaccinations.ts`.

The official T.C. Sağlık Bakanlığı vaccine schedule should be seeded in Supabase by SQL, then personalized rows should be generated through the `create_baby_vaccination_schedule` RPC.
