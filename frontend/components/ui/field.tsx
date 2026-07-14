import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Champs de formulaire partages (§2 uniformite — un SEUL style de champ).
 *
 * Remplace la constante `FIELD_CLASS` redefinie a l'identique dans chaque dialogue
 * (tache / projet / utilisateur) et la variante des ecrans d'auth. `Field` fournit le
 * couple label + marqueur « obligatoire », `Input` / `Textarea` / `Select` partagent
 * `FIELD_CLASSNAME`. Presentationnels (utilisables cote serveur comme client).
 */
export const FIELD_CLASSNAME =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";

export function Field({
  label,
  htmlFor,
  required = false,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASSNAME} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASSNAME} ${className}`} {...rest} />;
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLASSNAME} ${className}`} {...rest}>
      {children}
    </select>
  );
}
