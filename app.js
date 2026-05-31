// DOMの読み込み完了後に実行
document.addEventListener('DOMContentLoaded', () => {
  // --- 状態管理 ---
  let timer = {
    state: 'stopped', // 'stopped', 'running', 'paused'
    mode: 'work',     // 'work', 'short', 'long'
    remainingSeconds: 1500, // 25分
    totalDuration: 1500,
    intervalId: null
  };

  let settings = {
    workDuration: 25,  // 分
    shortDuration: 5,  // 分
    longDuration: 15,  // 分
    volume: 50
  };

  let tasks = [];
  let activeTaskId = null;

  let stats = {
    sessionsCompleted: 0,
    totalFocusTime: 0, // 分
    completedTasksCount: 0
  };

  // --- 定数 ---
  const MODE_THEMES = {
    work: {
      color: 'var(--color-work)',
      rgb: 'var(--color-work-rgb)',
      label: '作業中'
    },
    short: {
      color: 'var(--color-short)',
      rgb: 'var(--color-short-rgb)',
      label: '短い休憩'
    },
    long: {
      color: 'var(--color-long)',
      rgb: 'var(--color-long-rgb)',
      label: '長い休憩'
    }
  };

  // SVGサークルの設定
  const circle = document.getElementById('timer-progress');
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = 0;

  // --- ローカルストレージからの読み込み ---
  function loadFromLocalStorage() {
    const savedSettings = localStorage.getItem('focusflow_settings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
      // UI入力値の更新
      document.getElementById('input-work').value = settings.workDuration;
      document.getElementById('input-short').value = settings.shortDuration;
      document.getElementById('input-long').value = settings.longDuration;
      document.getElementById('input-volume').value = settings.volume;
      document.getElementById('volume-value').innerText = `${settings.volume}%`;
    }

    const savedTasks = localStorage.getItem('focusflow_tasks');
    if (savedTasks) {
      tasks = JSON.parse(savedTasks);
    }

    const savedActiveTaskId = localStorage.getItem('focusflow_active_task_id');
    if (savedActiveTaskId) {
      activeTaskId = savedActiveTaskId;
    }

    const savedStats = localStorage.getItem('focusflow_stats');
    if (savedStats) {
      stats = JSON.parse(savedStats);
    }
  }

  // ローカルストレージへの書き込み
  function saveSettingsToLocalStorage() {
    localStorage.setItem('focusflow_settings', JSON.stringify(settings));
  }

  function saveTasksToLocalStorage() {
    localStorage.setItem('focusflow_tasks', JSON.stringify(tasks));
    localStorage.setItem('focusflow_active_task_id', activeTaskId);
  }

  function saveStatsToLocalStorage() {
    localStorage.setItem('focusflow_stats', JSON.stringify(stats));
  }

  // --- UIの更新ヘルパー ---
  function updateTheme() {
    const root = document.documentElement;
    const theme = MODE_THEMES[timer.mode];
    root.style.setProperty('--theme-color', theme.color);
    root.style.setProperty('--theme-color-rgb', theme.rgb);
    document.getElementById('active-mode-label').innerText = theme.label;
  }

  function updateTimerDisplay() {
    const mins = Math.floor(timer.remainingSeconds / 60);
    const secs = timer.remainingSeconds % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    // 画面の数字更新
    document.getElementById('time-display').innerText = formattedTime;
    
    // ブラウザのタブタイトルも更新
    document.title = `${formattedTime} - FocusFlow`;

    // 円形プログレスバーの更新
    const progressPercent = (timer.remainingSeconds / timer.totalDuration) * 100;
    const offset = circumference - (progressPercent / 100 * circumference);
    circle.style.strokeDashoffset = offset;
  }

  function updatePlayPauseUI() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const playPauseBtn = document.getElementById('play-pause-btn');

    if (timer.state === 'running') {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
      playPauseBtn.title = '一時停止';
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      playPauseBtn.title = '開始';
    }
  }

  function renderStats() {
    document.getElementById('stat-sessions').innerText = stats.sessionsCompleted;
    document.getElementById('stat-total-time').innerText = `${stats.totalFocusTime}m`;
    document.getElementById('stat-completed-tasks').innerText = stats.completedTasksCount;
  }

  // --- 音声シンセサイザー (Web Audio API) ---
  function playNotificationSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
      const ctx = new AudioContext();
      const volume = settings.volume / 100;
      if (volume === 0) return;

      const now = ctx.currentTime;

      // 1音目: 高いチャイム音
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, now); // B5
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(volume * 0.3, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // 2音目: 心地よい和音 (少し遅らせて発音)
      const delay = 0.15;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + delay); // G5
      gain2.gain.setValueAtTime(0, now + delay);
      gain2.gain.linearRampToValueAtTime(volume * 0.3, now + delay + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.9);
    } catch (e) {
      console.error("オーディオ再生中にエラーが発生しました:", e);
    }
  }

  // --- タイマーエンジンロジック ---
  function setTimerMode(mode) {
    // タイマー動作中なら一旦停止
    if (timer.state === 'running') {
      pauseTimer();
    }

    timer.mode = mode;
    
    // モードごとの初期時間を決定
    let durationMins = settings.workDuration;
    if (mode === 'short') durationMins = settings.shortDuration;
    if (mode === 'long') durationMins = settings.longDuration;

    timer.totalDuration = durationMins * 60;
    timer.remainingSeconds = timer.totalDuration;
    timer.state = 'stopped';

    // タブの選択状態を更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    updateTheme();
    updateTimerDisplay();
    updatePlayPauseUI();
  }

  function startTimer() {
    if (timer.state === 'running') return;

    timer.state = 'running';
    updatePlayPauseUI();

    timer.intervalId = setInterval(() => {
      if (timer.remainingSeconds > 0) {
        timer.remainingSeconds--;
        updateTimerDisplay();
      } else {
        handleTimerExpiry();
      }
    }, 1000);
  }

  function pauseTimer() {
    if (timer.state !== 'running') return;

    timer.state = 'paused';
    clearInterval(timer.intervalId);
    updatePlayPauseUI();
  }

  function resetTimer() {
    pauseTimer();
    setTimerMode(timer.mode);
  }

  function handleTimerExpiry() {
    pauseTimer();
    playNotificationSound();

    // 統計情報の更新
    if (timer.mode === 'work') {
      stats.sessionsCompleted++;
      stats.totalFocusTime += settings.workDuration;
      saveStatsToLocalStorage();
      renderStats();
    }

    // 次のモード提案/自動切り替え
    let nextMode = 'work';
    if (timer.mode === 'work') {
      // 4回の作業セッションごとに長い休憩、それ以外は短い休憩
      if (stats.sessionsCompleted > 0 && stats.sessionsCompleted % 4 === 0) {
        nextMode = 'long';
      } else {
        nextMode = 'short';
      }
    } else {
      nextMode = 'work';
    }

    // 次のモードを設定
    setTimeout(() => {
      alert(`${timer.mode === 'work' ? '作業セッション' : '休憩'}が終了しました！`);
      setTimerMode(nextMode);
    }, 100);
  }

  function skipSession() {
    if (confirm('現在のセッションをスキップして、次のセッションに進みますか？')) {
      handleTimerExpiry();
    }
  }

  // --- タスク管理ロジック ---
  function renderTasks() {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '';

    if (tasks.length === 0) {
      taskList.innerHTML = `<li class="current-task-placeholder" style="text-align: center; padding: 24px; list-style: none;">タスクはありません。上から追加してみましょう！</li>`;
      updateActiveTaskDisplay();
      return;
    }

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === activeTaskId ? 'active' : ''}`;
      li.dataset.id = task.id;

      li.innerHTML = `
        <div class="task-item-content">
          <label class="task-checkbox-container" data-id="${task.id}">
            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
          </label>
          <span class="task-text">${escapeHtml(task.text)}</span>
        </div>
        <div class="task-actions">
          <button class="delete-task-btn" data-id="${task.id}" title="削除">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      `;

      // タスク自体のクリック（アクティブ化）
      li.addEventListener('click', (e) => {
        // チェックボックスや削除ボタンのクリックは除外
        if (e.target.closest('.task-checkbox-container') || e.target.closest('.delete-task-btn')) {
          return;
        }
        
        if (!task.completed) {
          selectActiveTask(task.id);
        }
      });

      // チェックボックスの変更イベント
      const checkbox = li.querySelector('.task-checkbox');
      checkbox.addEventListener('change', (e) => {
        toggleTaskComplete(task.id);
      });

      // 削除ボタンのクリックイベント
      const deleteBtn = li.querySelector('.delete-task-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(task.id);
      });

      taskList.appendChild(li);
    });

    updateActiveTaskDisplay();
  }

  function selectActiveTask(id) {
    if (activeTaskId === id) {
      activeTaskId = null; // すでにアクティブなら解除
    } else {
      activeTaskId = id;
    }
    saveTasksToLocalStorage();
    renderTasks();
  }

  function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;

    if (task.completed) {
      // 完了した場合、アクティブなら解除
      if (activeTaskId === id) {
        activeTaskId = null;
      }
      stats.completedTasksCount++;
    } else {
      // 未完了に戻した場合
      stats.completedTasksCount = Math.max(0, stats.completedTasksCount - 1);
    }

    saveTasksToLocalStorage();
    saveStatsToLocalStorage();
    renderTasks();
    renderStats();
  }

  function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    if (activeTaskId === id) {
      activeTaskId = null;
    }
    saveTasksToLocalStorage();
    renderTasks();
  }

  function updateActiveTaskDisplay() {
    const activeTask = tasks.find(t => t.id === activeTaskId);
    const displayEl = document.getElementById('current-task-name');

    if (activeTask && !activeTask.completed) {
      displayEl.innerText = activeTask.text;
      displayEl.classList.remove('current-task-placeholder');
    } else {
      displayEl.innerText = 'タスクが選択されていません';
      displayEl.classList.add('current-task-placeholder');
    }
  }

  // エスケープ処理（XSS対策）
  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- イベントバインディング ---

  // タイマーコントロール
  document.getElementById('play-pause-btn').addEventListener('click', () => {
    if (timer.state === 'running') {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  document.getElementById('reset-btn').addEventListener('click', resetTimer);
  document.getElementById('skip-btn').addEventListener('click', skipSession);

  // タブのクリックイベント
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimerMode(btn.dataset.mode);
    });
  });

  // タスク追加フォーム
  document.getElementById('add-task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;

    const newTask = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: text,
      completed: false
    };

    tasks.push(newTask);
    
    // 最初のタスクなら自動的にアクティブにする
    if (tasks.length === 1) {
      activeTaskId = newTask.id;
    }

    input.value = '';
    saveTasksToLocalStorage();
    renderTasks();
  });

  // 設定モーダルの切り替え
  const settingsModal = document.getElementById('settings-modal');
  
  document.getElementById('settings-toggle-btn').addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  const closeSettings = () => {
    settingsModal.classList.add('hidden');
  };

  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);

  // オーバーレイ背景クリックで閉じる
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettings();
    }
  });

  // 音量スライダー変更
  const volumeSlider = document.getElementById('input-volume');
  volumeSlider.addEventListener('input', () => {
    document.getElementById('volume-value').innerText = `${volumeSlider.value}%`;
  });

  // サウンドテスト
  document.getElementById('test-sound-btn').addEventListener('click', () => {
    // 一時的に設定を反映してテスト
    settings.volume = parseInt(volumeSlider.value);
    playNotificationSound();
  });

  // 統計リセットボタン
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    if (confirm('すべての今日のフォーカス統計データをリセットしますか？この操作は取り消せません。')) {
      stats.sessionsCompleted = 0;
      stats.totalFocusTime = 0;
      stats.completedTasksCount = 0;
      saveStatsToLocalStorage();
      renderStats();
      alert('統計データをリセットしました。');
    }
  });

  // 設定保存
  document.getElementById('settings-save-btn').addEventListener('click', () => {
    const workVal = Math.max(1, parseInt(document.getElementById('input-work').value) || 25);
    const shortVal = Math.max(1, parseInt(document.getElementById('input-short').value) || 5);
    const longVal = Math.max(1, parseInt(document.getElementById('input-long').value) || 15);
    const volumeVal = parseInt(volumeSlider.value);

    settings.workDuration = workVal;
    settings.shortDuration = shortVal;
    settings.longDuration = longVal;
    settings.volume = volumeVal;

    saveSettingsToLocalStorage();

    // タイマー未動作の場合、現在のモードの時間を即座に反映
    if (timer.state === 'stopped') {
      setTimerMode(timer.mode);
    } else {
      alert('設定を保存しました。現在のセッションの終了後、またはリセット後に適用されます。');
    }

    closeSettings();
  });

  // --- 初期化処理 ---
  loadFromLocalStorage();
  updateTheme();
  setTimerMode('work');
  renderTasks();
  renderStats();
});
