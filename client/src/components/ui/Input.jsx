import { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  { label, error, className = '', id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={`input ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ label, error, id, ...props }, ref) {
  const inputId = id || props.name;
  return (
    <div>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <textarea id={inputId} ref={ref} className={`input ${error ? 'border-red-400' : ''} min-h-[100px]`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
});

export function Select({ label, error, id, children, ...props }) {
  const inputId = id || props.name;
  return (
    <div>
      {label && <label htmlFor={inputId} className="label">{label}</label>}
      <select id={inputId} className="input" {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}