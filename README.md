# Todo List App

풀스택 Todo 리스트 애플리케이션 (React + Express + MongoDB)

## 기술 스택

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB Atlas
- **배포**: Vercel

## 프로젝트 구조

```
todo-app/
├── frontend/          # React + Vite 프론트엔드
├── backend/           # Express API 백엔드
├── vercel.json        # Vercel 배포 설정
├── .gitignore
└── README.md
```

## 로컬 실행 방법

### 1. 사전 준비

- Node.js 18 이상 설치
- MongoDB Atlas 계정 및 클러스터 생성

### 2. 백엔드 실행

```bash
cd backend
cp .env.example .env   # .env 파일 생성 후 MONGODB_URI 입력
npm install
npm run dev            # http://localhost:5000
```

### 3. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### 4. 브라우저에서 확인

http://localhost:5173 접속 → Todo 앱 사용

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/todos | 모든 Todo 조회 |
| POST | /api/todos | 새 Todo 추가 |
| PUT | /api/todos/:id | Todo 완료 상태 수정 |
| DELETE | /api/todos/:id | Todo 삭제 |

## Vercel 배포 방법

1. GitHub에 코드 push
2. [Vercel](https://vercel.com) → New Project → GitHub 레포 Import
3. Environment Variables에 `MONGODB_URI` 추가
4. Deploy 클릭
