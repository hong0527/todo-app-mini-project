const request = require('supertest');

// MongoDB 연결을 모킹하여 실제 DB 없이도 테스트 가능
jest.mock('mongoose', () => {
  let todos = [];
  let idCounter = 1;

  const TodoModel = function (data) {
    this._id = String(idCounter++);
    this.title = data.title;
    this.completed = data.completed || false;
  };

  TodoModel.prototype.save = function () {
    const plain = { _id: this._id, title: this.title, completed: this.completed };
    todos.push(plain);
    return Promise.resolve(plain);
  };

  TodoModel.find = jest.fn().mockImplementation(() => Promise.resolve([...todos]));
  TodoModel.findByIdAndUpdate = jest.fn().mockImplementation((id, update, opts) => {
    const todo = todos.find(t => t._id === id);
    if (todo) {
      Object.assign(todo, update);
      return Promise.resolve({ ...todo });
    }
    return Promise.resolve(null);
  });
  TodoModel.findByIdAndDelete = jest.fn().mockImplementation((id) => {
    const todo = todos.find(t => t._id === id);
    todos = todos.filter(t => t._id !== id);
    return Promise.resolve(todo || null);
  });

  const mock = {
    connect: jest.fn().mockResolvedValue(true),
    connection: { readyState: 0 },
    Schema: function () { return {}; },
    model: jest.fn().mockReturnValue(TodoModel),
    get __todos() { return todos; },
    __resetTodos: () => { todos = []; idCounter = 1; },
  };
  return mock;
});

// 모킹 후에 app을 require
const app = require('./index');
const mongoose = require('mongoose');

beforeEach(() => {
  mongoose.__resetTodos();
});

describe('Todo API 테스트', () => {

  // ===== GET /api/todos =====
  test('GET /api/todos - 빈 목록 반환', async () => {
    const res = await request(app).get('/api/todos');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // ===== POST /api/todos =====
  test('POST /api/todos - 새 할 일 추가', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ title: '테스트 할 일' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('테스트 할 일');
    expect(res.body.completed).toBe(false);
    expect(res.body._id).toBeDefined();
  });

  test('POST /api/todos - 제목 없이 추가 시 에러', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('제목은 필수입니다');
  });

  // ===== PUT /api/todos/:id =====
  test('PUT /api/todos/:id - 완료 상태 토글', async () => {
    // 먼저 할 일 추가
    const createRes = await request(app)
      .post('/api/todos')
      .send({ title: '완료 테스트' });

    const todoId = createRes.body._id;

    const updateRes = await request(app)
      .put(`/api/todos/${todoId}`)
      .send({ completed: true });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.completed).toBe(true);
  });

  // ===== DELETE /api/todos/:id =====
  test('DELETE /api/todos/:id - 할 일 삭제', async () => {
    // 먼저 할 일 추가
    const createRes = await request(app)
      .post('/api/todos')
      .send({ title: '삭제 테스트' });

    const todoId = createRes.body._id;

    const deleteRes = await request(app)
      .delete(`/api/todos/${todoId}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('삭제 완료');
  });

  // ===== 통합 시나리오 =====
  test('CRUD 전체 흐름 테스트', async () => {
    // 1. 추가
    const todo1 = await request(app)
      .post('/api/todos')
      .send({ title: '첫 번째 할 일' });
    expect(todo1.body.title).toBe('첫 번째 할 일');

    const todo2 = await request(app)
      .post('/api/todos')
      .send({ title: '두 번째 할 일' });

    // 2. 완료 체크
    await request(app)
      .put(`/api/todos/${todo1.body._id}`)
      .send({ completed: true });

    // 3. 삭제
    await request(app)
      .delete(`/api/todos/${todo2.body._id}`);

    // 4. 최종 확인 - find가 모킹되어 있으므로 내부 배열 상태 확인
    expect(mongoose.__todos.length).toBe(1);
    expect(mongoose.__todos[0].completed).toBe(true);
  });
});
