# MPDF 프로젝트 인수인계 (다른 AI에서 이어 작업하기)

이 문서 하나만 읽으면 MPDF 작업을 이어갈 수 있도록 정리했습니다. ChatGPT 등 다른 AI에 이 파일을 통째로 붙여 넣거나 업로드하고, 맨 아래 "시작 프롬프트"를 함께 보내세요.

- 공개 저장소: https://github.com/CaLeb-Shin/mpdf-format
- 운영 사이트: https://mpdf.pages.dev (영어 `/`, 한국어 `/ko/`, 일본어 `/ja/`)
- 로컬 경로(작성자 Mac): `~/Desktop/App./mpdf-format`
- 기준 시점: 2026-11-19, 최신 커밋 `c790201`

---

## 1. MPDF가 무엇인가

**MPDF = 음악 재생 정보가 첨부된 보통 PDF.** PDF 표준 첨부파일(EmbeddedFiles) 기능으로 `mpdf.json`을 넣습니다. 여기에 트랙 목록(유튜브 / 내장 음원 / URL)과 페이지별 재생 큐가 들어 있습니다.

- 일반 PDF 앱에서는 그냥 PDF로 열립니다(음악만 없음).
- MPDF 뷰어(이 사이트, 앞으로 SEETO 앱)에서는 악보를 보며 음악이 나오고, 페이지를 넘기면 곡이 바뀝니다.
- 보통 PDF 뷰어 안에서 플레이어를 직접 돌리는 것은 불가능합니다(PDF 뷰어는 코드·미디어를 실행하지 않음). 그래서 "웹 뷰어 + 앱 뷰어" 구조입니다.

```json
{
  "mpdf": "1.0",
  "title": "Piano Book 2",
  "tracks": [
    { "id": "t1", "title": "Canon in D", "src": "youtube:dQw4w9WgXcQ" },
    { "id": "t2", "title": "Arirang",    "src": "file:track2.m4a", "start": 10, "end": 70 }
  ],
  "cues": [ { "page": 1, "track": "t1" }, { "page": 4, "track": "t2", "at": 32.5 } ],
  "options": { "autoplay": false, "followPage": true, "loop": false }
}
```

전체 규격은 `SPEC.md`(영문, CC BY 4.0), JSON 스키마는 `schema/mpdf.schema.json`.

## 2. 정해진 결정 (바꾸지 말 것, 사용자가 다시 꺼내기 전에는)

1. **컨테이너는 PDF 첨부파일.** ZIP 금지. 페이지 내용은 절대 수정하지 않음.
2. **배포 확장자 기본은 `.pdf`.** `.mpdf`는 확장자를 등록한 앱용 선택지.
3. **사이트는 음원 파일을 서버에 저장하지 않음(저작권).** 공개 링크는 유튜브·HTTPS 트랙만. 내장 음원이 든 파일은 다운로드해서 파일로 보냄.
4. **뷰어 원칙:** PDF는 일반 뷰어처럼 보이고, 플레이어는 옮기고 접을 수 있는 팝업(모바일은 알약 → 시트). 자동재생 금지(사용자 동작 후). 유튜브는 공식 플레이어를 화면에 보이게(정책).
5. **광고는 사이트 지정 영역에만.** 악보 위 금지. 떠 있는 플레이어 안에는 네트워크 광고 금지(애드센스 정책).
6. **특허 없음, 오픈 포맷.** 코드 MIT, 스펙 CC BY 4.0. 이름은 상표로 보호(미출원). "mPDF" PHP 라이브러리와 이름이 겹치지만 일단 MPDF 유지.
7. **전 세계 대상.** 영어 기본, 한국어·일본어 지원.
8. **예시 콘텐츠는 중립적으로.** 교회·예배 제목 금지. 사용 예 순서는 레슨 교재 → 합창단 → 찬양팀. 샘플 곡은 캐논, 아리랑, 엘리제를 위하여.
9. 디자인 톤: 디자인 캔버스는 어두운 무대풍이었으나, 현재 운영 사이트는 밝은 작업 화면 스타일(`site.css`)입니다. 현재 사이트 기준을 따릅니다.

