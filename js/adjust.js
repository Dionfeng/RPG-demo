import {
  LEARNING_RATE,
  ANCHOR_DRIFT,
  STAT_MIN,
  STAT_MAX,
  XP_PER_CHECKIN,
  XP_LEVEL_BASE,
  GROWTH_XP_BASE,
  GROWTH_XP_LINEAR,
  GROWTH_XP_POWER,
  ATTRIBUTE_XP_BASE,
  ATTRIBUTE_XP_LINEAR,
  ATTRIBUTE_XP_TO_TOTAL_XP_RATIO,
  ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS,
  QUESTION_ATTRIBUTE_XP_BASE,
  QUESTION_ATTRIBUTE_XP_PER_WEIGHT,
  QUESTION_REFLECTION_XP_BASE,
  QUESTION_REFLECTION_XP_PER_WEIGHT,
  FEEDBACK_ATTRIBUTE_XP_PER_POSITIVE_WEIGHT,
  TASK_DIFFICULTIES,
  TASK_PARTIAL_MULTIPLIER,
  TASK_SKIP_STAT_DELTA,
  TASK_STAT_LEARNING_RATE,
  STREAK_BONUS_CAP,
  STREAK_BONUS_PER_DAY,
} from "./config.js";
import { appDayKey, appYesterdayKey } from "./clock.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** 整体心情 → 全属性轻微偏移 */
function moodBias(mood) {
  const center = 3;
  const delta = (mood - center) * 0.35;
  return delta;
}

/**
 * 根据反馈计算各属性变化量（未应用）
 * @param {object} params
 * @param {Array} params.stats
 * @param {number} params.mood
 * @param {string[]} params.tagIds
 * @param {Record<string, number>} params.tuneDeltas - 滑条 -2~+2，0 表示未调
 * @param {typeof import('./config.js').EVENT_TAGS} eventTags
 */
export function computeDeltas({ stats, mood, tagIds, tuneDeltas, eventTags }) {
  const totals = Object.fromEntries(stats.map((s) => [s.id, 0]));
  const global = moodBias(mood);

  for (const stat of stats) {
    totals[stat.id] += global;
  }

  for (const tagId of tagIds) {
    const tag = eventTags.find((t) => t.id === tagId);
    if (!tag) continue;
    for (const [statId, weight] of Object.entries(tag.effects)) {
      if (totals[statId] !== undefined) totals[statId] += weight;
    }
  }

  for (const [statId, tune] of Object.entries(tuneDeltas)) {
    if (tune !== 0 && totals[statId] !== undefined) {
      totals[statId] += tune * 1.8;
    }
  }

  return totals;
}

/** 应用变化：当前值向反馈靠拢，锚点缓慢跟随 */
export function applyDeltas(save, deltas, learningRate = LEARNING_RATE) {
  const applied = [];

  for (const stat of save.stats) {
    const raw = deltas[stat.id] ?? 0;
    if (Math.abs(raw) < 0.01) continue;

    const pull = raw * learningRate;
    const before = stat.value;
    stat.value = clamp(before + pull, STAT_MIN, STAT_MAX);

    stat.anchor = clamp(
      stat.anchor + (stat.value - stat.anchor) * ANCHOR_DRIFT,
      STAT_MIN,
      STAT_MAX
    );

    const change = Math.round((stat.value - before) * 10) / 10;
    if (Math.abs(change) >= 0.1) {
      applied.push({ id: stat.id, name: stat.name, change });
    }
  }

  return { applied };
}

export function addXp(save, amount = XP_PER_CHECKIN) {
  return addGrowthXp(save, amount);
}

export function levelXpNeeded(level) {
  return Math.round(
    GROWTH_XP_BASE +
      level * GROWTH_XP_LINEAR +
      Math.pow(level, GROWTH_XP_POWER) * 18
  );
}

export function legacyLevelXpNeeded(level) {
  return XP_LEVEL_BASE + (level - 1) * 25;
}

export function attributeLevelXpNeeded(level) {
  return Math.round(ATTRIBUTE_XP_BASE + level * ATTRIBUTE_XP_LINEAR);
}

