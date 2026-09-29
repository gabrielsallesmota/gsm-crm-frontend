import { useEffect, useRef, useState, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogos empilhados (ex.: confirmação por cima de um formulário): só o
// do topo reage a Tab/Esc.
const stack: HTMLElement[] = [];
// `overflow` do body antes do PRIMEIRO diálogo — restaurado quando o
// último fecha, em qualquer ordem.
let bodyOverflowBefore = "";

const FIELDS =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Comportamento acessível de diálogo (Etapa 4), compartilhado por `Modal`
 * e pelos drawers:
 * - foco inicial no primeiro campo (ou no próprio diálogo) e volta ao
 *   elemento que abriu, ao fechar;
 * - Tab/Shift+Tab presos dentro do diálogo (focus trap);
 * - Esc fecha — exceto se `isDirty()` indicar dados digitados (aí só o
 *   botão Cancelar/Fechar descarta, evitando perder o formulário);
 * - trava o scroll do fundo enquanto aberto.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  isDirty: () => boolean = () => false,
): void {
  // Quem abriu o diálogo, capturado no RENDER: no efeito já seria tarde —
  // o `autoFocus` do primeiro campo roda antes e roubaria a referência.
  const [opener] = useState(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const onCloseRef = useRef(onClose);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    onCloseRef.current = onClose;
    isDirtyRef.current = isDirty;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (stack.length === 0) bodyOverflowBefore = document.body.style.overflow;
    stack.push(node);

    // `autoFocus` de um campo já resolveu o foco; senão, o primeiro campo
    // do formulário e, sem campos, o primeiro botão/link.
    if (!node.contains(document.activeElement)) {
      const first =
        node.querySelector<HTMLElement>(FIELDS) ?? node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus();
    }

    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (!node || stack[stack.length - 1] !== node) return;
      if (e.key === "Escape") {
        if (!isDirtyRef.current()) {
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = stack.lastIndexOf(node);
      if (index >= 0) stack.splice(index, 1);
      if (stack.length === 0) document.body.style.overflow = bodyOverflowBefore;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [ref, opener]);
}
