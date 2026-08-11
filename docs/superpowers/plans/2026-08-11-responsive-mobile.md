# 반응형 모바일 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱 전용으로 만들어진 가계부 웹앱의 5개 페이지 전부를 375px 화면에서 쓸 수 있게 만든다. 데스크톱 화면은 시각적으로 변하지 않는다.

**Architecture:** 단일 코드베이스 반응형. `md`(768px) 미만이 모바일이다. 대부분은 기존 컴포넌트에 Tailwind 반응형 클래스를 추가하는 일이고, 새로 만드는 것은 하단 탭바, 공용 하단 시트, 거래 카드 리스트/편집 시트뿐이다. 거래 목록만 CSS 숨김이 아니라 `useMediaQuery`로 한쪽만 렌더한다 — 행마다 `<input>`/`<select>`를 만드는 테이블을 이중으로 마운트하면 DOM이 두 배가 되기 때문이다.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3.4 (`darkMode: 'class'`), react-router-dom 6, recharts 2, zustand, vitest + jsdom

## Global Constraints

- 모바일 브레이크포인트는 `md`(768px)다. Tailwind 기본 브레이크포인트를 쓰고 커스텀 브레이크포인트를 추가하지 않는다.
- 기존 `lg:grid-cols-2` / `sm:grid-cols-2` 분기는 건드리지 않는다. 태블릿→데스크톱 전환을 담당한다.
- 새로 쓰는 클래스는 모바일 우선이다: 베이스가 모바일, `md:`/`lg:`가 넓은 화면.
- 새 npm 의존성을 추가하지 않는다. 아이콘은 인라인 SVG로 만든다.
- 모든 색상은 다크모드 짝을 가져야 한다 (`dark:` 클래스). 하드코딩된 hex 대신 `tailwind.config.js`의 토큰(`accent`, `canvas`, `surface`, `income`, `spending`, `saving`)을 쓴다.
- 데스크톱(≥1024px) 렌더 결과는 작업 전과 동일해야 한다. 이번 작업은 좁은 화면을 고치는 것이지 넓은 화면을 바꾸는 것이 아니다.
- 테스트 러너는 `npm run test` (vitest). 타입체크는 `npm run build` (`tsc -b && vite build`).
- 테스트는 순수 함수(`src/lib/*.ts`)에만 붙인다. 이 저장소에는 컴포넌트 렌더 테스트가 없고 이번 작업에서 도입하지 않는다.

---

### Task 1: 축약 통화 포맷 (`formatKRWCompact`)

좁은 화면에서 차트 Y축이 `1,200,000` 같은 라벨 때문에 폭을 크게 잃는다. 축약 포맷을 만든다.

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `formatKRWCompact(amount: number): string` — Task 8이 차트 Y축 `tickFormatter`로 쓴다.

기존 `src/lib/format.ts`에는 `formatKRW`(→ `1,200,000원`)와 `formatManwon`(→ `120만원`)이 있다. 새 함수는 축 눈금용이라 `원` 접미사를 붙이지 않고 억 단위까지 처리한다.

- [ ] **Step 1: Write the failing test**

`src/lib/format.test.ts` 파일 맨 아래에 추가한다. 파일 상단의 import 문에 `formatKRWCompact`를 추가하는 것도 잊지 말 것.

```ts
describe('formatKRWCompact', () => {
  it('만 단위 미만은 천 단위 구분자만 붙인다', () => {
    expect(formatKRWCompact(0)).toBe('0')
    expect(formatKRWCompact(850)).toBe('850')
    expect(formatKRWCompact(8500)).toBe('8,500')
    expect(formatKRWCompact(9999)).toBe('9,999')
  })

  it('만 단위는 만으로 축약한다', () => {
    expect(formatKRWCompact(10000)).toBe('1만')
    expect(formatKRWCompact(1200000)).toBe('120만')
    expect(formatKRWCompact(15000)).toBe('1.5만')
  })

  it('만 단위에서 소수 둘째 자리는 버린다', () => {
    expect(formatKRWCompact(12345)).toBe('1.2만')
  })

  it('억 단위는 억으로 축약한다', () => {
    expect(formatKRWCompact(100000000)).toBe('1억')
    expect(formatKRWCompact(120000000)).toBe('1.2억')
    expect(formatKRWCompact(2500000000)).toBe('25억')
  })

  it('음수는 부호를 유지한다', () => {
    expect(formatKRWCompact(-1200000)).toBe('-120만')
    expect(formatKRWCompact(-8500)).toBe('-8,500')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- format`
Expected: FAIL — `formatKRWCompact is not a function` 또는 import 오류

- [ ] **Step 3: Implement**

`src/lib/format.ts` 맨 아래에 추가한다.

```ts
/** Axis-tick formatter: drops the 원 suffix and collapses 만/억 so labels stay narrow on phones. */
export function formatKRWCompact(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  if (abs >= 100_000_000) return `${sign}${trimUnit(abs / 100_000_000)}억`
  if (abs >= 10_000) return `${sign}${trimUnit(abs / 10_000)}만`
  return `${sign}${abs.toLocaleString('ko-KR')}`
}

// One decimal place, but never a trailing ".0" — "1만" reads better than "1.0만" on an axis.
function trimUnit(value: number): string {
  return (Math.trunc(value * 10) / 10).toLocaleString('ko-KR', { maximumFractionDigits: 1 })
}
```

`Math.trunc`를 쓰는 이유: `12345 / 10000 = 1.2345`를 반올림하면 `1.2`로 같지만, `19999 / 10000 = 1.9999`는 반올림하면 `2만`이 되어 실제보다 커 보인다. 축 눈금은 실제 값을 넘지 않는 편이 낫다.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- format`
Expected: PASS (기존 `formatKRW`/`formatManwon` 테스트 포함 전부)

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: add a compact currency formatter for narrow chart axes"
```

---

### Task 2: 지출 강도 함수 추출 (`spendingIntensity`)

`CalendarGrid.tsx:71`에 강도 계산이 매직 넘버와 함께 JSX 안에 박혀 있다. 순수 함수로 빼고 테스트를 붙인다. **동작은 그대로 유지한다 — 시각적 변화 없음.**

