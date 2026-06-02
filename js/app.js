import {
  DEFAULT_STATS,
  EVENT_TAGS,
  MOOD_OPTIONS,
  DAILY_QUESTION_LEARNING_RATE,
  WEEKLY_QUESTION_LEARNING_RATE,
  XP_PER_QUESTION,
  TASK_DIFFICULTIES,
  TASK_SELECTION_LIMIT,
  SIGNIN_MILESTONES,
  ATTRIBUTE_RANKS,
} from "./config.js";
import { loadSave, persistSave, createInitialSave } from "./storage.js";
import {
  getCurrentUser,
  getCurrentUserId,
  loginUser,
  registerUser,
  logoutUser,
  hasPendingLegacy,
  tryAutoLogin,
  getRememberPreference,
  setRememberPreference,
  getSavedUsername,
} from "./auth.js";
import {
  computeDeltas,
  applyDeltas,
  addXp,
  attributeLevelXpNeeded,
  levelXpNeeded,
  setAttributeGrowthBaselines,
  settleFeedbackAttributeXp,
  settleQuestionnaireAttributeXp,
  settleTaskOutcome,
  undoLast,
} from "./adjust.js";
import { ONBOARDING_QUESTIONS } from "./questions.js";
import {
  computeBaselineFromOnboarding,
  computeInitialGrowthFromBaseline,
  applyBaselineToStats,
  mergeEffects,
  getDueDailyQuestions,
  getDueWeeklyQuestions,
  markQuestionAnswered,
  countAnsweredToday,
  countAnsweredThisWeek,
} from "./questionnaire.js";
import {
  acceptTask,
  describeTaskReward,
  ensureDailyTasks,
  getTodayTaskEntry,
  hasRefreshableBoardTasks,
  recordTaskOutcome,
  refreshBoardTasks,
} from "./tasks.js";
import {
  applyPlanScoring,
  archivePlan,
  createPlan,
  ensurePlans,
  formatPlanScoreSummary,
  getActivePlans,
  setManualPlanScore,
  updatePlan,
} from "./plans.js";
import {
  getCheckInStatus,
  getRecentCheckInDays,
  performCheckIn,
} from "./checkin.js";
import { appDayKey, formatAppClock } from "./clock.js";

const $ = (sel) => document.querySelector(sel);

