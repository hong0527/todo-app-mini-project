import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.DEV
  ? 'http://localhost:5001/api/todos'
  : '/api/todos';

// 오늘 날짜를 YYYY-MM-DD 형식으로 (로컬 타임존 기준)
const getTodayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 현재 시간을 HH:MM 형식으로 (분 올림)
const getNowTimeStr = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

function App() {
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await axios.get(API_URL);
      setTodos(res.data);
    } catch (err) {
      console.error('목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      // 날짜/시간 조합 로직
      let dueDate;
      if (newDueDate && newDueTime) {
        dueDate = new Date(`${newDueDate}T${newDueTime}`).toISOString();
      } else if (newDueDate) {
        dueDate = new Date(`${newDueDate}T23:59:59`).toISOString();
      } else if (newDueTime) {
        // 시간만 선택 → 오늘 날짜 + 선택한 시간
        dueDate = new Date(`${getTodayStr()}T${newDueTime}`).toISOString();
      } else {
        // 둘 다 미선택 → 현재 시간
        dueDate = new Date().toISOString();
      }
      const res = await axios.post(API_URL, { title: newTitle.trim(), dueDate });
      setTodos(prev => [...prev, res.data]);
      setNewTitle('');
      setNewDueDate('');
      setNewDueTime('');
    } catch (err) {
      console.error('추가 실패:', err);
    }
  };

  const toggleTodo = async (id, completed) => {
    // 낙관적 업데이트: 즉시 UI 반영 후 서버 동기화
    setTodos(prev => prev.map(todo => todo._id === id ? { ...todo, completed: !completed } : todo));
    try {
      const res = await axios.put(`${API_URL}/${id}`, { completed: !completed });
      setTodos(prev => prev.map(todo => todo._id === id ? res.data : todo));
    } catch (err) {
      // 실패 시 원래 상태로 롤백
      setTodos(prev => prev.map(todo => todo._id === id ? { ...todo, completed } : todo));
      console.error('수정 실패:', err);
    }
  };

  const deleteTodo = async (id) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      setTodos(prev => prev.filter(todo => todo._id !== id));
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  const clearAllTodos = async () => {
    const currentTodos = [...todos]; // 현재 상태 캡처
    try {
      const results = await Promise.allSettled(currentTodos.map(todo => axios.delete(`${API_URL}/${todo._id}`)));
      const failedIds = new Set();
      results.forEach((result, i) => {
        if (result.status === 'rejected') failedIds.add(currentTodos[i]._id);
      });
      setTodos(prev => failedIds.size > 0 ? prev.filter(t => failedIds.has(t._id)) : []);
      setShowClearConfirm(false);
    } catch (err) {
      console.error('전체 삭제 실패:', err);
    }
  };

  const clearCompletedTodos = async () => {
    const completed = todos.filter(t => t.completed); // 현재 상태 캡처
    try {
      const results = await Promise.allSettled(completed.map(todo => axios.delete(`${API_URL}/${todo._id}`)));
      const failedIds = new Set();
      results.forEach((result, i) => {
        if (result.status === 'rejected') failedIds.add(completed[i]._id);
      });
      const successIds = new Set(completed.filter((_, i) => results[i].status === 'fulfilled').map(t => t._id));
      setTodos(prev => prev.filter(t => !successIds.has(t._id)));
    } catch (err) {
      console.error('완료 항목 삭제 실패:', err);
    }
  };

  const startEdit = (todo) => {
    setEditingId(todo._id);
    setEditTitle(todo.title);
  };

  const isSavingRef = useRef(false);
  const saveEdit = async (id) => {
    if (isSavingRef.current) return; // Enter + onBlur 이중 호출 방지
    if (!editTitle.trim()) {
      setEditingId(null);
      setEditTitle('');
      return;
    }
    isSavingRef.current = true;
    setEditingId(null);
    try {
      const res = await axios.put(`${API_URL}/${id}`, { title: editTitle.trim() });
      setTodos(prev => prev.map(todo => todo._id === id ? res.data : todo));
      setEditTitle('');
    } catch (err) {
      console.error('수정 실패:', err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // 날짜 유틸 - 날짜만 비교하는 헬퍼
  const getDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    return getDateOnly(new Date(dateStr)).getTime() === getDateOnly(new Date()).getTime();
  };

  const isTomorrow = (dateStr) => {
    if (!dateStr) return false;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getDateOnly(new Date(dateStr)).getTime() === getDateOnly(tomorrow).getTime();
  };

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    // 오늘까지는 지연이 아님, 어제 이전부터 지연
    return getDateOnly(new Date(dateStr)) < getDateOnly(new Date());
  };

  const isUpcoming = (dateStr) => {
    if (!dateStr) return false;
    // 내일 이후 = 예정
    return getDateOnly(new Date(dateStr)) > getDateOnly(new Date());
  };

  const formatDueDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const timeStr = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    if (isToday(dateStr)) {
      return { text: `오늘 ${timeStr}`, color: 'text-amber-600', bg: 'bg-amber-50' };
    }
    if (isTomorrow(dateStr)) {
      return { text: `내일 ${timeStr}`, color: 'text-blue-600', bg: 'bg-blue-50' };
    }
    if (isOverdue(dateStr)) {
      const diffDays = Math.ceil((getDateOnly(new Date()) - getDateOnly(d)) / (1000 * 60 * 60 * 24));
      return { text: `${diffDays}일 지남`, color: 'text-red-600', bg: 'bg-red-50' };
    }
    return {
      text: d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ` ${timeStr}`,
      color: 'text-gray-500',
      bg: 'bg-gray-50'
    };
  };

  // 필터링
  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  const getFilteredActive = () => {
    switch (filter) {
      case 'today': return activeTodos.filter(t => isToday(t.dueDate));
      case 'upcoming': return activeTodos.filter(t => isUpcoming(t.dueDate));
      case 'overdue': return activeTodos.filter(t => isOverdue(t.dueDate));
      default: return activeTodos;
    }
  };

  const filteredActive = getFilteredActive();
  const progress = todos.length > 0 ? Math.round((completedTodos.length / todos.length) * 100) : 0;

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const overdueTodos = activeTodos.filter(t => isOverdue(t.dueDate));

  // 과거 날짜 방지를 위한 min 값
  const minDate = getTodayStr();
  const minTime = newDueDate === getTodayStr() ? getNowTimeStr() : undefined;

  // 할 일 카드
  const TodoItem = ({ todo }) => {
    const due = formatDueDate(todo.dueDate);
    const overdue = todo.dueDate && isOverdue(todo.dueDate) && !todo.completed;

    return (
      <div className={`group flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-200 border ${
        todo.completed
          ? 'bg-gray-50/80 border-gray-100'
          : overdue
            ? 'bg-white border-red-100 hover:border-red-200 hover:shadow-sm'
            : 'bg-white border-gray-100 hover:border-violet-200 hover:shadow-sm'
      }`}>
        <button
          onClick={() => toggleTodo(todo._id, todo.completed)}
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer ${
            todo.completed
              ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm shadow-emerald-200'
              : 'border-2 border-gray-300 hover:border-violet-400 hover:shadow-sm hover:shadow-violet-100'
          }`}
        >
          {todo.completed && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {editingId === todo._id ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit(todo._id);
                if (e.key === 'Escape') { isSavingRef.current = true; setEditingId(null); setEditTitle(''); setTimeout(() => { isSavingRef.current = false; }, 0); }
              }}
              onBlur={() => saveEdit(todo._id)}
              autoFocus
              className="w-full text-sm bg-violet-50 border border-violet-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          ) : (
            <>
              <p
                className={`text-[14px] leading-relaxed truncate ${
                  todo.completed ? 'line-through text-gray-400' : 'text-gray-800 font-medium'
                }`}
                onDoubleClick={() => !todo.completed && startEdit(todo)}
                title="더블클릭으로 수정"
              >
                {todo.title}
              </p>
              {due && (
                <span className={`inline-flex items-center gap-1 mt-1.5 text-xs px-2 py-0.5 rounded-md font-medium ${
                  todo.completed ? 'text-gray-400 bg-gray-50' : `${due.color} ${due.bg}`
                }`}>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {due.text}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 opacity-40 transition-opacity">
          {!todo.completed && (
            <button
              onClick={() => startEdit(todo)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-all cursor-pointer"
              title="수정"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => deleteTodo(todo._id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
            title="삭제"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="flex h-screen">

        {/* ===== 사이드바 ===== */}
        <aside className="w-[280px] bg-white border-r border-gray-200/80 flex flex-col flex-shrink-0">
          {/* 로고 */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-300/30">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 12l2 2 4-4" />
                  <rect x="3" y="3" width="18" height="18" rx="4" strokeWidth={1.8} strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h1 className="text-[17px] font-extrabold tracking-tight text-gray-900">Taskflow</h1>
                <p className="text-[11px] text-gray-400 font-medium">Smart Task Manager</p>
              </div>
            </div>
          </div>

          {/* 날짜 */}
          <div className="px-6 py-3.5 bg-gradient-to-r from-violet-50/50 to-transparent border-b border-gray-100">
            <p className="text-[11px] text-violet-500 font-semibold tracking-wide">{dateStr}</p>
          </div>

          {/* 필터 */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            <p className="px-3 text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-3">카테고리</p>
            {[
              { key: 'all', label: '모든 할 일', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', count: activeTodos.length, color: 'violet' },
              { key: 'today', label: '오늘', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', count: activeTodos.filter(t => isToday(t.dueDate)).length, color: 'amber' },
              { key: 'upcoming', label: '예정', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', count: activeTodos.filter(t => isUpcoming(t.dueDate)).length, color: 'blue' },
              { key: 'overdue', label: '지연', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', count: overdueTodos.length, color: 'red' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer ${
                  filter === item.key
                    ? 'bg-violet-50 text-violet-700 shadow-sm shadow-violet-100/50'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                </svg>
                <span className="flex-1 text-left">{item.label}</span>
                {item.count > 0 && (
                  <span className={`text-[11px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-bold ${
                    filter === item.key ? 'bg-violet-200/60 text-violet-700' :
                    item.color === 'red' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}

            {/* 구분선 + 초기화 */}
            <div className="pt-4 mt-4 border-t border-gray-100">
              <p className="px-3 text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-3">관리</p>
              {completedTodos.length > 0 && (
                <button
                  onClick={clearCompletedTodos}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-amber-50 hover:text-amber-700 transition-all cursor-pointer"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="flex-1 text-left">완료 항목 정리</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">{completedTodos.length}</span>
                </button>
              )}
              {todos.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="flex-1 text-left">전체 초기화</span>
                </button>
              )}
            </div>
          </nav>

          {/* 달성률 */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gradient-to-t from-gray-50/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400 font-semibold">달성률</span>
              <span className="text-[13px] font-extrabold text-violet-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-[11px] text-gray-400 font-medium">
              <span>{completedTodos.length} 완료</span>
              <span>{activeTodos.length} 남음</span>
            </div>
          </div>
        </aside>

        {/* ===== 메인 ===== */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* 헤더 */}
          <header className="bg-white border-b border-gray-200/80 px-8 py-5">
            <div className="flex items-center justify-between max-w-4xl">
              <div>
                <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900">
                  {filter === 'all' && '모든 할 일'}
                  {filter === 'today' && '오늘의 할 일'}
                  {filter === 'upcoming' && '예정된 할 일'}
                  {filter === 'overdue' && '지연된 할 일'}
                </h2>
                <p className="text-[13px] text-gray-400 mt-1 font-medium">
                  {filteredActive.length}개 진행 중 · {completedTodos.length}개 완료
                </p>
              </div>

              <div className="flex gap-5">
                {[
                  { label: '전체', value: todos.length, color: 'text-gray-800' },
                  { label: '진행 중', value: activeTodos.length, color: 'text-amber-500' },
                  { label: '완료', value: completedTodos.length, color: 'text-emerald-500' },
                ].map(stat => (
                  <div key={stat.label} className="text-center px-3">
                    <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {/* 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-4xl">
              {/* 입력 폼 */}
              <form onSubmit={addTodo} className="mb-8">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                  <div className="flex gap-3 items-center">
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-violet-300 flex-shrink-0" />
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="새로운 할 일을 입력하세요..."
                      className="flex-1 text-[14px] text-gray-800 placeholder-gray-300 focus:outline-none py-1 font-medium"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 active:scale-[0.97] transition-all font-semibold text-[13px] cursor-pointer shadow-md shadow-violet-200/50"
                    >
                      추가
                    </button>
                  </div>
                  {/* 날짜/시간 선택 */}
                  <div className="flex items-center gap-4 mt-3 ml-[34px]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <input
                        type="date"
                        value={newDueDate}
                        min={minDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="text-[13px] text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 hover:border-gray-300 transition-colors"
                      />
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <input
                        type="time"
                        value={newDueTime}
                        min={minTime}
                        onChange={(e) => setNewDueTime(e.target.value)}
                        className="text-[13px] text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 hover:border-gray-300 transition-colors"
                      />
                    </label>
                    {(newDueDate || newDueTime) && (
                      <button
                        type="button"
                        onClick={() => { setNewDueDate(''); setNewDueTime(''); }}
                        className="text-[12px] text-gray-400 hover:text-red-500 cursor-pointer transition-colors font-medium"
                      >
                        초기화
                      </button>
                    )}
                    {!newDueDate && !newDueTime && (
                      <span className="text-[11px] text-gray-300 font-medium">미선택 시 현재 시간으로 등록</span>
                    )}
                  </div>
                </div>
              </form>

              {/* 로딩 */}
              {loading && (
                <div className="flex flex-col items-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
                  <p className="text-gray-400 text-sm mt-4">불러오는 중...</p>
                </div>
              )}

              {/* 진행 중 목록 */}
              {!loading && (
                <>
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2 h-2 bg-violet-500 rounded-full" />
                      <h3 className="text-[13px] font-bold text-gray-500 tracking-tight">
                        진행 중 <span className="text-violet-500 ml-1">{filteredActive.length}</span>
                      </h3>
                    </div>

                    {filteredActive.length === 0 ? (
                      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl flex items-center justify-center">
                          {todos.length === 0 ? (
                            <svg className="w-8 h-8 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                          ) : (
                            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-gray-400 text-[14px] font-medium">
                          {todos.length === 0
                            ? '할 일을 추가해보세요'
                            : filter !== 'all'
                              ? '이 필터에 해당하는 할 일이 없습니다'
                              : '모든 할 일을 완료했어요!'
                          }
                        </p>
                        {todos.length === 0 && (
                          <p className="text-gray-300 text-[12px] mt-1">위 입력창에서 새 할 일을 등록할 수 있습니다</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredActive.map(todo => (
                          <TodoItem key={todo._id} todo={todo} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 완료된 목록 */}
                  {completedTodos.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="flex items-center gap-2 mb-4 cursor-pointer group"
                      >
                        <svg
                          className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${showCompleted ? '' : '-rotate-90'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                        <h3 className="text-[13px] font-bold text-gray-400 group-hover:text-gray-500 transition-colors tracking-tight">
                          완료됨 <span className="text-emerald-500 ml-1">{completedTodos.length}</span>
                        </h3>
                      </button>

                      {showCompleted && (
                        <div className="space-y-2">
                          {completedTodos.map(todo => (
                            <TodoItem key={todo._id} todo={todo} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* 전체 초기화 확인 모달 */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[360px] mx-4">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-center text-[16px] font-bold text-gray-900 mb-1">전체 초기화</h3>
            <p className="text-center text-[13px] text-gray-500 mb-6">
              모든 할 일({todos.length}개)이 삭제됩니다.<br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 text-[13px] font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={clearAllTodos}
                className="flex-1 py-2.5 text-[13px] font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
              >
                전체 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
