const TOAST_ROOT_ID = "custom-toast-root";
const DEFAULT_DURATION_MS = 3200;

const ensureRoot = () => {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(TOAST_ROOT_ID);
  if (existing) return existing;

  const root = document.createElement("div");
  root.id = TOAST_ROOT_ID;
  Object.assign(root.style, {
    position: "fixed",
    top: "18px",
    right: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    zIndex: "9999",
    pointerEvents: "none"
  });
  document.body.appendChild(root);
  return root;
};

export const howCustomToast = (
  title: string,
  message: string,
  icon: string,
  durationMs: number = DEFAULT_DURATION_MS
) => {
  const root = ensureRoot();
  if (!root) return;

  const toast = document.createElement("div");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  Object.assign(toast.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 14px",
    minWidth: "260px",
    maxWidth: "360px",
    backgroundColor: "#101010",
    color: "#fff",
    border: "2px solid #ffcb05",
    boxShadow: "4px 4px 0 rgba(0,0,0,0.35)",
    fontFamily: "inherit",
    opacity: "0",
    transform: "translateY(-6px)",
    transition: "opacity 160ms ease, transform 160ms ease"
  });

  const iconSpan = document.createElement("span");
  iconSpan.textContent = icon;
  Object.assign(iconSpan.style, {
    fontSize: "18px"
  });

  const textWrap = document.createElement("div");
  Object.assign(textWrap.style, {
    display: "flex",
    flexDirection: "column",
    gap: "2px"
  });

  const titleEl = document.createElement("div");
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: "14px",
    fontWeight: "bold"
  });

  const messageEl = document.createElement("div");
  messageEl.textContent = message;
  Object.assign(messageEl.style, {
    fontSize: "12px",
    color: "#f6f1c1"
  });

  textWrap.appendChild(titleEl);
  textWrap.appendChild(messageEl);
  toast.appendChild(iconSpan);
  toast.appendChild(textWrap);
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  }, durationMs);
};
