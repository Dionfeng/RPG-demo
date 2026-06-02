import {
  ONBOARDING_GROWTH_TIERS,
  STAT_MIN,
  STAT_MAX,
} from "./config.js";
import { attributeLevelXpNeeded } from "./adjust.js";
import {
  ONBOARDING_QUESTIONS,
  DAILY_QUESTIONS,
  WEEKLY_QUESTIONS,
  DAILY_PICK_COUNT,
  WEEKLY_PICK_COUNT,
} from "./questions.js";
import { appDayKey, appWeekKey } from "./clock.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function dayKey(date = new Date()) {
  return appDayKey(date);
}

export function weekKey(date = new Date()) {
  return appWeekKey(date);
}

/** 从入门问卷答案计算各属性基准分 */
export function computeBaselineFromOnboarding(answers, statIds) {
  const buckets = Object.fromEntries(statIds.map((id) => [id, []]));

  for (const { questionId, optionId } of answers) {
    const q = ONBOARDING_QUESTIONS.find((x) => x.id === questionId);
    const opt = q?.options.find((o) => o.id === optionId);
    if (!opt?.scores) continue;
    for (const [statId, score] of Object.entries(opt.scores)) {
      if (buckets[statId]) buckets[statId].push(score);
    }
  }

  const baseline = {};
  for (const id of statIds) {
    const vals = buckets[id];
    baseline[id] =
      vals.length > 0
        ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        : 50;
    baseline[id] = clamp(baseline[id], STAT_MIN, STAT_MAX);
  }
  return baseline;
}

/** 将基准分写入 save.stats 的 value 与 anchor */
export function applyBaselineToStats(save, baseline) {
  for (const stat of save.stats) {
    const v = baseline[stat.id] ?? 50;
    stat.value = v;
    stat.anchor = v;
  }
}

function tierForScore(score) {
  return ONBOARDING_GROWTH_TIERS.find((tier) => score >= tier.minScore) ?? ONBOARDING_GROWTH_TIERS.at(-1);
}

/** 根据入门问卷基准生成属性成长初始等级/经验 */
export function computeInitialGrowthFromBaseline(baseline, statIds) {
  const growth = {};
  const insights = [];

  for (const statId of statIds) {
    const score = baseline[statId] ?? 50;
    const tier = tierForScore(score);
    const level = tier.level;
    const need = attributeLevelXpNeeded(level);
    const xp = Math.round(need * tier.xpRatio);
    growth[statId] = {
      level,
      xp,
      totalXp: xp,
      originScore: score,
      originLabel: tier.label,
    };
    insights.push({ statId, score, level, label: tier.label });
  }

  return { growth, insights };
}

/** 合并多个选项的 effects */
export function mergeEffects(optionList) {
  const totals = {};
  for (const opt of optionList) {
    if (!opt?.effects) continue;
    for (const [statId, w] of Object.entries(opt.effects)) {
      totals[statId] = (totals[statId] ?? 0) + w;
    }
  }
  return totals;
}

function hashPick(pool, count, seed) {
  const arr = [...pool];
  let s = seed;
  const picked = [];
  while (picked.length < count && arr.length > 0) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const idx = s % arr.length;
    picked.push(arr.splice(idx, 1)[0]);
  }
  return picked;
}

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

/** 今日待答的每日题（未答的） */
export function getDueDailyQuestions(save) {
  const dk = dayKey();
  const answered = new Set(save.questionLog?.daily?.[dk] ?? []);
  const seed = seedFromString(dk + save.playerName);
  const picked = hashPick(DAILY_QUESTIONS, DAILY_PICK_COUNT, seed);
  return picked.filter((q) => !answered.has(q.id));
}

/** 本周待答的每周题 */
export function getDueWeeklyQuestions(save) {
  const wk = weekKey();
  const answered = new Set(save.questionLog?.weekly?.[wk] ?? []);
  const seed = seedFromString(wk + save.playerName);
  const picked = hashPick(WEEKLY_QUESTIONS, WEEKLY_PICK_COUNT, seed);
  return picked.filter((q) => !answered.has(q.id));
}

export function markQuestionAnswered(save, frequency, questionId) {
  if (!save.questionLog) save.questionLog = { daily: {}, weekly: {} };
  const key = frequency === "daily" ? dayKey() : weekKey();
  const bucket = frequency === "daily" ? save.questionLog.daily : save.questionLog.weekly;
  if (!bucket[key]) bucket[key] = [];
  if (!bucket[key].includes(questionId)) bucket[key].push(questionId);
}

export function countAnsweredToday(save) {
  const dk = dayKey();
  return (save.questionLog?.daily?.[dk] ?? []).length;
}

export function countAnsweredThisWeek(save) {
  const wk = weekKey();
  return (save.questionLog?.weekly?.[wk] ?? []).length;
}
