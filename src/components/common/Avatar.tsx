import { initials } from "../../utils/initials";
import styles from "./Avatar.module.css";

export function Avatar({
  name,
  bg,
  color,
  size = 34,
}: {
  name: string;
  bg: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      className={styles.avatar}
      style={{ background: bg, color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
