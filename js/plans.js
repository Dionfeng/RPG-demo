import { EVENT_TAGS } from "./config.js";
import { appDayKey } from "./clock.js";
import { addAttributeXp } from "./adjust.js";
import { getTaskById } from "./tasks.js";

export const PLAN_SCORE_EMA = 0.32;
export const PLAN_MANUAL_WEIGHT = 0.65;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function createPlanId() {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function normalizePlanStatIds(planOrInput) {
  const ids = Array.isArray(planOrInput.statIds)
    ? planOrInput.statIds
    : [planOrInput.statId];
  return [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];
}

export function ensurePlans(save) {
  if (!save.plans) save.plans = [];
  for (const plan of save.plans) {
    if (!plan.scoreHistory) plan.scoreHistory = {};
    if (plan.currentScore === undefined) plan.currentScore = 50;
    if (plan.archived === undefined) plan.archived = false;
    if (!plan.keywords) plan.keywords = [];
    plan.statIds = normalizePlanStatIds(plan);
    plan.statId = plan.statIds[0] ?? plan.statId;
  }
  return save.plans;
}

export function getActivePlans(save) {
  return ensurePlans(save).filter((p) => !p.archived);
}

function syncGrowthGoals(save) {
  if (!save.growth) return;
  ensurePlans(save);
  save.growth.goals = save.plans.filter((p) => !p.archived).map((plan) => ({
    planId: plan.id,
    statIds: normalizePlanStatIds(plan),
    statId: normalizePlanStatIds(plan)[0],
    title: plan.title,
  }));
  save.goals = save.growth.goals;
}

export function createPlan(save, input) {
  ensurePlans(save);
  const plan = {
    id: createPlanId(),
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    statIds: normalizePlanStatIds(input),
    statId: normalizePlanStatIds(input)[0],
    cadence: input.cadence === "weekly" ? "weekly" : "daily",
    keywords: parseKeywords(input.keywords),
    createdAt: Date.now(),
    archived: false,
    currentScore: 50,
    scoreHistory: {},
  };
  save.plans.push(plan);
  syncGrowthGoals(save);
  return plan;
}

export function updatePlan(save, planId, input) {
  const plan = save.plans.find((p) => p.id === planId);
  if (!plan) return null;
  plan.title = input.title.trim();
  plan.description = (input.description ?? "").trim();
  plan.statIds = normalizePlanStatIds(input);
  plan.statId = plan.statIds[0];
  plan.cadence = input.cadence === "weekly" ? "weekly" : "daily";
  plan.keywords = parseKeywords(input.keywords);
  syncGrowthGoals(save);
  return plan;
}

export function archivePlan(save, planId) {
  const plan = save.plans.find((p) => p.id === planId);
  if (!plan) return false;
  plan.archived = true;
  syncGrowthGoals(save);
  return true;
}

function parseKeywords(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((k) => k.trim()).filter(Boolean);
  return String(raw)
    .split(/[,，、\s]+/)
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function getCompletedStatIdsToday(save) {
  const entry = save.taskLog?.daily?.[appDayKey()];
  if (!entry?.completedIds?.length) return [];

  const stats = new Set();
  for (const taskId of entry.completedIds) {
    const outcome = entry.outcomes?.[taskId];
    if (!outcome || outcome.result === "skip") continue;
    const task = getTaskById(taskId);
    if (!task) continue;
    task.statIds.forEach((id) => stats.add(id));
  }
  return [...stats];
}

/**
 * @param {object} context
 * @param {number} [context.mood]
 * @param {string[]} [context.tagIds]
 * @param {Record<string, number>} [context.tuneDeltas]
 * @param {string} [context.dailyNote]
 * @param {string[]} [context.completedStatIds]
 * @param {Record<string, number>} [context.extraEffects]
 */
export function buildScoringContext(save, context = {}) {
  return {
    mood: context.mood ?? 3,
    tagIds: context.tagIds ?? [],
    tuneDeltas: context.tuneDeltas ?? {},
    dailyNote: context.dailyNote ?? "",
    completedStatIds: context.completedStatIds ?? getCompletedStatIdsToday(save),
    extraEffects: context.extraEffects ?? {},
    eventTags: EVENT_TAGS,
  };
}

export function computeAutoPlanScore(plan, context, save) {
  let score = 52;
  const signals = [];
  const statIds = normalizePlanStatIds(plan);

  const note = context.dailyNote?.toLowerCase() ?? "";
  const titleHit = note.includes(plan.title.toLowerCase());
  if (titleHit) {
    score += 12;
    signals.push("备注提到计划本身");
  }

  const keywordHits = (plan.keywords ?? []).filter((k) => note.includes(k.toLowerCase()));
  if (keywordHits.length) {
    score += 10 + keywordHits.length * 4;
    signals.push(`关键词：${keywordHits.join("、")}`);
  }

  for (const tagId of context.tagIds) {
    const tag = context.eventTags.find((t) => t.id === tagId);
    const weights = statIds
      .map((statId) => tag?.effects?.[statId])
      .filter((weight) => weight !== undefined);
    if (weights.length) {
      const weight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
      score += weight * 6;
      signals.push(`事件「${tag.label}」`);
    }
  }

  const tuneValues = statIds.map((statId) => context.tuneDeltas?.[statId] ?? 0).filter((v) => v !== 0);
  const tune = tuneValues.length
    ? tuneValues.reduce((sum, value) => sum + value, 0) / tuneValues.length
    : 0;
  if (tune !== 0) {
    score += tune * 9;
    signals.push(tune > 0 ? "自评该属性变好" : "自评该属性变差");
  }

  score += (context.mood - 3) * 5;

  const extraValues = statIds.map((statId) => context.extraEffects?.[statId] ?? 0).filter((v) => v !== 0);
  const extra = extraValues.length
    ? extraValues.reduce((sum, value) => sum + value, 0) / extraValues.length
    : 0;
  if (extra !== 0) {
    score += extra * 5;
    signals.push("问卷反馈相关");
  }

  if (statIds.some((statId) => context.completedStatIds.includes(statId))) {
    score += 18;
    signals.push("今日完成了相关任务");
  }

  const relatedStats = statIds
    .map((statId) => save?.stats?.find((s) => s.id === statId))
    .filter(Boolean);
  if (relatedStats.length) {
    const avgValue = relatedStats.reduce((sum, stat) => sum + stat.value, 0) / relatedStats.length;
    if (avgValue >= 70) {
      score += 6;
      signals.push("当前属性状态较好");
    } else if (avgValue < 40) {
      score -= 4;
      signals.push("当前属性状态偏低");
    }
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    signals: signals.slice(0, 4),
  };
}

function todayEntry(plan) {
  const day = appDayKey();
  return { day, entry: plan.scoreHistory[day] };
}

function ensurePlanScoreLocks(save) {
  if (!save.dailyLocks) save.dailyLocks = {};
  const day = appDayKey();
  if (!save.dailyLocks[day]) save.dailyLocks[day] = {};
  if (!save.dailyLocks[day].planScores) save.dailyLocks[day].planScores = {};
  return save.dailyLocks[day].planScores;
}

function planRewardForScore(score) {
  if (score >= 85) return 8;
  if (score >= 65) return 5;
  if (score >= 40) return 3;
  return 2;
}

function grantPlanAttributeRewards(save, plan, score) {
  const statIds = normalizePlanStatIds(plan);
  const xp = planRewardForScore(score);
  return statIds
    .map((statId) => {
      const result = addAttributeXp(save, statId, xp);
      return result.xp > 0 ? { statId, type: score >= 40 ? "growth" : "reflection", ...result } : null;
    })
    .filter(Boolean);
}

export function setManualPlanScore(save, planId, rating, context = {}) {
  const plan = save.plans.find((p) => p.id === planId);
  if (!plan) return null;

  const manualScore = clamp(Math.round(20 + (rating - 1) * 20), 0, 100);
  const { day } = todayEntry(plan);
  const locks = ensurePlanScoreLocks(save);
  if (locks[planId]?.manual) {
    return {
      plan,
      dayScore: plan.scoreHistory[day],
      rewards: locks[planId]?.rewards ?? [],
      locked: true,
    };
  }
  const ctx = buildScoringContext(save, context);
  const { score: auto, signals } = computeAutoPlanScore(plan, ctx, save);

  const blended = clamp(
    Math.round(manualScore * PLAN_MANUAL_WEIGHT + auto * (1 - PLAN_MANUAL_WEIGHT)),
    0,
    100
  );

  plan.scoreHistory[day] = {
    score: blended,
    manualScore,
    autoScore: auto,
    manual: true,
    rating,
    signals,
    source: "manual",
    at: Date.now(),
  };

  plan.currentScore = clamp(
    Math.round(plan.currentScore * (1 - PLAN_SCORE_EMA) + blended * PLAN_SCORE_EMA),
    0,
    100
  );

  const rewards = grantPlanAttributeRewards(save, plan, blended);
  locks[planId] = {
    manual: true,
    score: blended,
    rewards,
    at: Date.now(),
  };

  return { plan, dayScore: plan.scoreHistory[day], rewards, locked: false };
}

export function applyPlanScoring(save, context, source = "auto") {
  ensurePlans(save);
  const ctx = buildScoringContext(save, context);
  const day = appDayKey();
  const results = [];

  for (const plan of getActivePlans(save)) {
    const { score: autoScore, signals } = computeAutoPlanScore(plan, ctx, save);
    const existing = plan.scoreHistory[day];
    let finalScore = autoScore;

    if (existing?.manual) {
      finalScore = clamp(
        Math.round(
          existing.manualScore * PLAN_MANUAL_WEIGHT +
            autoScore * (1 - PLAN_MANUAL_WEIGHT)
        ),
        0,
        100
      );
    }

    plan.scoreHistory[day] = {
      score: finalScore,
      autoScore,
      manualScore: existing?.manualScore ?? null,
      manual: existing?.manual ?? false,
      rating: existing?.rating ?? null,
      signals,
      source,
      at: Date.now(),
    };

    const before = plan.currentScore;
    plan.currentScore = clamp(
      Math.round(before * (1 - PLAN_SCORE_EMA) + finalScore * PLAN_SCORE_EMA),
      0,
      100
    );

    results.push({
      planId: plan.id,
      title: plan.title,
      autoScore,
      finalScore,
      delta: finalScore - before,
      currentScore: plan.currentScore,
      signals,
    });
  }

  syncGrowthGoals(save);
  return results;
}

export function formatPlanScoreSummary(results) {
  if (!results.length) return "";
  return results
    .map((r) => `${r.title} ${r.finalScore}分`)
    .join("，");
}
