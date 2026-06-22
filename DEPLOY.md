# 배포 및 공개 실행

## 권장: 무료 온디맨드 공개

서버를 항상 켜둘 필요가 없다면 PC에서 JARG를 실행하고 Cloudflare Quick Tunnel로 공개하는 방식이 가장 단순합니다. 호스팅 비용과 Cloudflare 계정이 필요 없고, SQLite 진행률은 `data` 폴더에 계속 보존됩니다.

```powershell
cd D:\JARG\JARG_ADVANCED
.\start-public.ps1
```

첫 실행 시 공식 Cloudflare `cloudflared` 실행 파일을 `.tools`에 내려받고 다음 프로세스를 백그라운드로 실행합니다.

- JARG 웹/API (`http://127.0.0.1:3100`)
- Gmail 이메일 폴러(자격 증명이 설정된 경우)
- 임시 HTTPS 공개 터널

출력되는 `https://...trycloudflare.com` 주소를 공유하면 됩니다. 실행할 때마다 주소가 바뀌며, PC가 켜져 있고 스크립트로 시작한 프로세스가 실행 중일 때만 접속할 수 있습니다.

종료:

```powershell
.\stop-public.ps1
```

웹만 실행하려면 `.\start-public.ps1 -SkipEmail`을 사용합니다.

### 이메일 자동응답기 준비

첫 실행 후 `email-worker/.env`에 아래 값을 입력합니다.

| 환경 변수 | 값 |
| --- | --- |
| `HINT_FROM` | `JARG Hint Bot <실제 Gmail 주소>` |
| `SMTP_USER`, `IMAP_USER` | 실제 Gmail 주소 |
| `SMTP_PASS`, `IMAP_PASS` | Gmail 앱 비밀번호 |

Gmail 앱 비밀번호는 Google 계정에서 2단계 인증을 켠 뒤 발급합니다. 일반 로그인 비밀번호를 넣지 마세요. `JARG_EMAIL_SECRET`과 로컬 API 주소는 실행 스크립트가 자동으로 맞춥니다.

Cloudflare는 Quick Tunnel을 테스트·개발 용도로 안내합니다. 소규모로 필요할 때만 여는 현재 사용 방식에 적합하지만, 고정 주소나 상시 운영 보장은 없습니다.

## 선택 사항: Render 상시 배포

이 저장소는 GitHub Pages가 아닌 Render Blueprint로 배포합니다. GitHub Pages는 Node 백엔드, SQLite 데이터베이스, Gmail IMAP 폴러를 실행할 수 없습니다.

## 구성

- `jarg-advanced`: 웹/API 서비스
- `jarg-data`: 계정과 진행률을 보존하는 1GB 영속 디스크
- `jarg-email-responder`: Gmail을 감시하고 힌트 메일을 보내는 백그라운드 워커

영속 디스크와 백그라운드 워커 때문에 두 서비스 모두 Render 유료 `starter` 플랜을 사용합니다.

## 배포 순서

1. GitHub에서 `bidulgi264/JARG-ADVANCED` 저장소를 Render에 연결합니다.
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
