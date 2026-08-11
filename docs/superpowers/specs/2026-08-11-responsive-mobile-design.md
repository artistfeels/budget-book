# 반응형 모바일 대응 설계

## 배경

앱은 데스크톱 전용에 가깝게 만들어졌다. 전체 33개 `.tsx` 파일 중 반응형 유틸리티를 쓰는 파일은 7개뿐이고, 그마저도 `KpiCards`의 그리드와 페이지 단위 2단 분기(`lg:grid-cols-2`)에 한정된다. 375px 화면에서 무너지는 지점:

- 헤더 가로 네비게이션 5개 + 브랜드 + 테마 토글이 한 줄에 들어가지 않는다
- `<main>`의 `px-8 py-10` 여백이 좁은 화면에서 콘텐츠 폭을 크게 깎는다
- 거래 관리의 7컬럼 인라인 편집 테이블 (셀마다 `<input>`/`<select>`)
- 월간 상세의 `grid-cols-7` 캘린더 — 셀 하나가 약 44px인데 날짜 + 수입 + 지출 세 줄이 들어간다
- recharts Y축 라벨(`1,200,000` 형태)이 좁은 차트 폭의 상당 부분을 차지한다
- `viewport-fit`이 없어 iOS safe-area를 쓸 수 없고, `theme-color`가 라이트 값 하나뿐이라 다크모드에서 상단 바가 흰색으로 뜬다

## 목표

기존 단일 코드베이스를 유지한 채 5개 페이지 전부를 모바일에서 쓸 수 있게 만든다. 데스크톱 경험은 그대로 유지한다.

**하지 않는 것:** PWA(manifest/오프라인 캐싱), 네이티브 앱, 모바일 전용 라우트.

## 결정 사항

| 항목 | 결정 |
| --- | --- |
| 형태 | 기존 앱을 반응형으로 (별도 라우트/앱 없음) |
| 모바일 브레이크포인트 | `md` (768px) 미만 |
| 네비게이션 | 모바일에서 하단 탭바 |
| 거래 관리 테이블 | 카드 리스트 + 하단 편집 시트 |
| 캘린더 | 7칸 그리드 유지, 셀은 날짜 + 지출 강도 막대, 탭하면 상세 |
| 범위 | 5개 페이지 전부 (불러오기는 "깨지지 않는" 수준) |

## 브레이크포인트 전략

모바일 레이아웃은 `md`(768px) 미만이다. Tailwind 기본 브레이크포인트를 그대로 쓰고, 기존 `lg:grid-cols-2` 2단 분기는 손대지 않는다 — 그쪽은 태블릿→데스크톱 전환을 담당한다.

새로 쓰는 클래스는 모바일 우선으로 작성한다: 베이스가 모바일, `md:`/`lg:`가 넓은 화면.

`index.html` 변경:
- `viewport` 에 `viewport-fit=cover` 추가 (safe-area 사용 전제)
- `theme-color`를 `media="(prefers-color-scheme: light)"` / `dark` 두 개로 분리

## 컴포넌트 설계

### AppShell — 하단 탭바

가로 네비게이션에 `hidden md:flex`를 걸고, `md:hidden` 고정 하단 탭바를 추가한다.

- 모바일 헤더에는 브랜드 + 테마 토글만 남는다
- 탭 5개(대시보드 / 월간 / 거래 / 분석 / 불러오기), 아이콘 + 10px 라벨, 활성 탭은 accent 컬러
- `<main>` 여백: `px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10` — 하단 패딩이 탭바에 가려지는 콘텐츠를 막는다
- 탭바에 `padding-bottom: env(safe-area-inset-bottom)`

데스크톱 nav의 슬라이딩 pill 인디케이터 로직은 그대로 둔다. nav가 `display:none`이면 `getBoundingClientRect()`가 0을 반환해 인디케이터가 `{left:0, width:0}`이 되지만 nav 자체가 숨겨져 있어 무해하고, 다시 보일 때 기존 `ResizeObserver`가 재측정한다.

**`NavIcons.tsx`** — 인라인 SVG 5개. `BrandMark`와 같은 방식이라 아이콘 라이브러리 의존성을 새로 추가하지 않는다. 각 아이콘은 `className`을 받고 `currentColor`로 그린다.

**`BottomNav.tsx`** — `NavLink` 5개를 `fixed inset-x-0 bottom-0`에 배치. `AppShell`의 `navItems` 배열을 공유하도록 배열을 모듈 상단에서 export 한다.

### useMediaQuery 훅

```
useMediaQuery(query: string): boolean
```

`window.matchMedia(query).matches`를 지연 초기화 값으로 쓰고 `change` 이벤트를 구독한다. 클라이언트 전용 SPA라 SSR 불일치 문제가 없고, 지연 초기화 덕에 첫 렌더 깜빡임도 없다.

