export const SEED_INCOME_CATEGORIES = ['급여', '상여금', '금융수입', '기타수입', '용돈', '중고거래', '미분류']

export const SEED_TRANSFER_CATEGORIES = ['내계좌이체', '카드대금', '투자', '현금', '이체', '미분류']

export const SEED_EXPENSE_CATEGORIES: Record<string, string[]> = {
  식비: ['한식', '일식', '중식', '양식', '아시아음식', '고기', '치킨', '패스트푸드', '배달', '식재료', '미분류'],
  '카페/간식': ['커피/음료', '베이커리', '디저트/떡', '도넛/핫도그', '아이스크림/빙수', '기타간식', '미분류'],
  생활: ['편의점', '마트', '생필품', '가구/가전', '생활서비스', '미분류'],
  '주거/통신': ['월세', '관리비', '가스비', '인터넷', '휴대폰'],
  교통: ['대중교통', '택시', '철도', '시외버스'],
  자동차: ['주유', '주차', '통행료', '정비/수리'],
  온라인쇼핑: ['인터넷쇼핑', '결제/충전', '서비스구독', '앱스토어', '미분류'],
  '패션/쇼핑': ['패션', '백화점', '아울렛/몰'],
  '뷰티/미용': ['화장품', '미용용품', '헤어샵', '피부과'],
  '의료/건강': ['약국', '내과/가정의학', '이비인후과', '종합병원', '건강용품', '보조식품', '운동'],
  '문화/여가': ['영화', '도서', '게임', '음악', '취미/체험', '테마파크'],
  '술/유흥': ['맥주/호프', '이자카야', '바(BAR)', '와인'],
  '교육/학습': ['학원/강의', '미분류'],
  '경조/선물': ['축의금', '부의금', '선물', '미분류'],
  '여행/숙박': ['숙박비'],
  금융: ['은행', '카드', '증권/투자', '세금/과태료'],
  기타: ['미분류'],
}

export const SEED_PAYMENT_METHODS = [
  '삼성카드 taptap O',
  'iMND Light 신한카드',
  '일상의 기쁨(신용) 웰트리 복지비카드',
  '플리(체크)',
  '네이버페이 간편결제',
  '네이버페이 간편결제(머니)',
  '네이버페이 간편결제(포인트)',
  '네이버페이 머니',
  '카카오페이 간편결제',
  '카카오페이 머니',
  '토스 간편결제',
  '삼성월렛머니 우리 통장',
  'NH주거래우대통장',
  'KB나라사랑우대통장',
  'MY 입출금통장',
  '토스뱅크 통장',
  'OK파킹플렉스통장',
  'NH청년도약계좌',
  '주택청약종합저축',
  '월세 보증금',
  'Deep Oil',
]

export function mergeObservedPaymentMethods(observed: string[]): string[] {
  const merged = new Set([...SEED_PAYMENT_METHODS, ...observed])
  return [...merged].sort()
}

export function mergeObservedCategories(
  seed: Record<string, string[]>,
  observed: Array<{ category: string; subcategory: string }>
): Record<string, string[]> {
  const merged: Record<string, string[]> = {}
  for (const [category, subcategories] of Object.entries(seed)) {
    merged[category] = [...subcategories]
  }
  for (const { category, subcategory } of observed) {
    if (!merged[category]) {
      merged[category] = []
    }
    if (!merged[category].includes(subcategory)) {
      merged[category].push(subcategory)
    }
  }
  return merged
}
