# JARG Advanced

기존 JARG의 16개 퍼즐을 유지하면서 계정, 서버 정답 검증, SQLite 진행률, 문제 API와 힌트 사용 기록을 추가한 독립 프로젝트입니다. 기존 `JARG`, `EmailResponse` 폴더는 수정하지 않습니다.

배포 방법은 [`DEPLOY.md`](./DEPLOY.md)를 참고하세요. 배포용 이메일 워커는 이 저장소의 `email-worker`에 함께 포함되어 있습니다.

## 실행

Node.js 24 이상만 필요하며 외부 패키지는 없습니다.

```powershell
cd D:\JARG\JARG_ADVANCED
Copy-Item .env.example .env
npm start
```

브라우저에서 `http://localhost:3100`을 엽니다. 테스트는 `npm test`로 실행합니다.

운영 배포 전 `.env`의 `ANSWER_PEPPER`를 길고 무작위인 값으로 반드시 변경하세요. SQLite 파일은 기본적으로 `data/jarg-advanced.sqlite`에 생성됩니다.

## 구현 범위

- 이메일/비밀번호 회원가입과 로그인
- scrypt 비밀번호 해시, 해시된 랜덤 Bearer 세션, 세션 만료/로그아웃
- 계정별 문제 상태(`locked`, `available`, `cleared`), 시도 횟수와 클리어 시각
- API가 공개한 문제 모듈만 프론트에서 동적 로드
- 서버 정답 검증과 다음 문제 잠금 해제
- 힌트 사용 기록 및 서버 진행률 초기화
- 이메일 발신 주소를 계정과 대조하고 잠긴 문제의 이메일 힌트 차단
- SQLite 트랜잭션, 제출 rate limit, 기본 보안 헤더
- 브라우저 JS에서 텍스트 정답 제거

## 주요 API

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/auth/register` | 계정 생성 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/me` | 현재 사용자 |
| POST | `/api/auth/logout` | 현재 세션 폐기 |
| GET | `/api/problems` | 문제 목록과 계정별 상태 |
| GET | `/api/problems/:id` | 접근 가능한 문제 메타데이터 |
| POST | `/api/problems/:id/submit` | 정답 검증 |
| POST | `/api/problems/:id/complete` | 인터랙션형 문제 완료 기록 |
| POST | `/api/problems/:id/hint` | 힌트 조회 및 사용 기록 |
| POST | `/api/email/hint-access` | 이메일 응답기용 계정/진행률 확인 |
| GET/DELETE | `/api/me/progress` | 진행률 조회/초기화 |

인증 API의 응답으로 받은 토큰을 `Authorization: Bearer <token>` 헤더에 넣습니다.

## 설계상 주의점

3~8번, 15~16번처럼 브라우저 상호작용으로 해결되는 문제는 완료 이벤트를 서버에 기록합니다. 퍼즐 로직 전체가 브라우저에서 실행되므로 이 완료 요청은 기술적으로 위조할 수 있습니다. 경쟁형 운영이 필요하다면 해당 퍼즐의 상태 전이도 서버 시뮬레이션으로 재구현해야 합니다.

기존 `EmailResponse`의 자동응답기는 `/api/email/hint-access`를 호출합니다. `JARG_ADVANCED/.env`의 `EMAIL_WEBHOOK_SECRET`과 `EmailResponse/.env`의 `JARG_EMAIL_SECRET`을 같은 값으로 지정해야 합니다. 등록되지 않은 이메일과 `locked` 상태 문제는 힌트가 거절됩니다.
