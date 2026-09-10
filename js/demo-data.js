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
    { intervention_id: 'CD01', before_date: null, after_date: null, before_image_url: null, after_image_url: null },
    { intervention_id: 'CD02', before_date: null, after_date: null, before_image_url: null, after_image_url: null },
    { intervention_id: 'CD03', before_date: null, after_date: null, before_image_url: null, after_image_url: null },
    { intervention_id: 'CD04', before_date: null, after_date: null, before_image_url: null, after_image_url: null },
    { intervention_id: 'CD05', before_date: null, after_date: null, before_image_url: null, after_image_url: null }
  ];

  // No LULC data yet — intentionally empty (per task: do not fabricate values).
  const lulc_analysis = [];

  // No field evidence photos yet — intentionally empty.
  const field_evidence = [];

  return { watersheds, interventions, satellite_analysis, lulc_analysis, field_evidence };
})();