function safeClone(value) {
  if (value === undefined) return undefined;
  try {
    return typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function showFatalError(err) {
  const msg = err?.message ?? String(err);
  console.error(err);
  const box = document.createElement("div");
  box.className = "fatal-error";
  box.innerHTML = `
    <strong>页面加载出错</strong>
    <p>${msg}</p>
    <p class="hint">请尝试：清除本站浏览器数据后刷新，或使用 <code>python -m http.server 5173</code> 通过 http://localhost:5173 访问。</p>
  `;
  document.body.prepend(box);
  document.body.classList.add("is-guest");
  document.body.classList.remove("is-authed");
}

let save = null;
let appReady = false;
let activePage = "main";
let selectedMood = 3;
let selectedTags = new Set();
const tuneValues = Object.fromEntries(DEFAULT_STATS.map((s) => [s.id, 0]));

let onboardStep = 0;
const onboardAnswers = [];
let onboardSelectedOption = null;
let onboardingAdvanceLock = false;

/** questionId -> { frequency, option } */
const pendingQuestionAnswers = new Map();
let dailyRecordSteps = [];
let dailyRecordStep = 0;

function makeUndoSnapshot() {
  return {
    stats: (save.stats ?? []).map((s) => ({ ...s })),
    growth: safeClone(save.growth),
    taskLog: safeClone(save.taskLog),
    plans: safeClone(save.plans),
    checkIn: safeClone(save.checkIn),
    dailyLocks: safeClone(save.dailyLocks),
    xp: save.xp,
    level: save.level,
  };
}

function canMutateStats() {
  return appReady && Boolean(getCurrentUserId() && save);
}

function getTodayLocks() {
  if (!save.dailyLocks) save.dailyLocks = {};
  const day = appDayKey();
  if (!save.dailyLocks[day]) save.dailyLocks[day] = {};
  return save.dailyLocks[day];
}

function hasDailyRecordToday() {
  return Boolean(save?.dailyLocks?.[appDayKey()]?.dailyRecord);
}

function markDailyRecordToday() {
  const locks = getTodayLocks();
  locks.dailyRecord = {
    at: Date.now(),
  };
}

function switchAppPage(pageId = "main") {
  const target = document.querySelector(`.app-page[data-page="${pageId}"]`);
  if (!target) return;
  activePage = pageId;

  document.querySelectorAll(".app-page").forEach((page) => {
    const active = page.dataset.page === pageId;
    page.classList.toggle("is-active", active);
    page.hidden = !active;
  });

  document.querySelectorAll(".app-nav-btn").forEach((btn) => {
    const active = btn.dataset.pageTarget === pageId;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

function bindPageNav() {
  document.querySelectorAll(".app-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchAppPage(btn.dataset.pageTarget));
  });
  switchAppPage(activePage);
}

function restoreLoginFormDefaults() {
  const remember = getRememberPreference();
  const loginRemember = $("#loginRemember");
  const registerRemember = $("#registerRemember");
  if (loginRemember) loginRemember.checked = remember;
  if (registerRemember) registerRemember.checked = remember;

  const savedName = getSavedUsername();
  const loginUser = $("#loginUsername");
  const regUser = $("#registerUsername");
  if (loginUser && savedName) loginUser.value = savedName;
  if (regUser && savedName) regUser.value = savedName;
}

async function init() {
  bindAuthUI();
  bindPageNav();
  restoreLoginFormDefaults();

  const auto = await tryAutoLogin();
  if (auto.ok) {
    bootApp();
    return;
  }

  if (!getCurrentUserId()) {
    openAuthDialog();
    return;
  }
  bootApp();
}

function startApp() {
  init().catch((err) => showFatalError(err));
}

function enterGuestMode() {
  document.body.classList.remove("is-authed");
  document.body.classList.add("is-guest");
  appReady = false;
  save = null;
  const guestBanner = $("#guestBanner");
  if (guestBanner) guestBanner.hidden = false;
  const btnAccount = $("#btnAccount");
  if (btnAccount) {
    btnAccount.hidden = false;
    btnAccount.textContent = "登录";
  }
  const lastCheckIn = $("#lastCheckIn");
  if (lastCheckIn) lastCheckIn.textContent = "未登录 · 浏览模式，不会保存或修改数值";
}

function bootApp() {
  document.body.classList.remove("is-guest");
  const guestBanner = $("#guestBanner");
  if (guestBanner) guestBanner.hidden = true;
  save = loadSave();
  if (!save) {
    save = createInitialSave(DEFAULT_STATS);
    persistSave(save);
    $("#nameDialog")?.showModal();
  }
  if (!save?.stats?.length) {
    save.stats = DEFAULT_STATS.map((s) => ({ ...s }));
    persistSave(save);
  }
  document.body.classList.add("is-authed");
  appReady = true;
  const btnAccount = $("#btnAccount");
  if (btnAccount) btnAccount.hidden = false;
  updateAccountHeader();
  if (!window.__uiBound) {
    bindUI();
    window.__uiBound = true;
  }
  try {
    renderAll();
    updateOnboardingEntry();
    if (!$("#nameDialog")?.open) {
      maybeStartOnboarding();
    }
  } catch (err) {
    showFatalError(err);
  }
}

function isOnboardingUnlocked() {
  return Boolean(save?.onboardingComplete || save?.onboardingDismissed);
}

/** 仅首次进入且未完成、未跳过过时自动弹出入门问卷 */
function maybeStartOnboarding() {
  if (!appReady || !save) return;
  if (save.onboardingComplete || save.onboardingDismissed) return;
  if ($("#nameDialog")?.open || $("#onboardingDialog")?.open) return;
  startOnboardingWizard();
}

function updateOnboardingEntry() {
  const btnStart = $("#btnStartOnboarding");
  const btnRetake = $("#btnRetakeOnboarding");
  if (!btnStart || !save) return;
  if (save.onboardingComplete) {
    btnStart.hidden = true;
    if (btnRetake) btnRetake.hidden = false;
  } else if (save.onboardingDismissed) {
    btnStart.hidden = false;
    btnStart.textContent = "完成入门问卷";
    if (btnRetake) btnRetake.hidden = true;
  } else {
    btnStart.hidden = false;
    btnStart.textContent = "完成入门问卷";
    if (btnRetake) btnRetake.hidden = true;
  }
}

function exitAuthWithoutLogin() {
  $("#authDialog").close();
  enterGuestMode();
}

function updateAccountHeader() {
  const user = getCurrentUser();
  if (!user) return;
  $("#btnAccount").textContent = `账号 · ${user.username}`;
  $("#accountLine").hidden = false;
  $("#accountLine").textContent = `当前登录：${user.username}`;
  $("#accountCurrentUser").textContent = `已登录：${user.username}`;
}

function openAuthDialog() {
  $("#authError").hidden = true;
  $("#authHint").textContent = hasPendingLegacy()
    ? "检测到本机有一份旧存档。注册第一个账号时，会自动迁入该数据。"
    : "登录后，你的问卷、任务与成长数据将只属于当前账号。";
  $("#authDialog").showModal();
}

function showAuthError(message) {
  const el = $("#authError");
  el.textContent = message;
  el.hidden = false;
}

function setAuthTab(tab) {
  const isLogin = tab === "login";
  $("#loginForm").hidden = !isLogin;
  $("#registerForm").hidden = isLogin;
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tab);
  });
  $("#authError").hidden = true;
}

function bindAuthUI() {
  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => setAuthTab(btn.dataset.tab));
  });

  $("#authDialog").addEventListener("cancel", () => {
    if (!getCurrentUserId()) exitAuthWithoutLogin();
  });

  $("#btnAuthExit").addEventListener("click", exitAuthWithoutLogin);
  $("#btnGuestLogin").addEventListener("click", openAuthDialog);

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#loginUsername").value;
    const password = $("#loginPassword").value;
    const rememberMe = $("#loginRemember")?.checked ?? true;
    setRememberPreference(rememberMe);
    const result = await loginUser(username, password, rememberMe);
    if (!result.ok) {
      showAuthError(result.error);
      return;
    }
    $("#authDialog").close();
    bootApp();
  });

  $("#registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#registerUsername").value;
    const password = $("#registerPassword").value;
    const confirm = $("#registerPasswordConfirm").value;
    const rememberMe = $("#registerRemember")?.checked ?? true;
    if (password !== confirm) {
      showAuthError("两次输入的密码不一致");
      return;
    }
    setRememberPreference(rememberMe);
    const result = await registerUser(username, password, rememberMe);
    if (!result.ok) {
      showAuthError(result.error);
      return;
    }
    $("#authDialog").close();
    bootApp();
  });

  $("#btnAccount").addEventListener("click", () => {
    if (!getCurrentUserId()) {
      openAuthDialog();
      return;
    }
    updateAccountHeader();
    $("#accountDialog").showModal();
  });

  $("#btnLogout").addEventListener("click", () => {
    logoutUser();
    location.reload();
  });

  $("#btnSwitchAccount").addEventListener("click", () => {
    logoutUser();
    location.reload();
  });

  $("#btnCloseAccount").addEventListener("click", () => {
    $("#accountDialog").close();
  });
}

function requestRetakeOnboarding() {
  if (!canMutateStats()) return;
  if (confirm("重新作答将用新答案覆盖当前属性基准，是否继续？")) {
    save.onboardingComplete = false;
    save.onboardingAnswers = [];
    persistSave(save);
    startOnboardingWizard();
  }
}

