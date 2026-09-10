/**
 * interventions.js
 * ------------------------------------------------------------------
 * Client-side search + type filtering for the Interventions tab's
 * cross-watershed discovery table. Does not re-fetch from the
 * database — it filters the in-memory array already loaded via
 * DB.getAllInterventions(). Also holds the small summarize() helper
 * used by the Map tab's per-watershed summary cards.
 * ------------------------------------------------------------------
 */

const Interventions = (() => {

  /**
   * Search + type filter over the full cross-watershed list. No
   * status column here — status is a per-watershed, satellite-derived
   * concept shown on the Map tab's summary cards, not a property of
   * this discovery table. Matches on id / name / type / watershed name.
   */
  function filterAll(interventions, searchTerm, typeFilter) {
    const term = (searchTerm || '').trim().toLowerCase();
    return interventions.filter(iv => {
      const matchesType = !typeFilter || typeFilter === 'All Types' || iv.intervention_type === typeFilter;
      const matchesSearch = !term ||
        iv.intervention_id.toLowerCase().includes(term) ||
        iv.name.toLowerCase().includes(term) ||
        iv.intervention_type.toLowerCase().includes(term) ||
        (iv.watershed_name || '').toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
  }

  function distinctTypes(interventions) {
    return [...new Set(interventions.map(i => i.intervention_type))].sort();
  }

  /**
   * @param {Array<string>} statusList - impact status strings (one per
   *   intervention that has a resolvable status) for the CURRENTLY
   *   SELECTED watershed — used by the Map tab's summary cards.
   */
  function summarize(statusList) {
    const summary = { total: statusList.length, IMPROVED: 0, UNCHANGED: 0, 'NEEDS ATTENTION': 0 };
    statusList.forEach(s => { if (summary[s] !== undefined) summary[s]++; });
    return summary;
  }

  return { filterAll, distinctTypes, summarize };
})();
