import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bouton partage de l'application (§2 uniformite — un SEUL style par role).
 *
 * Remplace les ~11 boutons declares en Tailwind inline (paddings divergents px-3 py-1.5 /
 * px-3 py-2.5 / px-4 py-2) par une primitive unique. Invariants de design :
 *   - `primary`   = bleu de marque = ACTION (creer / enregistrer / valider).
 *   - `secondary` = contour neutre (action secondaire de meme rang).
 *   - `ghost`     = plat (Annuler / fermer).
 *   - `danger`    = rouge SEMANTIQUE `--color-danger` (destructif), texte `on-primary`
 *                   (jeton, plus de `text-white` code en dur).
 * L'etat `loading` desactive le bouton et affiche un spinner a la place de `leftIcon`
 * (feedback immediat, skill : loading-buttons). L'anneau de focus vient du `:focus-visible`
 * global de `globals.css`.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Affiche un spinner et desactive le bouton pendant une operation asynchrone. */
  loading?: boolean;
  /** Icone optionnelle avant le libelle (remplacee par le spinner si `loading`). */
  leftIcon?: ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "border border-border text-foreground hover:bg-foreground/5",
  ghost: "text-muted-foreground hover:bg-foreground/5",
  danger: "bg-danger text-on-primary hover:opacity-90",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden /> : leftIcon}
      {children}
    </button>
  );
}