function bindUI() {
  $("#nameForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canMutateStats()) return;
    const name = $("#nameInput").value.trim();
    if (name) {
      save.playerName = name;
      persistSave(save);
      renderHeader();
    }
    $("#nameDialog").close();
    updateOnboardingEntry();
    maybeStartOnboarding();
  });

  $("#btnSkipName").addEventListener("click", () => {
    $("#nameDialog").close();
    updateOnboardingEntry();
    maybeStartOnboarding();
  });

  $("#btnStartOnboarding").addEventListener("click", () => startOnboardingWizard());
  $("#btnCalibrate").addEventListener("click", openCalibrate);
  $("#btnRetakeOnboarding").addEventListener("click", requestRetakeOnboarding);
  $("#btnArchiveOnboarding").addEventListener("click", requestRetakeOnboarding);
  $("#btnArchiveCalibrate").addEventListener("click", openCalibrate);
  $("#btnArchiveAccount").addEventListener("click", () => $("#btnAccount").click());
  $("#btnToggleHistory").addEventListener("click", toggleHistoryPanel);

  $("#calibrateForm").addEventListener("submit", (e) => {
    e.preventDefault();
    applyCalibration();
    $("#calibrateDialog").close();
  });
  $("#btnCancelCalibrate").addEventListener("click", () => {
    $("#calibrateDialog").close();
  });

  $("#btnDailyContinue").addEventListener("click", handleDailyRecordContinue);
  $("#btnUndo").addEventListener("click", () => {
    if (!canMutateStats()) return;
    if (undoLast(save)) {
      persistSave(save);
      renderAll();
      $("#btnUndo").disabled = true;
      $("#deltaLog").hidden = true;
    }
  });

  $("#btnOnboardBack").addEventListener("click", () => {
    if (onboardStep > 0) {
      onboardStep -= 1;
      const prev = onboardAnswers[onboardStep];
      onboardSelectedOption = prev?.optionId ?? null;
      renderOnboardingStep();
    }
  });

  $("#onboardingDialog").addEventListener("cancel", () => {
    exitOnboardingWizard();
  });

  $("#btnOnboardExit").addEventListener("click", exitOnboardingWizard);

  $("#btnCheckIn").addEventListener("click", handleCheckIn);
  $("#btnRefreshTasks").addEventListener("click", handleRefreshTasks);

  $("#btnAddPlan").addEventListener("click", () => openPlanDialog());
  $("#btnCancelPlan").addEventListener("click", () => $("#planDialog").close());
  $("#planForm").addEventListener("submit", (e) => {
    e.preventDefault();
    savePlanFromForm();
  });

  buildMoodScale();
  buildEventTags();
  buildTuneSliders();
  populatePlanStatSelect();
}

function populatePlanStatSelect() {
  const box = $("#planStatChoices");
  if (!box || !save?.stats) return;
  box.innerHTML = "";
  save.stats.forEach((stat) => {
    const label = document.createElement("label");
    label.className = "plan-stat-choice";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "planStat";
    input.value = stat.id;
    label.append(input, document.createTextNode(stat.name));
    box.appendChild(label);
  });
}

function setPlanStatSelection(statIds) {
  const selected = new Set(statIds);
  $("#planStatChoices")
    ?.querySelectorAll('input[type="checkbox"][name="planStat"]')
    .forEach((input) => {
      input.checked = selected.has(input.value);
    });
}

function selectedPlanStatIds() {
  return [
    ...($("#planStatChoices")?.querySelectorAll('input[type="checkbox"][name="planStat"]:checked') ??
      []),
  ].map((input) => input.value);
}

function planStatIds(plan) {
  return Array.isArray(plan?.statIds) && plan.statIds.length
    ? plan.statIds
    : plan?.statId
      ? [plan.statId]
      : [];
}

function openPlanDialog(plan = null) {
  $("#planDialogTitle").textContent = plan ? "编辑计划" : "添加计划";
  populatePlanStatSelect();
  $("#planEditId").value = plan?.id ?? "";
  $("#planTitle").value = plan?.title ?? "";
  $("#planDescription").value = plan?.description ?? "";
  const selectedStats = plan ? planStatIds(plan) : [save.stats[0]?.id ?? "hea"];
  setPlanStatSelection(selectedStats);
  $("#planCadence").value = plan?.cadence ?? "daily";
  $("#planKeywords").value = (plan?.keywords ?? []).join(", ");
  $("#planDialog").showModal();
}

function savePlanFromForm() {
  if (!canMutateStats()) return;
  const input = {
    title: $("#planTitle").value,
    description: $("#planDescription").value,
    statIds: selectedPlanStatIds(),
    cadence: $("#planCadence").value,
    keywords: $("#planKeywords").value,
  };
  if (!input.statIds.length) {
    alert("请至少选择一个关联属性");
    return;
  }
  const editId = $("#planEditId").value;
  if (editId) updatePlan(save, editId, input);
  else createPlan(save, input);
  persistSave(save);
  $("#planDialog").close();
  renderPlansPanel();
}

function scorePlansFromActivity(context, source) {
  const results = applyPlanScoring(save, context, source);
  if (!results.length) return null;
  return formatPlanScoreSummary(results);
}

function planScoreColor(score) {
  if (score >= 65) return "var(--stat-high)";
  if (score >= 35) return "var(--stat-mid)";
  return "var(--stat-low)";
}

