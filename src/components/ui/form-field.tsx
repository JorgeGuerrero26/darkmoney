import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  errorKey?: string;
  hasError?: boolean;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function FormField({
  label,
  hint,
  error,
  errorKey,
  hasError = false,
  required = false,
  children,
  className = "",
}: FormFieldProps) {
  const showErrorRing = hasError || Boolean(error);

  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="text-[0.8125rem] font-medium tracking-[0.01em] text-storm">
        {label}
        {required ? <span className="ml-1 text-[#d6b69b]">*</span> : null}
      </span>
      <div
        className={`mt-2 ${showErrorRing ? "field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs leading-5 text-rosewood">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 break-words text-xs leading-5 text-storm/75">{hint}</p>
      ) : null}
    </label>
  );
}
