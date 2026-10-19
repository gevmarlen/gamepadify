import type { createCollection } from './collection.js';

interface Page {
  section: 'collection' | 'journeys' | 'journal';
  title: string;
  eyebrow: string;
  description?: string;
  worlds?: readonly string[];
  back?: string;
}

const pages: Record<string, Page> = {
  collection: { section: 'collection', title: 'Small worlds.', eyebrow: 'YOUR COLLECTION', description: 'A small place to wander.' },
  journeys: { section: 'journeys', title: 'Take the scenic route.', eyebrow: 'JOURNEYS', back: 'collection' },
  journal: { section: 'journal', title: 'Your field notes.', eyebrow: 'JOURNAL', back: 'collection' },
  'journeys/slow': { section: 'collection', title: 'Slow mornings.', eyebrow: 'JOURNEY / 01', description: 'Warm sand, quiet water, room to grow.', worlds: ['Dune', 'Tide', 'Bloom'], back: 'journeys' },
  'journeys/motion': { section: 'collection', title: 'Always moving.', eyebrow: 'JOURNEY / 02', description: 'From an orbit to a ripple. Nothing stands still.', worlds: ['Orbit', 'Tide', 'Echo'], back: 'journeys' },
  'journeys/balance': { section: 'collection', title: 'In balance.', eyebrow: 'JOURNEY / 03', description: 'Shapes, circles and a little symmetry.', worlds: ['Mono', 'Orbit', 'Echo'], back: 'journeys' },
};

export function createPages(collection: ReturnType<typeof createCollection>, beforeChange: () => void, afterChange: (page: Page) => void) {
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const worlds = new Map([...get('collection').querySelectorAll<HTMLButtonElement>('[data-world]')].map(button => [button.dataset.world!, button]));
  const visited = new Set<string>();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = pages.collection!;
  let animation: Animation | undefined;

  for (const thumbnail of document.querySelectorAll<HTMLElement>('[data-journey-art]')) {
    thumbnail.append(worlds.get(thumbnail.dataset.journeyArt!)!.querySelector('.art')!.cloneNode(true));
  }

  function updateJournal() {
    get('journal-count').textContent = `${visited.size} / ${worlds.size} visited`;
    get('empty-journal').hidden = visited.size > 0;
    get('journal-list').hidden = get('journal-actions').hidden = visited.size === 0;
  }

  function render() {
    const requested = location.hash.slice(2);
    const key = Object.hasOwn(pages, requested) ? requested : 'collection';
    if (location.hash !== `#/${key}`) history.replaceState(history.state, '', `#/${key}`);
    beforeChange();
    current = pages[key]!;
    animation?.cancel();
    for (const view of document.querySelectorAll<HTMLElement>('[data-page]')) view.hidden = view.dataset.page !== current.section;
    if (current.section === 'collection') {
      collection.show(current.worlds);
      get('collection-description').textContent = current.description!;
    }
    get('page-title').textContent = current.title;
    get('page-eyebrow').textContent = current.eyebrow;
    get('page-back').hidden = !current.back;
    const back = get<HTMLAnchorElement>('back-page');
    back.href = `#/${current.back ?? 'collection'}`;
    back.dataset.route = current.back ?? 'collection';
    back.textContent = current.back === 'journeys' ? '← Back to journeys' : '← Back to collection';
    for (const link of document.querySelectorAll<HTMLAnchorElement>('.page-links a')) {
      if (link.dataset.route === key.split('/')[0]) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = `Gamepadify — ${current.title}`;
    const view = document.querySelector<HTMLElement>(`[data-page="${current.section}"]`)!;
    if (!motion.matches) animation = view.animate([{ opacity: .55, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
    afterChange(current);
  }

  get('clear-journal').addEventListener('click', () => {
    visited.clear(); get('journal-list').replaceChildren(); updateJournal();
    get('last-action').textContent = 'A fresh page. Your journal is empty.';
    get('empty-journal').querySelector<HTMLElement>('a')!.focus({ preventScroll: true });
  });
  motion.addEventListener('change', () => { if (motion.matches) animation?.cancel(); });
  window.addEventListener('hashchange', render);

  return {
    start: render,
    current: () => current,
    visit(name: string) {
      if (visited.has(name)) return;
      visited.add(name);
      const original = worlds.get(name)!;
      const button = document.createElement('button');
      button.className = 'world';
      button.dataset.world = name;
      button.dataset.gamepadFocusable = '';
      button.append(original.querySelector('.art')!.cloneNode(true), original.querySelector('.world-meta')!.cloneNode(true));
      get('journal-list').append(button);
      updateJournal();
    },
  };
}