function renderPlansPanel() {
  ensurePlans(save);
  const list = $("#planList");
  list.innerHTML = "";

  if (!isOnboardingUnlocked()) {
    list.innerHTML = "<p class='hint'>完成入门问卷后，方可立下你的行路志。</p>";
    return;
  }

  const plans = getActivePlans(save);
  if (!plans.length) {
    list.innerHTML = "<p class='hint'>还没有行路志。点击「添加计划」，写下你想坚持的事。</p>";
    return;
  }

  const day = appDayKey();
  plans.forEach((plan) => {
    const today = plan.scoreHistory?.[day];
    const card = document.createElement("article");
    card.className = "plan-card";

    const signals =
      today?.signals?.length > 0
        ? `今日依据：${today.signals.join("；")}`
        : "今日尚未评分，完成反馈或任务后会自动更新";
    const statLabels = planStatIds(plan).map(statName).join(" / ");

    card.innerHTML = `
      <div class="plan-card-head">
        <h3>${plan.title}</h3>
        <span class="plan-score-value">${Math.round(plan.currentScore)}</span>
      </div>
      <div class="plan-bar-track">
        <div class="plan-bar-fill" style="width:${plan.currentScore}%;background:${planScoreColor(plan.currentScore)}"></div>
      </div>
      <p class="plan-meta">${statLabels} · ${plan.cadence === "weekly" ? "每周" : "每天"}检查${
        today ? ` · 今日 ${today.score} 分` : ""
      }</p>
      <p class="plan-signals">${signals}</p>
    `;

    const rateRow = document.createElement("div");
    rateRow.className = "plan-rate-row";
    const label = document.createElement("span");
    label.className = "plan-rate-label";
    label.textContent = "我觉得今天：";
    rateRow.appendChild(label);

    const labels = ["很差", "一般", "还行", "很好", "极好"];
    labels.forEach((text, idx) => {
      const rating = idx + 1;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "plan-rate-btn";
      btn.textContent = text;
      btn.setAttribute("aria-pressed", today?.rating === rating ? "true" : "false");
      btn.disabled = Boolean(today?.manual);
      if (today?.manual) btn.title = "今天已经评分，明天 4 点后可再次评分";
      btn.addEventListener("click", () => {
        if (!canMutateStats()) return;
        const result = setManualPlanScore(save, plan.id, rating);
        if (result?.locked) {
          alert("这个计划今天已经评分，明天 4 点刷新后可以再次评分。");
          renderPlansPanel();
          return;
        }
        const rewardText = result?.rewards?.length
          ? ` · 属性成长 · ${result.rewards.map(formatAttributeReward).join("，")}`
          : "";
        save.history.unshift({
          at: Date.now(),
          type: "plan",
          summary: `计划评分 · ${plan.title} · 自评 ${text}（${plan.scoreHistory[day].score} 分）${rewardText}`,
          rewards: result?.rewards ?? [],
        });
        if (save.history.length > 50) save.history.length = 50;
        persistSave(save);
        renderAll();
        renderHistory();
      });
      rateRow.appendChild(btn);
    });
    card.appendChild(rateRow);

    const actions = document.createElement("div");
    actions.className = "plan-card-actions";
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn ghost";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", () => openPlanDialog(plan));
    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "btn ghost";
    archiveBtn.textContent = "归档";
    archiveBtn.addEventListener("click", () => {
      if (confirm(`归档「${plan.title}」？归档后不再每日评分，但历史保留。`)) {
        archivePlan(save, plan.id);
        persistSave(save);
        renderPlansPanel();
      }
    });
    actions.append(editBtn, archiveBtn);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

function exitOnboardingWizard() {
  onboardStep = 0;
  onboardAnswers.length = 0;
  onboardSelectedOption = null;
  if (save && !save.onboardingComplete) {
    save.onboardingDismissed = true;
    persistSave(save);
    updateOnboardingEntry();
    renderAll();
  }
  $("#onboardingDialog").close();
}

function startOnboardingWizard() {
  onboardStep = 0;
  onboardAnswers.length = 0;
  onboardSelectedOption = null;
  if (save.onboardingAnswers?.length) {
    save.onboardingAnswers.forEach((a, i) => {
      onboardAnswers[i] = a;
    });
  }
  renderOnboardingStep();
  $("#onboardingDialog").showModal();
}

function renderOnboardingStep() {
  const q = ONBOARDING_QUESTIONS[onboardStep];
  const total = ONBOARDING_QUESTIONS.length;
  $("#onboardStepLabel").textContent = `入门问卷 ${onboardStep + 1} / ${total}`;
  $("#onboardBarFill").style.width = `${((onboardStep + 1) / total) * 100}%`;
  $("#onboardQuestionText").textContent = q.text;
  $("#onboardQuestionHint").textContent = q.hint ?? "";
  $("#onboardQuestionHint").hidden = !q.hint;

  const box = $("#onboardOptions");
  box.innerHTML = "";
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "onboard-opt";
    btn.textContent = opt.label;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", opt.id === onboardSelectedOption ? "true" : "false");
    btn.addEventListener("click", () => {
      onboardSelectedOption = opt.id;
      box.querySelectorAll(".onboard-opt").forEach((b) => b.setAttribute("aria-checked", "false"));
      btn.setAttribute("aria-checked", "true");
      advanceOnboarding();
    });
    box.appendChild(btn);
  });

  $("#btnOnboardBack").disabled = onboardStep === 0;
}

function advanceOnboarding() {
  if (!onboardSelectedOption || onboardingAdvanceLock) return;
  onboardingAdvanceLock = true;
  const q = ONBOARDING_QUESTIONS[onboardStep];
  onboardAnswers[onboardStep] = {
    questionId: q.id,
    optionId: onboardSelectedOption,
  };

  if (onboardStep < ONBOARDING_QUESTIONS.length - 1) {
    onboardStep += 1;
    const next = onboardAnswers[onboardStep];
    onboardSelectedOption = next?.optionId ?? null;
    renderOnboardingStep();
  } else {
    finishOnboarding();
  }
  setTimeout(() => {
    onboardingAdvanceLock = false;
  }, 120);
}

function finishOnboarding() {
  if (!canMutateStats()) return;
  const statIds = save.stats.map((s) => s.id);
  const baseline = computeBaselineFromOnboarding(onboardAnswers, statIds);
  const initialGrowth = computeInitialGrowthFromBaseline(baseline, statIds);
  applyBaselineToStats(save, baseline);
  setAttributeGrowthBaselines(save, initialGrowth.growth);
  save.onboardingComplete = true;
  save.onboardingDismissed = true;
  save.onboardingAnswers = [...onboardAnswers];
  const growthSummary = initialGrowth.insights
    .map((entry) => `${statName(entry.statId)} Lv.${entry.level}`)
    .join("，");
  save.history.unshift({
    at: Date.now(),
    type: "onboarding",
    summary: `入门问卷完成 · 已生成成长画像（${growthSummary}）`,
    applied: save.stats.map((s) => ({
      id: s.id,
      name: s.name,
      change: s.value,
    })),
  });
  if (save.history.length > 50) save.history.length = 50;
  persistSave(save);
  $("#onboardingDialog").close();
  renderAll();
}

function resetDailyRecordState() {
  dailyRecordSteps = [];
  dailyRecordStep = 0;
  pendingQuestionAnswers.clear();
}

function buildDailyRecordSteps() {
  const daily = getDueDailyQuestions(save).map((q) => ({ ...q, frequency: "daily", freqLabel: "每日" }));
  const weekly = getDueWeeklyQuestions(save).map((q) => ({ ...q, frequency: "weekly", freqLabel: "每周" }));
  return [
    { type: "mood" },
    { type: "tags" },
    { type: "tune" },
    { type: "note" },
    ...daily.map((q) => ({ type: "question", ...q })),
    ...weekly.map((q) => ({ type: "question", ...q })),
  ];
}

function renderDailyRecordPanel() {
  if (!isOnboardingUnlocked()) {
    $("#dailyRecordHost").innerHTML =
      "<p class='hint'>请先完成入门问卷，解锁每日记录。</p>";
    $("#questAllDone").hidden = true;
    $("#questBadge").textContent = "未解锁";
    $("#btnDailyContinue").hidden = true;
    hideDailyRecordBlocks();
    return;
  }

  const answeredDaily = countAnsweredToday(save);
  const answeredWeekly = countAnsweredThisWeek(save);
  $("#questBadge").textContent = `今日 ${answeredDaily}/3 · 本周 ${answeredWeekly}/2`;
  if (hasDailyRecordToday()) {
    $("#dailyRecordHost").innerHTML = "<p class='hint'>今日记录已完成，明天 4 点后可再次记录。</p>";
    $("#questAllDone").hidden = false;
    $("#questAllDone").textContent = "今日已记录 ✓";
    $("#btnDailyContinue").hidden = true;
    hideDailyRecordBlocks();
    return;
  }

  resetDailyRecordState();
  dailyRecordSteps = buildDailyRecordSteps();
  $("#questAllDone").hidden = true;
  renderDailyRecordStep();
}

