# KJ SHOPLINK — TikTok Shop 한국·일본 입점 파트너 사이트

공개 사이트 + 관리자, 5개 국어(한국어·English·中文·日本語·Tiếng Việt).

- 사이트: https://whaleguard.github.io/tiktokshop-partner/
- 관리자: https://whaleguard.github.io/tiktokshop-partner/#admin

## 구성
- `index.html` — 사이트 전체(단일 파일). 디자인은 GPT 작성(`design/gpt-design.css` 원본).
- DB: Supabase 프로젝트 `sangdam-magic` 의 `tts_` 테이블 (`supabase/schema.sql`).
  - `tts_requests` 신청서(브랜드·크리에이터·샵·스튜디오·구매) — 방문자는 쓰기만, 관리자만 조회·수정
  - `tts_catalog` 상품, `tts_config` 사이트 설정, `tts_admins` 관리자 이메일
  - Storage 버킷 `tts-assets` — 로고·파트너 배지·상품 이미지
- 신청자 본인 조회: 접수번호 + 신청 이메일(`tts_status` 함수)

## 처음 설정
1. Supabase SQL Editor 에서 `supabase/schema.sql` 실행 (여러 번 실행해도 안전)
2. `#admin` 에서 「관리자 계정 만들기」 → 확인 메일 → 로그인
   - 관리자가 0명일 때 처음 로그인한 계정이 자동으로 최초 관리자가 됨
   - 이후 관리자는 「사이트 설정 → 관리자 계정」에서 이메일 추가
3. 사이트 설정에서 브랜드명·연락처·사업자 정보·로고·TikTok 파트너 배지 입력
