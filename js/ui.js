/**
 * ui.js
 * ------------------------------------------------------------------
 * DOM rendering helpers. Keeps app.js focused on orchestration/state
 * and keeps markup generation in one place.
 * ------------------------------------------------------------------
 */

const UI = (() => {

  function el(id) { return document.getElementById(id); }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ---------------------------------------------------------------
  // Generic async-state rendering: LOADING / ERROR / EMPTY / content
  // ---------------------------------------------------------------
  function showLoading(containerId, message = 'Loading…') {
    const c = el(containerId);
    if (!c) return;
    c.innerHTML = `
      <div class="state-block state-loading">
        <div class="spinner" aria-hidden="true"></div>
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  function showError(containerId, message = 'Something went wrong.') {
    const c = el(containerId);
    if (!c) return;
    c.innerHTML = `
      <div class="state-block state-error">
        <p class="state-title">Unable to load data</p>
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  function showEmpty(containerId, message = 'No records found.') {
    const c = el(containerId);
    if (!c) return;
    c.innerHTML = `
      <div class="state-block state-empty">
        <p>${escapeHtml(message)}</p>
      </div>`;
  }

  // ---------------------------------------------------------------
  // Watershed status summary cards
  // ---------------------------------------------------------------
  function renderSummaryCards(summary) {
    const c = el('summaryCards');
    if (!c) return;
    c.innerHTML = `
      <div class="summary-card card-improved">
        <span class="summary-label">Improved</span>
        <span class="summary-value">${summary.IMPROVED}</span>
      </div>
      <div class="summary-card card-unchanged">
        <span class="summary-label">Unchanged</span>
        <span class="summary-value">${summary.UNCHANGED}</span>
      </div>
      <div class="summary-card card-attention">
        <span class="summary-label">Needs Attention</span>
        <span class="summary-value">${summary['NEEDS ATTENTION']}</span>
      </div>
      <div class="summary-card card-total">
        <span class="summary-label">Total Interventions</span>
        <span class="summary-value">${summary.total}</span>
      </div>`;
  }

  // ---------------------------------------------------------------
  // Interventions tab — cross-watershed discovery table
  // ---------------------------------------------------------------
  function renderAllInterventionsTable(interventions, selectedId) {
    const tbody = el('allInterventionsBody');
    if (!tbody) return;

    if (interventions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No interventions match your search/filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = interventions.map(iv => {
      const rowClass = iv.intervention_id === selectedId ? 'row-selected' : '';
      return `
        <tr class="${rowClass}" data-id="${escapeHtml(iv.intervention_id)}" data-watershed="${escapeHtml(iv.watershed_id)}">
          <td>${escapeHtml(iv.watershed_name || iv.watershed_id)}</td>
          <td>${escapeHtml(iv.intervention_id)}</td>
          <td>${escapeHtml(iv.intervention_type)}</td>
          <td>${iv.latitude != null ? iv.latitude.toFixed(5) : '—'}</td>
          <td>${iv.longitude != null ? iv.longitude.toFixed(5) : '—'}</td>
          <td><button class="btn-view" data-id="${escapeHtml(iv.intervention_id)}" data-watershed="${escapeHtml(iv.watershed_id)}">View</button></td>
        </tr>`;
    }).join('');
  }

  function renderAllInterventionsTypeFilterOptions(types) {
    const sel = el('allInterventionsTypeFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="All Types">All Types</option>` +
      types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (types.includes(current)) sel.value = current;
  }

  function renderWatershedOptions(watersheds, selectedId) {
    const sel = el('watershedSelect');
    if (!sel) return;
    sel.innerHTML = watersheds.map(w =>
      `<option value="${escapeHtml(w.watershed_id)}" ${w.watershed_id === selectedId ? 'selected' : ''}>${escapeHtml(w.watershed_name)}</option>`
    ).join('');
  }

  // ---------------------------------------------------------------
  // Intervention details panel
  // ---------------------------------------------------------------
  function renderDetailsPlaceholder() {
    const c = el('detailsPanelBody');
    if (!c) return;
    c.innerHTML = `
      <div class="state-block state-empty details-placeholder">
        <p>Select an intervention marker on the map to view its ID, type and coordinates.</p>
      </div>`;
    el('detailsPanelTitle').textContent = 'Intervention Details';
  }

  // Map tab detail panel intentionally shows ONLY id/type/coordinates —
  // satellite/NDVI/NDWI/LULC/field evidence live in the Analysis tab,
  // reached via the button below, keyed off the same selected intervention.
  function renderDetails({ intervention }) {
    el('detailsPanelTitle').textContent = `${intervention.intervention_type} (${intervention.intervention_id})`;

    const location = intervention.latitude != null && intervention.longitude != null
      ? intervention.latitude.toFixed(6) + ', ' + intervention.longitude.toFixed(6)
      : '—';

    el('detailsPanelBody').innerHTML = `
      <section class="details-section">
        <dl class="detail-list">
          <div><dt>ID</dt><dd>${escapeHtml(intervention.intervention_id)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(intervention.intervention_type)}</dd></div>
          <div><dt>Lat &amp; Long</dt><dd>${location}</dd></div>
        </dl>
      </section>
      <div class="details-actions">
        <button id="viewAnalysisBtn" class="btn-primary" type="button">View Analysis &rarr;</button>
      </div>
    `;
  }

  // ---------------------------------------------------------------
  // Watershed info card (Interventions tab)
  // ---------------------------------------------------------------
  function renderWatershedInfo(watershed, centroid) {
    const c = el('watershedInfoPanel');
    if (!c) return;
    if (!watershed) {
      c.innerHTML = `<div class="state-block state-empty"><p>No watershed selected.</p></div>`;
      return;
    }
    const lat = watershed.watershed_latitude != null ? watershed.watershed_latitude : (centroid ? centroid.latitude : null);
    const lng = watershed.watershed_longitude != null ? watershed.watershed_longitude : (centroid ? centroid.longitude : null);
    c.innerHTML = `
      <dl class="watershed-info-grid">
        <div><dt>Watershed Name</dt><dd>${escapeHtml(watershed.watershed_name)}</dd></div>
        <div><dt>Watershed ID</dt><dd>${escapeHtml(watershed.watershed_id)}</dd></div>
        <div><dt>Latitude</dt><dd>${lat != null ? lat.toFixed(5) : '—'}</dd></div>
        <div><dt>Longitude</dt><dd>${lng != null ? lng.toFixed(5) : '—'}</dd></div>
      </dl>`;
  }

  // ---------------------------------------------------------------
  // Analysis tab — before/after satellite, NDVI, NDWI, LULC, overall impact
  // ---------------------------------------------------------------
  function renderAnalysisEmpty(message) {
    el('analysisSelectedLabel').textContent = message || 'Select an intervention from the map or interventions table to view its analysis.';
    el('analysisBody').innerHTML = '';
    Charts.destroyAll();
  }

  function satImageBlock(url, timeLabel, subLabel) {
    const img = url
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(timeLabel)} satellite image" loading="lazy">`
      : `<div class="sat-image-empty">No image available yet</div>`;
    return `
      <div class="analysis-sat-col">
        <p class="sat-time-label">${escapeHtml(timeLabel)}</p>
        <p class="sat-time-sub">${escapeHtml(subLabel)}</p>
        ${img}
      </div>`;
  }

  function renderAnalysis({ intervention, satellite, lulc, evidence }, impactResult) {
    el('analysisSelectedLabel').textContent = `Selected Intervention: ${intervention.intervention_type} (${intervention.intervention_id})`;

    if (!satellite) {
      el('analysisBody').innerHTML = `
        <div class="analysis-panel">
          <div class="state-block state-empty">
            <p>No satellite analysis data available yet for this intervention.</p>
          </div>
        </div>
        ${fieldEvidencePanel(evidence)}`;
      return;
    }

    const overallMeta = impactResult.status ? IMPACT.badgeMeta(impactResult.status) : IMPACT.badgeMeta(null);
    const ndviStatus = IMPACT.indicatorStatus(satellite.ndvi_change, CONFIG.IMPACT_THRESHOLDS.NDVI_NOCHANGE_BAND);
    const ndwiStatus = IMPACT.indicatorStatus(satellite.ndwi_change, CONFIG.IMPACT_THRESHOLDS.NDWI_NOCHANGE_BAND);
    const ndviMeta = IMPACT.badgeMeta(ndviStatus);
    const ndwiMeta = IMPACT.badgeMeta(ndwiStatus);

    const lulcRows = IMPACT.lulcCategories(lulc).map(cat => `
      <tr>
        <td>${escapeHtml(cat.label)}</td>
        <td>${cat.before.toFixed(1)}%</td>
        <td>${cat.after.toFixed(1)}%</td>
        <td class="${changeClass(cat.change)}">${IMPACT.formatSignedPercent(cat.change)}</td>
      </tr>`).join('');

    const location = intervention.latitude != null && intervention.longitude != null
      ? intervention.latitude.toFixed(6) + ', ' + intervention.longitude.toFixed(6)
      : '—';

    el('analysisBody').innerHTML = `
      <div class="analysis-panel">
        <h3>Selected Intervention</h3>
        <dl class="detail-list detail-list-inline">
          <div><dt>ID</dt><dd>${escapeHtml(intervention.intervention_id)}</dd></div>
          <div><dt>Type</dt><dd>${escapeHtml(intervention.intervention_type)}</dd></div>
          <div><dt>Lat &amp; Long</dt><dd>${location}</dd></div>
        </dl>
      </div>

      <div class="analysis-panel">
        <h3>Satellite Analysis</h3>
        <div class="analysis-satellite-grid">
          ${satImageBlock(satellite.before_image_url, 'Historical / Before', `~${formatDate(satellite.before_date)}`)}
          ${satImageBlock(satellite.after_image_url, 'Current / After', formatDate(satellite.after_date))}
        </div>
        <p class="muted-small" style="margin-top:10px;">These images represent environmental conditions at two different times — not before/after construction photos of the intervention itself.</p>
      </div>

      <div class="analysis-panel">
        <h3>Indicators</h3>
        <div class="indicator-grid">
          <div class="indicator-card">
            <h4>NDVI (Vegetation Index)</h4>
            <div class="indicator-stats">
              <div class="indicator-stat"><span class="stat-label">Before</span><span class="stat-value">${satellite.before_ndvi != null ? satellite.before_ndvi.toFixed(2) : '—'}</span></div>
              <div class="indicator-stat"><span class="stat-label">After</span><span class="stat-value">${satellite.after_ndvi != null ? satellite.after_ndvi.toFixed(2) : '—'}</span></div>
              <div class="indicator-stat"><span class="stat-label">Change</span><span class="stat-value ${changeClass(satellite.ndvi_change)}">${IMPACT.formatSigned(satellite.ndvi_change)}</span></div>
            </div>
            <span class="badge ${ndviMeta.className}">${ndviMeta.symbol} ${ndviMeta.label}</span>
            <div class="indicator-chart-box"><canvas id="chartNdviAnalysis"></canvas></div>
          </div>
          <div class="indicator-card">
            <h4>NDWI (Water Index)</h4>
            <div class="indicator-stats">
              <div class="indicator-stat"><span class="stat-label">Before</span><span class="stat-value">${satellite.before_ndwi != null ? satellite.before_ndwi.toFixed(2) : '—'}</span></div>
              <div class="indicator-stat"><span class="stat-label">After</span><span class="stat-value">${satellite.after_ndwi != null ? satellite.after_ndwi.toFixed(2) : '—'}</span></div>
              <div class="indicator-stat"><span class="stat-label">Change</span><span class="stat-value ${changeClass(satellite.ndwi_change)}">${IMPACT.formatSigned(satellite.ndwi_change)}</span></div>
            </div>
            <span class="badge ${ndwiMeta.className}">${ndwiMeta.symbol} ${ndwiMeta.label}</span>
            <div class="indicator-chart-box"><canvas id="chartNdwiAnalysis"></canvas></div>
          </div>
        </div>
      </div>

      <div class="analysis-panel">
        <h3>LULC (Land Use / Land Cover)</h3>
        ${lulc ? `
          <table class="analysis-lulc-table">
            <thead><tr><th>Category</th><th>Before</th><th>After</th><th>Change</th></tr></thead>
            <tbody>${lulcRows}</tbody>
          </table>
          <div class="analysis-lulc-chart-box"><canvas id="chartLulcAnalysis"></canvas></div>
        ` : `<p class="muted">No LULC analysis data available yet for this intervention.</p>`}
      </div>

      <div class="analysis-panel analysis-impact-panel">
        <span class="badge badge-large ${overallMeta.className}">${overallMeta.symbol} ${overallMeta.label}</span>
        <p class="impact-explanation" style="flex:1;min-width:180px;margin:0;">${escapeHtml(impactResult.explanation)}</p>
      </div>
      <p class="disclaimer">Prototype rule-based assessment — not a scientifically validated model. See js/impact.js.</p>

      ${fieldEvidencePanel(evidence)}
    `;

    // Charts must be rendered after the canvases above exist in the DOM.
    Charts.renderNdvi('chartNdviAnalysis', satellite);
    Charts.renderNdwi('chartNdwiAnalysis', satellite);
    Charts.renderLulc('chartLulcAnalysis', lulc);
  }

  /**
   * Ground-truth field evidence photos for the analysis's selected
   * intervention — distinct from the before/after satellite imagery
   * above. Returns a full "analysis-panel" section as an HTML string
   * so it can be appended both from the normal render and from the
   * "no satellite data yet" early-return branch above.
   */
  function fieldEvidencePanel(evidence) {
    if (!evidence || !evidence.length) {
      return `
        <div class="analysis-panel">
          <h3>Field Evidence</h3>
          <p class="muted">No field evidence photos uploaded yet for this intervention.</p>
        </div>`;
    }
    return `
      <div class="analysis-panel">
        <h3>Field Evidence</h3>
        <div class="photos-gallery-grid">
          ${evidence.map(ev => `
            <figure class="evidence-item">
              <img src="${escapeHtml(ev.photo_url)}" alt="Field evidence photo" loading="lazy">
              <figcaption>
                <span>${formatDate(ev.photo_date)}</span>
                <span class="muted-small">${ev.latitude != null ? ev.latitude.toFixed(4) + ', ' + ev.longitude.toFixed(4) : ''}</span>
                ${ev.description ? `<p>${escapeHtml(ev.description)}</p>` : ''}
              </figcaption>
            </figure>`).join('')}
        </div>
      </div>`;
  }

  // ---------------------------------------------------------------
  // Tab switching (Map / Interventions / Analysis)
  // ---------------------------------------------------------------
  function setActiveTab(tab) {
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('view-map').classList.toggle('active', tab === 'map');
    document.getElementById('view-interventions').classList.toggle('active', tab === 'interventions');
    document.getElementById('view-analysis').classList.toggle('active', tab === 'analysis');
  }

  function changeClass(v) {
    if (v === null || v === undefined) return '';
    return v > 0 ? 'change-positive' : v < 0 ? 'change-negative' : 'change-neutral';
  }

  function setDemoBanner(isDemo) {
    const b = el('dataModeBanner');
    if (!b) return;
    b.style.display = isDemo ? 'flex' : 'none';
  }

  function closeDetailsPanel() {
    el('detailsPanel').classList.remove('open');
  }

  function openDetailsPanel() {
    el('detailsPanel').classList.add('open');
  }

  function toggleSidebar() {
    document.querySelector('.app-shell').classList.toggle('sidebar-collapsed');
  }

  return {
    el, escapeHtml, formatDate,
    showLoading, showError, showEmpty,
    renderSummaryCards, renderWatershedOptions,
    renderAllInterventionsTable, renderAllInterventionsTypeFilterOptions,
    renderDetailsPlaceholder, renderDetails, renderWatershedInfo,
    renderAnalysis, renderAnalysisEmpty,
    setActiveTab,
    setDemoBanner, closeDetailsPanel, openDetailsPanel, toggleSidebar
  };
})();
