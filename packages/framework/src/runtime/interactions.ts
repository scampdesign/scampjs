/**
 * Variant interactions that need the browser to remember something:
 * a click that opens a menu, a click outside or Escape that closes it.
 * CONTRACT.md §1.3.2. The component declares them as literal attributes,
 * so it stays free of expressions:
 *
 *   data-scamp-click="state:closed=open,open=closed"    on the clicked element
 *   data-scamp-outside="state:open=closed"              on the component's root
 *   data-scamp-escape="state:open=closed"               on the component's root
 *
 * Each group is `<axis>:<from>=<to>,…`; `*` as `from` matches any value.
 * The handler sets `data-<axis>` on the nearest element carrying it, the
 * component's root. Hover, press, and focus are CSS and need none of this.
 */

export type Transition = { from: string | null; to: string };
export type InteractionGroup = { axis: string; transitions: Transition[] };

const AXIS = /^[a-z][a-z0-9]*$/;
const VALUE = /^[a-z][a-z0-9-]*$/;

/** Read an attribute's groups; anything malformed is skipped, not thrown. */
export const parseInteractions = (value: string): InteractionGroup[] =>
  value
    .trim()
    .split(/\s+/)
    .flatMap((group) => {
      const at = group.indexOf(':');
      const axis = group.slice(0, at);
      if (at <= 0 || !AXIS.test(axis)) return [];
      const transitions = group
        .slice(at + 1)
        .split(',')
        .flatMap((pair): Transition[] => {
          const [from = '', to = '', ...rest] = pair.split('=');
          if (rest.length > 0 || !VALUE.test(to)) return [];
          if (from === '*') return [{ from: null, to }];
          return VALUE.test(from) ? [{ from, to }] : [];
        });
      return transitions.length > 0 ? [{ axis, transitions }] : [];
    });

/** The value a transition takes `current` to: an exact `from` first, then `*`. Null when none applies. */
export const nextValue = (
  transitions: ReadonlyArray<Transition>,
  current: string | null,
): string | null =>
  (
    transitions.find((t) => t.from !== null && t.from === current) ??
    transitions.find((t) => t.from === null)
  )?.to ?? null;

const apply = (el: Element, attribute: string): void => {
  for (const group of parseInteractions(el.getAttribute(attribute) ?? '')) {
    const name = `data-${group.axis}`;
    const root = el.closest(`[${name}]`);
    if (root === null) continue;
    const next = nextValue(group.transitions, root.getAttribute(name));
    if (next !== null) root.setAttribute(name, next);
  }
};

const INSTALLED = Symbol.for('scampjs.interactions');

/**
 * Listen once, on the document, for every component on the page. Safe to
 * call twice: the dev shell and a hydrated route can both load it.
 */
export const installInteractions = (doc: Document): void => {
  const flagged = doc as Document & { [INSTALLED]?: true };
  if (flagged[INSTALLED] === true) return;
  flagged[INSTALLED] = true;
  doc.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    for (const root of Array.from(
      doc.querySelectorAll('[data-scamp-outside]'),
    )) {
      if (target === null || !root.contains(target))
        apply(root, 'data-scamp-outside');
    }
    const clicked = target?.closest('[data-scamp-click]') ?? null;
    if (clicked !== null) apply(clicked, 'data-scamp-click');
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const root of Array.from(doc.querySelectorAll('[data-scamp-escape]')))
      apply(root, 'data-scamp-escape');
  });
};

/** Whether a view's or component's source declares a click, outside, or Escape interaction. */
export const declaresInteractions = (source: string): boolean =>
  /\sdata-scamp-(?:click|outside|escape)=/.test(source);
