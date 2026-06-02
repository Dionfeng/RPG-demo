/**
 * 问卷题库
 * - onboarding: 新用户基准（选项含各属性目标分 0–100）
 * - daily / weekly: 动态微调（选项含 effects 权重，经 adjust 学习率应用）
 */

export const ONBOARDING_QUESTIONS = [
  {
    id: "on_health",
    text: "过去两周，你的身体状态整体如何？",
    hint: "诚实即可，没有标准答案。",
    options: [
      { id: "1", label: "睡眠、饮食或运动明显失衡", scores: { hea: 28, wil: 35, spi: 38 } },
      { id: "2", label: "勉强维持，偶尔会透支", scores: { hea: 48, wil: 48 } },
      { id: "3", label: "大多数时候还算稳定", scores: { hea: 66, wil: 60, spi: 58 } },
      { id: "4", label: "作息和身体管理都不错", scores: { hea: 84, wil: 72, cha: 62 } },
    ],
  },
  {
    id: "on_will",
    text: "面对计划、习惯和困难时，你的执行力如何？",
    options: [
      { id: "1", label: "经常拖延或半途而废", scores: { wil: 24, int: 38 } },
      { id: "2", label: "想做好，但常被情绪或阻力带走", scores: { wil: 45, spi: 45 } },
      { id: "3", label: "多数重要事情能推进", scores: { wil: 68, int: 62 } },
      { id: "4", label: "执行稳定，很少失约于自己", scores: { wil: 88, int: 72, hea: 66 } },
    ],
  },
  {
    id: "on_charm",
    text: "在表达自己、与人互动时，你通常感觉如何？",
    options: [
      { id: "1", label: "容易紧张或回避表达", scores: { cha: 28, spi: 38 } },
      { id: "2", label: "看对象和场合，有时自在", scores: { cha: 48, spi: 50 } },
      { id: "3", label: "多数时候能自然沟通", scores: { cha: 68, wil: 58 } },
      { id: "4", label: "表达有感染力，容易建立连接", scores: { cha: 86, spi: 70, int: 62 } },
    ],
  },
  {
    id: "on_creative",
    text: "最近一个月，你有多少创造或表达的时刻？",
    hint: "写作、画画、做项目、整理想法、做内容都算。",
    options: [
      { id: "1", label: "几乎没有", scores: { cre: 25, spi: 38 } },
      { id: "2", label: "偶尔有一点", scores: { cre: 45 } },
      { id: "3", label: "每周都有一些产出", scores: { cre: 68, int: 58 } },
      { id: "4", label: "经常沉浸在创造里", scores: { cre: 88, spi: 72, int: 66 } },
    ],
  },
  {
    id: "on_spirit",
    text: "你的内在稳定、松弛感和意义感如何？",
    options: [
      { id: "1", label: "经常焦虑、麻木或被外界牵着走", scores: { spi: 25, wil: 35 } },
      { id: "2", label: "有起伏，需要刻意调整", scores: { spi: 46, hea: 48 } },
      { id: "3", label: "多数时候能回到稳定状态", scores: { spi: 66, wil: 60 } },
      { id: "4", label: "内在清明，有持续的方向感", scores: { spi: 86, cre: 68, cha: 62 } },
    ],
  },
  {
    id: "on_intellect",
    text: "学习、思考和解决问题时，你的状态更接近？",
    options: [
      { id: "1", label: "容易分心，很难深入", scores: { int: 24, wil: 32 } },
      { id: "2", label: "能理解，但持续投入不稳定", scores: { int: 46, wil: 48 } },
      { id: "3", label: "能较好学习和拆解问题", scores: { int: 68, wil: 62 } },
      { id: "4", label: "思考清晰，能持续解决复杂问题", scores: { int: 88, cre: 70, wil: 70 } },
    ],
  },
];

