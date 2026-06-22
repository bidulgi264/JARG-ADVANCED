# JARG — Email Hint Response API

JARG ARG의 **힌트 자동응답 백엔드**입니다. 플레이어가 **`jshsemail@gmail.com`** 으로
**정해진 형식의 메일**을 보내면, 이 서버가 요청한 문제 번호를 해석해 **점진적 힌트**를 자동으로 회신합니다.
요청 수신·회신 발신 모두 `jshsemail@gmail.com`(Gmail) 주소를 사용합니다.

수신은 **IMAP 폴러**(`npm run poll`)가 Gmail 받은편지함을 주기적으로 확인해 처리하고, 발신은
Gmail SMTP로 자동 회신합니다. 메일 인프라 없이도 `/api/hint` 로 동일 로직을 그대로 테스트할 수 있습니다.

## 빠른 시작

```bash
cd EmailResponse
npm install
cp .env.example .env   # Windows PowerShell: Copy-Item .env.example .env
```

`.env` 에 Gmail 앱 비밀번호(`SMTP_PASS`)까지 채운 뒤, **두 프로세스를 각각 실행**합니다.

```bash
npm run poll    # (필수) 받은편지함을 감시해 자동 답장 → "메일 보내면 답장" 기능
npm start       # (선택) 테스트/관리용 HTTP API 서버
```

`SMTP_HOST` 를 비워두면 **dry-run 모드**로 동작합니다(수신은 처리하지만 실제 발송 안 함).

API로 직접 테스트 (서버 실행 후):

```bash
curl -X POST http://localhost:3000/api/hint \
  -H "Content-Type: application/json" \
  -d '{ "from": "Player <player@example.com>", "subject": "HINT #10" }'
```

## 요청 형식

제목 또는 본문 어디에든 아래 패턴이 있으면 인식합니다(대소문자 무관).

| 형식 | 의미 |
| --- | --- |
| `HINT #10` / `HINT 10` | 10번 문제, 자동 레벨 |
| `HINT #10 LEVEL 2` | 10번 문제, 레벨 2 고정 |
| `힌트 10` / `힌트 #10 레벨 3` | 한글 형식 |

레벨을 지정하지 않으면, **같은 발신자가 같은 문제를 다시 요청할수록** 레벨이 1→2→3으로 올라가며
점점 더 구체적인 힌트(마지막 레벨은 정답)를 보냅니다.

## 아키텍처

```
Gmail 받은편지함 ──IMAP폴링──▶ poller ┐
                                       ├─▶ handler ─▶ parser  (형식 해석)
HTTP 직접 호출 ──▶ POST /api/hint ─────┘           ├─▶ hints   (data/hints.json)
                  POST /inbound                    ├─▶ store   (요청 로그 + 레벨 산정)
                                                    └─▶ mailer ─SMTP─▶ 회신 메일 발송
```

- `src/parser.js` — 요청 문자열에서 문제 번호/레벨 추출, 발신자 주소 정규화.
- `src/hints.js` — `data/hints.json` 로드 및 문제/레벨 조회.
- `src/store.js` — 요청 로그(`data/requests.json`) 영속화, 발신자별 제공 횟수 집계(레벨 에스컬레이션 근거).
- `src/mailer.js` — nodemailer 트랜스포트. SMTP 미설정 시 `jsonTransport`(dry-run). 헤더 인젝션 방지.
- `src/handler.js` — 핵심 흐름(검증 → 파싱 → 레벨 결정 → 회신 → 로깅).
- `src/poller.js` — Gmail IMAP 폴러. 미확인 메일을 읽어 핸들러로 넘기고 처리한 메일은 읽음 처리.
- `src/server.js` — Express 라우팅 및 레이트리밋(테스트/관리용).

## API 명세

전체 명세는 [`openapi.yaml`](./openapi.yaml) 참고.

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | `/api/health` | 상태 확인 |
| GET | `/api/hints` | 힌트가 있는 문제 목록(스포일러 없음) |
| POST | `/api/hint` | 힌트 요청(JSON) |
| POST | `/inbound` | 메일 제공자 인바운드 웹훅(JSON/urlencoded) |
| GET | `/api/requests` | 요청 로그 조회(관리자, `x-admin-token` 필요) |

## 데이터 모델 (ERD)

```
HintRequestLog (data/requests.json)
┌───────────┬──────────┬─────────────────────────────────────────────┐
│ 필드      │ 타입     │ 설명                                          │
├───────────┼──────────┼─────────────────────────────────────────────┤
│ id        │ integer  │ 순번(PK)                                      │
│ at        │ ISO time │ 처리 시각                                     │
│ email     │ string   │ 발신자(정규화된 소문자 주소)                  │
│ problem   │ int|null │ 요청 문제 번호                                │
│ level     │ integer  │ 제공한 힌트 레벨 (kind=hint일 때)             │
│ served    │ boolean  │ 실제 힌트를 제공했는지                        │
│ kind      │ enum     │ hint | help | unknown_problem                 │
│ dryRun    │ boolean  │ 실제 발송 여부(false=발송, true=dry-run)      │
└───────────┴──────────┴─────────────────────────────────────────────┘
        │
        │  (email, problem) 로 그룹핑 → served=true 개수
        ▼
   다음 자동 힌트 레벨 = COUNT(served) + 1   (최대 레벨에서 고정)

HintCatalog (data/hints.json)  — 읽기 전용 콘텐츠
  problem(키) → { name, levels: string[] }   // levels[마지막] = 정답
```

## 보안 / 남용 방지

- **발신자 검증**: 형식이 올바르지 않은 주소는 400으로 거부.
- **레이트리밋**: 발신자별 `RATE_WINDOW_MS` 동안 `RATE_MAX` 회 초과 시 429.
- **메일 헤더 인젝션 방지**: 제목/수신자에서 CR/LF 제거.
- **회신은 text/plain**: 입력값을 HTML로 렌더링하지 않음.
- **관리자 엔드포인트 보호**: `/api/requests` 는 `ADMIN_TOKEN` 설정 + 헤더 일치 시에만 접근.

## 실제 이메일 연동

- 수신/발신 주소: **`jshsemail@gmail.com`** (`.env` 의 `HINT_FROM`, `SMTP_USER`).
- 발신: Gmail SMTP(`smtp.gmail.com:587`)에 **앱 비밀번호**로 인증(2단계 인증 필요).
- 수신: `npm run poll` 이 Gmail IMAP(`imap.gmail.com:993`)에 같은 앱 비밀번호로 접속해 받은편지함을 폴링.

설정 순서:

1. Gmail 계정에서 **2단계 인증**을 켜고 **앱 비밀번호**를 발급 → `.env` 의 `SMTP_PASS` 에 입력.
2. Gmail 설정에서 **IMAP 사용**이 켜져 있는지 확인.
3. `npm run poll` 실행 → 새 메일이 오면 자동으로 힌트를 회신.

> IMAP 폴러 대신 메일 제공자 인바운드 파싱(SendGrid/Mailgun 등)을 쓸 수도 있습니다. 그 경우 파싱 결과를
> `POST /inbound` 로 전달하면 됩니다(`from`/`sender`, `subject`, `text`/`body-plain`/`plain` 필드 매핑).
> 시연 신뢰성을 위해 메일 지연/스팸 필터에 대비한 폴백(웹 힌트 또는 로그 캡처)을 권장합니다.

## 테스트

```bash
npm test
```

`node --test` 로 파서·레벨 에스컬레이션·검증·예외 경로를 검증합니다(격리된 임시 로그 사용).
