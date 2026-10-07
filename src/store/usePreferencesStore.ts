import { create } from 'zustand'

// 기기별 화면 설정. 데이터가 아니라 "이 기기에서 무엇을 보일지"라서 Supabase가 아닌 localStorage에 둔다.

const REPORT_BUTTON_KEY = 'pref-report-button'

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch {
    return fallback
  }
}

function writeBool(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // 사파리 개인정보 보호 모드 등 저장이 막힌 환경 — 이번 세션에서만 유지된다
  }
}

interface PreferencesState {
  /** 월간 상세 화면의 "리포트 내보내기" 버튼 표시 여부 */
  showReportButton: boolean
  setShowReportButton: (show: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  showReportButton: typeof window === 'undefined' ? true : readBool(REPORT_BUTTON_KEY, true),
  setShowReportButton: (show) => {
    writeBool(REPORT_BUTTON_KEY, show)
    set({ showReportButton: show })
  },
}))
