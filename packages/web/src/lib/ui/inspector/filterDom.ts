import { getSearchText, matchesTokens, normalize, tokensFromQuery } from '$lib/ui/inspector/searchText';

type SearchStats = {
  query: string;
  matches: number;
  panels: number;
  details: number;
  rows: number;
};

type SearchParams = {
  query: string;
  onStats?: (stats: SearchStats) => void;
};

type SearchInput = string | SearchParams;

function parseInput(input: SearchInput): SearchParams {
  if (typeof input === 'string') {
    return { query: input };
  }

  return input;
}

function setForcedPanelOpen(panel: HTMLElement, open: boolean) {
  panel.dispatchEvent(new CustomEvent<boolean>('searchforcedopen', { detail: open }));
}

export function filterDom(node: HTMLElement, input: SearchInput) {
  let params = parseInput(input);
  let query = params.query;
  let onStats = params.onStats;
  let timer: number | null = null;
  const hiddenBySearch = new Set<HTMLElement>();
  const detailsRestore = new Map<HTMLDetailsElement, boolean>();

  function clearHidden() {
    for (const el of hiddenBySearch) {
      el.hidden = false;
    }
    hiddenBySearch.clear();
  }

  function setHidden(el: HTMLElement, hidden: boolean) {
    if (hidden) {
      if (!el.hidden) el.hidden = true;
      hiddenBySearch.add(el);
      return;
    }

    if (hiddenBySearch.has(el)) {
      el.hidden = false;
      hiddenBySearch.delete(el);
    }
  }

  function resetDetails() {
    for (const [details, open] of detailsRestore.entries()) {
      details.open = open;
    }
    detailsRestore.clear();
  }

  function clearMatches() {
    node.querySelectorAll('.search-match').forEach((el) => el.classList.remove('search-match'));
  }

  function reportStats(stats: SearchStats) {
    onStats?.(stats);
  }

  function resetSearch() {
    clearHidden();
    resetDetails();
    clearMatches();

    const panels = Array.from(node.querySelectorAll<HTMLElement>('[data-panel-title]'));
    for (const panel of panels) {
      setForcedPanelOpen(panel, false);
    }

    reportStats({ query: '', matches: 0, panels: 0, details: 0, rows: 0 });
  }

  function applySearch() {
    const normalized = normalize(query);
    if (!normalized) {
      resetSearch();
      return;
    }

    const tokens = tokensFromQuery(normalized);
    const panels = Array.from(node.querySelectorAll<HTMLElement>('[data-panel-title]'));

    let panelMatches = 0;
    let detailMatches = 0;
    let rowMatches = 0;

    for (const panel of panels) {
      const panelText = getSearchText(panel);
      const panelTitleMatch = matchesTokens(panelText, tokens);
      panel.classList.toggle('search-match', panelTitleMatch);
      if (panelTitleMatch) panelMatches += 1;

      let anyRowVisible = false;
      let anyDetailsVisible = false;

      const detailsList = Array.from(panel.querySelectorAll<HTMLDetailsElement>('.control-details'));
      const detailRows = new Set<HTMLElement>();

      for (const details of detailsList) {
        const summary = details.querySelector('summary');
        const summaryMatch = summary ? matchesTokens(getSearchText(summary), tokens) : false;
        if (summary) summary.classList.toggle('search-match', summaryMatch);
        if (summaryMatch) detailMatches += 1;

        const rows = Array.from(details.querySelectorAll<HTMLElement>('.control-row'));
        let anyDetailRowVisible = false;
        for (const row of rows) {
          detailRows.add(row);
          const rowTextMatch = matchesTokens(getSearchText(row), tokens);
          const rowMatch = panelTitleMatch || summaryMatch || rowTextMatch;
          row.classList.toggle('search-match', rowTextMatch);
          if (rowTextMatch) rowMatches += 1;
          setHidden(row, !rowMatch);
          if (rowMatch && !row.hidden) anyDetailRowVisible = true;
        }

        const detailsMatch = panelTitleMatch || summaryMatch || anyDetailRowVisible;
        setHidden(details, !detailsMatch);
        if (detailsMatch) {
          anyDetailsVisible = true;
          if (!details.open) {
            if (!detailsRestore.has(details)) detailsRestore.set(details, details.open);
            details.open = true;
          }
        }
      }

      const rows = Array.from(panel.querySelectorAll<HTMLElement>('.control-row')).filter((row) => !detailRows.has(row));
      for (const row of rows) {
        const rowTextMatch = matchesTokens(getSearchText(row), tokens);
        const rowMatch = panelTitleMatch || rowTextMatch;
        row.classList.toggle('search-match', rowTextMatch);
        if (rowTextMatch) rowMatches += 1;
        setHidden(row, !rowMatch);
        if (rowMatch && !row.hidden) anyRowVisible = true;
      }

      const panelVisible = panelTitleMatch || anyRowVisible || anyDetailsVisible;
      setHidden(panel, !panelVisible);
      setForcedPanelOpen(panel, panelVisible);
    }

    const matches = rowMatches + panelMatches + detailMatches;
    reportStats({
      query: normalized,
      matches,
      panels: panelMatches,
      details: detailMatches,
      rows: rowMatches
    });
  }

  function scheduleApply() {
    if (timer) window.clearTimeout(timer);
    if (!normalize(query)) {
      applySearch();
      return;
    }
    timer = window.setTimeout(applySearch, 120);
  }

  scheduleApply();

  return {
    update(nextInput: SearchInput) {
      params = parseInput(nextInput);
      query = params.query;
      onStats = params.onStats;
      scheduleApply();
    },
    destroy() {
      if (timer) window.clearTimeout(timer);
      resetSearch();
    }
  };
}
