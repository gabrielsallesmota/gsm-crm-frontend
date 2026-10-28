import type { CalEvent } from "../../types/event";
import styles from "./AgendaGrid.module.css";

/** Cor do evento: origem externa tem cor própria; do CRM segue o tipo. */
export function eventTone(event: CalEvent): string {
  if (event.source === "google") return styles.toneGoogle ?? "";
  if (event.source === "microsoft") return styles.toneMicrosoft ?? "";
  if (event.source === "apple") return styles.toneApple ?? "";
  if (event.type === "retorno") return styles.toneRetorno ?? "";
  if (event.type === "visita") return styles.toneVisita ?? "";
  return styles.toneReuniao ?? "";
}