function hideDailyRecordBlocks() {
  $("#dailyMoodField").hidden = true;
  $("#dailyTagsField").hidden = true;
  $("#dailyTuneField").hidden = true;
  $("#dailyNoteWrap").hidden = true;
}

function handleDailyRecordContinue() {
  const step = dailyRecordSteps[dailyRecordStep];
  if (!step) return;
  if (step.type === "note" || step.type === "tags" || step.type === "tune") {
    dailyRecordStep += 1;
    renderDailyRecordStep();
  }
}

function renderDailyRecordStep() {
  const host = $("#dailyRecordHost");
  host.innerHTML = "";
  hideDailyRecordBlocks();
  const btnContinue = $("#btnDailyContinue");
  const step = dailyRecordSteps[dailyRecordStep];

  if (!step) {
    submitDailyRecord();
    return;
  }

  if (step.type === "mood") {
    $("#dailyMoodField").hidden = false;
    btnContinue.hidden = true;
    $("#dailyRecordHint").textContent = "请选择整体状态，点选后自动下一步。";
    buildMoodScale((value) => {
      selectedMood = value;
      dailyRecordStep += 1;
      renderDailyRecordStep();
    });
    return;
  }

  if (step.type === "tags") {
    $("#dailyTagsField").hidden = false;
    btnContinue.hidden = false;
    btnContinue.textContent = "继续";
    $("#dailyRecordHint").textContent = "选择今天发生的事情后，继续下一步。";
    buildEventTags();
    return;
  }

  if (step.type === "tune") {
    $("#dailyTuneField").hidden = false;
    btnContinue.hidden = false;
    btnContinue.textContent = "继续";
    $("#dailyRecordHint").textContent = "如需补充属性体感，请拖动滑条。";
    buildTuneSliders();
    return;
  }

  if (step.type === "note") {
    $("#dailyNoteWrap").hidden = false;
    btnContinue.hidden = false;
    btnContinue.textContent = "进入动态题";
    $("#dailyRecordHint").textContent = "可写一句备注，然后继续。";
    return;
  }

  if (step.type === "question") {
    btnContinue.hidden = true;
    host.innerHTML = `
      <div class="quest-block">
        <span class="quest-freq">${step.freqLabel}</span>
        <p class="quest-text">${step.text}</p>
        <div class="quest-options" role="radiogroup" aria-label="${step.text}"></div>
      </div>
    `;
    const opts = host.querySelector(".quest-options");
    step.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quest-opt";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        pendingQuestionAnswers.set(step.id, { frequency: step.frequency, option: opt, question: step });
        dailyRecordStep += 1;
        renderDailyRecordStep();
      });
      opts.appendChild(btn);
    });
    $("#dailyRecordHint").textContent = `动态题 ${pendingQuestionAnswers.size + 1} / ${
      dailyRecordSteps.filter((s) => s.type === "question").length
    }，点选后自动下一题。`;
  }
}

function submitDailyRecord() {
  if (!canMutateStats()) return;
  if (hasDailyRecordToday()) {
    renderDailyRecordPanel();
    return;
  }
  const deltas = computeDeltas({
    stats: save.stats,
    mood: selectedMood,
    tagIds: [...selectedTags],
    tuneDeltas: tuneValues,
    eventTags: EVENT_TAGS,
  });

  const dailyOpts = [];
  const weeklyOpts = [];

  for (const [, { frequency, option }] of pendingQuestionAnswers) {
    if (frequency === "daily") dailyOpts.push(option);
    else weeklyOpts.push(option);
  }

  save.lastUndo = makeUndoSnapshot();

  const allApplied = [];
  const feedbackApplied = applyDeltas(save, deltas).applied;
  allApplied.push(...feedbackApplied);
  const feedbackRewards = settleFeedbackAttributeXp(save, deltas);
  addXp(save);

  if (dailyOpts.length) {
    const deltas = mergeEffects(dailyOpts);
    const { applied } = applyDeltas(save, deltas, DAILY_QUESTION_LEARNING_RATE);
    allApplied.push(...applied);
  }

  if (weeklyOpts.length) {
    const deltas = mergeEffects(weeklyOpts);
    const { applied } = applyDeltas(save, deltas, WEEKLY_QUESTION_LEARNING_RATE);
    allApplied.push(...applied);
  }

  for (const [qid, { frequency }] of pendingQuestionAnswers) {
    markQuestionAnswered(save, frequency, qid);
  }

  const count = pendingQuestionAnswers.size;
  addXp(save, XP_PER_QUESTION * count);

  const mergedEffects = mergeEffects([...dailyOpts, ...weeklyOpts]);
  const questionRewards = settleQuestionnaireAttributeXp(save, mergedEffects);
  const allRewards = [...feedbackRewards, ...questionRewards];
  const note = $("#dailyNote").value.trim();
  const planSummary = scorePlansFromActivity(
    {
      mood: selectedMood,
      tagIds: [...selectedTags],
      tuneDeltas: { ...tuneValues },
      dailyNote: note,
      extraEffects: mergedEffects,
    },
    "dailyRecord"
  );

  const changeText =
    allApplied.length > 0
      ? allApplied.map((a) => `${a.name} ${a.change > 0 ? "+" : ""}${a.change.toFixed(1)}`).join("，")
      : "数值基本持平";
  const rewardText =
    allRewards.length > 0
      ? allRewards
          .map(formatAttributeReward)
          .join("，")
      : "";

  save.history.unshift({
    at: Date.now(),
    type: "dailyRecord",
    summary: [
      planSummary ? `计划评分 · ${planSummary}` : null,
      rewardText ? `属性成长 · ${rewardText}` : null,
      `今日状态 · ${changeText}`,
    ]
      .filter(Boolean)
      .join(" · "),
    applied: allApplied,
    rewards: allRewards,
  });
  if (save.history.length > 50) save.history.length = 50;
  markDailyRecordToday();

  persistSave(save);
  pendingQuestionAnswers.clear();
  renderAll();

  const deltaList = $("#deltaList");
  deltaList.innerHTML = "";
  allApplied.forEach((a) => {
    const li = document.createElement("li");
    li.className = a.change > 0 ? "delta-positive" : "delta-negative";
    li.textContent = `${a.name} ${a.change > 0 ? "+" : ""}${a.change.toFixed(1)}`;
    deltaList.appendChild(li);
  });
  allRewards.forEach((reward) => {
    const li = document.createElement("li");
    li.className = "delta-positive";
    li.textContent = formatAttributeReward(reward);
    deltaList.appendChild(li);
  });
  if (allApplied.length || allRewards.length) {
    $("#deltaLog").hidden = false;
    $("#btnUndo").disabled = false;
  }
  resetFeedbackForm();
}