**Files:**
- Modify: `src/lib/monthDetailAggregations.ts`
- Modify: `src/components/month/CalendarGrid.tsx:71`
- Test: `src/lib/monthDetailAggregations.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `spendingIntensity(spending: number, maxSpending: number): number` — 0 이상 0.6 이하. Task 7이 캘린더 셀에서 계속 쓴다.

- [ ] **Step 1: Write the failing test**

`src/lib/monthDetailAggregations.test.ts` 맨 아래에 추가한다. 상단 import에 `spendingIntensity`를 추가할 것.

```ts
describe('spendingIntensity', () => {
  it('지출이 없으면 0을 반환한다 — 셀에 배경색이 칠해지지 않는다', () => {
    expect(spendingIntensity(0, 50000)).toBe(0)
    expect(spendingIntensity(-100, 50000)).toBe(0)
  })

  it('최대 지출액이 0 이하면 0으로 나누지 않고 0을 반환한다', () => {
    expect(spendingIntensity(0, 0)).toBe(0)
    expect(spendingIntensity(1000, 0)).toBe(0)
  })

  it('최댓값인 날은 상한 0.6을 받는다', () => {
    expect(spendingIntensity(50000, 50000)).toBeCloseTo(0.6)
  })

  it('지출이 있는 날은 최소 0.1의 바닥값을 받아 배경이 보인다', () => {
    expect(spendingIntensity(1, 1_000_000)).toBeGreaterThanOrEqual(0.1)
  })

  it('최댓값의 절반은 0.1 + 0.25 = 0.35다', () => {
    expect(spendingIntensity(25000, 50000)).toBeCloseTo(0.35)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- monthDetailAggregations`
Expected: FAIL — `spendingIntensity is not a function`

- [ ] **Step 3: Implement**

`src/lib/monthDetailAggregations.ts` 맨 아래에 추가한다.

```ts
/**
 * Background opacity for a calendar day cell, scaled against the month's heaviest spending day.
 * The 0.1 floor keeps any day with spending visibly tinted rather than fading to nothing, and the
 * 0.5 span keeps the darkest cell light enough for the date number to stay readable in both themes.
 */
export function spendingIntensity(spending: number, maxSpending: number): number {
  if (spending <= 0 || maxSpending <= 0) return 0
  return 0.1 + (spending / maxSpending) * 0.5
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- monthDetailAggregations`
Expected: PASS

- [ ] **Step 5: 호출부를 교체한다**

`src/components/month/CalendarGrid.tsx`에서:

import 문을 바꾼다 (2번째 줄):
```ts
import { dailySummaries, spendingIntensity, weeklySpendingBands } from '../../lib/monthDetailAggregations'
```

71번째 줄을 바꾼다:
```ts
const intensity = spendingIntensity(day.spending, maxSpending)
```

`maxSpending`은 19번째 줄에서 `Math.max(1, ...)`로 계산되므로 항상 1 이상이다. 함수의 0 방어는 그 계산이 나중에 바뀌어도 안전하도록 남겨 둔다.

- [ ] **Step 6: 전체 테스트와 빌드를 돌린다**

Run: `npm run test`
Expected: PASS (전부)

Run: `npm run build`
Expected: 성공 — 타입 오류 없음

- [ ] **Step 7: Commit**

```bash
git add src/lib/monthDetailAggregations.ts src/lib/monthDetailAggregations.test.ts src/components/month/CalendarGrid.tsx
git commit -m "refactor: extract the calendar cell spending intensity into a tested function"
```

---

### Task 3: 뷰포트 메타와 전역 타이포그래피

safe-area를 쓰려면 `viewport-fit=cover`가 먼저 있어야 한다. 다크모드에서 상단 바가 흰색으로 뜨는 문제도 여기서 고친다.

**Files:**
- Modify: `index.html:5`, `index.html:8`
- Modify: `src/index.css` (`.page-title`)

**Interfaces:**
- Consumes: 없음
- Produces: `env(safe-area-inset-*)`가 동작하는 문서. Task 4의 하단 탭바가 이것에 의존한다.

- [ ] **Step 1: viewport에 `viewport-fit=cover`를 추가한다**

`index.html` 5번째 줄:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

이게 없으면 `env(safe-area-inset-bottom)`이 iOS에서 항상 `0px`으로 계산된다.

- [ ] **Step 2: theme-color를 라이트/다크로 분리한다**

`index.html` 8번째 줄 (`<meta name="theme-color" content="#f8fafc" />`)을 두 줄로 바꾼다:

```html
<meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#0a0a0b" media="(prefers-color-scheme: dark)" />
```

값은 `tailwind.config.js`의 `canvas.light` / `canvas.dark`와 일치시킨 것이다. 기존 `#f8fafc`는 어느 토큰과도 맞지 않는 값이었다.

- [ ] **Step 3: `.page-title`을 반응형으로 만든다**

`src/index.css`의 `.page-title` (108-110번째 줄 근처):

```css
  .page-title {
    @apply text-2xl font-semibold tracking-[-0.02em] text-slate-900 md:text-3xl dark:text-white;
  }
```

`text-3xl`(30px)이 `md:` 뒤로 밀리므로 데스크톱은 그대로고 모바일에서만 24px가 된다.

- [ ] **Step 4: 빌드로 확인한다**

Run: `npm run build`
Expected: 성공

`npm run dev`를 띄우고 브라우저 폭을 1440px로 두었을 때 페이지 제목 크기가 변하지 않았는지 확인한다.

- [ ] **Step 5: Commit**

```bash
git add index.html src/index.css
git commit -m "feat: opt into safe-area insets and scale page titles down on phones"
```

---

### Task 4: 하단 탭바

**Files:**
- Create: `src/components/NavIcons.tsx`
- Create: `src/components/BottomNav.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: Task 3의 `viewport-fit=cover`
- Produces:
  - `src/components/AppShell.tsx`에서 `export const navItems: { to: string; label: string; end: boolean; icon: ComponentType<{ className?: string }> }[]` — `BottomNav`가 import 한다.
  - `src/components/BottomNav.tsx`의 `export default function BottomNav(): JSX.Element`

- [ ] **Step 1: 아이콘 컴포넌트를 만든다**

`src/components/NavIcons.tsx` 신규 생성. 5개 전부 24×24 stroke 아이콘이고 `currentColor`로 그리므로 부모의 텍스트 색을 따라간다. `BrandMark.tsx`와 같은 인라인 SVG 방식이라 새 의존성이 없다.

```tsx
interface IconProps {
  className?: string
}

// Shared stroke setup: 1.75 reads crisply at 22px without looking heavy next to the 10px labels.
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...strokeProps}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...strokeProps}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  )
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...strokeProps}>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...strokeProps}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}

export function ImportIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...strokeProps}>
      <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}
```

- [ ] **Step 2: `AppShell`의 `navItems`에 아이콘을 붙이고 export 한다**

`src/components/AppShell.tsx` 상단. import 문에 아이콘을 추가하고 배열을 export 한다.

```tsx
import { CalendarIcon, ChartIcon, DashboardIcon, ImportIcon, ListIcon } from './NavIcons'

// Exported so BottomNav renders exactly the same destinations in the same order as the desktop nav —
// two hand-maintained lists would drift.
export const navItems = [
  { to: '/', label: '대시보드', end: true, icon: DashboardIcon },
  { to: '/monthly', label: '월간 상세', end: false, icon: CalendarIcon },
  { to: '/entries', label: '거래 관리', end: false, icon: ListIcon },
  { to: '/analytics', label: '분석', end: false, icon: ChartIcon },
  { to: '/import', label: '불러오기', end: false, icon: ImportIcon },
]
```

기존 `const navItems = [...]`를 이걸로 대체한다. 데스크톱 nav는 `item.icon`을 쓰지 않으므로 렌더 결과가 바뀌지 않는다.

- [ ] **Step 3: `BottomNav`를 만든다**

`src/components/BottomNav.tsx` 신규 생성.

```tsx
import { NavLink } from 'react-router-dom'
import { navItems } from './AppShell'

