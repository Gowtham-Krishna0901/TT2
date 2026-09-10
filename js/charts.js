/**
 * charts.js
 * ------------------------------------------------------------------
 * Chart.js rendering for the three indicator graphs. Instances are
 * tracked and destroyed before re-creation to avoid the classic
 * "Canvas is already in use" duplicate-chart error when switching
 * between interventions.
 * ------------------------------------------------------------------
 */

const Charts = (() => {

  const instances = {}; // canvasId -> Chart instance

  function destroy(canvasId) {
    if (instances[canvasId]) {
      instances[canvasId].destroy();
      delete instances[canvasId];
    }
  }

  function destroyAll() {
    Object.keys(instances).forEach(destroy);
  }

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 10, font: { size: 11 } } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(148,163,184,0.15)' } }
    }
  };

  function renderNdvi(canvasId, satellite) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || !satellite) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [fmtDate(satellite.before_date), fmtDate(satellite.after_date)],
        datasets: [{
          label: 'NDVI (Vegetation Index)',
          data: [satellite.before_ndvi, satellite.after_ndvi],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.15)',
          pointBackgroundColor: '#22c55e',
          tension: 0.3,
          fill: true
        }]
      },
      options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0, max: 1 } } }
    });
  }

  function renderNdwi(canvasId, satellite) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || !satellite) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [fmtDate(satellite.before_date), fmtDate(satellite.after_date)],
        datasets: [{
          label: 'NDWI (Water Index)',
          data: [satellite.before_ndwi, satellite.after_ndwi],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.15)',
          pointBackgroundColor: '#3b82f6',
          tension: 0.3,
          fill: true
        }]
      },
      options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: -0.2, max: 1 } } }
    });
  }

  function renderLulc(canvasId, lulc) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || !lulc) return;

    // Categories come from whatever before_X/after_X columns are actually
    // present on the row (see IMPACT.lulcCategories), so this chart works
    // for real QGIS/Supabase data even if the land-cover classes differ
    // from the demo set.
    const categories = IMPACT.lulcCategories(lulc);
    if (!categories.length) return;
    const labels = categories.map(c => c.label);
    const beforeVals = categories.map(c => c.before);
    const afterVals = categories.map(c => c.after);

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Before', data: beforeVals, backgroundColor: '#f97316' },
          { label: 'After', data: afterVals, backgroundColor: '#22c55e' }
        ]
      },
      options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, title: { display: true, text: 'Area (%)' } } } }
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return { renderNdvi, renderNdwi, renderLulc, destroyAll };
})();