function buildMoodScale(onPick = null) {
  const container = $("#moodScale");
  container.innerHTML = "";
  MOOD_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-btn";
    btn.textContent = opt.label;
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", opt.value === selectedMood ? "true" : "false");
    btn.addEventListener("click", () => {
      selectedMood = opt.value;
      container.querySelectorAll(".mood-btn").forEach((b) => {
        b.setAttribute("aria-checked", "false");
      });
      btn.setAttribute("aria-checked", "true");
      if (typeof onPick === "function") onPick(opt.value);
    });
    if (opt.value === selectedMood) btn.setAttribute("aria-checked", "true");
    container.appendChild(btn);
  });
}

function buildEventTags() {
  const grid = $("#eventTags");
  grid.innerHTML = "";
  EVENT_TAGS.forEach((tag) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tag-btn";
    btn.textContent = tag.label;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => {
      if (selectedTags.has(tag.id)) {
        selectedTags.delete(tag.id);
        btn.setAttribute("aria-pressed", "false");
      } else {
        selectedTags.add(tag.id);
        btn.setAttribute("aria-pressed", "true");
      }
    });
    grid.appendChild(btn);
  });
}

function buildTuneSliders() {
  const list = $("#tuneSliders");
  list.innerHTML = "";
  save.stats.forEach((stat) => {
    const wrap = document.createElement("div");
    wrap.className = "tune-item";
    const label = document.createElement("label");
    const spanVal = document.createElement("span");
    spanVal.textContent = "—";
    label.innerHTML = `${stat.name} <span></span>`;
    label.querySelector("span").replaceWith(spanVal);

    const input = document.createElement("input");
    input.type = "range";
    input.min = "-2";
    input.max = "2";
    input.step = "1";
    input.value = "0";
    input.addEventListener("input", () => {
      const v = Number(input.value);
      tuneValues[stat.id] = v;
      const labels = ["明显变差", "略差", "—", "略好", "明显变好"];
      spanVal.textContent = labels[v + 2];
    });

    wrap.append(label, input);
    list.appendChild(wrap);
  });
}

function renderStats() {
  const list = $("#statList");
  list.innerHTML = "";
  save.stats.forEach((stat) => {
    const growthStat = save.growth?.statGrowth?.[stat.id] ?? { level: 1, xp: 0, totalXp: 0 };
    const level = growthStat.level ?? 1;
    const need = attributeLevelXpNeeded(level);
    const xp = growthStat.xp ?? 0;
    const pct = Math.min(100, (xp / need) * 100);
    const li = document.createElement("li");
    li.className = "stat-item";
    li.innerHTML = `
      <div class="stat-header">
        <div>
          <span class="stat-name">${stat.name}</span>
          <span class="stat-rank">${statRankLabel(level)}</span>
        </div>
        <span class="stat-value">Lv.${level}</span>
      </div>
      <div class="stat-xp-line">
        <span>${xp} / ${need} XP</span>
        <span>累计 ${growthStat.totalXp ?? xp} XP</span>
      </div>
      <div class="stat-bar-track">
        <div class="stat-bar-fill" style="width:${pct}%;background:linear-gradient(90deg, var(--jade), var(--gold))"></div>
      </div>
      <p class="stat-desc">${stat.desc}</p>
      <p class="stat-state">${statusLabel(stat.value)} · 状态 ${Math.round(stat.value)} / 100 · 锚点 ${Math.round(stat.anchor)}</p>
    `;
    list.appendChild(li);
  });
}

function renderHeader() {
  $("#playerName").textContent = save.playerName || "旅人";
  const growth = save.growth ?? { level: save.level ?? 1, xp: save.xp ?? 0, totalXp: 0 };
  $("#level").textContent = growth.level;
  const need = levelXpNeeded(growth.level);
  const pct = Math.min(100, (growth.xp / need) * 100);
  $("#xpBar").style.width = `${pct}%`;
  $("#xpLabel").textContent = `${growth.xp} / ${need} XP`;

  const last = save.history[0];
  if (last) {
    const d = new Date(last.at);
    $("#lastCheckIn").textContent = `上次记录：${d.toLocaleString("zh-CN")}`;
  } else {
    $("#lastCheckIn").textContent = isOnboardingUnlocked()
      ? "完成入门问卷后，可记录今日状态"
      : "请先完成入门问卷";
  }
  const clock = formatAppClock();
  const clockEl = $("#appClock");
  if (clockEl) {
    clockEl.textContent = `App 日期 ${clock.dayKey} · 每天 04:00 刷新 · 距离刷新约 ${clock.remainingLabel}`;
  }
}

function renderHistory() {
  const list = $("#historyList");
  list.innerHTML = "";
  if (!save.history.length) {
    list.innerHTML = "<li class='history-item'>完成问卷或反馈后，这里会显示你的成长轨迹。</li>";
    return;
  }
  save.history.slice(0, 20).forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item";
    const d = new Date(entry.at);
    li.innerHTML = `
      <time>${d.toLocaleString("zh-CN")}</time>
      <p class="summary">${entry.summary}</p>
    `;
    list.appendChild(li);
  });
}

function toggleHistoryPanel() {
  const panel = $("#historyPanel");
  const btn = $("#btnToggleHistory");
  const willShow = panel.hidden;
  panel.hidden = !willShow;
  btn.textContent = willShow ? "收起成长轨迹" : "查看成长轨迹";
  btn.setAttribute("aria-expanded", String(willShow));
  if (willShow) renderHistory();
}

function statName(statId) {
  return save.stats.find((s) => s.id === statId)?.name ?? statId.toUpperCase();
}

function statRankLabel(level) {
  return ATTRIBUTE_RANKS.reduce(
    (label, rank) => (level >= rank.minLevel ? rank.label : label),
    ATTRIBUTE_RANKS[0]?.label ?? "成长中"
  );
}

function statusLabel(value) {
  if (value >= 75) return "今日状态很好";
  if (value >= 58) return "今日状态稳定";
  if (value >= 42) return "今日状态普通";
  return "今日需要照顾";
}

function formatAttributeReward(reward) {
  return `${statName(reward.statId)} +${reward.xp} XP${
    reward.levelUps > 0 ? ` · Lv.+${reward.levelUps}` : ""
  }${reward.totalXp > 0 ? ` · 总等级 +${reward.totalXp} XP` : ""}${
    reward.totalLevelUps > 0 ? ` · 总等级提升 +${reward.totalLevelUps}` : ""
  }`;
}