두 곳에서 쓴다: 거래 관리(테이블 ↔ 카드 리스트 전환)와 차트(축 설정 분기). 나머지 레이아웃 변경은 CSS 분기로 충분하므로 훅을 쓰지 않는다.

### 거래 관리 — 카드 리스트 + 편집 시트

`EntriesPage`가 `EntriesTable`에 넘기는 prop이 17개다. 카드 리스트가 같은 목록을 두 번 받게 하지 않으려면:

- `EntriesTable.tsx`에서 공유 prop 타입 `EntryListProps`를 추출한다. `EntriesTable`과 `EntriesCardList` 모두 이 타입을 받는다
- `EntriesPage`는 이 객체를 한 번 만들어 스프레드로 넘긴다. 상태와 핸들러는 전부 기존 것을 재사용하므로 로직 중복이 없다

**둘을 동시에 렌더하고 CSS로 숨기지 않는다.** 테이블이 행마다 `<input>`/`<select>`를 만들기 때문에 거래 수백 건이면 DOM 노드가 두 배가 된다. `useMediaQuery('(min-width: 768px)')`로 하나만 렌더한다.

**`EntriesCardList.tsx`**
- 상단 합계 바 + 선택 삭제 버튼은 테이블과 동일하게 유지
- 테이블 헤더가 사라지므로 정렬 컨트롤(날짜 / 금액 × 오름 / 내림)을 카드 리스트 위에 둔다. 기존 `onSortChange` 핸들러를 그대로 쓴다
- 카드 한 장: 상단 줄에 내용(`truncate`) + 금액(우측, `tabular-nums`), 하단 줄에 날짜 · 카테고리 · 결제수단(작은 회색). 좌측에 선택 체크박스
- 카드 본문 탭 → 편집 시트 열기. 체크박스는 카드 탭과 분리된 히트 영역
- 하단에 `+ 추가` 버튼 (테이블과 동일)

**`EntryEditSheet.tsx`**
- `Sheet` 위에 `columns` 정의를 순회해 필드를 세로로 쌓는다. 기존 `EditableSelect` / `AmountInput` / date / text 입력을 그대로 쓴다
- 기존 행 편집: 필드 변경 시 `onEditField(id, key, value)`를 호출한다 (테이블과 동일하게 즉시 저장). 하단에 삭제 · `overrideAction` · 닫기
- 신규 추가: `draftRow`를 대상으로 `onDraftChange`를 호출하고 하단에 저장 · 취소. 즉 `+ 추가`는 같은 시트를 draft 모드로 연다

**`EntriesToolbar`**
- 섹션 세그먼트 탭을 `overflow-x-auto` 래퍼로 감싼다
- 필터 셀렉트들은 모바일에서 2열 그리드, `md` 이상에서 기존 `flex-wrap`

### Sheet 컴포넌트

하단 시트가 두 곳(거래 편집, 날짜 상세)에 필요하므로 하나로 만든다.

**`Sheet.tsx`** — props: `open`/`onClose`/`title`/`children`
- 오버레이(`fixed inset-0 bg-black/20 backdrop-blur`) + 하단 고정 패널
- 패널: `fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl`, 하단에 safe-area 패딩
- 오버레이 탭과 Escape 키로 닫는다
- 헤더에 제목 + 닫기 버튼

`tailwind.config.js`에 `slide-up` 키프레임/애니메이션을 추가한다 (`translateY(24px)` → `0`, 기존 `slide-in-right`과 같은 spring 커브·지속시간).

**`DayTransactionPanel`**은 새로 만들지 않고 반응형으로 바꾼다 — 모바일에서 하단 시트, `md` 이상에서 지금의 우측 드로어:

```
fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl animate-slide-up
md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-full md:max-w-sm
md:rounded-none md:animate-slide-in-right
```

### 캘린더

`grid-cols-7`과 주별 밴드 구조를 유지한다.

셀에는 **이미 지출 강도가 배경색으로 구현돼 있다** — `CalendarGrid.tsx:71`의 `0.1 + (day.spending / maxSpending) * 0.5`를 `rgba(225, 29, 72, intensity)` 배경으로 칠한다. 따라서 강도 막대를 새로 만들 필요가 없다. 모바일에서는 이 배경만 남기고 금액 텍스트를 걷어낸다.

- 셀 안의 수입/지출 금액 두 줄에 `hidden md:block`
- 모바일 셀에는 날짜 숫자 + 기존 강도 배경만 남는다. 숫자를 가운데 정렬하고 `min-h-[44px]`로 터치 타깃을 확보한다
- 금액은 날짜를 탭했을 때 열리는 `DayTransactionPanel`에서 본다
- 밴드 헤더의 금액은 그대로 둔다 — 주 단위 합계는 좁은 화면에서도 읽을 만하다

