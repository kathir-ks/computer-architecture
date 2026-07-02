import { CHAPTER_TITLES, NARRATION } from '../story/script';
import { parseMarkers } from '../story/markers';

/**
 * No-WebGL fallback (FR-012): a labeled SVG building plus the complete story
 * text rendered from the SAME script.ts — the lesson survives without 3D and
 * can never drift from the real narration.
 */
export function mountStaticFallback(): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '<div id="fallback"></div>';
  const root = document.getElementById('fallback')!;

  root.innerHTML = `
    <h1 style="color:var(--accent);letter-spacing:.1em;margin-bottom:6px">CPU BUILDING</h1>
    <p class="para" style="color:var(--text-dim)">Your browser can't show the 3D building,
    so here is the tour on paper — same story, same lesson.</p>
    ${buildingSvg()}
  `;

  for (const [ci, paragraphs] of NARRATION.entries()) {
    const h = document.createElement('p');
    h.className = 'chapter-title';
    h.textContent = CHAPTER_TITLES[ci];
    root.appendChild(h);
    for (const raw of paragraphs) {
      const { plainText, spans } = parseMarkers(raw);
      const p = document.createElement('p');
      p.className = 'para';
      let cursor = 0;
      for (const s of spans) {
        p.appendChild(document.createTextNode(plainText.slice(cursor, s.start)));
        const em = document.createElement('em');
        em.textContent = plainText.slice(s.start, s.end);
        p.appendChild(em);
        cursor = s.end;
      }
      p.appendChild(document.createTextNode(plainText.slice(cursor)));
      root.appendChild(p);
    }
  }
}

function buildingSvg(): string {
  const row = (y: number, label: string, color: string, cycles: string) =>
    `<rect x="120" y="${y}" width="160" height="34" fill="${color}" opacity="0.35" stroke="${color}"/>
     <text x="130" y="${y + 22}" fill="#dce4f5" font-size="13">${label}</text>
     <text x="292" y="${y + 22}" fill="#ffd75e" font-size="12">${cycles}</text>`;
  return `<svg viewBox="0 0 420 460" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="The CPU as a ten-story building: registers and the Worker on floor 10, L1 caches on floor 9, L2 on floor 8, RAM on floor 4, disk warehouse outside">
    <rect x="110" y="20" width="180" height="400" fill="none" stroke="#00e5ff" stroke-width="2"/>
    <text x="140" y="14" fill="#00e5ff" font-size="12" letter-spacing="2">CPU CORE TOWER</text>
    ${row(30, 'Floor 10 · Worker + registers', '#2affb0', '≈0 cyc')}
    ${row(70, 'Floor 9 · L1i + L1d caches', '#00e5ff', '4 cyc')}
    ${row(110, 'Floor 8 · L2 cache', '#00b8d4', '12 cyc')}
    ${row(150, 'Floor 7', '#223056', '')}
    ${row(190, 'Floor 6', '#223056', '')}
    ${row(230, 'Floor 5', '#223056', '')}
    ${row(270, 'Floor 4 · RAM archive', '#35558a', '200 cyc')}
    ${row(310, 'Floor 3', '#223056', '')}
    ${row(350, 'Floor 2', '#223056', '')}
    ${row(382, 'Floor 1 · lobby', '#223056', '')}
    <rect x="10" y="360" width="80" height="60" fill="#2e2a45" stroke="#7a62d1"/>
    <text x="16" y="352" fill="#7a62d1" font-size="12">Disk · warehouse</text>
    <text x="14" y="392" fill="#dce4f5" font-size="11">millions of</text>
    <text x="14" y="406" fill="#dce4f5" font-size="11">cycles away</text>
    <line x1="90" y1="400" x2="110" y2="400" stroke="#7a62d1" stroke-dasharray="4 3"/>
  </svg>`;
}