function renderCheckInPanel() {
  if (!canMutateStats()) {
    $("#checkinStreakBadge").textContent = "未登录";
    $("#btnCheckIn").disabled = true;
    $("#checkinHint").textContent = "登录后可每日签到并获得连续奖励。";
    return;
  }

  const status = getCheckInStatus(save);
  $("#checkinStreakBadge").textContent = `连续 ${status.streak} 天`;
  $("#checkinTotal").textContent = status.totalDays;
  $("#checkinMaxStreak").textContent = status.maxStreak;

  const btn = $("#btnCheckIn");
  if (status.signedToday) {
    btn.disabled = true;
    btn.textContent = "今日已签到 ✓";
    const rec = status.todayRecord;
    if (rec) {
      $("#checkinReward").hidden = false;
      $("#checkinReward").textContent = `今日获得 ${rec.totalXp} XP${
        rec.milestoneLabel ? ` · ${rec.milestoneLabel}` : ""
      }`;
    }
  } else {
    btn.disabled = false;
    btn.textContent = "今日签到";
    $("#checkinReward").hidden = true;
  }

  if (status.nextMilestone) {
    $("#checkinNext").textContent = `再连续 ${status.daysUntilNext} 天 → ${status.nextMilestone.label}（+${status.nextMilestone.xp} XP）`;
  } else {
    $("#checkinNext").textContent = "已达当前全部连续签到里程碑，继续保持！";
  }

  const cal = $("#checkinCalendar");
  cal.innerHTML = "";
  getRecentCheckInDays(save, 7).forEach((day) => {
    const cell = document.createElement("div");
    cell.className = [
      "checkin-day",
      day.signed ? "is-signed" : "",
      day.isToday ? "is-today" : "",
    ]
      .filter(Boolean)
      .join(" ");
    cell.innerHTML = `
      <span class="checkin-day-wd">${day.weekday}</span>
      <span class="checkin-day-num">${day.label}</span>
    `;
    cell.title = day.signed ? "已签到" : "未签到";
    cal.appendChild(cell);
  });

  const list = $("#checkinMilestones");
  list.innerHTML = "";
  SIGNIN_MILESTONES.forEach((m) => {
    const li = document.createElement("li");
    const reached = status.maxStreak >= m.days || status.streak >= m.days;
    li.className = reached ? "milestone-done" : "";
    li.textContent = `${m.days} 天 · ${m.label} (+${m.xp} XP)`;
    list.appendChild(li);
  });
}

function handleCheckIn() {
  if (!canMutateStats()) return;
  save.lastUndo = makeUndoSnapshot();
  const result = performCheckIn(save);
  if (!result.ok) {
    alert(result.error);
    return;
  }

  const levelText = result.xpResult.levelUps > 0 ? ` · 升级 +${result.xpResult.levelUps}` : "";
  save.history.unshift({
    at: Date.now(),
    type: "checkin",
    summary: `每日签到 · 连续 ${result.streak} 天 · ${result.message}${levelText}`,
  });
  if (save.history.length > 50) save.history.length = 50;

  persistSave(save);
  renderAll();
}

function renderGrowthPanel() {
  const growth = save.growth;
  if (!growth) return;

  const need = levelXpNeeded(growth.level);
  const pct = Math.min(100, (growth.xp / need) * 100);
  const attrBuckets = save.stats.map((stat) => growth.statGrowth?.[stat.id] ?? { level: 1, xp: 0, totalXp: 0 });
  const avgAttrLevel =
    attrBuckets.length > 0
      ? attrBuckets.reduce((sum, bucket) => sum + (bucket.level ?? 1), 0) / attrBuckets.length
      : 1;
  $("#growthLevel").textContent = `Lv.${growth.level}`;
  $("#growthTotalXp").textContent = `累计 ${growth.totalXp ?? 0} XP · 属性贡献 ${
    growth.attributeLinkedTotalXp ?? 0
  } XP`;
  $("#growthXpBar").style.width = `${pct}%`;
  $("#growthXpLabel").textContent = `${growth.xp} / ${need} XP · 平均属性 Lv.${avgAttrLevel.toFixed(1)}`;
  $("#streakBadge").textContent = `任务连续 ${growth.streak?.count ?? 0} 天`;

  const grid = $("#attributeGrowthGrid");
  grid.innerHTML = "";
  save.stats.forEach((stat) => {
    const growthStat = growth.statGrowth?.[stat.id] ?? { level: 1, xp: 0 };
    const statNeed = attributeLevelXpNeeded(growthStat.level);
    const card = document.createElement("div");
    card.className = "attribute-growth-card";
    card.innerHTML = `
      <strong>${stat.name} Lv.${growthStat.level}</strong>
      <span>${growthStat.xp} / ${statNeed} 属性 XP</span>
    `;
    grid.appendChild(card);
  });
}

function handleRefreshTasks() {
  if (!canMutateStats()) return;
  if (!isOnboardingUnlocked()) return;

  const result = refreshBoardTasks(save);
  if (!result.ok) {
    alert(result.error);
    renderTaskPanel();
    return;
  }

  save.history.unshift({
    at: Date.now(),
    type: "task",
    summary: `告示板刷新 · 保留 ${result.keptCount} 个已接取 · 换新 ${result.refreshedCount} 条`,
  });
  if (save.history.length > 50) save.history.length = 50;

  persistSave(save);
  renderTaskPanel();
}

