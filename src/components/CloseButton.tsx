/** 44px close target shared by every overlay — the drawn icon stays small, the hit area does not. */
export default function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="닫기"
      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-200 ease-spring hover:bg-black/[0.05] hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-white/[0.08] dark:hover:text-slate-200"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