export default function BottomNav() {
  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-20 border-t md:hidden"
      // The inset keeps the tab row above the iOS home indicator instead of underneath it.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {navItems.map(({ to, label, end, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 transition-colors duration-200 ${
                isActive
                  ? 'text-accent dark:text-accent-light'
                  : 'text-slate-500 active:text-slate-800 dark:text-slate-400 dark:active:text-slate-100'
              }`
            }
          >
            <Icon className="h-[22px] w-[22px]" />
            <span className="text-[10px] font-medium leading-none tracking-[-0.01em]">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

`md:hidden`이므로 데스크톱에서는 렌더되긴 하지만 화면에 나타나지 않는다. 요소 5개뿐이라 DOM 비용이 무의미하다 — 거래 테이블과 달리 조건부 렌더가 필요 없다.

- [ ] **Step 4: `AppShell`에 붙이고 여백을 조정한다**

`src/components/AppShell.tsx`:

import를 추가한다:
```tsx
import BottomNav from './BottomNav'
```

헤더 컨테이너 (71번째 줄 근처) — 모바일에서 좌우 여백을 줄인다:
```tsx
<div className="mx-auto flex max-w-[1800px] items-center gap-6 px-4 py-3.5 md:px-8">
```

데스크톱 `<nav>` (77번째 줄) — 모바일에서 감춘다:
```tsx
<nav ref={navRef} className="segmented relative hidden md:inline-flex">
```

`.segmented`가 `inline-flex`를 포함하므로 `hidden`만 붙이면 특이도 충돌로 계속 보일 수 있다. `md:inline-flex`를 함께 붙여 명시적으로 되살린다.

`<main>` (117번째 줄):
```tsx
<main key={pathname} className="mx-auto max-w-[1800px] px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10">
```

`pb-28`(7rem)은 탭바 높이(아이콘 22 + 간격 4 + 라벨 10 + 상하 패딩 16 ≈ 52px)와 safe-area, 그리고 마지막 카드가 탭바에 딱 붙지 않을 여유를 합친 값이다.

닫는 `</main>` 바로 뒤, `</div>` 앞에 탭바를 넣는다:
```tsx
      </main>

      <BottomNav />
    </div>
```

- [ ] **Step 5: 빌드하고 확인한다**

Run: `npm run build`
Expected: 성공

Run: `npm run dev`

브라우저 개발자도구의 디바이스 툴바로 확인한다:
- 375px — 상단에 브랜드 + 테마 토글만, 하단에 탭 5개. 탭을 누르면 이동하고 활성 탭이 accent 색으로 바뀐다
- 1440px — 탭바가 보이지 않고 상단 가로 네비게이션과 슬라이딩 pill이 작업 전과 똑같이 동작한다
- 767px → 768px로 폭을 넘나들 때 탭바와 가로 네비게이션이 정확히 교대하는지 확인한다
- 라이트/다크 양쪽에서 탭바 배경(`glass`)이 콘텐츠와 구분되는지 확인한다

- [ ] **Step 6: Commit**

```bash
git add src/components/NavIcons.tsx src/components/BottomNav.tsx src/components/AppShell.tsx
git commit -m "feat: swap the header nav for a bottom tab bar on phones"
```

---

### Task 5: 공용 `Sheet` 컴포넌트

거래 편집(Task 6)과 날짜 상세(Task 7)가 함께 쓸 하단 시트다.

**Files:**
- Modify: `tailwind.config.js`
- Create: `src/components/Sheet.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `src/components/Sheet.tsx`의
  ```ts
  export default function Sheet(props: {
    title: string
    onClose: () => void
    children: React.ReactNode
    footer?: React.ReactNode
  }): JSX.Element
  ```
  Task 6의 `EntryEditSheet`가 쓴다. 열림/닫힘은 호출부가 조건부 렌더로 제어한다 (`{open && <Sheet .../>}`) — 기존 `DayTransactionPanel`과 같은 패턴이다.

- [ ] **Step 1: `slide-up` 애니메이션을 추가한다**

`tailwind.config.js`의 `keyframes` 블록에 추가한다 (기존 `slide-in-right` 다음):

```js
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
```

`animation` 블록에 추가한다:

```js
        'slide-up': 'slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
```

기존 `slide-in-right`과 같은 지속시간·커브다. 시트가 옆이 아니라 아래에서 올라온다는 것만 다르다.

- [ ] **Step 2: `Sheet`를 만든다**

`src/components/Sheet.tsx` 신규 생성.

```tsx
import { useEffect, type ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** Pinned below the scrolling body so actions stay reachable in a long form. */
  footer?: ReactNode
}

/**
 * Bottom sheet used for anything that needs a form or a detail list on a phone. Capped at 85vh so
 * the page behind stays partly visible — a full-height panel reads as a route change rather than a
 * temporary overlay, and the user loses track of where they were.
 */
export default function Sheet({ title, onClose, children, footer }: SheetProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    // Locking the body prevents the page underneath from scrolling when the sheet's own content
    // reaches its end — otherwise a flick inside the sheet drags the whole app.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] dark:bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-black/[0.06] bg-surface-light shadow-2xl dark:border-white/[0.07] dark:bg-surface-dark"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.07]">
          <p className="text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</p>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all duration-200 ease-spring hover:bg-black/[0.05] hover:text-slate-700 active:scale-90 dark:text-slate-500 dark:hover:bg-white/[0.08] dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="shrink-0 border-t border-black/[0.06] px-5 py-3 dark:border-white/[0.07]"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
```

`z-30`/`z-40`은 헤더(`z-10`)와 탭바(`z-20`)보다 위다. 시트가 탭바를 덮는 것이 맞다.

- [ ] **Step 3: 빌드로 확인한다**

Run: `npm run build`
Expected: 성공

이 시점에는 아직 아무도 `Sheet`를 쓰지 않으므로 화면 변화가 없다. `tsc`가 미사용 export를 오류로 잡지 않는지만 확인한다 (`tsconfig.json`에 `noUnusedLocals`가 있어도 export된 것은 대상이 아니다).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js src/components/Sheet.tsx
git commit -m "feat: add a shared bottom sheet with a slide-up entrance"
```

---

### Task 6: 거래 관리 카드 리스트와 편집 시트

이 계획에서 가장 큰 작업이다. `EntriesPage`가 `EntriesTable`에 17개 prop을 넘기고 있으므로, 카드 리스트가 같은 목록을 두 번 받지 않도록 prop 타입을 먼저 추출한다.

**Files:**
- Create: `src/lib/useMediaQuery.ts`
- Modify: `src/components/entries/EntriesTable.tsx` (prop 타입 추출 + export)
- Create: `src/components/entries/EntriesCardList.tsx`
- Create: `src/components/entries/EntryEditSheet.tsx`
- Modify: `src/pages/EntriesPage.tsx`
- Modify: `src/components/entries/EntriesToolbar.tsx`

**Interfaces:**
- Consumes: Task 5의 `Sheet`
- Produces:
  - `src/lib/useMediaQuery.ts`의 `export function useMediaQuery(query: string): boolean`
  - `src/components/entries/EntriesTable.tsx`의 `export interface EntryListProps { ... }` 및 기존 `export interface EntryColumnDef`
  - `src/components/entries/EntriesCardList.tsx`의 `export default function EntriesCardList(props: EntryListProps): JSX.Element`
  - `src/components/entries/EntryEditSheet.tsx`의 `export default function EntryEditSheet(props: {...}): JSX.Element`

- [ ] **Step 1: `useMediaQuery` 훅을 만든다**

`src/lib/useMediaQuery.ts` 신규 생성.

```ts
import { useEffect, useState } from 'react'

