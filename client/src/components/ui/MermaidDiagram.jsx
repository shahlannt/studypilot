import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../../context/ThemeContext';

// Strip markdown code fences so the raw Mermaid code is passed to render.
// The AI sometimes wraps the diagram in ```mermaid … ``` inside the JSON
// string, and mermaid.render chokes on the fences.
function stripFences(code) {
  return String(code)
    .replace(/^```(?:mermaid)?\s*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}

// Lightweight wrapper: renders a Mermaid diagram to inline SVG.
// Picks the mermaid theme from the app's current theme and re-renders on theme change.
export default function MermaidDiagram({ code, className = '' }) {
  const host = useRef(null);
  const idRef = useRef(`mmd-${Math.random().toString(36).slice(2, 10)}`);
  const { theme } = useTheme();

  useEffect(() => {
    const el = host.current;
    if (!el || !code || !String(code).trim()) return;
    let cancelled = false;

    const cleanCode = stripFences(code);
    if (!cleanCode) return;

    const draw = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: theme === 'dark' ? 'dark' : 'default',
          fontFamily: 'inherit'
        });
        const { svg } = await mermaid.render(idRef.current, cleanCode);
        if (!cancelled) { el.innerHTML = svg; }
      } catch (e) {
        // Invalid Mermaid code — show the raw code instead of blowing up.
        if (!cancelled) {
          const pre = document.createElement('pre');
          pre.className = 'm-0 rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs overflow-auto';
          pre.textContent = cleanCode;
          el.innerHTML = '';
          el.appendChild(pre);
        }
      }
    };

    draw();
    return () => { cancelled = true; };
  }, [code, theme]);

  return <div ref={host} className={`overflow-x-auto ${className}`} />;
}