function attributeGrowthContribution(bucket) {
  const totalXp = Math.max(0, bucket?.totalXp ?? 0);
  const level = Math.max(1, bucket?.level ?? 1);
  return Math.round(
    totalXp * ATTRIBUTE_XP_TO_TOTAL_XP_RATIO +
      Math.max(0, level - 1) * ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS
  );
}

function ensureGrowth(save) {
  if (!save.growth) {
    save.growth = {
      level: save.level ?? 1,
      xp: save.xp ?? 0,
      totalXp: save.xp ?? 0,
      attributeLinkedTotalXp: 0,
      statGrowth: {},
      streak: { count: 0, lastCompletedDay: null },
      titles: [],
      goals: [],
    };
  }

  for (const stat of save.stats ?? []) {
    if (!save.growth.statGrowth[stat.id]) {
      save.growth.statGrowth[stat.id] = { level: 1, xp: 0, totalXp: 0 };
    }
  }
  return save.growth;
}

export function addGrowthXp(save, amount) {
  const growth = ensureGrowth(save);
  const gained = Math.max(0, Math.round(amount));
  const before = growth.level;
  growth.xp += gained;
  growth.totalXp += gained;

  while (growth.xp >= levelXpNeeded(growth.level)) {
    growth.xp -= levelXpNeeded(growth.level);
    growth.level += 1;
  }

  save.level = growth.level;
  save.xp = growth.xp;
  return {
    xp: gained,
    levelUps: growth.level - before,
    level: growth.level,
  };
}

export function addAttributeXp(save, statId, amount) {
  const growth = ensureGrowth(save);
  const bucket = growth.statGrowth[statId];
  if (!bucket) return { xp: 0, levelUps: 0, level: 1 };

  const gained = Math.max(0, Math.round(amount));
  const before = bucket.level;
  bucket.xp += gained;
  bucket.totalXp += gained;

  while (bucket.xp >= attributeLevelXpNeeded(bucket.level)) {
    bucket.xp -= attributeLevelXpNeeded(bucket.level);
    bucket.level += 1;
  }

  const levelUps = bucket.level - before;
  const linkedTotalXp = Math.round(
    gained * ATTRIBUTE_XP_TO_TOTAL_XP_RATIO +
      levelUps * ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS
  );
  const totalResult = addGrowthXp(save, linkedTotalXp);
  growth.attributeLinkedTotalXp = (growth.attributeLinkedTotalXp ?? 0) + linkedTotalXp;

  return {
    xp: gained,
    levelUps,
    level: bucket.level,
    totalXp: totalResult.xp,
    totalLevelUps: totalResult.levelUps,
  };
}

export function setAttributeGrowthBaselines(save, initialGrowth) {
  const growth = ensureGrowth(save);
  for (const stat of save.stats ?? []) {
    const baseline = initialGrowth?.[stat.id];
    if (!baseline) continue;
    growth.statGrowth[stat.id] = {
      level: Math.max(1, Math.round(baseline.level ?? 1)),
      xp: Math.max(0, Math.round(baseline.xp ?? 0)),
      totalXp: Math.max(0, Math.round(baseline.totalXp ?? baseline.xp ?? 0)),
      originScore: baseline.originScore,
      originLabel: baseline.originLabel,
    };
  }
  const contribution = Object.values(growth.statGrowth ?? {}).reduce(
    (sum, bucket) => sum + attributeGrowthContribution(bucket),
    0
  );
  const previous = growth.attributeLinkedTotalXp ?? 0;
  if (contribution > previous) {
    addGrowthXp(save, contribution - previous);
    growth.attributeLinkedTotalXp = contribution;
  }
}

export function settleQuestionnaireAttributeXp(save, effects) {
  const rewards = [];
  for (const [statId, weight] of Object.entries(effects ?? {})) {
    if (weight === 0) continue;
    const magnitude = Math.abs(weight);
    const isReflection = weight < 0;
    const amount = Math.round(
      isReflection
        ? QUESTION_REFLECTION_XP_BASE + magnitude * QUESTION_REFLECTION_XP_PER_WEIGHT
        : QUESTION_ATTRIBUTE_XP_BASE + magnitude * QUESTION_ATTRIBUTE_XP_PER_WEIGHT
    );
    const result = addAttributeXp(save, statId, amount);
    if (result.xp > 0) {
      rewards.push({
        statId,
        type: isReflection ? "reflection" : "growth",
        ...result,
      });
    }
  }
  return rewards;
}

