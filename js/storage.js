import {
  ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS,
  ATTRIBUTE_XP_TO_TOTAL_XP_RATIO,
  DEFAULT_STATS,
  GROWTH_XP_BASE,
  GROWTH_XP_LINEAR,
  GROWTH_XP_POWER,
} from "./config.js";
import {
  getCurrentUserId,
  getSaveStorageKey,
  takePendingLegacySave,
} from "./auth.js";
import { ONBOARDING_QUESTIONS } from "./questions.js";

const LEGACY_GLOBAL_KEY = "rpg-life-save-v3";
const DEFAULT_STAT_IDS = DEFAULT_STATS.map((stat) => stat.id);
const LEGACY_STAT_ID_MAP = {
  vit: "hea",
  sta: "hea",
  mnd: "spi",
  foc: "int",
  soc: "cha",
  wil: "wil",
  cre: "cre",
  bal: "spi",
};

export function loadSave() {
  const userId = getCurrentUserId();
  if (!userId) return null;

  try {
    const key = getSaveStorageKey(userId);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const wasComplete = parsed.onboardingComplete === true;
      const data = migrateSave(parsed, userId);
      if (!wasComplete && data.onboardingComplete) persistSave(data);
      return data;
    }

    const pending = takePendingLegacySave();
    if (pending) {
      const data = migrateSave(JSON.parse(pending), userId);
      persistSave(data);
      return data;
    }

    const legacy = localStorage.getItem(LEGACY_GLOBAL_KEY);
    if (legacy) {
      const data = migrateSave(JSON.parse(legacy), userId);
      persistSave(data);
      localStorage.removeItem(LEGACY_GLOBAL_KEY);
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

function inferOnboardingComplete(data) {
  if (data.onboardingComplete) return;
  const finishedInHistory = data.history?.some((entry) => entry.type === "onboarding");
  const answers = data.onboardingAnswers;
  const hasFullAnswers =
    Array.isArray(answers) &&
    answers.length >= ONBOARDING_QUESTIONS.length &&
    answers.every((a) => a?.optionId);
  if (finishedInHistory || hasFullAnswers) {
    data.onboardingComplete = true;
    data.onboardingDismissed = true;
  }
}

function hasCurrentStatShape(stats) {
  if (!Array.isArray(stats) || stats.length !== DEFAULT_STATS.length) return false;
  const ids = stats.map((stat) => stat.id);
  return DEFAULT_STAT_IDS.every((id) => ids.includes(id));
}

function resetStatsToDefaults(data) {
  data.stats = DEFAULT_STATS.map((stat) => ({ ...stat }));
  data.growth = createDefaultGrowth(
    DEFAULT_STATS,
    data.growth?.level ?? data.level ?? 1,
    data.growth?.xp ?? data.xp ?? 0,
    data.growth?.totalXp ?? data.xp ?? 0
  );
  data.level = data.growth.level;
  data.xp = data.growth.xp;
}

function normalizeStatRef(statId) {
  return DEFAULT_STAT_IDS.includes(statId) ? statId : LEGACY_STAT_ID_MAP[statId] ?? null;
}

function normalizeStatRefs(statIds) {
  const ids = Array.isArray(statIds) ? statIds : [statIds];
  return [...new Set(ids.map(normalizeStatRef).filter(Boolean))];
}

function normalizePlanRefs(data) {
  if (Array.isArray(data.plans)) {
    data.plans = data.plans
      .map((plan) => {
        const statIds = normalizeStatRefs(plan.statIds ?? plan.statId);
        if (!statIds.length) return null;
        return { ...plan, statIds, statId: statIds[0] };
      })
      .filter(Boolean);
  }

  const goals = data.plans?.length
    ? data.plans.filter((plan) => !plan.archived).map((plan) => ({
        planId: plan.id,
        statIds: plan.statIds,
        statId: plan.statIds[0],
        title: plan.title,
      }))
    : data.growth?.goals ?? data.goals ?? [];
  const normalizedGoals = Array.isArray(goals)
    ? goals
        .map((goal) => {
          const statIds = normalizeStatRefs(goal.statIds ?? goal.statId);
          if (!statIds.length) return null;
          return { ...goal, statIds, statId: statIds[0] };
        })
        .filter(Boolean)
    : [];

  if (data.growth) data.growth.goals = normalizedGoals;
  data.goals = normalizedGoals;
}

function migrateSave(data, userId) {
  data.version = 3;
  data.userId = userId;
  if (!data.questionLog) data.questionLog = { daily: {}, weekly: {} };
  if (!data.dailyLocks) data.dailyLocks = {};
  if (data.onboardingComplete === undefined) {
    data.onboardingComplete = false;
  }
  if (!Array.isArray(data.onboardingAnswers)) data.onboardingAnswers = [];
  inferOnboardingComplete(data);
  if (data.onboardingDismissed === undefined) {
    data.onboardingDismissed =
      data.onboardingComplete || (data.history?.length ?? 0) > 0;
  }
  const shouldResetStats = !hasCurrentStatShape(data.stats);
  if (!data.growth) {
    data.growth = createDefaultGrowth(data.stats ?? DEFAULT_STATS, data.level ?? 1, data.xp ?? 0);
  } else {
    data.growth = normalizeGrowth(data.growth, data.stats ?? DEFAULT_STATS);
  }
  data.level = data.growth.level;
  data.xp = data.growth.xp;
  if (!data.taskLog) data.taskLog = { daily: {} };
  if (!data.goals) data.goals = [];
  if (!data.plans) data.plans = [];
  if (!data.checkIn) data.checkIn = { streak: 0, maxStreak: 0, lastDay: null, totalDays: 0, history: {} };
  if (!Array.isArray(data.stats) || data.stats.length === 0) {
    data.stats = DEFAULT_STATS.map((s) => ({ ...s }));
  }
  if (shouldResetStats) {
    resetStatsToDefaults(data);
  } else {
    data.stats = DEFAULT_STATS.map((template) => {
      const existing = data.stats.find((stat) => stat.id === template.id);
      return existing
        ? { ...template, value: existing.value ?? template.value, anchor: existing.anchor ?? template.anchor }
        : { ...template };
    });
    data.growth = normalizeGrowth(data.growth, DEFAULT_STATS);
  }
  normalizePlanRefs(data);
  if (!Array.isArray(data.history)) data.history = [];
  return data;
}

function createDefaultGrowth(statsTemplate, level = 1, xp = 0, totalXp = xp) {
  return {
    level,
    xp,
    totalXp,
    attributeLinkedTotalXp: 0,
    statGrowth: Object.fromEntries(
      statsTemplate.map((stat) => [
        stat.id,
        {
          level: 1,
          xp: 0,
          totalXp: 0,
        },
      ])
    ),
    streak: {
      count: 0,
      lastCompletedDay: null,
    },
    titles: [],
    goals: [],
  };
}

function storedLevelXpNeeded(level) {
  return Math.round(
    GROWTH_XP_BASE +
      level * GROWTH_XP_LINEAR +
      Math.pow(level, GROWTH_XP_POWER) * 18
  );
}

function addStoredGrowthXp(growth, amount) {
  const gained = Math.max(0, Math.round(amount));
  growth.xp += gained;
  growth.totalXp += gained;
  while (growth.xp >= storedLevelXpNeeded(growth.level)) {
    growth.xp -= storedLevelXpNeeded(growth.level);
    growth.level += 1;
  }
}

function attributeGrowthContribution(bucket) {
  return Math.round(
    Math.max(0, bucket.totalXp ?? 0) * ATTRIBUTE_XP_TO_TOTAL_XP_RATIO +
      Math.max(0, (bucket.level ?? 1) - 1) * ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS
  );
}

function normalizeGrowth(growth, statsTemplate) {
  const hadAttributeLink = growth.attributeLinkedTotalXp !== undefined;
  const normalized = {
    level: growth.level ?? 1,
    xp: growth.xp ?? 0,
    totalXp: growth.totalXp ?? growth.xp ?? 0,
    attributeLinkedTotalXp: growth.attributeLinkedTotalXp ?? 0,
    statGrowth: growth.statGrowth ?? {},
    streak: growth.streak ?? { count: 0, lastCompletedDay: null },
    titles: growth.titles ?? [],
    goals: growth.goals ?? [],
  };

  const validIds = new Set(statsTemplate.map((stat) => stat.id));
  normalized.statGrowth = Object.fromEntries(
    Object.entries(normalized.statGrowth).filter(([statId]) => validIds.has(statId))
  );

  for (const stat of statsTemplate) {
    if (!normalized.statGrowth[stat.id]) {
      normalized.statGrowth[stat.id] = { level: 1, xp: 0, totalXp: 0 };
    } else {
      const bucket = normalized.statGrowth[stat.id];
      normalized.statGrowth[stat.id] = {
        ...bucket,
        level: Math.max(1, Math.round(bucket.level ?? 1)),
        xp: Math.max(0, Math.round(bucket.xp ?? 0)),
        totalXp: Math.max(0, Math.round(bucket.totalXp ?? bucket.xp ?? 0)),
      };
    }
  }
  if (!hadAttributeLink) {
    const contribution = Object.values(normalized.statGrowth).reduce(
      (sum, bucket) => sum + attributeGrowthContribution(bucket),
      0
    );
    normalized.attributeLinkedTotalXp = contribution;
    addStoredGrowthXp(normalized, contribution);
  }
  return normalized;
}

export function persistSave(data) {
  const userId = getCurrentUserId();
  if (!userId) return;
  data.userId = userId;
  localStorage.setItem(getSaveStorageKey(userId), JSON.stringify(data));
}

export function createInitialSave(statsTemplate, playerName = "旅人", userId = null) {
  return {
    version: 3,
    userId: userId ?? getCurrentUserId(),
    playerName,
    level: 1,
    xp: 0,
    stats: statsTemplate.map((s) => ({ ...s })),
    growth: createDefaultGrowth(statsTemplate),
    taskLog: { daily: {} },
    goals: [],
    plans: [],
    checkIn: { streak: 0, maxStreak: 0, lastDay: null, totalDays: 0, history: {} },
    dailyLocks: {},
    history: [],
    lastUndo: null,
    onboardingComplete: false,
    onboardingDismissed: false,
    onboardingAnswers: [],
    questionLog: { daily: {}, weekly: {} },
    createdAt: Date.now(),
  };
}