function renderTaskPanel() {
  const refreshBtn = $("#btnRefreshTasks");
  if (!isOnboardingUnlocked()) {
    $("#taskBadge").textContent = "未解锁";
    $("#taskList").innerHTML = "<p class='hint'>请先完成入门问卷，解锁每日任务。</p>";
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.title = "完成入门问卷后可用";
    }
    return;
  }

  const tasks = ensureDailyTasks(save);
  const entry = getTodayTaskEntry(save);
  persistSave(save);

  $("#taskBadge").textContent = `${entry.acceptedIds.length} / ${TASK_SELECTION_LIMIT} 已接取`;
  if (refreshBtn) {
    const canRefresh = hasRefreshableBoardTasks(save);
    refreshBtn.disabled = !canRefresh;
    refreshBtn.title = canRefresh
      ? "仅替换未接取的任务，已接取的任务会保留"
      : "当前告示上的任务都已接取，无法刷新";
  }
  const list = $("#taskList");
  list.innerHTML = "";

  tasks.forEach((task) => {
    const diff = TASK_DIFFICULTIES[task.difficulty];
    const accepted = entry.acceptedIds.includes(task.id);
    const outcome = entry.outcomes?.[task.id];
    const done = Boolean(outcome);
    const card = document.createElement("article");
    card.className = [
      "task-card",
      accepted ? "is-accepted" : "",
      done ? "is-done" : "",
    ].filter(Boolean).join(" ");

    const statLabels = task.statIds.map(statName).join(" / ");
    card.innerHTML = `
      <div class="task-topline">
        <h3 class="task-title">${task.title}</h3>
        <span class="task-difficulty ${task.difficulty}">${diff.label}</span>
      </div>
      <p class="task-desc">${task.desc}</p>
      <div class="task-meta">
        <span>${task.minutes} 分钟</span>
        <span>${statLabels}</span>
        <span>${describeTaskReward(task)}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    if (done) {
      const p = document.createElement("p");
      p.className = "task-outcome";
      p.textContent = taskOutcomeText(outcome.result, outcome.xp);
      card.appendChild(p);
    } else if (!accepted) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn primary";
      btn.textContent = entry.acceptedIds.length >= TASK_SELECTION_LIMIT ? "接取已满" : "接取任务";
      btn.disabled = entry.acceptedIds.length >= TASK_SELECTION_LIMIT;
      btn.addEventListener("click", () => {
        if (!canMutateStats()) return;
        acceptTask(save, task.id);
        persistSave(save);
        renderTaskPanel();
      });
      actions.appendChild(btn);
    } else {
      actions.appendChild(taskActionButton("完成", () => completeTask(task, "complete"), "primary"));
      actions.appendChild(taskActionButton("部分完成", () => completeTask(task, "partial"), "ghost"));
      actions.appendChild(taskActionButton("今天跳过", () => completeTask(task, "skip"), "ghost"));
    }

    if (actions.childElementCount > 0) card.appendChild(actions);
    list.appendChild(card);
  });
}

function taskActionButton(label, onClick, variant) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn ${variant}`;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function taskOutcomeText(result, xp) {
  if (result === "complete") return `已完成 · 获得 ${xp} XP`;
  if (result === "partial") return `部分完成 · 获得 ${xp} XP`;
  return "已跳过 · 长期等级不扣分";
}

function completeTask(task, result) {
  if (!canMutateStats()) return;
  const entry = getTodayTaskEntry(save);
  if (entry.outcomes?.[task.id]) {
    alert("这个任务今天已经结算过，明天 4 点刷新后会生成新的每日任务。");
    renderTaskPanel();
    return;
  }
  save.lastUndo = makeUndoSnapshot();
  const settlement = settleTaskOutcome(save, task, result);
  if (!settlement) return;
  const recorded = recordTaskOutcome(save, task.id, {
    result,
    xp: settlement.xp,
    levelUps: settlement.levelUps,
    statResults: settlement.statResults,
  });
  if (!recorded) return;

  const statGrowthText = settlement.statResults
    .map(formatAttributeReward)
    .join("，");
  const levelText = settlement.levelUps > 0 ? ` · 升级 +${settlement.levelUps}` : "";
  const resultText =
    result === "complete" ? "完成" : result === "partial" ? "部分完成" : "跳过";
  const summary =
    result === "skip"
      ? `任务跳过 · ${task.title} · 长期等级不扣分`
      : `任务${resultText} · ${task.title} · +${settlement.xp} XP${levelText}${
          statGrowthText ? ` · ${statGrowthText}` : ""
        }`;

  save.history.unshift({
    at: Date.now(),
    type: "task",
    taskId: task.id,
    result,
    summary,
    applied: settlement.applied,
  });
  if (save.history.length > 50) save.history.length = 50;

  const planSummary =
    result !== "skip"
      ? scorePlansFromActivity(
          { completedStatIds: task.statIds },
          "task"
        )
      : null;
  if (planSummary) {
    save.history[0].summary += ` · 计划评分 · ${planSummary}`;
  }

  persistSave(save);
  renderAll();
  renderDeltaLog(settlement.applied, result === "skip" ? "跳过只产生轻微状态波动，长期等级不会下降。" : "");
  $("#btnUndo").disabled = false;
}

function renderDeltaLog(applied, fallback) {
  const deltaList = $("#deltaList");
  deltaList.innerHTML = "";
  applied.forEach((a) => {
    const li = document.createElement("li");
    li.className = a.change > 0 ? "delta-positive" : "delta-negative";
    li.textContent = `${a.name} ${a.change > 0 ? "+" : ""}${a.change.toFixed(1)}`;
    deltaList.appendChild(li);
  });
  if (applied.length === 0) {
    const li = document.createElement("li");
    li.textContent = fallback || "本次变化很小，系统仍在根据你的锚点保持稳定。";
    deltaList.appendChild(li);
  }
  $("#deltaLog").hidden = false;
}

function renderAll() {
  if (!save) return;
  renderHeader();
  renderCheckInPanel();
  renderGrowthPanel();
  renderStats();
  renderPlansPanel();
  renderTaskPanel();
  renderDailyRecordPanel();
  renderHistory();
  if (save.stats?.length) buildTuneSliders();
}

function openCalibrate() {
  const box = $("#calibrateSliders");
  box.innerHTML = "";
  save.stats.forEach((stat) => {
    const row = document.createElement("div");
    row.className = "calibrate-row";
    const valSpan = document.createElement("span");
    valSpan.textContent = Math.round(stat.anchor);
    const label = document.createElement("label");
    label.textContent = stat.name + " ";
    label.appendChild(valSpan);
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.value = String(Math.round(stat.anchor));
    input.dataset.statId = stat.id;
    input.addEventListener("input", () => {
      valSpan.textContent = input.value;
    });
    row.append(label, input);
    box.appendChild(row);
  });
  $("#calibrateDialog").showModal();
}

function applyCalibration() {
  if (!canMutateStats()) return;
  const inputs = $("#calibrateSliders").querySelectorAll('input[type="range"]');
  inputs.forEach((input) => {
    const stat = save.stats.find((s) => s.id === input.dataset.statId);
    if (stat) {
      const v = Number(input.value);
      stat.anchor = v;
      stat.value = v;
    }
  });
  persistSave(save);
  renderAll();
}

function resetFeedbackForm() {
  selectedTags.clear();
  selectedMood = 3;
  Object.keys(tuneValues).forEach((k) => (tuneValues[k] = 0));
  $("#dailyNote").value = "";
  buildMoodScale();
  buildEventTags();
  buildTuneSliders();
}

window.addEventListener("error", (e) => showFatalError(e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => showFatalError(e.reason));

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