## 3. 저장소 구조

| 경로 | 내용 |
|---|---|
| `SPEC.md`, `schema/` | MPDF 1.0 규격과 JSON 스키마 |
| `js/mpdf.js` | JS 레퍼런스 라이브러리(pdf-lib). `npm test` |
| `python/mpdf.py` | Python 레퍼런스 + CLI(make/info/extract). `python3 python/test_mpdf.py` |
| `samples/` | 샘플 PDF·MPDF와 생성 스크립트 |
| `viewer/` | 초기 단일 파일 레퍼런스 뷰어 |
| `design/` | 디자인 캔버스 원본(`.dc.html`) |
| `site/` | **운영 웹사이트** (아래) |

### site/ (Cloudflare Pages + Functions + R2)

| 파일 | 역할 |
|---|---|
| `index.html` | 랜딩. 한 페이지에 영·한·일 문구가 `<span data-l="en|ko|ja">`로 함께 있고 CSS가 하나만 표시 |
| `make/index.html` + `maker.js` | 제작기: 페이지 목록, 음원(파일/유튜브), 재생 버튼·타임마커 배치, 페이지 지정, 미리보기, 저장(원본/공유용/악보만), 링크 생성 |
| `v/index.html` + `viewer.js` | 뷰어: 페이지 버튼·타임마크, A–B 반복, 키 조절(내장 음원만, ±12반음), 사운드 선택 |
| `mpdf-browser.js` | 브라우저용 MPDF 읽기·쓰기, SEETO 확장 보존, 공유본/악보만 내보내기 |
| `playback-engine.js`, `pitch-worklet.js` | 재생 엔진, 키 변경 |
| `seeto-account.js` | 선택 기능: SEETO(Firebase) Google 로그인, 제작자 원본 확인·등록 |
| `i18n.js` | 언어 전환(국기 메뉴, 새로고침 없이 전환), 사전 |
| `functions/api/upload.js` | `POST /api/upload` 공유본을 R2에 저장(20MB, 내장 음원 거부) |
| `functions/f/[id].js` | `GET /f/{id}` 파일 제공 |
| `functions/v/[id].js` | `GET /v/{id}` 뷰어 + 언어별 링크 미리보기(OG) 태그 |
| `ads.js`, `ads.txt` | 광고 자리. 애드센스 게시자 `ca-pub-4493654380629025` |
| `guide.html`, `developers.html`, `terms.html`, `report.html`, `guides/*` | 영어 문서 |
| `ko/` | 한국어 문서(직접 관리). `ko/index.html`만 자동 생성 |
| `ja/` | 일본어 페이지 **전부 자동 생성** (직접 수정 금지) |
| `build-ko.py`, `build-ja.py` | `index.html`로 `ko/index.html`, `ja/index.html` 생성 |
| `build-ja-pages.py` + `ja-pages.json` | 영어 문서 → 일본어 문서 생성(영어 문장 → 일본어 대응표) |

## 4. 다국어 규칙 (새 문구를 추가할 때 반드시)

- `maker.js`: `L('한국어', 'English', '日本語')`
- `viewer.js`: `say('한국어', 'English', '日本語')`
- HTML(랜딩·제작기): `<span data-l="en">…</span><span data-l="ko">…</span><span data-l="ja">…</span>`
- 뷰어 HTML: `data-en="…" data-ko="…" data-ja="…"` 속성
- 입력창 안내문: `data-ko-placeholder`, `data-ja-placeholder`
- 영어 문서를 고치면 `ja-pages.json`에 새 문장의 일본어를 추가. `build-ja-pages.py`가 빠진 문장을 출력하고 실패로 끝납니다.
- 한국어 문서(`ko/*.html`)는 손으로 같이 고쳐야 합니다.

## 5. 실행·테스트·배포

```bash
cd site
npm install
npm run dev        # http://127.0.0.1:8788 (로컬 R2 흉내 포함)
npm test           # Functions 테스트
npm run deploy     # ko/ja 생성 후 Cloudflare Pages 배포 (wrangler 로그인 필요)
```

