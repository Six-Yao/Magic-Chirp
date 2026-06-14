export type BirdGuideEntry = {
  name: string;
  rarity: '常见' | '偶见' | '少见';
  features: string[];
  habitats: string[];
  activeTime: string;
};

export const birdGuideEntries: BirdGuideEntry[] = [
  {
    name: '麻雀',
    rarity: '常见',
    features: ['体型小巧', '背部褐色带纵纹', '常成群在地面跳跃觅食'],
    habitats: ['教学楼附近', '食堂周边', '宿舍区', '草坪'],
    activeTime: '全年常见，清晨和傍晚更活跃',
  },
  {
    name: '乌鸫',
    rarity: '常见',
    features: ['雄鸟通体黑色', '橙黄色嘴和眼圈', '常在草地低头翻找食物'],
    habitats: ['草坪', '树丛边缘', '湖边', '道路绿化带'],
    activeTime: '全年常见，清晨鸣唱明显',
  },
  {
    name: '白头鹎',
    rarity: '常见',
    features: ['头顶和后颈有白色区域', '脸侧黑白分明', '叫声清亮且频繁'],
    habitats: ['树冠', '宿舍区', '教学楼附近', '果树和灌木'],
    activeTime: '全年常见，上午和傍晚容易观察',
  },
  {
    name: '绣眼鸟',
    rarity: '常见',
    features: ['体型很小', '黄绿色羽色', '眼周有明显白色眼圈'],
    habitats: ['花木', '灌木丛', '校园小树林', '开花植物附近'],
    activeTime: '春秋较活跃，白天常在枝叶间穿梭',
  },
  {
    name: '喜鹊',
    rarity: '常见',
    features: ['黑白配色', '长尾明显', '飞行时翅膀白斑醒目'],
    habitats: ['高树', '道路两侧', '开阔草地', '楼宇周边'],
    activeTime: '全年常见，白天活动明显',
  },
  {
    name: '灰喜鹊',
    rarity: '偶见',
    features: ['蓝灰色长尾', '头顶黑色', '常成小群在树间移动'],
    habitats: ['高大乔木', '校园林带', '安静道路旁'],
    activeTime: '全年可见，上午活动较多',
  },
  {
    name: '八哥',
    rarity: '常见',
    features: ['黑色身体', '额前羽冠明显', '翅上有白斑', '叫声多变'],
    habitats: ['草坪', '操场边', '教学楼屋顶', '道路绿化带'],
    activeTime: '全年常见，清晨和傍晚常成群',
  },
  {
    name: '大山雀',
    rarity: '偶见',
    features: ['黑色头部带白脸斑', '腹部有黑色纵纹', '动作灵活'],
    habitats: ['树林', '灌木', '较安静的校园绿地'],
    activeTime: '秋冬和春季较容易遇到',
  },
  {
    name: '燕子',
    rarity: '偶见',
    features: ['翅膀尖长', '飞行迅速', '常低空掠过捕虫'],
    habitats: ['开阔道路', '水面附近', '操场上空', '建筑檐下'],
    activeTime: '春夏常见，雨前或傍晚更活跃',
  },
  {
    name: '乌鸦',
    rarity: '偶见',
    features: ['体型较大', '全身黑色', '叫声低沉粗哑'],
    habitats: ['高树', '楼顶', '开阔草地', '校园边缘区域'],
    activeTime: '全年可见，白天活动',
  },
  {
    name: '鸽子',
    rarity: '常见',
    features: ['体型圆润', '灰色为主', '行走时头部前后摆动'],
    habitats: ['广场', '教学楼附近', '道路边', '食堂周边'],
    activeTime: '全年常见，白天活动',
  },
  {
    name: '夜鹭',
    rarity: '少见',
    features: ['灰黑色背部', '红眼明显', '白天常安静停在水边树上'],
    habitats: ['湖边', '河道', '湿地植物附近'],
    activeTime: '傍晚和夜间更活跃，白天也可在水边休息',
  },
  {
    name: '珠颈斑鸠',
    rarity: '常见',
    features: ['颈侧有黑底白点斑块', '体色粉褐', '常在地面慢走觅食'],
    habitats: ['草坪', '宿舍区', '树下空地', '道路边'],
    activeTime: '全年常见，上午和傍晚较多',
  },
  {
    name: '白鹡鸰',
    rarity: '偶见',
    features: ['黑白灰配色', '尾巴频繁上下摆动', '常在地面快步行走'],
    habitats: ['水边', '广场', '道路边', '开阔硬质地面'],
    activeTime: '全年可见，清晨和白天活动',
  },
  {
    name: '红耳鹎',
    rarity: '少见',
    features: ['头顶黑色羽冠', '脸侧有红色耳斑', '尾下覆羽偏红'],
    habitats: ['灌木', '果树', '校园花木密集处'],
    activeTime: '春夏较容易观察，白天活动',
  },
  {
    name: '灰椋鸟',
    rarity: '偶见',
    features: ['灰褐色身体', '脸部偏白', '常成群停在树上或草地'],
    habitats: ['草坪', '高树', '道路绿化带', '开阔校园区域'],
    activeTime: '秋冬和迁徙季较常见，傍晚易成群',
  },
];
