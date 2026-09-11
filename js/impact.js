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
   * LULC is intentionally limited to these two categories only
   * (Vegetation, Water) — no Agriculture / Built-up / Bare Land.
   * Any before_X/after_X pair outside this whitelist on a lulc row
   * (e.g. an older/wider QGIS export) is ignored, not displayed.
   */
  const LULC_CATEGORY_KEYS = ['vegetation', 'water'];

  /**
   * Turns a lulc_analysis-shaped row (real DB row OR the output of
   * deriveLulcFromIndices() below — same shape) into the Vegetation/
   * Water category list used by both the LULC table (ui.js) and the
   * LULC chart (charts.js).
   */
  function lulcCategories(lulc) {
    if (!lulc) return [];
    return LULC_CATEGORY_KEYS
      .filter(key => lulc['before_' + key] !== null && lulc['before_' + key] !== undefined)
      .map(key => {
        const before = Number(lulc['before_' + key] ?? 0);
        const after = Number(lulc['after_' + key] ?? 0);
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return { key, label, before, after, change: after - before };
      });
  }

  /**
   * DERIVED LULC — ESTIMATE, NOT A FIELD CLASSIFICATION.
   * ------------------------------------------------------------------
   * We only have one scalar NDVI/NDWI value per watershed (no pixel
   * raster), so we can't do a real per-pixel land-cover classification
   * client-side. This instead applies the standard "fractional cover"
   * technique used in remote sensing to turn a single index value into
   * an estimated % cover, by linearly scaling it between a configured
   * floor (treated as 0% cover) and ceiling (treated as 100% cover):
   *
   *   vegetation% = clamp01((ndvi - NDVI_FLOOR) / (NDVI_CEIL - NDVI_FLOOR)) * 100
   *   water%      = clamp01((ndwi - NDWI_FLOOR) / (NDWI_CEIL - NDWI_FLOOR)) * 100
   *
   * Floor/ceiling values live in CONFIG.LULC_THRESHOLDS so they can be
   * retuned without touching this logic — same pattern as
   * CONFIG.IMPACT_THRESHOLDS above.
   *
   * This is only ever used as a fallback when no field-verified
   * lulc_analysis row exists for the intervention — see app.js. It
   * returns null (rendered as "pending") if the satellite row is
   * missing any of the four NDVI/NDWI values it needs.
   *
   * @param {object} satellite - row from satellite_analysis (may be null)
   * @returns {{before_vegetation:number, after_vegetation:number, before_water:number, after_water:number, derived:true}|null}
   */
  function deriveLulcFromIndices(satellite) {
    if (!satellite ||
        satellite.before_ndvi == null || satellite.after_ndvi == null ||
        satellite.before_ndwi == null || satellite.after_ndwi == null) {
      return null;
    }

    const T = CONFIG.LULC_THRESHOLDS;
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const round1 = (x) => Math.round(x * 10) / 10;
    const vegPct = (ndvi) => round1(clamp01((ndvi - T.NDVI_FLOOR) / (T.NDVI_CEIL - T.NDVI_FLOOR)) * 100);
    const waterPct = (ndwi) => round1(clamp01((ndwi - T.NDWI_FLOOR) / (T.NDWI_CEIL - T.NDWI_FLOOR)) * 100);

    return {
      before_vegetation: vegPct(satellite.before_ndvi),
      after_vegetation: vegPct(satellite.after_ndvi),
      before_water: waterPct(satellite.before_ndwi),
      after_water: waterPct(satellite.after_ndwi),
      derived: true // flag consumed by ui.js to label this as an estimate, not field data
    };
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

  return { STATUS, assess, badgeMeta, formatSigned, indicatorStatus, lulcCategories, deriveLulcFromIndices, formatSignedPercent };
})();
