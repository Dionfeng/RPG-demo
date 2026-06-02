import {
  TASK_DAILY_PICK_COUNT,
  TASK_DIFFICULTIES,
  TASK_SELECTION_LIMIT,
} from "./config.js";
import { appDayKey } from "./clock.js";

export const TASK_BANK = [
  {
    id: "hea_easy_walk",
    title: "散步 10 分钟",
    desc: "出门或在室内走动，让身体从静止里醒过来。",
    statIds: ["hea"],
    difficulty: "easy",
    minutes: 10,
    effects: { hea: 1 },
  },
  {
    id: "hea_normal_training",
    title: "完成一次轻训练",
    desc: "任选拉伸、俯卧撑、深蹲或慢跑，持续 20 分钟。",
    statIds: ["hea", "wil"],
    difficulty: "normal",
    minutes: 20,
    effects: { hea: 2, wil: 1 },
  },
  {
    id: "hea_hard_recovery",
    title: "认真照顾身体 45 分钟",
    desc: "运动、备餐、拉伸或早睡准备任选其一，认真完成并记录感受。",
    statIds: ["hea", "wil"],
    difficulty: "hard",
    minutes: 45,
    effects: { hea: 3, wil: 1 },
  },
  {
    id: "wil_easy_first_step",
    title: "只做第一步",
    desc: "把一个拖延事项拆到最小，然后只完成第一步。",
    statIds: ["wil"],
    difficulty: "easy",
    minutes: 5,
    effects: { wil: 1 },
  },
  {
    id: "wil_normal_promise",
    title: "兑现一个小承诺",
    desc: "完成今天答应自己的一个小动作，不追求完美。",
    statIds: ["wil"],
    difficulty: "normal",
    minutes: 20,
    effects: { wil: 2 },
  },
  {
    id: "wil_hard_frog",
    title: "处理最抗拒的一件事",
    desc: "直接推进今天最不想做但最重要的任务，至少完成一个可见节点。",
    statIds: ["wil", "int"],
    difficulty: "hard",
    minutes: 60,
    effects: { wil: 3, int: 1 },
  },
  {
    id: "cha_easy_tidy",
    title: "整理外在状态",
    desc: "整理仪容、衣着或桌面，让自己更清爽地出现。",
    statIds: ["cha", "hea"],
    difficulty: "easy",
    minutes: 8,
    effects: { cha: 1, hea: 0.5 },
  },
  {
    id: "cha_normal_talk",
    title: "进行一次不敷衍的交流",
    desc: "认真听对方说完，并表达一个具体回应。",
    statIds: ["cha", "spi"],
    difficulty: "normal",
    minutes: 15,
    effects: { cha: 2, spi: 1 },
  },
  {
    id: "cha_hard_connect",
    title: "主动发起一次连接",
    desc: "约一个人聊天、吃饭、散步或线上交流。",
    statIds: ["cha", "wil"],
    difficulty: "hard",
    minutes: 30,
    effects: { cha: 3, wil: 1 },
  },
  {
    id: "cha_easy_ping",
    title: "给一个人发问候",
    desc: "给朋友、家人或同事发一句真诚问候。",
    statIds: ["cha"],
    difficulty: "easy",
    minutes: 3,
    effects: { cha: 1 },
  },
  {
    id: "cre_easy_capture",
    title: "捕捉一个点子",
    desc: "记录一个想法、画面、句子或项目灵感。",
    statIds: ["cre"],
    difficulty: "easy",
    minutes: 5,
    effects: { cre: 1 },
  },
  {
    id: "cre_normal_make",
    title: "创作 25 分钟",
    desc: "写、画、剪辑、做项目都可以，重点是产出。",
    statIds: ["cre", "int"],
    difficulty: "normal",
    minutes: 25,
    effects: { cre: 2, int: 1 },
  },
  {
    id: "cre_hard_publish",
    title: "发布或展示一个小作品",
    desc: "把一个片段发给朋友、社群，或整理到自己的作品库。",
    statIds: ["cre", "cha", "wil"],
    difficulty: "hard",
    minutes: 45,
    effects: { cre: 3, cha: 1, wil: 1 },
  },
  {
    id: "spi_easy_breath",
    title: "三轮深呼吸",
    desc: "吸气 4 秒，停 2 秒，呼气 6 秒，完成三轮。",
    statIds: ["spi"],
    difficulty: "easy",
    minutes: 3,
    effects: { spi: 1 },
  },
  {
    id: "spi_normal_journal",
    title: "写下一个真实感受",
    desc: "用 5 句话描述今天最强烈的感受，不评价它。",
    statIds: ["spi", "cre"],
    difficulty: "normal",
    minutes: 10,
    effects: { spi: 2, cre: 0.5 },
  },
  {
    id: "spi_hard_reframe",
    title: "重构一个困扰",
    desc: "选一个烦恼，写出事实、解释、下一步行动三栏。",
    statIds: ["spi", "wil", "int"],
    difficulty: "hard",
    minutes: 25,
    effects: { spi: 3, wil: 1, int: 1 },
  },
  {
    id: "int_easy_read",
    title: "阅读 10 分钟",
    desc: "读一段书、教程或长文，记录一句有用的信息。",
    statIds: ["int"],
    difficulty: "easy",
    minutes: 10,
    effects: { int: 1 },
  },
  {
    id: "int_normal_deepwork",
    title: "完成一轮深度学习/工作",
    desc: "设 40 分钟计时器，推进今天最需要动脑的一件事。",
    statIds: ["int", "wil"],
    difficulty: "normal",
    minutes: 40,
    effects: { int: 2, wil: 1 },
  },
  {
    id: "int_hard_ship",
    title: "解决一个复杂问题",
    desc: "把一个复杂任务拆解、推进，并留下可复用的笔记或结论。",
    statIds: ["int", "wil", "cre"],
    difficulty: "hard",
    minutes: 60,
    effects: { int: 3, wil: 1, cre: 1 },
  },
  {
    id: "wil_epic_breakthrough",
    title: "完成一次关键突破",
    desc: "选择今天最重要的目标，连续投入 90 分钟，产出可验收结果。",
    statIds: ["wil", "int", "cre"],
    difficulty: "epic",
    minutes: 90,
    effects: { wil: 4, int: 3, cre: 1 },
  },
  {
    id: "spi_epic_reset",
    title: "半日身心重整",
    desc: "集中处理休息、整理、计划和关系中的一个长期失衡点。",
    statIds: ["spi", "hea", "wil"],
    difficulty: "epic",
    minutes: 120,
    effects: { spi: 4, hea: 2, wil: 2 },
  },
  {
    id: "cha_epic_presence",
    title: "完成一次高质量表达",
    desc: "准备并完成一次展示、沟通、发布或重要对话。",
    statIds: ["cha", "int", "wil"],
    difficulty: "epic",
    minutes: 75,
    effects: { cha: 4, int: 2, wil: 1 },
  },
];

