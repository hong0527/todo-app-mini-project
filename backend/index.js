// 환경 변수 로드
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 미들웨어 설정
app.use(cors()); // CORS 허용 (프론트엔드에서 백엔드 호출 가능하도록)
app.use(express.json()); // JSON 요청 본문 파싱

// MongoDB 연결 (서버리스 환경에서 중복 연결 방지)
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB 연결 성공');
  } catch (err) {
    console.log('MongoDB 연결 실패:', err);
  }
};
connectDB();

// Todo 스키마 정의
const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  dueDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Todo 모델 생성
const Todo = mongoose.model('Todo', todoSchema);

// ===== API 엔드포인트 =====

// 모든 Todo 목록 조회
app.get('/api/todos', async (req, res) => {
  try {
    const todos = await Todo.find();
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: '목록 조회 실패', error: err.message });
  }
});

// 새 Todo 추가
app.post('/api/todos', async (req, res) => {
  try {
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ message: '제목은 필수입니다' });
    }
    const newTodo = new Todo({
      title: req.body.title.trim(),
      dueDate: req.body.dueDate || null
    });
    await newTodo.save();
    res.json(newTodo);
  } catch (err) {
    res.status(500).json({ message: '추가 실패', error: err.message });
  }
});

// Todo 완료 상태 토글 (수정)
app.put('/api/todos/:id', async (req, res) => {
  try {
    const updateFields = {};
    if (req.body.completed !== undefined) updateFields.completed = req.body.completed;
    if (req.body.title !== undefined) {
      if (!req.body.title.trim()) return res.status(400).json({ message: '제목은 비워둘 수 없습니다' });
      updateFields.title = req.body.title.trim();
    }
    if (req.body.dueDate !== undefined) updateFields.dueDate = req.body.dueDate;
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: '수정할 내용이 없습니다' });
    }
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { returnDocument: 'after' }
    );
    if (!todo) return res.status(404).json({ message: '할 일을 찾을 수 없습니다' });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: '수정 실패', error: err.message });
  }
});

// Todo 삭제
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    if (!todo) return res.status(404).json({ message: '할 일을 찾을 수 없습니다' });
    res.json({ message: '삭제 완료' });
  } catch (err) {
    res.status(500).json({ message: '삭제 실패', error: err.message });
  }
});

// 로컬 개발용 서버 실행 (Vercel에서는 사용하지 않음)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
}

// Vercel 서버리스 함수용 export
module.exports = app;
