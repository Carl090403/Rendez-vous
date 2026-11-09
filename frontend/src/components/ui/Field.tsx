import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const CONTROL =
  "block w-full min-h-11 rounded-xl border bg-white px-3 py-2 text-base text-neutral-900 sm:text-sm " +
  "placeholder:text-neutral-400 focus:outline-2 focus:outline-offset-1 focus:outline-neutral-900 " +
  "disabled:bg-neutral-100";

type FieldShellProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

function FieldShell({ id, label, error, hint, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-800">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-neutral-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

function borderColor(error?: string) {
  return error ? "border-red-600" : "border-neutral-300";
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
};

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <FieldShell id={inputId} label={label} error={error} hint={hint}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(inputId, error, hint)}
        className={`${CONTROL} ${borderColor(error)} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
};

export function Select({ label, error, id, className = "", children, ...props }: SelectProps) {
  const generated = useId();
  const selectId = id ?? generated;
  return (
    <FieldShell id={selectId} label={label} error={error}>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(selectId, error)}
        className={`${CONTROL} ${borderColor(error)} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  ref?: Ref<HTMLTextAreaElement>;
};

export function Textarea({ label, error, id, className = "", ...props }: TextareaProps) {
  const generated = useId();
  const areaId = id ?? generated;
  return (
    <FieldShell id={areaId} label={label} error={error}>
      <textarea
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(areaId, error)}
        className={`${CONTROL} ${borderColor(error)} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}
