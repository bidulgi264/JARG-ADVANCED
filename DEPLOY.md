# Render 배포

이 저장소는 GitHub Pages가 아닌 Render Blueprint로 배포합니다. GitHub Pages는 Node 백엔드, SQLite 데이터베이스, Gmail IMAP 폴러를 실행할 수 없습니다.

## 구성

- `jarg-advanced`: 웹/API 서비스
- `jarg-data`: 계정과 진행률을 보존하는 1GB 영속 디스크
- `jarg-email-responder`: Gmail을 감시하고 힌트 메일을 보내는 백그라운드 워커

영속 디스크와 백그라운드 워커 때문에 두 서비스 모두 Render 유료 `starter` 플랜을 사용합니다.

## 배포 순서

1. GitHub에서 `BIGGGJUN/JARG-ADVANCED` 저장소를 Render에 연결합니다.
2. Render Dashboard에서 **New > Blueprint**를 선택합니다.
3. 이 저장소를 선택하면 루트의 `render.yaml`이 감지됩니다.
4. 초기 생성 화면에서 아래 세 값을 입력합니다.

| 환경 변수 | 값 |
| --- | --- |
| `HINT_FROM` | `JARG Hint Bot <실제 Gmail 주소>` |
| `SMTP_USER` | 실제 Gmail 주소 |
| `SMTP_PASS` | Gmail 앱 비밀번호 |

`ANSWER_PEPPER`와 웹/워커 사이의 공유 비밀은 Render가 자동으로 생성하고 연결합니다.

## Gmail 준비

Gmail 계정에서 2단계 인증을 켠 뒤 앱 비밀번호를 발급하여 `SMTP_PASS`에 입력합니다. 일반 Gmail 로그인 비밀번호를 넣지 마세요.

배포가 완료되면 웹 서비스 URL의 `/api/health`가 `{ "ok": true }`를 반환하는지 확인합니다. 이메일 제목은 정확히 `HINT #문제번호` 형식이어야 합니다.