/**
 * Client-only media query subscription. The initial value is read lazily from matchMedia rather
 * than defaulted to false, so the first paint already matches the real viewport — this app is a
 * Vite SPA with no SSR, so there is no hydration mismatch to worry about.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    // Re-read on subscribe: the viewport can change between the lazy initializer and this effect.
    setMatches(list.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
```

- [ ] **Step 2: `EntriesTable`에서 공유 prop 타입을 추출한다**

`src/components/entries/EntriesTable.tsx`의 `interface EntriesTableProps { ... }` (14-33번째 줄)를 이름만 바꾸고 export 한다. 필드는 하나도 바꾸지 않는다.

```tsx
/** Shared by EntriesTable (desktop) and EntriesCardList (mobile) — one list of props, two renderers. */
export interface EntryListProps {
  columns: EntryColumnDef[]
  rows: Transaction[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onBulkDelete: () => void
  onDeleteRow: (id: string) => void
  onEditField: (id: string, key: EntryColumnKey, value: string | number) => void
  sortField: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField) => void
  totalAmount: number
  draftRow: Transaction | null
  onDraftChange: (key: EntryColumnKey, value: string | number) => void
  onDraftSave: () => void
  onDraftCancel: () => void
  onStartDraft: () => void
  overrideAction?: { label: (row: Transaction) => string; onClick: (row: Transaction) => void }
}
```

함수 시그니처(100번째 줄 근처)의 타입 주석을 바꾼다:
```tsx
}: EntryListProps) {
```

또한 `EditableCell`을 편집 시트에서 재사용할 수 있게 export 한다. 40번째 줄의 `function EditableCell({`를 `export function EditableCell({`로 바꾼다. `resolveOptions`는 `EditableCell` 내부에서만 쓰이므로 export 하지 않는다.

Run: `npm run build`
Expected: 성공 — 순수 리네이밍이라 동작 변화 없음

- [ ] **Step 3: `EntryEditSheet`를 만든다**

`src/components/entries/EntryEditSheet.tsx` 신규 생성.

```tsx
import Sheet from '../Sheet'
import { EditableCell, type EntryColumnDef } from './EntriesTable'
import type { EntryColumnKey } from '../../lib/entriesLogic'
import type { Transaction } from '../../types/transaction'

interface EntryEditSheetProps {
  columns: EntryColumnDef[]
  row: Transaction
  /** Draft mode holds an unsaved new row: changes are staged and committed by the footer's 저장. */
  isDraft: boolean
  onChange: (key: EntryColumnKey, value: string | number) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  overrideAction?: { label: (row: Transaction) => string; onClick: (row: Transaction) => void }
}

export default function EntryEditSheet({
  columns,
  row,
  isDraft,
  onChange,
  onClose,
  onSave,
  onDelete,
  overrideAction,
}: EntryEditSheetProps) {
  // Editing an existing row writes through on every field change, matching the desktop table — so
  // the footer only needs a close button. A draft has nothing to write through to yet.
  const footer = isDraft ? (
    <div className="flex gap-2">
      <button onClick={onClose} className="btn-ghost flex-1">
        취소
      </button>
      <button onClick={onSave} className="btn-primary flex-1">
        저장
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button
        onClick={onDelete}
        className="rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 transition-all duration-200 ease-spring active:scale-[0.97] dark:text-rose-400"
      >
        삭제
      </button>
      {overrideAction && (
        <button onClick={() => overrideAction.onClick(row)} className="btn-ghost">
          {overrideAction.label(row)}
        </button>
      )}
      <button onClick={onClose} className="btn-primary ml-auto">
        완료
      </button>
    </div>
  )

  return (
    <Sheet title={isDraft ? '거래 추가' : '거래 편집'} onClose={onClose} footer={footer}>
      <div className="space-y-4">
        {columns.map((col) => (
          <label key={col.key} className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-500 dark:text-slate-400">
              {col.label}
            </span>
            <EditableCell col={col} row={row} onChange={onChange} />
          </label>
        ))}
      </div>
    </Sheet>
  )
}
```

`EditableCell`의 `onChange` 시그니처는 `(key: EntryColumnKey, value: string | number) => void`이므로 기존 행 편집이든 draft든 그대로 흘려보낼 수 있다. 호출부(`EntriesPage`)에서 어느 쪽인지 결정한다.

- [ ] **Step 4: `EntriesCardList`를 만든다**

`src/components/entries/EntriesCardList.tsx` 신규 생성.

```tsx
import { useState } from 'react'
import { formatKRW } from '../../lib/format'
import type { SortField } from '../../lib/entriesLogic'
import type { Transaction } from '../../types/transaction'
import type { EntryListProps } from './EntriesTable'
import EntryEditSheet from './EntryEditSheet'

const SORT_FIELDS: { field: SortField; label: string }[] = [
  { field: 'date', label: '날짜' },
  { field: 'amount', label: '금액' },
]

export default function EntriesCardList({
  columns,
  rows,
  selectedIds,
  onToggleSelect,
  onBulkDelete,
  onDeleteRow,
  onEditField,
  sortField,
  sortDirection,
  onSortChange,
  totalAmount,
  draftRow,
  onDraftChange,
  onDraftSave,
  onDraftCancel,
  onStartDraft,
  overrideAction,
}: EntryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingRow = editingId ? rows.find((r) => r.id === editingId) : undefined

  // A row that vanishes from the filtered list while its sheet is open (e.g. an edit moved it out
  // of the current month) would otherwise leave the sheet stuck on stale data.
  if (editingId && !editingRow) {
    if (editingId !== null) setEditingId(null)
  }

  return (
    <div className="card animate-fade-up p-4">
      <div className="mb-4 flex items-baseline justify-between border-b border-black/[0.06] pb-4 dark:border-white/[0.07]">
        <span className="text-sm text-slate-500 dark:text-slate-400">합계 ({rows.length}건)</span>
        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white">
          {formatKRW(totalAmount)}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="segmented">
          {SORT_FIELDS.map(({ field, label }) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              aria-pressed={sortField === field}
              className={`btn-ghost text-xs ${sortField === field ? 'btn-ghost-active' : ''}`}
            >
              {label} {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
            </button>
          ))}
        </div>
        <button
          onClick={onBulkDelete}
          disabled={selectedIds.size === 0}
          className="shrink-0 rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 transition-all duration-200 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 dark:text-rose-400"
        >
          선택 삭제 ({selectedIds.size})
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2.5 dark:border-white/[0.07]"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(row.id)}
              onChange={() => onToggleSelect(row.id)}
              aria-label={`${row.content} 선택`}
              className="h-4 w-4 shrink-0"
            />
            <button onClick={() => setEditingId(row.id)} className="min-w-0 flex-1 text-left">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {row.content || '(내용 없음)'}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-slate-900 dark:text-white">
                  {formatKRW(row.amount)}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
                {row.date} · {row.category} · {row.paymentMethod}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {rows.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">표시할 거래가 없습니다.</p>
      )}

      <button
        onClick={onStartDraft}
        className="mt-4 w-full rounded-xl border border-dashed border-black/[0.12] py-3 text-sm text-slate-500 transition-all duration-200 ease-spring active:scale-[0.99] dark:border-white/[0.12] dark:text-slate-400"
      >
        + 추가
      </button>

      {draftRow && (
        <EntryEditSheet
          columns={columns}
          row={draftRow}
          isDraft
          onChange={onDraftChange}
          onClose={onDraftCancel}
          onSave={onDraftSave}
          onDelete={onDraftCancel}
        />
      )}

      {editingRow && (
        <EntryEditSheet
          columns={columns}
          row={editingRow}
          isDraft={false}
          onChange={(key, value) => onEditField(editingRow.id, key, value)}
          onClose={() => setEditingId(null)}
          onSave={() => setEditingId(null)}
          onDelete={() => {
            setEditingId(null)
            onDeleteRow(editingRow.id)
          }}
          overrideAction={
            overrideAction && {
              label: overrideAction.label,
              onClick: (r: Transaction) => {
                setEditingId(null)
                overrideAction.onClick(r)
              },
            }
          }
        />
      )}
    </div>
  )
}
```

`onToggleSelectAll`은 카드 리스트에서 쓰지 않는다 (전체 선택 체크박스가 테이블 헤더 전용). `EntryListProps`가 공유 타입이라 prop은 넘어오지만 구조분해에서 빼면 `noUnusedLocals`에도 걸리지 않는다.

Step 4에서 `if (editingId && !editingRow) { if (editingId !== null) setEditingId(null) }`는 렌더 중 setState다. React는 같은 컴포넌트에 대한 렌더 중 setState를 허용하며(파생 상태 조정 패턴), 즉시 재렌더한다. 조건이 재렌더 후 거짓이 되므로 무한 루프가 아니다.

- [ ] **Step 5: `EntriesPage`에서 분기한다**

`src/pages/EntriesPage.tsx`:

import를 추가한다:
```tsx
import EntriesCardList from '../components/entries/EntriesCardList'
import { useMediaQuery } from '../lib/useMediaQuery'
```

컴포넌트 본문 상단(`const transactions = ...` 근처)에 추가한다:
```tsx
  const isDesktop = useMediaQuery('(min-width: 768px)')
```

353-374번째 줄의 `<div className="mt-4"> <EntriesTable ... /> </div>` 블록을 아래로 대체한다. prop 목록을 한 객체로 모으고 두 렌더러 중 하나에만 스프레드한다.

```tsx
      <div className="mt-4">
        {(() => {
          const listProps = {
            columns,
            rows: sortedRows,
            selectedIds,
            onToggleSelect: toggleSelect,
            onToggleSelectAll: toggleSelectAll,
            onBulkDelete: handleBulkDelete,
            onDeleteRow: handleDeleteRow,
            onEditField: handleEditField,
            sortField,
            sortDirection,
            onSortChange: handleSortChange,
            totalAmount,
            draftRow: draft,
            onDraftChange: handleDraftChange,
            onDraftSave: handleDraftSave,
            onDraftCancel: () => setDraft(null),
            onStartDraft: () => setDraft(createDraft(section, month)),
            overrideAction,
          }
          // Only one renderer mounts: the table builds an <input>/<select> per row per column, so
          // rendering both and hiding one with CSS would double the DOM for hundreds of rows.
          return isDesktop ? <EntriesTable {...listProps} /> : <EntriesCardList {...listProps} />
        })()}
      </div>
```

- [ ] **Step 6: 툴바를 좁은 화면에 맞춘다**

`src/components/entries/EntriesToolbar.tsx`:

카드 패딩 (43번째 줄):
```tsx
    <div className="card animate-fade-up p-4">
```
(이미 `p-4`이므로 그대로 둔다.)

섹션 세그먼트 래퍼 (44-45번째 줄) — 좁은 화면에서 가로 스크롤을 허용한다:
```tsx
      <div className="mb-4 -mx-1 overflow-x-auto px-1">
        <div className="segmented">
```
`-mx-1`/`px-1` 짝은 스크롤 컨테이너가 세그먼트의 포커스 링을 자르지 않게 한다.

필터 줄 (59번째 줄) — 모바일에서 2열 그리드, `md` 이상에서 기존 flex:
```tsx
      <div className="grid grid-cols-2 gap-2.5 md:flex md:flex-wrap md:items-center">
```

그 안의 컨트롤 4개가 그리드 셀을 채우도록 바꾼다:

- 61번째 줄 월 선택 `<select>`: `className="field font-medium"` → `className="field w-full font-medium md:w-auto"`
- 76-82번째 줄 검색 `<input>`: `className="field"` → `className="field w-full md:w-auto"`
- 84-88번째 줄 카테고리 `<select>`: `className="field"` → `className="field w-full md:w-auto"`
- 97-101번째 줄 결제수단 `<select>`: `className="field"` → `className="field w-full md:w-auto"`
- 110-119번째 줄 "제외됨" 토글 `<button>`: `className={...}` 템플릿 리터럴의 고정 부분 맨 앞 `rounded-lg border px-3 py-1.5`를 `w-full rounded-lg border px-3 py-1.5 md:w-auto`로 바꾼다

월 선택 `<select>`와 "일부 기간" 배지를 감싼 `<div className="flex items-center gap-2">` (60번째 줄)에는 `col-span-2 md:col-span-1`을 붙여 배지와 함께 한 줄을 쓰게 한다:
```tsx
        <div className="col-span-2 flex items-center gap-2 md:col-span-1">
```

- [ ] **Step 7: 빌드하고 테스트한다**

Run: `npm run build`
Expected: 성공

Run: `npm run test`
Expected: PASS (전부 — 이 태스크는 순수 로직을 건드리지 않는다)

- [ ] **Step 8: 브라우저에서 확인한다**

`npm run dev`, 375px에서 `/entries`:
- 카드 목록이 뜨고 카드마다 내용·금액·날짜·카테고리·결제수단이 보인다
- 카드를 탭하면 편집 시트가 아래에서 올라온다. 필드를 바꾸면 즉시 저장되고 카드에 반영된다
- 시트에서 삭제하면 확인 창이 뜨고, 확인하면 카드가 사라진다
- `+ 추가`를 누르면 같은 시트가 "거래 추가"로 열리고 저장/취소가 동작한다
- 체크박스로 여러 건을 고르고 "선택 삭제"가 동작한다 (카드 탭과 체크박스가 서로 간섭하지 않아야 한다)
- 정렬 세그먼트에서 날짜/금액을 누를 때마다 방향이 뒤집힌다
- 시트를 열고 배경을 스크롤해도 페이지가 움직이지 않는다
- 오버레이 탭과 Esc로 시트가 닫힌다

1440px에서 `/entries`:
- 기존 테이블이 작업 전과 동일하게 나온다. 인라인 편집, 정렬 헤더, 전체 선택 체크박스 전부 동작

폭을 767 ↔ 768px로 넘나들며 테이블과 카드 리스트가 교대하는지, 그때 편집 중이던 시트가 남지 않는지 확인한다.

- [ ] **Step 9: Commit**

```bash
git add src/lib/useMediaQuery.ts src/components/entries/ src/pages/EntriesPage.tsx
git commit -m "feat: render entries as a tappable card list with an edit sheet on phones"
```

---

### Task 7: 캘린더와 날짜 상세 패널

**Files:**
- Modify: `src/components/month/CalendarGrid.tsx`
- Modify: `src/components/month/DayTransactionPanel.tsx`

**Interfaces:**
- Consumes: Task 2의 `spendingIntensity`
- Produces: 없음 (표시 전용 변경)

- [ ] **Step 1: 캘린더 셀에서 모바일 금액을 감춘다**

`src/components/month/CalendarGrid.tsx`:

카드 패딩 (28번째 줄):
```tsx
    <div className="card animate-fade-up p-4 md:p-6">
```

셀 버튼 (73-78번째 줄) — 터치 타깃을 확보하고 모바일에서 가운데 정렬한다:
```tsx
                  <button
                    key={day.date}
                    onClick={() => onDayClick(day.date)}
                    className="min-h-[44px] rounded-lg p-1.5 text-center text-xs tabular-nums transition-all duration-200 ease-spring hover:scale-[1.04] hover:ring-2 hover:ring-accent/40 md:p-2 md:text-left"
                    style={{ backgroundColor: intensity > 0 ? `rgba(225, 29, 72, ${intensity})` : 'transparent' }}
                  >
```

금액 두 줄 (80-81번째 줄) — 모바일에서 감춘다. 남는 것은 날짜 숫자와 이미 있는 강도 배경이다:
```tsx
                    <div className="font-medium text-slate-700 dark:text-slate-200">{Number(day.date.slice(-2))}</div>
                    {day.income > 0 && <div className="hidden text-income md:block">+{formatKRW(day.income)}</div>}
                    {day.spending > 0 && <div className="hidden text-spending md:block">-{formatKRW(day.spending)}</div>}
```

주별 밴드 헤더의 금액은 그대로 둔다 — 주 합계는 좁은 화면에서도 읽을 만하고, 셀과 달리 가로 폭이 넉넉하다.

밴드 헤더 패딩 (43번째 줄)만 살짝 줄인다:
```tsx
            <div className="relative px-3 py-2.5 md:px-3.5">
```

- [ ] **Step 2: 날짜 상세 패널을 하단 시트로 바꾼다 (모바일에서만)**

`src/components/month/DayTransactionPanel.tsx`의 패널 `<div>` (29번째 줄)를 아래로 바꾼다. `md` 이상에서는 지금의 우측 드로어 그대로다.

```tsx
      <div className="animate-slide-up fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-black/[0.06] bg-surface-light p-6 shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-sm md:animate-slide-in-right md:rounded-none md:border-l md:border-t-0 dark:border-white/[0.07] dark:bg-surface-dark">
```

바뀐 점: `animate-slide-in-right` → `animate-slide-up md:animate-slide-in-right`, `inset-y-0 right-0` → 모바일 하단 고정 + `md:` 복원, 테두리를 `border-t` ↔ `md:border-l`로 교대.

하단 safe-area 여백을 추가한다. 같은 `<div>`에 `style`을 붙인다:
```tsx
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
```
`p-6`의 1.5rem에 인셋을 더한 값이다. 데스크톱에서는 인셋이 0이라 `p-6`과 같아진다.

이 컴포넌트는 `Sheet`를 쓰지 않는다 — 데스크톱에서 우측 드로어 형태를 유지해야 하는데 `Sheet`는 하단 시트 전용이기 때문이다. 두 형태를 한 컴포넌트에 욱여넣는 것보다 반응형 클래스로 두는 편이 읽기 쉽다.

- [ ] **Step 3: 빌드하고 확인한다**

Run: `npm run build`
Expected: 성공

`npm run dev`, 375px에서 `/monthly`:
- 캘린더 셀에 날짜 숫자만 보이고 지출이 있는 날은 붉은 배경이 진하다
- 셀을 탭하면 상세가 아래에서 올라온다. 거래 목록이 읽히고 닫기가 동작한다
- 주별 밴드 헤더의 수입/지출 금액이 잘리지 않는다

1440px에서 `/monthly`:
- 캘린더 셀에 금액 두 줄이 작업 전과 동일하게 나온다
- 날짜를 클릭하면 상세가 우측에서 슬라이드해 들어온다 (하단 시트가 아니다)

- [ ] **Step 4: Commit**

```bash
git add src/components/month/CalendarGrid.tsx src/components/month/DayTransactionPanel.tsx
git commit -m "feat: reduce calendar cells to date and intensity on phones, slide day detail up"
```

---

### Task 8: 차트 축과 KPI 카드

좁은 화면에서 Y축 라벨(`120만원`, `width={70}`)이 차트 폭을 크게 먹고 X축 라벨이 서로 겹친다.

**Files:**
- Modify: `src/components/dashboard/MonthlyTrendChart.tsx`
- Modify: `src/components/dashboard/MonthCategoryChart.tsx`
- Modify: `src/components/dashboard/TopMerchants.tsx`
- Modify: `src/components/dashboard/CategoryDonut.tsx`
- Modify: `src/components/dashboard/PaymentMethodPie.tsx`
- Modify: `src/components/analytics/WeekdayChart.tsx`
- Modify: `src/components/analytics/HourBucketChart.tsx`
- Modify: `src/components/month/SpendingPaceChart.tsx`
- Modify: `src/components/dashboard/KpiCards.tsx`

**Interfaces:**
- Consumes: Task 1의 `formatKRWCompact`, Task 6의 `useMediaQuery`
- Produces: 없음

- [ ] **Step 1: 축 값을 가진 차트 5개에 반응형 축을 적용한다**

대상: `MonthlyTrendChart`, `MonthCategoryChart`, `TopMerchants`, `WeekdayChart`, `HourBucketChart`, `SpendingPaceChart`. (`CategoryDonut`과 `PaymentMethodPie`는 파이라 축이 없다.)

각 파일에서 동일하게:

1. import를 추가한다:
```tsx
import { useMediaQuery } from '../../lib/useMediaQuery'
import { formatKRWCompact } from '../../lib/format'
```
(`formatKRWCompact`는 이미 `format`에서 다른 것을 import 중이면 그 줄에 합친다.)

2. 컴포넌트 본문 상단에 추가한다:
```tsx
  const isDesktop = useMediaQuery('(min-width: 768px)')
```

3. `<ResponsiveContainer>`의 `height`를 분기한다. 각 파일의 현재 값에 따라:
   - `height={320}` → `height={isDesktop ? 320 : 240}`
   - `height={280}` → `height={isDesktop ? 280 : 220}`
   - `height={240}` → `height={isDesktop ? 240 : 200}`
   - `MonthCategoryChart`의 `height={Math.max(240, items.length * 32)}` → `height={Math.max(isDesktop ? 240 : 200, items.length * (isDesktop ? 32 : 26))}`

4. 금액 축의 `tickFormatter`와 `width`를 분기한다. **차트마다 금액 축이 다르다** — `TopMerchants`와 `MonthCategoryChart`는 `layout="vertical"`이라 금액이 `<XAxis>`에 있고 `<YAxis>`는 이름을 표시한다. 파일별 정확한 변경:

**`MonthlyTrendChart.tsx`** (세로 막대, 금액은 YAxis, 현재 `formatManwon` + `width={70}`):
```tsx
            tickFormatter={(v) => (isDesktop ? formatManwon(v) : formatKRWCompact(v))}
            width={isDesktop ? 70 : 44}
```

**`SpendingPaceChart.tsx`**, **`WeekdayChart.tsx`**, **`HourBucketChart.tsx`** (세로 막대/선, 금액은 YAxis): 각 파일의 `<YAxis>`에 있는 기존 `tickFormatter`를 `isDesktop ?`의 참 가지에 그대로 두고 거짓 가지에 `formatKRWCompact(v)`를 넣는다. `width`가 지정돼 있으면 모바일 값을 `44`로, 없으면 `width={isDesktop ? 60 : 44}`를 새로 추가한다.

**`TopMerchants.tsx`** (가로 막대). XAxis가 금액(`type="number"`, 현재 `formatKRW`), YAxis가 가맹점 이름(`type="category"`, `width={100}`):
```tsx
          <XAxis
            type="number"
            tickFormatter={(v) => (isDesktop ? formatKRW(v) : formatKRWCompact(v))}
            tick={{ fontSize: 11, fill: theme.axisTick }}
          />
          <YAxis type="category" dataKey="label" tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }} width={isDesktop ? 100 : 72} />
```
`<BarChart>`의 `margin={{ left: 40 }}`도 모바일에서 줄인다: `margin={{ left: isDesktop ? 40 : 0 }}`.

**`MonthCategoryChart.tsx`** (가로 막대, 같은 구조, YAxis `width={90}`):
```tsx
            <XAxis
              type="number"
              tickFormatter={(v) => (isDesktop ? formatKRW(v) : formatKRWCompact(v))}
              tick={{ fontSize: 11, fill: theme.axisTick }}
            />
            <YAxis type="category" dataKey="label" tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }} width={isDesktop ? 90 : 68} />
