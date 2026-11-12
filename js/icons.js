/* CubeClock – własne ikony SVG (odznaki osiągnięć, seria, rekord) */
(function () {
  'use strict';

  const svg = (body, cls) => `<svg class="${cls || 'ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const num = (n, y, size) => `<text x="12" y="${y}" text-anchor="middle" fill="currentColor" stroke="none" font-family="'Nunito Variable', system-ui, sans-serif" font-weight="800" font-size="${size}">${n}</text>`;

  // każdy rysunek mieści się w polu 24x24
  const DRAW = {
    // kostka izometryczna
    cube: () => '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/><path d="M8 5.2l8 4.5M16 5.2 8 9.7M4 12l8 4.5 8-4.5" stroke-width="1.1" opacity=".6"/>',
    cube2: () => '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/><path d="M8 5.3l8 4.5M8 9.8v9M16 9.8v9M4 12l8 4.5 8-4.5" stroke-width="1.1" opacity=".6"/>',
    cube7: () => '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/><path d="M6.3 8.8v9M8.6 10.1v9M10.3 11v9M13.7 11v9M15.4 10.1v9M17.7 8.8v9M4 9.9l8 4.5 8-4.5M4 12.3l8 4.5 8-4.5M4 14.7l8 4.5 8-4.5" stroke-width=".7" opacity=".55"/>',
    // liczba ułożeń: kostka z liczbą
    count: (n) => `<path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" stroke-width="1.5" opacity=".55"/>${num(n, 15.6, n.length > 2 ? 7 : 8.5)}`,
    // stoper z liczbą sekund
    watch: (n) => `<circle cx="12" cy="13.5" r="8"/><path d="M10 2.5h4M12 2.5v3M18.6 6.4l1.4-1.4"/>${num(n, 16.6, 8)}`,
    // wykres średniej z liczbą nad osią
    avg: (n) => `<path d="M3.5 20h17"/><path d="M4.5 17l4.5-4.5 3 2.5 7.5-7.5" stroke-width="1.4" opacity=".5"/>${num(n, 10.5, 8)}`,
    // płomień serii z liczbą
    flame: (n) => `<path d="M12 21.5c-4.2 0-7-2.8-7-6.6 0-3.7 2.5-5.7 3.9-8.2.4 1.9 1.4 3 2.6 3.5-.3-3.2.9-5.9 3.4-7.7.2 3 1.8 4.6 3.1 6.4 1 1.4 1.5 3 1.5 4.8 0 4.4-3.1 7.8-7.5 7.8z"/>${n ? num(n, 18.3, 7) : ''}`,
    // kalendarz z liczbą
    cal: (n) => `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>${num(n, 18, 7.5)}`,
    target: () => '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    sparkle: () => '<path d="M12 3.5c.6 4 2.4 6 6.5 6.5-4.1.6-5.9 2.5-6.5 6.5-.6-4-2.4-5.9-6.5-6.5 4.1-.5 5.9-2.5 6.5-6.5z"/><path d="M18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5z" stroke-width="1.3"/>',
    pentagon: () => '<path d="M12 3 21 9.6 17.6 20H6.4L3 9.6z"/><path d="M12 7.6l4.8 3.5-1.8 5.6H9l-1.8-5.6z" stroke-width="1.2" opacity=".6"/><path d="M12 3v4.6M21 9.6l-4.2 1.5M17.6 20 15 16.7M6.4 20 9 16.7M3 9.6l4.2 1.5" stroke-width="1.1" opacity=".6"/>',
    stack: () => '<rect x="3" y="13" width="7" height="7" rx="1.2"/><rect x="14" y="13" width="7" height="7" rx="1.2"/><rect x="8.5" y="4" width="7" height="7" rx="1.2"/>',
    shapes: () => '<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><path d="M17 3.5l4 7h-8z"/><circle cx="7" cy="17" r="3.5"/><path d="M17 13.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>',
    eye: () => '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    compass: () => '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9z"/>',
    moon: () => '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z"/><path d="M16.5 4v3M15 5.5h3" stroke-width="1.3"/>',
    sunrise: () => '<path d="M5.5 17a6.5 6.5 0 0 1 13 0M2.5 17h19M12 4.5v3M5.2 8.7l2 2M18.8 8.7l-2 2M7 20.5h10"/>',
    dnf: () => '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
    run: () => '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l2.5-5.5 3 2.5V22M6 11.5l3-3.5 4.5.8 2.5 3.7 3 .5M10.5 15.5l2.5-6.7"/>',
    trophy: () => '<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7l-.8-3h-5.4z"/>',
  };

  function icon(name, arg, cls) {
    const f = DRAW[name] || DRAW.cube;
    return svg(f(arg ? String(arg) : ''), cls);
  }

  window.Icons = { icon };
})();
