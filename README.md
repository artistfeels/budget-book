# 가계부 (Budget Book)

개인용 가계부 웹앱. 뱅크샐러드 엑셀 내보내기를 불러와 수입/지출/저축을 구분해 보여준다.

## 설정

1. `npm install`
2. Supabase 프로젝트를 만들고 `supabase/migrations/0001_init.sql`을 SQL Editor에서 실행한다.
3. Supabase Authentication → Providers에서 Google 로그인을 활성화한다.
4. `.env.example`을 `.env.local`로 복사하고 Supabase 프로젝트의 URL/anon key를 채운다.
5. `npm run dev`로 실행한다.

## 데이터 불러오기

`/import` 화면에서 뱅크샐러드 내보내기 엑셀(`가계부 내역` 시트)을 드래그&드롭하면 파싱 미리보기가 뜬다. 불러올 월을 체크하고 "선택한 월 불러오기"를 누르면 저장된다. 이미 저장된 거래는 자동으로 중복 스킵된다.

## 테스트

`npm run test`

## 설계 문서

- `docs/superpowers/specs/2026-07-19-budget-book-design.md`
- `docs/superpowers/plans/2026-07-19-budget-book-foundation.md` (이 단계)
