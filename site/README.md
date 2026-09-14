# MPDF 사이트

운영 주소: https://mpdf.pages.dev (Cloudflare Pages 프로젝트 `mpdf`, R2 버킷 `mpdf-files`, 90일 후 자동 삭제 규칙 적용)

정적 파일뿐입니다. 서버 코드 없음. 파일은 브라우저 안에서만 처리됩니다.

| 경로 | 역할 |
|---|---|
| `index.html` + `maker.js` | 랜딩 + 메이커. PDF 놓기 → 유튜브 링크·음원 파일 → 페이지별 곡 지정 → `.pdf`(기본) 또는 `.mpdf`로 저장 |
| `v/index.html` + `viewer.js` | 뷰어. 파일을 놓거나 `?file=URL`. PDF는 원래 뷰어처럼, 플레이어는 접었다 펴는 팝업(모바일은 알약 → 시트) |
| `mpdf-browser.js` | 브라우저용 MPDF 라이브러리 (pdf-lib UMD + pdf.js) |
| `functions/` | Cloudflare Pages Functions: `POST /api/upload`(R2 저장, 유튜브·URL 트랙만 허용), `GET /f/{id}`(파일), `GET /v/{id}`(OG 태그가 들어간 뷰어 페이지) |
| `ads.js` | 광고 자리. `ADS.provider`와 유닛 id를 채우면 애드핏/애드센스 코드가 들어가고, 비어 있으면 점선 자리만 보임 |
| `site.css` | 최종 디자인 토큰 |

로컬 실행 (링크 기능 포함, 로컬 R2 흉내): `npm install` 후 `npm run dev` → `http://127.0.0.1:8788/`
(샘플: `/?file=samples/score.pdf`, 뷰어: `/v/?file=../samples/mixed.mpdf`). 함수 단위 테스트: `npm test`.

배포: 이 폴더에서 `npm run deploy` (wrangler 로그인 필요). 빌드 명령 없음. 함수의 R2 바인딩은 `wrangler.toml`에 있습니다.

링크 정책: 유튜브·URL 트랙만 링크가 됩니다. 음원 파일이 든 파일은 서버가 거부하고(저작권·용량), 메이커가 "PDF로 저장"을 안내합니다.

아직 없는 것: 도메인, `index.html`의 스펙·GitHub 링크와 `report.html`·`terms.html`의 `[ ]` 자리표시(신고 메일, 보관 기간, 시행일).
