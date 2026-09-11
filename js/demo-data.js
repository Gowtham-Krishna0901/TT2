/**
 * demo-data.js
 * ------------------------------------------------------------------
 * In-memory data source used when CONFIG.USE_DEMO_DATA is true.
 * database.js reads from this object when CONFIG.USE_DEMO_DATA is
 * true, and from Supabase when it's false — the rest of the app
 * cannot tell the difference.
 *
 * REAL PROJECT DATA (not sample/placeholder data):
 *   5 watersheds, each with exactly one Check Dam intervention:
 *     CD01 — Viswanathapuram
 *     CD02 — Peddamungalachedu
 *     CD03 — Jagannathapuram
 *     CD04 — Veerapandi
 *     CD05 — Cuddalore
 *   Coordinates come from interventions.csv (the real site list).
 *
 * No polygon boundary was supplied for these watersheds, so
 * `geometry` is left null on each — map.js / app.js already handle
 * a null boundary gracefully (no boundary drawn, marker + info panel
 * still work via watershed_latitude/longitude). See schema.sql for
 * the matching Supabase-side change (geometry column made nullable).
 *
 * satellite_analysis rows exist (one per intervention) so the
 * Analysis tab's Historical/Current image panel renders, but
 * before_image_url / after_image_url are null until the real
 * before/after images are supplied — see the "PENDING IMAGES" note
 * below for how to fill them in. NDVI/NDWI/LULC fields are
 * intentionally omitted (not fabricated) — the UI shows "NO DATA" /
 * "—" for those until real figures are provided.
 * ------------------------------------------------------------------
 */

const DEMO_DATA = (() => {

  const watersheds = [
    { watershed_id: 'CD01', watershed_name: 'Viswanathapuram',    state: null, district: null, watershed_latitude: 11.805000,  watershed_longitude: 79.659944, geometry: null, created_at: null },
    { watershed_id: 'CD02', watershed_name: 'Peddamungalachedu',  state: null, district: null, watershed_latitude: 16.495961,  watershed_longitude: 77.894172, geometry: null, created_at: null },
    { watershed_id: 'CD03', watershed_name: 'Jagannathapuram',    state: null, district: null, watershed_latitude: 13.261128,  watershed_longitude: 80.168365, geometry: null, created_at: null },
    { watershed_id: 'CD04', watershed_name: 'Veerapandi',         state: null, district: null, watershed_latitude: 9.966636,   watershed_longitude: 77.429217, geometry: null, created_at: null },
    { watershed_id: 'CD05', watershed_name: 'Cuddalore',          state: null, district: null, watershed_latitude: 11.844412,  watershed_longitude: 79.735178, geometry: null, created_at: null }
  ];

  const interventions = [
    { intervention_id: 'CD01', watershed_id: 'CD01', name: 'Viswanathapuram Check Dam',   intervention_type: 'Check Dam', latitude: 11.805000, longitude: 79.659944, created_at: null },
    { intervention_id: 'CD02', watershed_id: 'CD02', name: 'Peddamungalachedu Check Dam', intervention_type: 'Check Dam', latitude: 16.495961, longitude: 77.894172, created_at: null },
    { intervention_id: 'CD03', watershed_id: 'CD03', name: 'Jagannathapuram Check Dam',   intervention_type: 'Check Dam', latitude: 13.261128, longitude: 80.168365, created_at: null },
    { intervention_id: 'CD04', watershed_id: 'CD04', name: 'Veerapandi Check Dam',        intervention_type: 'Check Dam', latitude: 9.966636,  longitude: 77.429217, created_at: null },
    { intervention_id: 'CD05', watershed_id: 'CD05', name: 'Cuddalore Check Dam',         intervention_type: 'Check Dam', latitude: 11.844412, longitude: 79.735178, created_at: null }
  ];

  // ---- PENDING IMAGES --------------------------------------------
  // Fill in before_image_url / after_image_url below once the real
  // before/after images are available (e.g. uploaded to a Supabase
  // storage bucket, or any URL your team controls). Do not put
  // placeholder/fake URLs here — leave null until a real URL exists,
  // which is exactly what these rows do right now.
  const satellite_analysis = [
    { intervention_id: 'CD01', before_date: null, after_date: null, before_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD01/CD01_before.jpg', after_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD01/CD01_after.jpg',before_ndvi: 0.3298, after_ndvi: 0.4357, ndvi_change: 0.1059,
      before_ndwi: -0.3215, after_ndwi: -0.4230, ndwi_change: -0.1015 },
    { intervention_id: 'CD02', before_date: null, after_date: null, before_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD02/CD02_before.jpg', after_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD02/CD02_after.jpg',before_ndvi: 0.1163, after_ndvi: 0.1121, ndvi_change: -0.0042,
      before_ndwi: -0.1479, after_ndwi: -0.1052, ndwi_change: 0.0427 },
    { intervention_id: 'CD03', before_date: null, after_date: null, before_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD03/CD03_before.jpg', after_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD03/CD03_after.jpg',before_ndvi: 0.2615, after_ndvi: 0.3259, ndvi_change: 0.0644,
      before_ndwi: -0.3001, after_ndwi: -0.2726, ndwi_change: 0.0275 },
    { intervention_id: 'CD04', before_date: null, after_date: null, before_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD04/CD04_before.jpg', after_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD04/CD04_after.jpg',before_ndvi: 0.1476, after_ndvi: 0.2772, ndvi_change: 0.1296,
      before_ndwi: -0.1399, after_ndwi: -0.2657, ndwi_change: -0.1258 },
    { intervention_id: 'CD05', before_date: null, after_date: null, before_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD05/CD05_before.jpg', after_image_url: 'https://tknbijlujridmztkuulp.supabase.co/storage/v1/object/public/satellite/CD05/CD05_after.jpg',before_ndvi: 0.3714, after_ndvi: 0.5226, ndvi_change: 0.1512,
      before_ndwi: -0.3554, after_ndwi: -0.4729, ndwi_change: -0.1175 }
  ];

  // No LULC data yet — intentionally empty (per task: do not fabricate values).
  const lulc_analysis = [];

  // No field evidence photos yet — intentionally empty.
  const field_evidence = [];

  return { watersheds, interventions, satellite_analysis, lulc_analysis, field_evidence };
})();
