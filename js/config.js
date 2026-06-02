/** 默认属性：可后续改为用户自定义 */
export const DEFAULT_STATS = [
  { id: "hea", name: "健康", desc: "睡眠、运动、饮食与身体恢复", value: 50, anchor: 50 },
  { id: "wil", name: "意志", desc: "自律、执行、坚持与抗压", value: 50, anchor: 50 },
  { id: "cha", name: "魅力", desc: "表达、连接、外在状态与影响力", value: 50, anchor: 50 },
  { id: "cre", name: "创造", desc: "灵感、表达、产出与探索", value: 50, anchor: 50 },
  { id: "spi", name: "灵气", desc: "内在稳定、感知力、松弛与意义感", value: 50, anchor: 50 },
  { id: "int", name: "智力", desc: "学习、思考、专注与问题解决", value: 50, anchor: 50 },
];

/** 事件标签 → 对各属性的影响权重（-3 ~ +3） */
export const EVENT_TAGS = [
  { id: "sleep_good", label: "睡得好", effects: { hea: 2, spi: 1, int: 1 } },
  { id: "sleep_bad", label: "睡眠不足", effects: { hea: -3, wil: -1, int: -1, spi: -1 } },
  { id: "exercise", label: "运动", effects: { hea: 2, wil: 1, cha: 1 } },
  { id: "work_win", label: "工作/学习突破", effects: { int: 2, wil: 1, cre: 1 } },
  { id: "work_stuck", label: "拖延/卡住", effects: { wil: -2, int: -2, spi: -1 } },
  { id: "social_good", label: "愉快社交", effects: { cha: 2, spi: 1 } },
  { id: "social_drain", label: "社交消耗", effects: { cha: -1, hea: -1, spi: -1 } },
  { id: "creative", label: "创作/灵感", effects: { cre: 2, spi: 1, int: 1 } },
  { id: "rest", label: "主动休息", effects: { hea: 1, spi: 2, wil: 1 } },
  { id: "stress", label: "压力/焦虑", effects: { spi: -2, wil: -1, hea: -1 } },
  { id: "routine", label: "规律作息", effects: { hea: 1, wil: 2, spi: 1 } },
];

export const MOOD_OPTIONS = [
  { value: 1, label: "很低落" },
  { value: 2, label: "有些累" },
  { value: 3, label: "平平" },
  { value: 4, label: "还不错" },
  { value: 5, label: "状态很好" },
];

/** 学习率：反馈对当前值的影响强度 */
export const LEARNING_RATE = 0.22;
/** 锚点向当前值缓慢漂移（长期「我是谁」） */
export const ANCHOR_DRIFT = 0.04;
export const STAT_MIN = 0;
export const STAT_MAX = 100;
export const XP_PER_CHECKIN = 15;
export const XP_PER_QUESTION = 8;
export const XP_LEVEL_BASE = 100;

/** RPG 成长层：可无限升级，不等同于 0-100 的状态条 */
export const GROWTH_XP_BASE = 80;
export const GROWTH_XP_LINEAR = 28;
export const GROWTH_XP_POWER = 1.35;
export const ATTRIBUTE_XP_BASE = 50;
export const ATTRIBUTE_XP_LINEAR = 18;

/** 属性面板成长文案与问卷 XP 规则 */
export const ATTRIBUTE_RANKS = [
  { minLevel: 1, label: "见习" },
  { minLevel: 3, label: "入门" },
  { minLevel: 6, label: "熟练" },
  { minLevel: 10, label: "精进" },
  { minLevel: 16, label: "卓越" },
  { minLevel: 24, label: "传奇" },
];

export const ONBOARDING_GROWTH_TIERS = [
  { minScore: 75, level: 3, xpRatio: 0.35, label: "已有优势" },
  { minScore: 58, level: 2, xpRatio: 0.45, label: "基础稳定" },
  { minScore: 0, level: 1, xpRatio: 0.65, label: "成长空间" },
];

export const QUESTION_ATTRIBUTE_XP_BASE = 6;
export const QUESTION_ATTRIBUTE_XP_PER_WEIGHT = 3;
export const QUESTION_REFLECTION_XP_BASE = 3;
export const QUESTION_REFLECTION_XP_PER_WEIGHT = 1;
export const FEEDBACK_ATTRIBUTE_XP_PER_POSITIVE_WEIGHT = 2;
export const ATTRIBUTE_XP_TO_TOTAL_XP_RATIO = 0.35;
export const ATTRIBUTE_LEVEL_UP_TOTAL_XP_BONUS = 12;

export const TASK_DAILY_PICK_COUNT = 6;
export const TASK_SELECTION_LIMIT = 6;
export const TASK_STAT_LEARNING_RATE = 0.18;
export const TASK_PARTIAL_MULTIPLIER = 0.55;
export const TASK_SKIP_STAT_DELTA = -0.2;
export const STREAK_BONUS_PER_DAY = 0.03;
export const STREAK_BONUS_CAP = 0.15;

/** 每日签到 */
export const SIGNIN_BASE_XP = 25;
export const SIGNIN_STREAK_XP_PER_DAY = 8;
export const SIGNIN_STREAK_XP_CAP = 56;
export const SIGNIN_MILESTONES = [
  { days: 3, xp: 30, label: "连续 3 天 · 初露锋芒" },
  { days: 7, xp: 80, label: "连续 7 天 · 一周坚持" },
  { days: 14, xp: 150, label: "连续 14 天 · 习惯成型" },
  { days: 30, xp: 350, label: "连续 30 天 · 月度达人" },
  { days: 60, xp: 600, label: "连续 60 天 · 意志如铁" },
  { days: 100, xp: 1000, label: "连续 100 天 · 百日传奇" },
];

export const TASK_DIFFICULTIES = {
  easy: {
    label: "轻松",
    xp: 18,
    statXp: 8,
    burden: 1,
    description: "低压力，适合状态一般时完成。",
  },
  normal: {
    label: "标准",
    xp: 35,
    statXp: 16,
    burden: 2,
    description: "有明确行动，但不会过度消耗。",
  },
  hard: {
    label: "挑战",
    xp: 65,
    statXp: 30,
    burden: 3,
    description: "需要投入专注或体力，奖励更高。",
  },
  epic: {
    label: "史诗",
    xp: 110,
    statXp: 52,
    burden: 5,
    description: "少量出现，适合想突破的一天。",
  },
};

/** 每日/每周问卷的学习率（略高于日常反馈，仍保持平滑） */
export const DAILY_QUESTION_LEARNING_RATE = 0.28;
export const WEEKLY_QUESTION_LEARNING_RATE = 0.38;
