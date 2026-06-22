# JARG Advanced 계정 연동

힌트를 보내기 전에 `JARG_ADVANCED`의 `/api/email/hint-access` API로 발신 이메일과 문제 진행도를 확인합니다.

- 등록 계정과 발신 이메일이 일치해야 합니다.
- 현재 `available` 또는 이미 `cleared`인 문제만 힌트를 받을 수 있습니다.
- 아직 `locked`인 문제는 힌트를 제공하지 않습니다.
- JARG API가 일시적으로 응답하지 않으면 요청을 실패 처리합니다.

두 프로젝트의 환경 변수에 같은 공유 비밀을 설정합니다.

```text
# JARG_ADVANCED/.env
EMAIL_WEBHOOK_SECRET=긴-무작위-문자열

# EmailResponse/.env
JARG_API_URL=http://localhost:3100
JARG_EMAIL_SECRET=긴-무작위-문자열
```
