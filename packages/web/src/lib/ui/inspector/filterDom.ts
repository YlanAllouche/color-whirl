function norm(s: string): string {
  return s.trim().toLowerCase();
}

function textOf(el: Element): string {
  return norm(el.textContent ?? '');
}

export function filterDom(node: HTMLElement, query: string) {
  let q = norm(query);

  function apply() {
    q = norm(query);

    const panels = Array.from(node.querySelectorAll<HTMLElement>('[data-panel-title]'));

    if (!q) {
      for (const el of node.querySelectorAll<HTMLElement>('[hidden]')) el.hidden = false;
      return;
    }

    for (const panel of panels) {
      const rows = Array.from(panel.querySelectorAll<HTMLElement>('.control-row'));
      for (const row of rows) row.hidden = !textOf(row).includes(q);

      const details = Array.from(panel.querySelectorAll<HTMLElement>('.control-details'));
      for (const d of details) {
        const summary = d.querySelector('summary');
        const summaryMatch = summary ? textOf(summary).includes(q) : false;
        const dRows = Array.from(d.querySelectorAll<HTMLElement>('.control-row'));
        const anyRowVisible = dRows.some((r) => !r.hidden);
        d.hidden = !(summaryMatch || anyRowVisible);
      }

      const title = panel.getAttribute('data-panel-title') ?? '';
      const titleMatch = norm(title).includes(q);
      const anyRowVisible = rows.some((r) => !r.hidden);
      const anyDetailsVisible = details.some((d) => !d.hidden);

      panel.hidden = !(titleMatch || anyRowVisible || anyDetailsVisible);
    }
  }

  apply();

  return {
    update(nextQuery: string) {
      query = nextQuery;
      apply();
    },
    destroy() {
      // noop
    }
  };
}
