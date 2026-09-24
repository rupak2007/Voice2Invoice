import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap '
  + 'transition-[background-color,border-color,color,opacity] duration-[120ms] '
  + 'disabled:opacity-40 disabled:pointer-events-none';

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px]',
  md: 'h-9.5 px-4 text-[13.5px]',
  lg: 'h-11 px-5 text-[14.5px]',
};

/**
 * Exactly one primary per screen. Teal is the product's signal colour, so a
 * second solid-teal button on the same view devalues the first.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-press',
  secondary: 'border border-line bg-raised text-ink hover:border-line-strong hover:bg-elevated',
  ghost: 'text-dim hover:bg-raised hover:text-ink',
  quiet: 'text-accent hover:bg-accent-soft',
  danger: 'border border-danger-line bg-danger-soft text-danger hover:bg-danger/20',
};

/** Shared so links look identical to buttons without duplicating styles. */
export function buttonStyles(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra = '') {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={buttonStyles(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

interface ExternalLinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function ExternalLinkButton({
  variant = 'secondary', size = 'md', className = '', children, ...rest
}: ExternalLinkButtonProps) {
  return (
    <a className={buttonStyles(variant, size, className)} target="_blank" rel="noreferrer" {...rest}>
      {children}
    </a>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls must still be announced. */
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted
        transition-colors duration-[120ms] hover:bg-raised hover:text-ink
        disabled:pointer-events-none disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