레퍼런스 라이브러리 테스트: `cd js && npm install && npm test`, `python3 python/test_mpdf.py`.

배포는 Cloudflare 계정 로그인(`npx wrangler login`)이 된 컴퓨터에서만 가능합니다. 다른 AI는 코드를 작성해 주고, 실제 배포 명령은 사용자가 실행합니다.

## 6. 남은 일

1. **애드센스:** 심사 결과 대기. 승인되면 "디스플레이 광고 → 가로형" 2개(Landing, Viewer) 만들고 광고 단위 ID를 `site/ads.js`의 `ADS.adsense.landing / viewerTop`에 넣고 배포. 자동 광고는 끌 것.
2. **도메인:** 아직 `mpdf.pages.dev`. 구입하면 Cloudflare Pages에서 연결하고 사이트 안의 `https://mpdf.pages.dev` 절대 주소(canonical, hreflang, sitemap, OG)를 바꿔야 함.
3. **문서 자리표시:** 약관 등에 남은 대괄호 값(시행일 등) 채우기. 약관은 변호사 검토 전 초안.
4. **SEETO 앱(iOS, SwiftUI + PDFKit)에 MPDF 뷰어 붙이기 (Level 2):** `.mpdf`/PDF 파일 연결, `mpdf.json` 첨부 읽기(Swift 예제는 `site/developers.html`), AVPlayer·유튜브 IFrame 재생, 페이지 변경 시 큐 적용, 접는 플레이어. SEETO 저장소는 별도(`~/Desktop/App./SEETogether`).
5. 선택: 일반 PDF 뷰어에서도 탭하면 유튜브가 열리는 "페이지 재생 링크(▶)" 옵션 — 원칙(페이지에 그리지 않기)을 일부 양보하므로 기본은 꺼둠.
6. 일본어 번역(특히 약관) 원어민 검토.

## 7. 다른 AI에게 주는 작업 규칙

- 위 "정해진 결정"을 지킬 것. 바꿔야 할 이유가 있으면 먼저 사용자에게 물을 것.
- 파일을 고칠 때는 전체 파일을 다시 써서 주기보다 **바꿀 부분만** 정확히(찾을 문자열 → 바꿀 문자열) 제시할 것. `maker.js`, `viewer.js`는 크고 압축된 형태라 통째로 다시 쓰면 기능이 깨지기 쉽습니다.
- `ja/` 아래 파일과 `ko/index.html`은 직접 고치지 말고 원본(`index.html`, 영어 문서, `ja-pages.json`)을 고칠 것.
- 새 문구는 영·한·일 세 언어로 함께 추가할 것.
- 코드를 바꾸면 `npm test`와 브라우저 확인 방법을 함께 알려 줄 것.
- 배포·결제·계정 작업은 사용자가 직접 합니다.

---

## 시작 프롬프트 (복사해서 ChatGPT에 보내기)

```
나는 MPDF라는 오픈 포맷과 웹사이트를 만들고 있어. 첨부한 HANDOFF.md가 프로젝트 전체 요약이야.
코드는 공개 저장소 https://github.com/CaLeb-Shin/mpdf-format 에 있고, 운영 사이트는 https://mpdf.pages.dev 야.

규칙:
- HANDOFF.md의 "정해진 결정"과 "다른 AI에게 주는 작업 규칙"을 따라 줘.
- 파일을 고칠 땐 바꿀 부분만 "찾을 내용 → 바꿀 내용" 형식으로 줘. 필요한 파일 내용이 없으면 나한테 그 파일을 붙여 달라고 요청해.
- 새 문구는 영어·한국어·일본어로 같이 넣어 줘.
- 답은 한국어로.

이번에 하고 싶은 작업: [여기에 적기]
```

필요한 파일 내용을 ChatGPT가 요청하면 GitHub 주소에서 복사하거나(예: https://github.com/CaLeb-Shin/mpdf-format/blob/main/site/maker.js), 로컬 파일을 열어 붙여 넣으면 됩니다.
