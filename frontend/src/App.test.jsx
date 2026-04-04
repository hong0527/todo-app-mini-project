import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App';

// axios 모킹
vi.mock('axios', () => {
  const mockTodos = [];
  let idCounter = 1;

  return {
    default: {
      get: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: [...mockTodos] })
      ),
      post: vi.fn().mockImplementation((url, data) => {
        const newTodo = { _id: String(idCounter++), title: data.title, completed: false, dueDate: data.dueDate || null, createdAt: new Date().toISOString() };
        mockTodos.push(newTodo);
        return Promise.resolve({ data: newTodo });
      }),
      put: vi.fn().mockImplementation((url, data) => {
        const id = url.split('/').pop();
        const todo = mockTodos.find(t => t._id === id);
        if (todo) {
          if (data.completed !== undefined) todo.completed = data.completed;
          if (data.title !== undefined) todo.title = data.title;
        }
        return Promise.resolve({ data: { ...todo } });
      }),
      delete: vi.fn().mockImplementation((url) => {
        const id = url.split('/').pop();
        const idx = mockTodos.findIndex(t => t._id === id);
        if (idx !== -1) mockTodos.splice(idx, 1);
        return Promise.resolve({ data: { message: '삭제 완료' } });
      }),
      __mockTodos: mockTodos,
      __reset: () => { mockTodos.length = 0; idCounter = 1; },
    },
  };
});

import axios from 'axios';

beforeEach(() => {
  axios.__reset();
  vi.clearAllMocks();
});

describe('App 컴포넌트 테스트', () => {

  test('초기 렌더링 시 앱 이름이 표시된다', async () => {
    render(<App />);
    expect(screen.getByText('Taskflow')).toBeInTheDocument();
  });

  test('로딩 후 빈 목록 안내 메시지가 표시된다', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('할 일을 추가해보세요')).toBeInTheDocument();
    });
  });

  test('할 일을 추가할 수 있다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('새로운 할 일을 입력하세요...');
    const addButton = screen.getByText('추가');

    await user.type(input, '새로운 할 일');
    await user.click(addButton);

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ title: '새로운 할 일' })
    );

    await waitFor(() => {
      expect(screen.getByText('새로운 할 일')).toBeInTheDocument();
    });
  });

  test('빈 입력으로는 추가되지 않는다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument();
    });

    const addButton = screen.getByText('추가');
    await user.click(addButton);

    expect(axios.post).not.toHaveBeenCalled();
  });

  test('입력 폼이 존재한다', async () => {
    render(<App />);
    expect(screen.getByPlaceholderText('새로운 할 일을 입력하세요...')).toBeInTheDocument();
    expect(screen.getByText('추가')).toBeInTheDocument();
  });

  test('필터 버튼들이 표시된다', async () => {
    render(<App />);
    expect(screen.getAllByText('모든 할 일').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('오늘')).toBeInTheDocument();
    expect(screen.getByText('예정')).toBeInTheDocument();
    expect(screen.getByText('지연')).toBeInTheDocument();
  });
});
