import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName | undefined;
  danger?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Si se define, el elemento es una opcion exclusiva (menuitemradio). */
  checked?: boolean | undefined;
  onSelect: () => void;
}

export interface MenuButtonProps {
  /** Nombre accesible del boton que abre el menu. */
  label: string;
  items: readonly MenuItem[];
  /** Contenido visual del boton (icono, avatar...). */
  children: ReactNode;
  align?: "start" | "end";
  triggerClassName?: string | undefined;
}

const ENABLED_ITEMS = '[role^="menuitem"]:not([aria-disabled="true"])';

function enabledItems(list: HTMLElement | null): HTMLElement[] {
  return list
    ? Array.from(list.querySelectorAll<HTMLElement>(ENABLED_ITEMS))
    : [];
}

/** Menu desplegable con el patron ARIA "menu button" y teclado completo. */
export function MenuButton({
  label,
  items,
  children,
  align = "end",
  triggerClassName,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<"first" | "last">("first");
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const elements = enabledItems(listRef.current);
    (focusTarget.current === "last" ? elements.at(-1) : elements[0])?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const inside =
        event.target instanceof Node && rootRef.current?.contains(event.target);
      if (!inside) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    focusTarget.current = event.key === "ArrowUp" ? "last" : "first";
    setOpen(true);
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const elements = enabledItems(listRef.current);
    const current = elements.findIndex((el) => el === document.activeElement);
    const focusAt = (index: number) => {
      event.preventDefault();
      elements.at(index % elements.length)?.focus();
    };
    if (event.key === "ArrowDown") focusAt(current + 1);
    else if (event.key === "ArrowUp") focusAt(current <= 0 ? -1 : current - 1);
    else if (event.key === "Home") focusAt(0);
    else if (event.key === "End") focusAt(-1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") setOpen(false);
  }

  return (
    <div className="vd-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cx("vd-menu__trigger", triggerClassName)}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          focusTarget.current = "first";
          setOpen((value) => !value);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {children}
      </button>
      {open ? (
        <div
          id={menuId}
          ref={listRef}
          role="menu"
          aria-label={label}
          className={cx("vd-menu__list", `vd-menu__list--${align}`)}
          onKeyDown={onListKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              tabIndex={-1}
              role={item.checked === undefined ? "menuitem" : "menuitemradio"}
              aria-checked={item.checked}
              aria-disabled={item.disabled || undefined}
              className={cx(
                "vd-menu__item",
                item.danger && "vd-menu__item--danger",
              )}
              onClick={() => {
                if (item.disabled) return;
                close(true);
                item.onSelect();
              }}
            >
              {item.icon ? <Icon name={item.icon} size="sm" /> : null}
              <span className="vd-menu__label">{item.label}</span>
              {item.checked ? <Icon name="check" size="sm" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