강도 계산은 JSX 안에 매직 넘버(`0.1`, `0.5`)로 박혀 있으므로 `monthDetailAggregations.ts`의 순수 함수로 추출하고 단위 테스트를 붙인다:

```
spendingIntensity(spending: number, maxSpending: number): number  // 0..1
```

`spending`이 0 이하이거나 `maxSpending`이 0 이하이면 0을 반환한다. 동작은 현재 식과 동일하게 유지한다 — 이번 작업에서 시각적 변화는 없다.

### 차트

차트는 전부 `ResponsiveContainer`를 쓰므로 폭 자체는 문제가 없다. 실제 문제는 Y축이다 — `1,200,000` 형태의 라벨이 375px에서 차트 폭의 3분의 1가량을 차지한다.

- `format.ts`에 축약 포맷 함수를 추가한다: `formatKRWCompact(n)` → `120만`, `1.2억`, `8,500`. 만 단위 미만은 그대로 두고, 만/억 경계에서 소수 첫째 자리까지 표기한다. 단위 테스트를 붙인다
- 모바일에서 Y축 `tickFormatter`를 축약 포맷으로 바꾸고 `width`를 줄인다
- 고정 높이(240 / 280 / 320px)를 모바일에서 낮춘다
- X축 라벨은 `interval`을 줘서 겹침을 막는다

`ResponsiveContainer`는 자식에게 폭을 알려주지 않고 `tickFormatter`는 CSS로 분기할 수 없으므로, 차트 컴포넌트에서 `useMediaQuery('(min-width: 768px)')`를 재사용해 축 설정을 분기한다.

### 페이지별 조정

**대시보드**
- 기간 선택 세그먼트 4개를 `overflow-x-auto`로 감싼다
- `KpiCards`: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` → `grid-cols-2 lg:grid-cols-5`. 모바일 1열이면 5장이 세로로 너무 길다. 숫자 크기는 `text-[22px] md:text-[26px]`, 카드 패딩 `p-4 md:p-6`

**월간 상세**
- 위 캘린더 변경. 월 선택 `select`는 이미 `field`라 그대로 둔다

**분석**
- 헤더의 월 선택 + 세그먼트 묶음을 모바일에서 세로로 쌓고 세그먼트에 `overflow-x-auto`

**불러오기**
- 미리보기 테이블에는 이미 `overflow-x-auto`가 걸려 있고 월 선택 칩도 `flex-wrap`이다. 페이지 고유의 변경은 없고, 전역 여백·타이틀 변경만으로 동작한다. 실제 기기 확인만 한다

**전역**
- `.page-title`: `text-2xl md:text-3xl`
- `.card` 계열 패딩은 각 호출부에서 `p-4 md:p-6`으로 조정 (`.card`는 의도적으로 padding-free이므로 컴포넌트 정의는 건드리지 않는다)

## 파일

**신규 (6)**
- `src/components/BottomNav.tsx`
- `src/components/NavIcons.tsx`
- `src/components/Sheet.tsx`
- `src/components/entries/EntriesCardList.tsx`
- `src/components/entries/EntryEditSheet.tsx`
- `src/lib/useMediaQuery.ts`

**수정**
- `index.html` — viewport-fit, theme-color 2개
- `tailwind.config.js` — `slide-up` 키프레임
- `src/index.css` — `.page-title` 반응형
- `src/components/AppShell.tsx` — nav 숨김, 탭바, main 여백
- `src/pages/DashboardPage.tsx`, `AnalyticsPage.tsx`, `EntriesPage.tsx` — 헤더 스택, 세그먼트 스크롤, 카드 리스트 분기 (`MonthDetailPage`/`ImportPage`는 전역 변경만으로 충분)
- `src/components/dashboard/KpiCards.tsx`
- `src/components/month/CalendarGrid.tsx`
- `src/components/month/DayTransactionPanel.tsx`
- `src/components/entries/EntriesTable.tsx` — `EntryListProps` 추출
- `src/components/entries/EntriesToolbar.tsx`
- 차트 컴포넌트들 — 축 포맷/높이 분기
- `src/lib/format.ts` + 테스트 — `formatKRWCompact`
- `src/lib/monthDetailAggregations.ts` + 테스트 — `spendingIntensity`

## 검증

- 새로 추가되는 순수 로직 두 개(`formatKRWCompact`, `spendingIntensity`)에 단위 테스트를 붙인다
- `npm run test` 전체 통과
- `npm run build` (tsc 포함) 통과
- 브라우저에서 375 / 390 / 768 / 1440px 폭으로 5개 페이지를 확인한다. 라이트/다크 양쪽
- 데스크톱(1440px) 화면이 작업 전과 시각적으로 동일한지 확인한다 — 이번 작업은 좁은 화면을 고치는 것이지 넓은 화면을 바꾸는 것이 아니다