export function localDayKey(date = new Date()) {
  return appDayKey(date);
}

function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return Math.abs(h);
}

function seededShuffle(items, seed) {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function taskScore(task, save) {
  const statMap = Object.fromEntries((save.stats ?? []).map((s) => [s.id, s]));
  const avg = task.statIds.reduce((sum, id) => sum + (statMap[id]?.value ?? 50), 0) / task.statIds.length;
  const weakBonus = avg < 45 && task.difficulty !== "epic" ? 18 : 0;
  const challengeBonus = avg > 65 && ["hard", "epic"].includes(task.difficulty) ? 14 : 0;
  const planStats = (save.plans ?? [])
    .filter((p) => !p.archived)
    .flatMap((p) => p.statIds ?? [p.statId])
    .filter(Boolean);
  const goalStats = (save.growth?.goals ?? [])
    .flatMap((g) => g.statIds ?? [g.statId])
    .filter(Boolean);
  const related = new Set([...planStats, ...goalStats]);
  const goalBonus = task.statIds.some((id) => related.has(id)) ? 14 : 0;
  const doneToday = new Set(getTodayTaskEntry(save).completedIds ?? []);
  const repeatPenalty = doneToday.has(task.id) && !task.repeatable ? -100 : 0;
  return weakBonus + challengeBonus + goalBonus + repeatPenalty;
}

function selectByDifficulty(tasks, difficulty, count, seed) {
  return seededShuffle(tasks.filter((task) => task.difficulty === difficulty), seed).slice(0, count);
}

function pickTaskIds(save, count, exclude, seed) {
  const pool = TASK_BANK.filter((task) => !exclude.has(task.id));
  if (!pool.length || count <= 0) return [];

  const scored = seededShuffle(pool, seed)
    .map((task) => ({ task, score: taskScore(task, save) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.task);

  const picked = [
    ...selectByDifficulty(scored, "easy", 2, seed + 11),
    ...selectByDifficulty(scored, "normal", 2, seed + 17),
    ...selectByDifficulty(scored, "hard", 1, seed + 23),
    ...selectByDifficulty(scored, "epic", 1, seed + 31),
  ];

  const unique = [];
  for (const task of [...picked, ...scored]) {
    if (!unique.some((x) => x.id === task.id)) unique.push(task);
    if (unique.length >= count) break;
  }
  return unique.map((task) => task.id);
}

export function generateDailyTasks(save) {
  const day = localDayKey();
  const seed = seedFromString(`${day}-${save.playerName ?? "旅人"}`);
  return pickTaskIds(save, TASK_DAILY_PICK_COUNT, new Set(), seed);
}

export function hasRefreshableBoardTasks(save) {
  const entry = getTodayTaskEntry(save);
  if (!entry.generatedIds?.length) return false;
  const accepted = new Set(entry.acceptedIds ?? []);
  return entry.generatedIds.some((id) => !accepted.has(id));
}

export function refreshBoardTasks(save) {
  const entry = getTodayTaskEntry(save);
  if (!entry.generatedIds?.length) {
    entry.generatedIds = generateDailyTasks(save);
  }
  if (entry.refreshCount === undefined) entry.refreshCount = 0;

  const accepted = new Set(entry.acceptedIds ?? []);
  const kept = entry.generatedIds.filter((id) => accepted.has(id));
  const replaceCount = TASK_DAILY_PICK_COUNT - kept.length;

  if (replaceCount <= 0) {
    return { ok: false, error: "当前告示上的任务都已接取，无法刷新" };
  }

  const exclude = new Set(entry.generatedIds);
  const seed = seedFromString(
    `${localDayKey()}-${save.playerName ?? "旅人"}-refresh-${entry.refreshCount}`
  );
  const newIds = pickTaskIds(save, replaceCount, exclude, seed);

  entry.refreshCount += 1;
  entry.generatedIds = [...kept, ...newIds];

  return {
    ok: true,
    keptCount: kept.length,
    refreshedCount: newIds.length,
  };
}

export function getTaskById(taskId) {
  return TASK_BANK.find((task) => task.id === taskId);
}

export function getTodayTaskEntry(save) {
  if (!save.taskLog) save.taskLog = { daily: {} };
  const day = localDayKey();
  if (!save.taskLog.daily[day]) {
    save.taskLog.daily[day] = {
      generatedIds: [],
      acceptedIds: [],
      completedIds: [],
      outcomes: {},
      refreshCount: 0,
    };
  }
  if (save.taskLog.daily[day].refreshCount === undefined) {
    save.taskLog.daily[day].refreshCount = 0;
  }
  return save.taskLog.daily[day];
}

export function ensureDailyTasks(save) {
  const entry = getTodayTaskEntry(save);
  if (!entry.generatedIds?.length) {
    entry.generatedIds = generateDailyTasks(save);
  }
  if (!entry.acceptedIds) entry.acceptedIds = [];
  if (!entry.completedIds) entry.completedIds = [];
  if (!entry.outcomes) entry.outcomes = {};
  if (entry.refreshCount === undefined) entry.refreshCount = 0;
  return entry.generatedIds.map(getTaskById).filter(Boolean);
}

export function canAcceptMoreTasks(save) {
  const entry = getTodayTaskEntry(save);
  return entry.acceptedIds.length < TASK_SELECTION_LIMIT;
}

export function acceptTask(save, taskId) {
  const entry = getTodayTaskEntry(save);
  if (!entry.generatedIds.includes(taskId)) return false;
  if (entry.acceptedIds.includes(taskId)) return true;
  if (!canAcceptMoreTasks(save)) return false;
  entry.acceptedIds.push(taskId);
  return true;
}

export function recordTaskOutcome(save, taskId, outcome) {
  const entry = getTodayTaskEntry(save);
  if (!entry.acceptedIds.includes(taskId)) return false;
  if (entry.outcomes?.[taskId]) return false;
  if (!entry.completedIds.includes(taskId)) entry.completedIds.push(taskId);
  entry.outcomes[taskId] = { ...outcome, at: Date.now() };
  return true;
}

export function describeTaskReward(task) {
  const diff = TASK_DIFFICULTIES[task.difficulty];
  return `+${diff.xp} XP · ${task.statIds.map((id) => `+${diff.statXp} ${id.toUpperCase()}`).join(" / ")}`;
}