```
`margin={{ left: 20 }}` → `margin={{ left: isDesktop ? 20 : 0 }}`.

5. 월/날짜 라벨을 쓰는 `<XAxis>`에 겹침 방지를 추가한다 (`MonthlyTrendChart`, `SpendingPaceChart` — 가로 막대 차트 두 개는 XAxis가 금액이므로 해당 없음):
```tsx
            interval={isDesktop ? 0 : 'preserveStartEnd'}
            tick={{ fontSize: isDesktop ? 12 : 10, fill: theme.axisTick }}
```

6. 이 6개 차트 카드의 패딩을 `p-6` → `p-4 md:p-6`으로 바꾼다.

- [ ] **Step 2: 파이 차트 2개를 조정한다**

`CategoryDonut`, `PaymentMethodPie`: 축이 없으므로 높이와 패딩만 손본다.

```tsx
  const isDesktop = useMediaQuery('(min-width: 768px)')
```
```tsx
          <ResponsiveContainer width="100%" height={isDesktop ? 240 : 200}>
```
카드 패딩 `p-6` → `p-4 md:p-6`.

`<Pie>`에 `outerRadius`가 하드코딩돼 있으면 모바일에서 줄인다 (예: `outerRadius={isDesktop ? 80 : 66}`). 없으면 recharts가 컨테이너에 맞추므로 그대로 둔다.

- [ ] **Step 3: KPI 카드를 2열로 만든다**

`src/components/dashboard/KpiCards.tsx` 54번째 줄:
```tsx
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
```

`grid-cols-1 sm:grid-cols-2`가 `grid-cols-2`로 합쳐진다. 모바일 1열이면 카드 5장이 세로로 너무 길다. `lg:grid-cols-5`는 그대로라 데스크톱은 변하지 않는다.

카드 (56번째 줄):
```tsx
          <div key={card.label} className={`card card-interactive animate-fade-up p-4 md:p-6 ${STAGGER[i]}`}>
