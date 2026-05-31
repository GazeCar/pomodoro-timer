'use client';

import React, { useState } from 'react';
import { Task } from '@/types';

interface TaskListProps {
  tasks: Task[];
  activeTaskId: string | null;
  onAddTask: (text: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onSelectTask: (id: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  activeTaskId,
  onAddTask,
  onDeleteTask,
  onToggleTask,
  onSelectTask,
}) => {
  const [taskText, setTaskText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskText.trim();
    if (!trimmed) return;
    onAddTask(trimmed);
    setTaskText('');
  };

  return (
    <section className="tasks-section glass-panel p-8 rounded-[24px] flex flex-col max-h-[380px]">
      <h2 className="panel-title text-lg font-semibold font-outfit flex items-center gap-2.5 mb-5 text-white">
        <svg className="panel-title-icon w-5 h-5 text-theme transition duration-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9M3 20h.01M3 12h.01M3 4h.01M4 4h10M4 12h14M4 20h14"/>
        </svg>
        タスク管理
      </h2>
      
      <form onSubmit={handleSubmit} className="task-form flex gap-2 mb-4">
        <input
          type="text"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="新しいタスクを入力..."
          required
          autoComplete="off"
          className="flex-1 bg-black/20 border border-glass-border rounded-xl px-4 py-3 text-sm text-white placeholder-[#64748b] outline-none transition duration-300 focus:border-theme focus:shadow-[0_0_10px_rgba(var(--theme-color-rgb),0.15)]"
        />
        <button
          type="submit"
          className="add-task-btn bg-theme text-bg-color w-11 rounded-xl flex items-center justify-center transition duration-300 cursor-pointer shadow-[0_4px_12px_rgba(var(--theme-color-rgb),0.2)] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(var(--theme-color-rgb),0.3)]"
          title="追加"
        >
          <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </form>

      <ul className="task-list scrollbar-custom list-none overflow-y-auto flex-1 pr-1">
        {tasks.length === 0 ? (
          <li className="text-center py-6 text-text-muted italic text-sm list-none select-none">
            タスクはありません。上から追加してみましょう！
          </li>
        ) : (
          tasks.map((task) => (
            <li
              key={task.id}
              onClick={() => !task.completed && onSelectTask(task.id)}
              className={`group task-item flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-glass-border rounded-xl mb-2 transition duration-300 cursor-pointer hover:bg-white/[0.05] hover:border-theme/20 ${
                task.completed ? 'completed opacity-60' : ''
              } ${task.id === activeTaskId && !task.completed ? 'active border-theme/40 bg-theme/5 shadow-[0_4px_16px_rgba(var(--theme-color-rgb),0.05)]' : ''}`}
            >
              <div className="task-item-content flex items-center gap-3 flex-1 min-w-0">
                <label
                  className="task-checkbox-container flex items-center justify-center cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTask(task.id)}
                    className="task-checkbox appearance-none w-4.5 h-4.5 border-1.5 border-[#64748b] rounded-[5px] outline-none cursor-pointer flex items-center justify-center transition duration-300 checked:bg-theme checked:border-theme checked:after:content-[''] checked:after:w-2 checked:after:h-1 checked:after:border-l-[1.5px] checked:after:border-b-[1.5px] checked:after:border-bg-color checked:after:-rotate-45 checked:after:translate-x-[0.5px] checked:after:-translate-y-[0.5px]"
                  />
                </label>
                <span className={`task-text text-sm text-white truncate select-none ${task.completed ? 'line-through text-[#64748b]' : ''}`}>
                  {task.text}
                </span>
              </div>
              <div className="task-actions flex items-center opacity-0 group-hover:opacity-100 transition duration-300">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task.id);
                  }}
                  className="delete-task-btn bg-transparent border-none text-[#64748b] hover:text-danger-color hover:bg-danger-color/10 p-1 rounded-md flex items-center justify-center transition duration-300 cursor-pointer"
                  title="削除"
                >
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
};
