# Google Apps Script 인증 설정

이 폴더의 `Code.gs`를 Apps Script 프로젝트에 붙여 넣은 뒤 아래 순서로 설정합니다.

## 1. 초기 설정

1. Apps Script 편집기에서 기존 `Code.gs` 내용을 이 파일의 코드로 교체합니다.
2. 새 버전으로 웹 앱을 배포합니다.
3. 웹 앱 URL을 한 번 열면 필요한 시트와 서버 비밀값이 자동으로 생성됩니다.
4. 연결된 스프레드시트에 `Users`, `Sessions` 시트가 생성됐는지 확인합니다.

웹 앱의 첫 요청 또는 `setupAuth` 직접 실행은 다음 작업을 수행합니다.

- 회원 정보용 `Users` 시트 생성
- 로그인 세션용 `Sessions` 시트 생성
- 비밀번호 해시용 pepper 생성
- 로그인 토큰 서명용 비밀값 생성

비밀번호 원문과 서버 비밀값은 시트에 저장되지 않습니다. 비밀값은 Apps Script의 Script Properties에 저장됩니다.

## 2. 웹 앱 배포

1. **배포 → 새 배포**를 선택합니다.
2. 배포 유형으로 **웹 앱**을 선택합니다.
3. 실행 계정은 **나**로 설정합니다.
4. 액세스 권한은 **모든 사용자**로 설정합니다.
5. 배포 후 `/exec`으로 끝나는 웹 앱 URL을 복사합니다.

정상적으로 최신 코드가 배포되면 웹 앱 URL을 열었을 때 `apiVersion`이 `2.1.0`, `ready`가 `true`로 표시됩니다.

코드를 수정한 뒤에는 **배포 관리 → 수정 → 새 버전**으로 다시 배포해야 변경사항이 반영됩니다.

## 3. API 요청 형식

GitHub Pages에서는 CORS 사전 요청을 피하기 위해 `application/x-www-form-urlencoded` 형식으로 전송합니다.

### 회원가입

```javascript
const body = new URLSearchParams({
  action: 'signup',
  name: '홍길동',
  email: 'user@example.com',
  password: 'password123',
});

const response = await fetch(WEB_APP_URL, {
  method: 'POST',
  body,
});

const result = await response.json();
```

### 로그인

```javascript
const body = new URLSearchParams({
  action: 'login',
  email: 'user@example.com',
  password: 'password123',
});

const response = await fetch(WEB_APP_URL, {
  method: 'POST',
  body,
});

const result = await response.json();
```

### 로그인 확인

```javascript
const body = new URLSearchParams({
  action: 'verify',
  token: localStorage.getItem('blogAuthToken'),
});
```

### 로그아웃

```javascript
const body = new URLSearchParams({
  action: 'logout',
  token: localStorage.getItem('blogAuthToken'),
});
```

## 4. 관리자 지정

가입 후 `Users` 시트에서 해당 사용자의 `role` 값을 `reader`에서 `admin`으로 직접 변경합니다. 게시글 작성 API를 추가할 때 서버 코드에서 반드시 `admin` 역할을 다시 확인해야 합니다.

## 보안 범위

이 구현은 소규모 개인 블로그용 기본 인증입니다. 비밀번호는 서버 비밀값과 사용자별 salt를 사용해 HMAC-SHA256으로 저장하고, 로그인 실패 5회 후 15분 동안 잠급니다. 결제, 금융, 의료 또는 중요한 개인정보를 처리하는 서비스에는 전문 인증 서비스 사용을 권장합니다.
