/**
 * database.js
 * ------------------------------------------------------------------
 * The ONLY module that knows whether data is coming from DEMO_DATA
 * or from Supabase. Every other module calls these functions and
 * gets back the same shape of data either way. This is what makes
 * "flip USE_DEMO_DATA to false" a one-line change.
 *
 * Every function returns a Promise resolving to:
 *   { data, error }
 * so callers can handle LOADING / SUCCESS / EMPTY / ERROR uniformly
 * (see ui.js renderAsyncState helper).
 * ------------------------------------------------------------------
 */

const DB = (() => {

  // Simulate realistic network latency in demo mode so loading states
  // are actually visible/testable, instead of resolving instantly.
  const demoDelay = (ms = 250) => new Promise(res => setTimeout(res, ms));

  async function getWatersheds() {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      return { data: DEMO_DATA.watersheds, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('watersheds').select('*').order('watershed_name');
    return { data, error: error ? error.message : null };
  }

  async function getWatershedById(watershedId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const w = DEMO_DATA.watersheds.find(w => w.watershed_id === watershedId) || null;
      return { data: w, error: w ? null : 'Watershed not found.' };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('watersheds').select('*').eq('watershed_id', watershedId).single();
    return { data, error: error ? error.message : null };
  }

  async function getInterventionsByWatershed(watershedId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const rows = DEMO_DATA.interventions.filter(i => i.watershed_id === watershedId);
      return { data: rows, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('interventions').select('*').eq('watershed_id', watershedId).order('intervention_id');
    return { data, error: error ? error.message : null };
  }

  async function getInterventionDetails(interventionId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const row = DEMO_DATA.interventions.find(i => i.intervention_id === interventionId) || null;
      return { data: row, error: row ? null : 'Intervention not found.' };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('interventions').select('*').eq('intervention_id', interventionId).single();
    return { data, error: error ? error.message : null };
  }

  async function getSatelliteAnalysis(interventionId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const row = DEMO_DATA.satellite_analysis.find(s => s.intervention_id === interventionId) || null;
      return { data: row, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('satellite_analysis').select('*').eq('intervention_id', interventionId).maybeSingle();
    return { data, error: error ? error.message : null };
  }

  async function getLulcAnalysis(interventionId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const row = DEMO_DATA.lulc_analysis.find(l => l.intervention_id === interventionId) || null;
      return { data: row, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('lulc_analysis').select('*').eq('intervention_id', interventionId).maybeSingle();
    return { data, error: error ? error.message : null };
  }

  async function getFieldEvidence(interventionId) {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const rows = DEMO_DATA.field_evidence.filter(f => f.intervention_id === interventionId);
      return { data: rows, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };
    const { data, error } = await client.from('field_evidence').select('*').eq('intervention_id', interventionId).order('photo_date');
    return { data, error: error ? error.message : null };
  }

  /**
   * Every intervention across every watershed, each carrying its
   * parent watershed_name — powers the Interventions tab's
   * discovery table (Watershed / ID / Type / Lat / Lng / View).
   * Implemented as two flat queries + a client-side join rather than
   * a PostgREST embed, so it doesn't depend on how the FK relationship
   * name resolves in a given Supabase project.
   */
  async function getAllInterventions() {
    if (CONFIG.USE_DEMO_DATA) {
      await demoDelay();
      const nameById = Object.fromEntries(DEMO_DATA.watersheds.map(w => [w.watershed_id, w.watershed_name]));
      const rows = DEMO_DATA.interventions.map(i => ({ ...i, watershed_name: nameById[i.watershed_id] || i.watershed_id }));
      return { data: rows, error: null };
    }
    const client = getSupabaseClient();
    if (!client) return { data: null, error: 'Supabase client not configured.' };

    const [interventionsRes, watershedsRes] = await Promise.all([
      client.from('interventions').select('*').order('intervention_id'),
      client.from('watersheds').select('watershed_id, watershed_name')
    ]);
    if (interventionsRes.error) return { data: null, error: interventionsRes.error.message };
    if (watershedsRes.error) return { data: null, error: watershedsRes.error.message };

    const nameById = Object.fromEntries((watershedsRes.data || []).map(w => [w.watershed_id, w.watershed_name]));
    const rows = (interventionsRes.data || []).map(i => ({ ...i, watershed_name: nameById[i.watershed_id] || i.watershed_id }));
    return { data: rows, error: null };
  }

  /**
   * Convenience aggregator: everything needed to render the details
   * panel for one intervention, fetched together.
   */
  async function getImpactData(interventionId) {
    const [intervention, satellite, lulc, evidence] = await Promise.all([
      getInterventionDetails(interventionId),
      getSatelliteAnalysis(interventionId),
      getLulcAnalysis(interventionId),
      getFieldEvidence(interventionId)
    ]);

    const firstError = [intervention, satellite, lulc, evidence].find(r => r.error);
    if (firstError) return { data: null, error: firstError.error };

    return {
      data: {
        intervention: intervention.data,
        satellite: satellite.data,
        lulc: lulc.data,
        evidence: evidence.data || []
      },
      error: null
    };
  }

  return {
    getWatersheds,
    getWatershedById,
    getInterventionsByWatershed,
    getInterventionDetails,
    getSatelliteAnalysis,
    getLulcAnalysis,
    getFieldEvidence,
    getAllInterventions,
    getImpactData
  };
})();
