# 가계부 (Budget Book)

개인용 가계부. 뱅크샐러드 엑셀 내보내기를 불러와 수입/지출을 분류하고, 대시보드·월간 상세·분석 화면으로 보여준다.

## 스택

React 19 + Vite 8 + TypeScript + Tailwind 3 + Recharts 2 + Zustand + Supabase (Google 로그인)
Vercel 배포 (`vercel.json`: SPA fallback)

```bash
npm install
npm run dev      # Vite 개발 서버
npm test         # vitest run (src/**/*.test.ts, node 환경)
npm run build    # tsc -b && vite build
```

`.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`.env.example` 참고). 없으면 `src/lib/supabase.ts`가 시작 시 throw한다.

## 구조

```
src/pages/       Dashboard, MonthDetail, Entries(거래 관리), Analytics, Import
src/lib/         도메인 로직 — 순수 함수 + *.test.ts 동반
src/store/       useTransactionStore(데이터), useThemeStore, usePreferencesStore(기기별 화면 설정)
src/components/  화면별 하위 폴더(dashboard, month, analytics, entries) + 공용(AppShell, Sheet 등)
supabase/migrations/  SQL Editor에서 순서대로 실행
```

데이터 흐름: 로그인 → `DataGate`가 `fetchAll()` (1000행씩 페이징) → 전부 메모리에 들고 화면별 집계는 `src/lib`의 순수 함수로 계산한다. 서버 집계 쿼리는 없다.

## 도메인 규칙 — 건드리기 전에 읽을 것

- **금액 부호**: `amount`는 원본 그대로 signed. 지출은 음수, 환불은 양수로 같은 카테고리에서 상계된다. 집계는 `Math.max(0, -sum)`으로 지출을 구한다.
- **flowType** = `income | spending | neutral`. `flowType` 컬럼은 **자동 분류 결과만** 저장하고, 사용자 수정은 `flowTypeOverride`에만 둔다. 읽을 때는 항상 `resolvedFlowType()` (aggregations.ts)을 거친다.
- **저축은 분류 버킷이 아니다** (0002 마이그레이션에서 `saving` 제거). 저축 = 수입 − 지출. 이체·투자·청약 등은 `neutral`.
- **거래 ID** = 원본 필드의 SHA-256 (`idHash.ts`). 같은 엑셀을 다시 불러와도 중복이 스킵되는 근거라 필드 구성을 바꾸면 기존 데이터와 전부 중복이 난다.
- **내계좌이체 짝 맞추기**: `transferMatching.ts`. 불러오기 때마다 전체를 다시 매칭하고 바뀐 행만 upsert한다.
- RLS: 모든 테이블 `user_id = auth.uid()` 소유자 전용.

## 분석 기능

- `anomalies.ts` — 이상 지출 감지. 카테고리 월별 지출은 직전 최대 6개월 **중앙값 + 3×MAD**, 단건은 카테고리 평소 결제의 4배 이상 + 10만원 이상. 평균 대신 중앙값을 쓰는 이유는 파일 상단 주석 참고. 최소 3개월 이력이 없으면 아무것도 표시하지 않는다.
- `report.ts` — 월간 리포트 엑셀(요약/카테고리별/이상 지출/거래 내역 시트). 월간 상세 화면의 "리포트" 버튼, 헤더 톱니바퀴 설정에서 버튼을 숨길 수 있다(localStorage `pref-report-button`).

## UI 규칙

- 색 의미: 수입 `text-income`(파랑), 지출 `text-spending`(빨강), 저축 `text-saving`(초록). UI 강조색은 `accent`(앰버) — 금액 의미색과 절대 섞지 않는다.
- 카드는 `.card`, 버튼은 `.btn-primary` / `.btn-ghost`, 입력은 `.field` (index.css `@layer components`). 새 스타일 유틸을 만들기 전에 이걸 먼저 쓴다.
- 모바일: 터치 영역 최소 44px(`min-h-11`), 가로 스크롤 금지. 기간 선택 같은 세그먼트는 폰에서 `grid-cols-N`으로 꽉 채운다.
- Tailwind 클래스는 문자열 보간으로 만들지 않는다 (`stagger-${i}` 금지 — 빌드에서 purge됨). 리터럴 배열에서 고른다.
- 엑셀 파서(xlsx)와 차트 페이지는 route 단위 lazy import. 메인 번들에 xlsx를 끌어오지 않게 `import('xlsx')`로 동적 로드한다.

## 알려진 기술 부채

- `xlsx`는 SheetJS 공식 CDN 빌드(0.20.3)를 쓴다. npm의 `xlsx@0.18.5`는 취약점이 패치되지 않으므로 되돌리지 말 것. 업데이트도 `https://cdn.sheetjs.com/`의 tgz로.
- 미이행 메이저 업그레이드: Tailwind 4(설정 방식이 CSS로 바뀜), Recharts 3, react-router 7, zustand 5, date-fns 4 — 각각 별도 작업으로.