export function settleFeedbackAttributeXp(save, deltas) {
  const rewards = [];
  for (const [statId, weight] of Object.entries(deltas ?? {})) {
    if (Math.abs(weight) < 0.5) continue;
    const isReflection = weight < 0;
    const amount = Math.round(
      isReflection
        ? Math.max(1, Math.abs(weight))
        : Math.max(2, weight * FEEDBACK_ATTRIBUTE_XP_PER_POSITIVE_WEIGHT)
    );
    const result = addAttributeXp(save, statId, amount);
    if (result.xp > 0) {
      rewards.push({
        statId,
        type: isReflection ? "reflection" : "growth",
        ...result,
      });
    }
  }
  return rewards;
}

function updateStreak(save) {
  const growth = ensureGrowth(save);
  const today = appDayKey();
  const yesterday = appYesterdayKey();

  if (growth.streak.lastCompletedDay === today) {
    return growth.streak.count;
  }

  if (growth.streak.lastCompletedDay === yesterday) {
    growth.streak.count += 1;
  } else {
    growth.streak.count = 1;
  }
  growth.streak.lastCompletedDay = today;
  return growth.streak.count;
}

function streakBonusMultiplier(save) {
  const streak = ensureGrowth(save).streak?.count ?? 0;
  return 1 + Math.min(STREAK_BONUS_CAP, Math.max(0, streak - 1) * STREAK_BONUS_PER_DAY);
}

export function settleTaskOutcome(save, task, result) {
  const difficulty = TASK_DIFFICULTIES[task.difficulty];
  if (!difficulty) return null;

  const multiplier =
    result === "complete" ? 1 : result === "partial" ? TASK_PARTIAL_MULTIPLIER : 0;
  const streakCount = result === "complete" || result === "partial" ? updateStreak(save) : ensureGrowth(save).streak.count;
  const bonus = result === "complete" ? streakBonusMultiplier(save) : 1;

  const xpResult = addGrowthXp(save, difficulty.xp * multiplier * bonus);
  const statResults = [];
  const effects = {};

  for (const statId of task.statIds) {
    const statXp = addAttributeXp(save, statId, difficulty.statXp * multiplier * bonus);
    if (statXp.xp > 0) statResults.push({ statId, ...statXp });
  }
  const linkedTotalXp = statResults.reduce((sum, entry) => sum + (entry.totalXp ?? 0), 0);
  const linkedTotalLevelUps = statResults.reduce((sum, entry) => sum + (entry.totalLevelUps ?? 0), 0);

  for (const [statId, value] of Object.entries(task.effects ?? {})) {
    effects[statId] =
      result === "skip" ? TASK_SKIP_STAT_DELTA : value * multiplier;
  }

  const { applied } = applyDeltas(save, effects, TASK_STAT_LEARNING_RATE);

  return {
    result,
    xp: xpResult.xp,
    totalXp: xpResult.xp + linkedTotalXp,
    levelUps: xpResult.levelUps + linkedTotalLevelUps,
    statResults,
    applied,
    streakCount,
    bonus,
  };
}

export function undoLast(save) {
  const undo = save.lastUndo;
  if (!undo) return false;
  save.stats = undo.stats;
  save.growth = undo.growth ?? save.growth;
  save.taskLog = undo.taskLog ?? save.taskLog;
  save.plans = undo.plans ?? save.plans;
  save.checkIn = undo.checkIn ?? save.checkIn;
  save.dailyLocks = undo.dailyLocks ?? save.dailyLocks;
  save.xp = save.growth?.xp ?? undo.xp;
  save.level = save.growth?.level ?? undo.level;
  save.history.shift();
  save.lastUndo = null;
  return true;
}
