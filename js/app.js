/**
 * app.js
 * ------------------------------------------------------------------
 * Orchestration layer. Holds the app's current state, wires up event
 * listeners, and calls into DB / Map / UI / Charts / Impact. No
 * Supabase- or Leaflet-specific code should live here directly.
 *
 * Three tabs, one shared state:
 *   MAP           — GIS view: watershed picker, boundary, markers,
 *                    details panel (ID / Type / Lat&Long + "View
 *                    Analysis →").
 *   INTERVENTIONS — discovery table across every watershed; "View"
 *                    jumps to MAP, centered/highlighted on that row.
 *   ANALYSIS      — satellite/NDVI/NDWI/LULC + field evidence for
 *                    whichever intervention is currently selected.
 * ------------------------------------------------------------------
 */

(function () {

  const state = {
    watersheds: [],
    selectedWatershedId: null,
    interventions: [],       // raw list for selected watershed (Map tab)
    statusById: {},          // intervention_id -> impact status, for the current watershed's summary cards
    selectedInterventionId: null,
    selectedInterventionData: null,   // cached { intervention, satellite, lulc, evidence } for the Analysis tab
    selectedImpactResult: null,       // cached IMPACT.assess() result to match
    activeTab: 'map',                 // 'map' | 'interventions' | 'analysis'

    // Interventions tab (cross-watershed discovery table)
    allInterventions: [],
    allInterventionsLoaded: false,
    allSearchTerm: '',
    allTypeFilter: 'All Types'
  };

  /**
   * Rough polygon centroid (simple coordinate average — good enough for
   * an informational display point, not for precise GIS analysis).
   * Used as a fallback when a watershed row doesn't have explicit
   * watershed_latitude/watershed_longitude columns populated.
   */
  function centroidOfGeometry(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    const ring = geometry.type === 'Polygon' ? geometry.coordinates[0]
      : geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0]
      : null;
    if (!ring || !ring.length) return null;
    let sumLat = 0, sumLng = 0;
    ring.forEach(([lng, lat]) => { sumLng += lng; sumLat += lat; });
    return { latitude: sumLat / ring.length, longitude: sumLng / ring.length };
  }

  async function init() {
    UI.setDemoBanner(CONFIG.USE_DEMO_DATA);
    document.getElementById('appName').textContent = CONFIG.APP_NAME;
    document.getElementById('appTagline').textContent = CONFIG.APP_TAGLINE;

    WSMap.init('map', onMarkerClicked);
    bindGlobalControls();

    await loadWatersheds();
  }

  function bindGlobalControls() {
    document.getElementById('sidebarToggle').addEventListener('click', UI.toggleSidebar);
    document.getElementById('detailsCloseBtn').addEventListener('click', UI.closeDetailsPanel);

    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('watershedSelect').addEventListener('change', (e) => {
      selectWatershed(e.target.value);
    });

    // "View Analysis →" button inside the Map tab's details panel.
    // The panel's innerHTML is replaced on every selection, so this is
    // delegated on the stable container rather than bound per-render.
    document.getElementById('detailsPanelBody').addEventListener('click', (e) => {
      if (e.target.closest('#viewAnalysisBtn')) switchTab('analysis');
    });

    // Interventions tab: search + type filter over the full cross-watershed list.
    document.getElementById('allInterventionsSearch').addEventListener('input', (e) => {
      state.allSearchTerm = e.target.value;
      renderAllInterventionsTable();
    });
    document.getElementById('allInterventionsTypeFilter').addEventListener('change', (e) => {
      state.allTypeFilter = e.target.value;
      renderAllInterventionsTable();
    });
    document.getElementById('allInterventionsBody').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-view');
      const row = e.target.closest('tr[data-id]');
      const id = (btn && btn.dataset.id) || (row && row.dataset.id);
      const watershedId = (btn && btn.dataset.watershed) || (row && row.dataset.watershed);
      if (id && watershedId) viewInterventionOnMap(id, watershedId);
    });
  }

  function switchTab(tab) {
    if (state.activeTab === tab) return;
    state.activeTab = tab;
    UI.setActiveTab(tab);

    if (tab === 'map') {
      // The map was display:none while another tab was active, so Leaflet's
      // internal size cache is stale — invalidateSize() re-measures the
      // container. The small delay lets the layout/display change settle first.
      setTimeout(() => WSMap.invalidateSize(), 50);
    } else if (tab === 'interventions') {
      loadAllInterventionsIfNeeded();
    } else if (tab === 'analysis') {
      if (state.selectedInterventionData) {
        UI.renderAnalysis(state.selectedInterventionData, state.selectedImpactResult);
      } else {
        UI.renderAnalysisEmpty();
      }
    }
  }

  async function loadWatersheds() {
    const listEl = 'mapPanel';
    const { data, error } = await DB.getWatersheds();
    if (error) { UI.showError(listEl, error); return; }
    if (!data || data.length === 0) { UI.showEmpty(listEl, 'No watersheds configured yet.'); return; }

    state.watersheds = data;
    UI.renderWatershedOptions(data, data[0].watershed_id);
    await selectWatershed(data[0].watershed_id);
  }

  async function selectWatershed(watershedId) {
    state.selectedWatershedId = watershedId;
    state.selectedInterventionId = null;
    state.selectedInterventionData = null;
    state.selectedImpactResult = null;
    UI.renderDetailsPlaceholder();
    UI.closeDetailsPanel();

    // The previously-selected intervention (if any) belonged to the old
    // watershed, so if the user is looking at Analysis right now, reset it
    // to the "select an intervention" empty state rather than leaving
    // stale data on screen — the watershed selector lives in the topbar
    // and is reachable from every tab, not just Map.
    if (state.activeTab === 'analysis') UI.renderAnalysisEmpty();

    document.getElementById('watershedSelect').value = watershedId;

    const [watershedRes, interventionsRes] = await Promise.all([
      DB.getWatershedById(watershedId),
      DB.getInterventionsByWatershed(watershedId)
    ]);

    // Bail out if the user has since switched to a different watershed —
    // otherwise these stale results would overwrite the newer selection.
    if (state.selectedWatershedId !== watershedId) return;

    if (watershedRes.error) { console.error(watershedRes.error); }
    if (watershedRes.data) {
      WSMap.setBoundary(watershedRes.data.geometry, watershedRes.data.watershed_name);
      const centroid = centroidOfGeometry(watershedRes.data.geometry);
      UI.renderWatershedInfo(watershedRes.data, centroid);
    } else {
      UI.renderWatershedInfo(null);
    }

    if (interventionsRes.error) {
      console.error(interventionsRes.error);
      state.interventions = [];
      UI.renderSummaryCards({ total: 0, IMPROVED: 0, UNCHANGED: 0, 'NEEDS ATTENTION': 0 });
      WSMap.setInterventions([], null);
      return;
    }

    state.interventions = interventionsRes.data || [];

    // Compute impact status for every intervention up front so the
    // summary cards can show real counts without a click.
    await computeAllStatuses(watershedId);
    if (state.selectedWatershedId !== watershedId) return; // stale by now, ignore

    WSMap.setInterventions(state.interventions, null);
    renderSummary();
  }

  async function computeAllStatuses(watershedId) {
    const statusById = {};
    await Promise.all(state.interventions.map(async (iv) => {
      const [sat, lulc] = await Promise.all([
        DB.getSatelliteAnalysis(iv.intervention_id),
        DB.getLulcAnalysis(iv.intervention_id)
      ]);
      const result = IMPACT.assess(sat.data, lulc.data);
      statusById[iv.intervention_id] = result.status;
    }));
    // Only commit if this is still the currently-selected watershed.
    if (state.selectedWatershedId === watershedId) {
      state.statusById = statusById;
    }
  }

  function renderSummary() {
    const statusList = state.interventions.map(iv => state.statusById[iv.intervention_id]).filter(Boolean);
    const summary = Interventions.summarize(statusList);
    // "total" should reflect all interventions in the watershed, not only those with a resolvable status.
    summary.total = state.interventions.length;
    UI.renderSummaryCards(summary);
  }

  function onMarkerClicked(interventionId) {
    selectIntervention(interventionId);
  }

  async function selectIntervention(interventionId) {
    state.selectedInterventionId = interventionId;
    WSMap.highlightSelected(interventionId, state.interventions);
    UI.openDetailsPanel();

    UI.showLoading('detailsPanelBody', 'Loading intervention details…');
    const { data, error } = await DB.getImpactData(interventionId);

    // Bail out if the user has since selected a different intervention —
    // otherwise these stale results would overwrite the newer selection.
    if (state.selectedInterventionId !== interventionId) return;

    if (error) {
      UI.showError('detailsPanelBody', error);
      return;
    }
    if (!data || !data.intervention) {
      UI.showEmpty('detailsPanelBody', 'No details found for this intervention.');
      return;
    }

    const impactResult = IMPACT.assess(data.satellite, data.lulc);
    state.selectedInterventionData = data;
    state.selectedImpactResult = impactResult;

    // Map tab always shows the simplified ID / Type / Lat&Long panel
    // plus the "View Analysis →" action.
    UI.renderDetails(data);

    // Keep Analysis in sync too, in case it's the active tab (e.g. the
    // user re-clicks a different marker while already on Analysis).
    if (state.activeTab === 'analysis') UI.renderAnalysis(data, impactResult);
  }

  // -----------------------------------------------------------------
  // Interventions tab — cross-watershed discovery table
  // -----------------------------------------------------------------

  async function loadAllInterventionsIfNeeded() {
    if (state.allInterventionsLoaded) {
      renderAllInterventionsTable();
      return;
    }
    document.getElementById('allInterventionsBody').innerHTML =
      `<tr><td colspan="6" class="table-empty">Loading interventions…</td></tr>`;

    const { data, error } = await DB.getAllInterventions();
    if (error) {
      document.getElementById('allInterventionsBody').innerHTML =
        `<tr><td colspan="6" class="table-empty">Unable to load interventions: ${UI.escapeHtml(error)}</td></tr>`;
      return;
    }

    state.allInterventions = data || [];
    state.allInterventionsLoaded = true;
    UI.renderAllInterventionsTypeFilterOptions(Interventions.distinctTypes(state.allInterventions));
    renderAllInterventionsTable();
  }

  function renderAllInterventionsTable() {
    const filtered = Interventions.filterAll(state.allInterventions, state.allSearchTerm, state.allTypeFilter);
    UI.renderAllInterventionsTable(filtered, state.selectedInterventionId);
  }

  /**
   * "View" from the Interventions discovery table: switch to Map,
   * load that row's watershed if it isn't already selected, then
   * select + highlight + open details for that exact intervention.
   * Switching tabs first ensures the map container is visible before
   * Leaflet tries to pan/fit/measure it.
   */
  async function viewInterventionOnMap(interventionId, watershedId) {
    switchTab('map');
    if (state.selectedWatershedId !== watershedId) {
      await selectWatershed(watershedId);
    }
    await selectIntervention(interventionId);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
