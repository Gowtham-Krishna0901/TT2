/**
 * impact.js
 * ------------------------------------------------------------------
 * PROTOTYPE RULE-BASED IMPACT ASSESSMENT.
 * This is a simple, explainable, deterministic heuristic — NOT a
 * scientifically validated model. All thresholds live in
 * CONFIG.IMPACT_THRESHOLDS (js/config.js) so they can be retuned in
 * one place without touching this logic.
 *
 * Algorithm (in plain terms):
 *  1. Classify the NDVI change as "up" / "flat" / "down" using
 *     NDVI_NOCHANGE_BAND.
 *  2. Classify the NDWI change the same way using NDWI_NOCHANGE_BAND.
 *  3. If NDVI and NDWI agree (both up, both down, or both flat) ->
 *     that's the result.
 *  4. If they disagree, whichever one moved by a "strong" amount
 *     (NDVI_STRONG / NDWI_STRONG) wins the tie-break.
 *  5. If neither is strong, fall back to LULC as supporting evidence:
 *     a Vegetation+Water area gain/loss beyond LULC_SUPPORT_BAND tips
 *     the result toward IMPROVED / NEEDS_ATTENTION; otherwise UNCHANGED.
 * ------------------------------------------------------------------
 */

const IMPACT = (() => {

  const STATUS = {
    IMPROVED: 'IMPROVED',
    UNCHANGED: 'UNCHANGED',
    NEEDS_ATTENTION: 'NEEDS ATTENTION'
  };

  function directionOf(change, band) {
    if (change === null || change === undefined || Number.isNaN(change)) return null;
    if (change > band) return 'up';
    if (change < -band) return 'down';
    return 'flat';
  }

  /**
   * @param {object} satellite - row from satellite_analysis (may be null)
   * @param {object} lulc - row from lulc_analysis (may be null)
   * @returns {{status: string, explanation: string, hasData: boolean}}
   */
  function assess(satellite, lulc) {
    const T = CONFIG.IMPACT_THRESHOLDS;

    if (!satellite || satellite.ndvi_change === undefined) {
      return {
        status: null,
        hasData: false,
        explanation: 'No satellite analysis data available yet for this intervention.'
      };
    }

    const ndviDir = directionOf(satellite.ndvi_change, T.NDVI_NOCHANGE_BAND);
    const ndwiDir = directionOf(satellite.ndwi_change, T.NDWI_NOCHANGE_BAND);

    let status;
    let reason;

    if (ndviDir === ndwiDir) {
      // Both indicators agree
      status = ndviDir === 'up' ? STATUS.IMPROVED : ndviDir === 'down' ? STATUS.NEEDS_ATTENTION : STATUS.UNCHANGED;
      reason = `NDVI (${formatSigned(satellite.ndvi_change)}) and NDWI (${formatSigned(satellite.ndwi_change)}) both indicate ${describeDir(ndviDir)}.`;
    } else {
      // Indicators disagree — use whichever moved strongly
      const ndviStrong = Math.abs(satellite.ndvi_change) >= T.NDVI_STRONG;
      const ndwiStrong = Math.abs(satellite.ndwi_change) >= T.NDWI_STRONG;

      if (ndviStrong && !ndwiStrong) {
        status = ndviDir === 'up' ? STATUS.IMPROVED : STATUS.NEEDS_ATTENTION;
        reason = `NDVI showed a strong change (${formatSigned(satellite.ndvi_change)}), outweighing a smaller NDWI change (${formatSigned(satellite.ndwi_change)}).`;
      } else if (ndwiStrong && !ndviStrong) {
        status = ndwiDir === 'up' ? STATUS.IMPROVED : STATUS.NEEDS_ATTENTION;
        reason = `NDWI showed a strong change (${formatSigned(satellite.ndwi_change)}), outweighing a smaller NDVI change (${formatSigned(satellite.ndvi_change)}).`;
      } else {
        // Neither strong (or both strong but conflicting) — fall back to LULC
        const lulcSignal = lulcSupportSignal(lulc, T.LULC_SUPPORT_BAND);
        if (lulcSignal === 'up') {
          status = STATUS.IMPROVED;
          reason = `NDVI and NDWI changes were mixed and modest, but LULC shows a supporting gain in vegetation/water cover.`;
        } else if (lulcSignal === 'down') {
          status = STATUS.NEEDS_ATTENTION;
          reason = `NDVI and NDWI changes were mixed and modest, and LULC shows a supporting loss in vegetation/water cover.`;
        } else {
          status = STATUS.UNCHANGED;
          reason = `NDVI (${formatSigned(satellite.ndvi_change)}) and NDWI (${formatSigned(satellite.ndwi_change)}) changes were mixed and inconclusive.`;
        }
      }
    }

    return { status, hasData: true, explanation: reason };
  }

  function lulcSupportSignal(lulc, band) {
    if (!lulc) return 'flat';
    const vegChange = (lulc.after_vegetation ?? 0) - (lulc.before_vegetation ?? 0);
    const waterChange = (lulc.after_water ?? 0) - (lulc.before_water ?? 0);
    const combined = vegChange + waterChange;
    if (combined >= band) return 'up';
    if (combined <= -band) return 'down';
    return 'flat';
  }

  function describeDir(dir) {
    return dir === 'up' ? 'positive change' : dir === 'down' ? 'negative change' : 'no meaningful change';
  }

  function formatSigned(n) {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2);
  }

  /**
   * Status for a SINGLE indicator (NDVI or NDWI) in isolation — used by
   * the Analysis tab, which shows each indicator's own status alongside
   * the combined "Overall Impact" from assess(). Reuses the same
   * direction/band logic as assess() so the two never disagree about
   * what counts as "flat".
   */
  function indicatorStatus(change, band) {
    const dir = directionOf(change, band);
    if (dir === 'up') return STATUS.IMPROVED;
    if (dir === 'down') return STATUS.NEEDS_ATTENTION;
    if (dir === 'flat') return STATUS.UNCHANGED;
    return null; // change is null/undefined -> no data
  }

  /**
   * Turns a lulc_analysis row into a category list derived from
   * whatever before_X / after_X column pairs are actually present,
   * instead of a hardcoded 5-category list. This is what lets both
   * the LULC table (ui.js) and the LULC chart (charts.js) support
   * real QGIS data that may add/rename land-cover classes, without
   * duplicating the parsing logic in two places.
   */
  function lulcCategories(lulc) {
    if (!lulc) return [];
    const labelOverrides = { bare_land: 'Bare Land', builtup: 'Built-up' };
    const keys = Object.keys(lulc)
      .filter(k => k.startsWith('before_') && lulc[k] !== null && lulc[k] !== undefined)
      .map(k => k.slice('before_'.length));

    return keys.map(key => {
      const before = Number(lulc['before_' + key] ?? 0);
      const after = Number(lulc['after_' + key] ?? 0);
      const label = labelOverrides[key] || (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
      return { key, label, before, after, change: after - before };
    });
  }

  function formatSignedPercent(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  function badgeMeta(status) {
    switch (status) {
      case STATUS.IMPROVED:
        return { label: 'IMPROVED', className: 'badge-improved', symbol: '\u2713' };
      case STATUS.NEEDS_ATTENTION:
        return { label: 'NEEDS ATTENTION', className: 'badge-attention', symbol: '\u26A0' };
      case STATUS.UNCHANGED:
        return { label: 'UNCHANGED', className: 'badge-unchanged', symbol: '\u2192' };
      default:
        return { label: 'NO DATA', className: 'badge-nodata', symbol: '?' };
    }
  }

  return { STATUS, assess, badgeMeta, formatSigned, indicatorStatus, lulcCategories, formatSignedPercent };
})();
