import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export function Dropdown({ trigger, children, align = 'right', width = 'w-48' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const alignClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}>
        {typeof trigger === 'function' ? trigger(open) : trigger}
      </button>
      {open && (
        <div
          className={`absolute z-30 mt-2 ${alignClass} ${width} rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-cardHover py-1 animate-fade-in`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon: Icon, children, onClick, danger = false }) {
  return (
    <button
      onClick={() => {
        onClick?.();
      }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
      }`}
      role="menuitem"
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function SelectMenu({ value, onChange, options, placeholder = 'Select...', icon: Icon }) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`input pr-8 ${Icon ? 'pl-9' : ''} appearance-none cursor-pointer`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
      {Icon && <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />}
    </div>
  );
}