```

숫자 (60번째 줄) — `text-[26px]`을 반응형으로:
```tsx
            <p className={`text-[20px] font-semibold leading-none tracking-[-0.02em] md:text-[26px] ${card.color}`}>
```

라벨 (57번째 줄)은 `text-[13px]` 그대로 둔다.

- [ ] **Step 4: 빌드하고 테스트한다**

Run: `npm run build`
Expected: 성공

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: 브라우저에서 확인한다**

375px에서 `/`와 `/analytics`, `/monthly`:
- Y축 라벨이 `120만` 형태로 짧고 차트 그리기 영역이 넉넉하다
- X축 월 라벨이 서로 겹치지 않는다
- KPI 카드가 2열로 배치되고 금액이 카드 밖으로 넘치지 않는다
- 어떤 차트도 가로 스크롤을 만들지 않는다 (`document.body.scrollWidth === window.innerWidth`)

1440px:
- 모든 차트가 작업 전과 동일한 높이·축 포맷(`120만원`)으로 나온다
- KPI 카드가 5열이다

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/ src/components/analytics/ src/components/month/SpendingPaceChart.tsx
git commit -m "feat: shrink chart axes and stack KPI cards two-up on phones"
```

---

### Task 9: 페이지 헤더와 세그먼트 컨트롤