export const DAILY_QUESTIONS = [
  {
    id: "d_sleep",
    text: "昨晚睡得怎么样？",
    options: [
      { id: "1", label: "很差", effects: { hea: -3, spi: -1, int: -1 } },
      { id: "2", label: "一般", effects: { hea: 0 } },
      { id: "3", label: "不错", effects: { hea: 2, spi: 1 } },
      { id: "4", label: "很好", effects: { hea: 3, wil: 1, spi: 1 } },
    ],
  },
  {
    id: "d_health",
    text: "今天身体状态如何？",
    options: [
      { id: "1", label: "明显不舒服", effects: { hea: -3, wil: -1 } },
      { id: "2", label: "偏疲惫", effects: { hea: -1 } },
      { id: "3", label: "还行", effects: { hea: 1 } },
      { id: "4", label: "轻盈有活力", effects: { hea: 2, cha: 1 } },
    ],
  },
  {
    id: "d_intellect",
    text: "今天学习/思考/处理问题的状态？",
    options: [
      { id: "1", label: "脑子很乱", effects: { int: -3, wil: -1 } },
      { id: "2", label: "比较难进入状态", effects: { int: -1 } },
      { id: "3", label: "正常推进", effects: { int: 1 } },
      { id: "4", label: "清晰高效", effects: { int: 2, cre: 1 } },
    ],
  },
  {
    id: "d_spirit",
    text: "今天内在状态如何？",
    options: [
      { id: "1", label: "低落/烦躁", effects: { spi: -3, wil: -1 } },
      { id: "2", label: "平淡", effects: { spi: 0 } },
      { id: "3", label: "平稳偏积极", effects: { spi: 2 } },
      { id: "4", label: "松弛且有方向", effects: { spi: 3, cha: 1 } },
    ],
  },
  {
    id: "d_charm",
    text: "今天表达和人际互动让你感觉？",
    options: [
      { id: "1", label: "很消耗", effects: { cha: -2, spi: -1 } },
      { id: "2", label: "没什么交流", effects: { cha: 0 } },
      { id: "3", label: "自然或有连接感", effects: { cha: 2, spi: 1 } },
      { id: "4", label: "表达顺畅，很有吸引力", effects: { cha: 3, wil: 1 } },
    ],
  },
  {
    id: "d_execution",
    text: "今天对重要事的执行情况？",
    options: [
      { id: "1", label: "几乎没推进", effects: { wil: -3, int: -1 } },
      { id: "2", label: "做了一点", effects: { wil: -1 } },
      { id: "3", label: "完成了主要部分", effects: { wil: 2, int: 1 } },
      { id: "4", label: "超额完成", effects: { wil: 3, int: 1, spi: 1 } },
    ],
  },
  {
    id: "d_body",
    text: "身体状态（运动/饮食/不适）？",
    options: [
      { id: "1", label: "很不舒服", effects: { hea: -3, spi: -1 } },
      { id: "2", label: "一般", effects: { hea: 0 } },
      { id: "3", label: "还不错", effects: { hea: 2 } },
      { id: "4", label: "运动或饮食都很好", effects: { hea: 3, wil: 1 } },
    ],
  },
  {
    id: "d_creative",
    text: "今天有没有创造/表达的时刻？",
    options: [
      { id: "1", label: "没有", effects: { cre: -1 } },
      { id: "2", label: "有一点点", effects: { cre: 1 } },
      { id: "3", label: "有明显收获", effects: { cre: 2, spi: 1 } },
    ],
  },
];

export const WEEKLY_QUESTIONS = [
  {
    id: "w_overall",
    text: "回顾这一周，整体生活状态？",
    options: [
      { id: "1", label: "很艰难的一周", effects: { spi: -4, hea: -2, wil: -2 } },
      { id: "2", label: "起伏较大", effects: { spi: -1, wil: -1 } },
      { id: "3", label: "还算平稳", effects: { spi: 2, hea: 1 } },
      { id: "4", label: "充实且满意", effects: { spi: 3, wil: 2, cha: 1 } },
    ],
  },
  {
    id: "w_growth",
    text: "这周你有没有感到「自己在变好」？",
    options: [
      { id: "1", label: "几乎没有", effects: { wil: -2, spi: -2 } },
      { id: "2", label: "有一点", effects: { wil: 1, spi: 1 } },
      { id: "3", label: "比较明显", effects: { wil: 3, spi: 2, cre: 1 } },
      { id: "4", label: "成长感很强", effects: { wil: 4, spi: 3, cre: 2, int: 1 } },
    ],
  },
  {
    id: "w_relationship",
    text: "这周重要关系（家人/朋友/伴侣）的质量？",
    options: [
      { id: "1", label: "紧张或疏远", effects: { cha: -3, spi: -2 } },
      { id: "2", label: "平淡", effects: { cha: 0 } },
      { id: "3", label: "温暖稳定", effects: { cha: 3, spi: 1 } },
      { id: "4", label: "深度连接", effects: { cha: 4, spi: 2 } },
    ],
  },
  {
    id: "w_work",
    text: "工作/学习目标的推进程度？",
    options: [
      { id: "1", label: "严重落后", effects: { int: -3, wil: -3 } },
      { id: "2", label: "勉强维持", effects: { int: 0, wil: 0 } },
      { id: "3", label: "按计划推进", effects: { int: 2, wil: 2 } },
      { id: "4", label: "超出预期", effects: { int: 3, wil: 3, cre: 1 } },
    ],
  },
  {
    id: "w_selfcare",
    text: "这周自我照顾（休息、运动、娱乐）？",
    options: [
      { id: "1", label: "几乎顾不上", effects: { hea: -3, spi: -2 } },
      { id: "2", label: "很少", effects: { hea: -1 } },
      { id: "3", label: "有刻意安排", effects: { hea: 2, spi: 1 } },
      { id: "4", label: "做得很好", effects: { hea: 3, spi: 2, wil: 1 } },
    ],
  },
  {
    id: "w_meaning",
    text: "这周的生活有意义感吗？",
    options: [
      { id: "1", label: "我不知道呀", effects: { spi: -3, cre: -2 } },
      { id: "2", label: "偶尔有", effects: { spi: 1, cre: 1 } },
      { id: "3", label: "时常感受到", effects: { spi: 2, cre: 2 } },
      { id: "4", label: "强烈且持续", effects: { spi: 4, cre: 3, wil: 1 } },
    ],
  },
];

/** 每日展示题数、每周展示题数 */
export const DAILY_PICK_COUNT = 3;
export const WEEKLY_PICK_COUNT = 2;
