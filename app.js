// ---------- Storage ----------
const STORAGE_KEY = "habit_tracker_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { habits: [], logs: {} };
    const parsed = JSON.parse(raw);
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      logs: parsed.logs && typeof parsed.logs === "object" ? parsed.logs : {}
    };
  } catch {
    return { habits: [], logs: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// ---------- Dates ----------
function ymd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtToday() {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

// ---------- Streaks ----------
function getLog(dateStr) {
  if (!state.logs[dateStr]) state.logs[dateStr] = {};
  return state.logs[dateStr];
}

function isDoneForDay(habit, value) {
  if (habit.type === "bool") return value === true;
  const n = Number(value);
  const t = Number(habit.target ?? 0);
  if (!Number.isFinite(n)) return false;
  return t <= 0 ? n > 0 : n >= t;
}

function computeStreak(habitId, upToDateStr) {
  // Walk backwards day-by-day until first miss.
  let streak = 0;
  let d = new Date(upToDateStr + "T12:00:00");
  while (true) {
    const key = ymd(d);
    const v = (state.logs[key] || {})[habitId];
    const habit = state.habits.find(h => h.id === habitId);
    const done = habit ? isDoneForDay(habit, v) : false;
    if (!done) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ---------- UI ----------
const todayBtn = document.getElementById("todayBtn");
const manageBtn = document.getElementById("manageBtn");
const todayView = document.getElementById("todayView");
const manageView = document.getElementById("manageView");
const todayList = document.getElementById("todayList");
const habitTable = document.getElementById("habitTable");

document.getElementById("todayTitle").textContent = fmtToday();
document.getElementById("todayDate").textContent = ymd();

todayBtn.addEventListener("click", () => {
  manageView.classList.add("hidden");
  todayView.classList.remove("hidden");
});
manageBtn.addEventListener("click", () => {
  todayView.classList.add("hidden");
  manageView.classList.remove("hidden");
});

document.getElementById("addHabitForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("nameInput").value.trim();
  const type = document.getElementById("typeInput").value;
  const targetRaw = document.getElementById("targetInput").value;
  const notes = document.getElementById("notesInput").value.trim();

  if (!name) return;

  const habit = {
    id: "h_" + Math.random().toString(16).slice(2),
    name,
    type,                // "bool" or "num"
    target: type === "num" ? Number(targetRaw || 0) : null,
    notes
  };

  state.habits.unshift(habit);
  saveState();
  e.target.reset();
  render();
});

function colorScalePercent(pct) {
  // Keep it simple: adjust accent brightness by swapping accent when low/high.
  // You can later upgrade to real gradient.
  if (pct >= 100) return "#22c55e"; // green-ish
  if (pct >= 60)  return "#60a5fa"; // blue-ish
  if (pct >= 30)  return "#f59e0b"; // amber-ish
  return "#ef4444";                // red-ish
}

function renderToday() {
  const dayKey = ymd();
  const log = getLog(dayKey);

  if (state.habits.length === 0) {
    todayList.innerHTML = `<div class="muted">No habits yet. Tap “Manage” to add one.</div>`;
    return;
  }

  todayList.innerHTML = "";
  state.habits.forEach(h => {
    const v = log[h.id];

    const item = document.createElement("div");
    item.className = "item";

    const streak = computeStreak(h.id, dayKey);
    const done = isDoneForDay(h, v);

    // Progress for numeric habits
    let pct = 0;
    if (h.type === "bool") {
      pct = done ? 100 : 0;
    } else {
      const n = Number(v || 0);
      const t = Number(h.target || 0);
      pct = t <= 0 ? (n > 0 ? 100 : 0) : Math.max(0, Math.min(100, (n / t) * 100));
    }

    const top = document.createElement("div");
    top.className = "itemTop";
    top.innerHTML = `
      <div>
        <div style="font-weight:650">${h.name}</div>
        <div class="muted">${h.type === "bool" ? "Yes/No" : `Target: ${h.target ?? 0}`} • Streak: ${streak}</div>
      </div>
      <span class="badge">${done ? "Done" : "Not yet"}</span>
    `;

    const control = document.createElement("div");
    control.style.marginTop = "10px";

    if (h.type === "bool") {
      const btn = document.createElement("button");
      btn.textContent = done ? "Mark not done" : "Mark done";
      btn.addEventListener("click", () => {
        log[h.id] = !done;
        saveState();
        render();
      });
      control.appendChild(btn);
    } else {
      const row = document.createElement("div");
      row.className = "row";
      const input = document.createElement("input");
      input.type = "number";
      input.step = "1";
      input.min = "0";
      input.value = Number.isFinite(Number(v)) ? v : "";
      input.placeholder = "Enter value";
      input.addEventListener("change", () => {
        log[h.id] = input.value === "" ? null : Number(input.value);
        saveState();
        render();
      });

      const quick = document.createElement("button");
      quick.textContent = `+1`;
      quick.addEventListener("click", () => {
        const cur = Number(log[h.id] || 0);
        log[h.id] = cur + 1;
        saveState();
        render();
      });

      row.appendChild(input);
      row.appendChild(quick);
      control.appendChild(row);
    }

    const prog = document.createElement("div");
    prog.className = "progress";
    const fill = document.createElement("div");
    fill.style.width = `${pct}%`;
    fill.style.background = colorScalePercent(pct);
    prog.appendChild(fill);

    item.appendChild(top);
    item.appendChild(control);
    item.appendChild(prog);

    todayList.appendChild(item);
  });
}

function renderManage() {
  if (state.habits.length === 0) {
    habitTable.innerHTML = `<div class="muted">No habits yet.</div>`;
    return;
  }

  habitTable.innerHTML = "";
  state.habits.forEach(h => {
    const item = document.createElement("div");
    item.className = "item";

    item.innerHTML = `
      <div class="itemTop">
        <div>
          <div style="font-weight:650">${h.name}</div>
          <div class="muted">${h.type === "bool" ? "Yes/No" : `Numeric • Target: ${h.target ?? 0}`}${h.notes ? ` • ${h.notes}` : ""}</div>
        </div>
        <button data-del="${h.id}">Delete</button>
      </div>
    `;

    item.querySelector("[data-del]").addEventListener("click", () => {
      state.habits = state.habits.filter(x => x.id !== h.id);
      // remove from logs
      Object.keys(state.logs).forEach(day => {
        if (state.logs[day] && h.id in state.logs[day]) delete state.logs[day][h.id];
      });
      saveState();
      render();
    });

    habitTable.appendChild(item);
  });
}

function render() {
  // ensure today log exists
  getLog(ymd());
  renderToday();
  renderManage();
}

render();