대시보드와 분석 페이지 헤더에 세그먼트 컨트롤이 있고, 375px에서 가로로 넘친다.

**Files:**
- Modify: `src/pages/DashboardPage.tsx:54-68`
- Modify: `src/pages/AnalyticsPage.tsx:69-92`, `:61`
- Modify: `src/pages/MonthDetailPage.tsx:38`, `:49`
- Modify: `src/pages/EntriesPage.tsx:314`, `:322`
- Modify: `src/pages/ImportPage.tsx:65`, `:92`, `:121`, `:129`
- Modify: `src/components/analytics/CategoryTrendRanking.tsx:19`, `InsightFeed.tsx:13`, `SubscriptionList.tsx:14`
- Modify: `src/components/dashboard/CategoryHeatmap.tsx:40`
- Modify: `src/components/month/MonthSummaryCard.tsx:12`, `:28`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 대시보드 헤더**

`src/pages/DashboardPage.tsx` 54-68번째 줄:

```tsx
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8">
        <h1 className="page-title animate-fade-up">대시보드</h1>
        <div className="animate-fade-up stagger-1 -mx-1 w-full overflow-x-auto px-1 md:mx-0 md:w-auto md:overflow-visible md:px-0">
          <div className="segmented">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
                className={`btn-ghost whitespace-nowrap ${period === p.value ? 'btn-ghost-active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
```

바뀐 점: 스크롤 래퍼 `<div>`가 하나 늘었고, 모바일에서 `w-full`이라 세그먼트가 제목 아래 줄로 내려간다. `whitespace-nowrap`이 "최근 12개월" 같은 라벨의 줄바꿈을 막는다. `md:` 이상에서는 래퍼가 투명해져 기존 배치 그대로다.

- [ ] **Step 2: 분석 헤더**

`src/pages/AnalyticsPage.tsx` 69-92번째 줄:

```tsx
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8">
        <h1 className="page-title animate-fade-up">분석</h1>
        <div className="animate-fade-up stagger-1 flex w-full flex-wrap items-center gap-3 md:w-auto">
          <select value={month} onChange={(e) => setSelectedMonth(e.target.value)} className="field w-full font-medium md:w-auto">
            {[...availableMonths].reverse().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="-mx-1 w-full overflow-x-auto px-1 md:mx-0 md:w-auto md:overflow-visible md:px-0">
            <div className="segmented">
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  aria-pressed={period === p.value}
                  className={`btn-ghost whitespace-nowrap ${period === p.value ? 'btn-ghost-active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: 월간 상세와 거래 관리 헤더의 여백을 맞춘다**

`src/pages/MonthDetailPage.tsx` 49번째 줄:
```tsx
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 md:mb-8">
```

`src/pages/EntriesPage.tsx` 322번째 줄:
```tsx
      <h1 className="page-title animate-fade-up mb-6 md:mb-8">거래 입력/관리</h1>
```

`src/pages/ImportPage.tsx` 65번째 줄:
```tsx
      <h1 className="page-title animate-fade-up mb-6 md:mb-8">데이터 불러오기</h1>
```

- [ ] **Step 4: 남은 카드 패딩을 훑는다**

Task 6-8이 손대지 않은 카드들이 아직 모바일에서 `p-6`(24px 좌우)을 쓴다. 375px에서 `<main>`의 `px-4`까지 더하면 콘텐츠 폭이 295px로 줄어든다. 아래 파일에서 `p-6` → `p-4 md:p-6`으로 바꾼다 (기계적 치환, 같은 줄의 다른 클래스는 건드리지 않는다):

- `src/components/analytics/CategoryTrendRanking.tsx:19`
- `src/components/analytics/InsightFeed.tsx:13`
- `src/components/analytics/SubscriptionList.tsx:14`
- `src/components/dashboard/CategoryHeatmap.tsx:40`
- `src/components/month/MonthSummaryCard.tsx:12` 와 `:28` (두 군데 — 빈 상태 카드와 본 카드)
- `src/pages/ImportPage.tsx:92`, `:121`, `:129`
- `src/pages/AnalyticsPage.tsx:61`, `src/pages/EntriesPage.tsx:314`, `src/pages/MonthDetailPage.tsx:38` (세 곳 다 "불러온 데이터가 없습니다" 빈 상태 카드)

`src/components/entries/EntriesTable.tsx:104`는 바꾸지 않는다 — Task 6 이후 데스크톱에서만 렌더된다.

`src/components/month/MonthInfographics.tsx`는 위 목록에 없다 (`p-6` 카드를 쓰지 않는 구조다). 이 컴포넌트는 Step 5의 육안 확인으로만 다룬다 — 375px에서 넘치는 요소가 있으면 그때 고친다.

- [ ] **Step 5: 빌드하고 확인한다**

Run: `npm run build`
Expected: 성공

375px에서 `/`와 `/analytics`:
- 제목 아래 줄에 기간 선택이 놓이고, 넘치면 가로로만 스크롤된다. 페이지 자체는 가로로 스크롤되지 않는다
- 분석 페이지의 월 선택 셀렉트가 한 줄을 다 쓴다

375px에서 `/monthly`와 `/import`:
- `MonthSummaryCard`, `MonthInfographics`, 불러오기 미리보기 카드의 내용이 넘치거나 잘리지 않는다

1440px: 두 페이지 헤더가 작업 전과 동일하다 (제목 왼쪽, 컨트롤 오른쪽 한 줄). 모든 카드 패딩이 24px 그대로다.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ src/components/
git commit -m "feat: stack page headers, scroll segmented controls, tighten card padding on phones"
```

---

### Task 10: 최종 검증

**Files:**
- Modify: `README.md` (필요 시)

**Interfaces:**
- Consumes: Task 1-9 전부
- Produces: 없음

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npm run test`
Expected: PASS — 실패 0

Run: `npm run build`
Expected: 성공 — `tsc -b` 타입 오류 0, vite 빌드 성공

둘 중 하나라도 실패하면 여기서 멈추고 고친다. 실패를 남긴 채 다음 단계로 가지 않는다.

- [ ] **Step 2: 가로 스크롤 회귀 검사**

`npm run dev`를 띄우고 375px에서 5개 경로(`/`, `/monthly`, `/entries`, `/analytics`, `/import`)를 각각 열어 개발자도구 콘솔에서 실행한다:

```js
document.body.scrollWidth - window.innerWidth
```

Expected: 모든 경로에서 `0` 이하. 양수면 어떤 요소가 뷰포트를 넘긴 것이므로, 아래로 범인을 찾는다:

```js
[...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
```

- [ ] **Step 3: 폭·테마 교차 확인**

375 / 390 / 768 / 1440px × 라이트 / 다크 조합으로 5개 경로를 훑는다. 확인 항목:
- 텍스트가 컨테이너 밖으로 넘치거나 잘리지 않는다
- 하단 탭바가 콘텐츠 마지막 줄을 가리지 않는다
- 768px 경계에서 탭바 ↔ 상단 네비게이션, 카드 리스트 ↔ 테이블이 정확히 교대한다
- 다크모드에서 새로 만든 요소(탭바, 시트, 카드)가 배경과 구분된다

- [ ] **Step 4: 데스크톱 회귀 확인**

1440px에서 작업 전 커밋과 비교한다:

```bash
git stash list   # 작업 중인 변경이 없는지 확인
git log --oneline -12
```

`53497b1`(이 작업 시작 전 마지막 커밋)을 별도 워크트리나 브랜치에 체크아웃해 나란히 띄우고 5개 경로를 비교한다. 페이지 제목 크기(`text-3xl` 유지), KPI 5열, 차트 높이와 축 포맷, 테이블, 우측 드로어가 전부 동일해야 한다.

차이가 있으면 그 원인이 의도한 변경인지 확인한다. 이 작업에서 데스크톱에 의도한 변경은 **없다**.

- [ ] **Step 5: README에 한 줄 남긴다**

`README.md`의 `## 설계 문서` 목록에 추가한다:

```markdown
- `docs/superpowers/specs/2026-08-11-responsive-mobile-design.md`
- `docs/superpowers/plans/2026-08-11-responsive-mobile.md`
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: link the responsive mobile spec and plan from the README"
```

---

## 태스크 의존 관계

```
Task 1 (formatKRWCompact) ─────────────┐
Task 2 (spendingIntensity) ───┐        │
Task 3 (viewport + 타이포) ────┼──> Task 4 (하단 탭바)
                              │
Task 5 (Sheet) ───────────────┼──> Task 6 (카드 리스트) ──> Task 8 (차트)
                              │         └ useMediaQuery ────┘
                              └──> Task 7 (캘린더)
                                              Task 9 (페이지 헤더)
                                                    └──> Task 10 (검증)
```

- Task 1, 2, 3, 5는 서로 독립이라 순서를 바꿔도 된다
- Task 8은 Task 1(`formatKRWCompact`)과 Task 6(`useMediaQuery`)이 먼저 끝나야 한다
- Task 7은 Task 2(`spendingIntensity`)가 먼저 끝나야 한다
- Task 10은 전부 끝난 뒤에 한다
