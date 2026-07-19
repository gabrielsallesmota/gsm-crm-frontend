import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "ghost" | "danger";

export function Button({
  variant = "ghost",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const cls = [styles.btn, styles[variant], className].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}
