import baige from '../assets/birds/白头鹎.png';
import bage from '../assets/birds/八哥.png';
import daShanQue from '../assets/birds/大山雀.png';
import gezi from '../assets/birds/鸽子.png';
import huiLiangNiao from '../assets/birds/灰椋鸟.png';
import huiXiQue from '../assets/birds/灰喜鹊.png';
import maque from '../assets/birds/麻雀.png';
import hongErBei from '../assets/birds/红耳鹎.png';
import yeLu from '../assets/birds/夜鹭.png';
import xique from '../assets/birds/喜鹊.png';
import yanzi from '../assets/birds/燕子.png';
import wuya from '../assets/birds/乌鸦.png';
import wudong from '../assets/birds/乌鸫.png';
import xiuyan from '../assets/birds/绣眼鸟.png';
import zhuJingBanJiu from '../assets/birds/珠颈斑鸠.png';
import baiJiLing from '../assets/birds/白鹡鸰.png';

const birdAssetMap = new Map<string, string>([
  ['白头鹎', baige],
  ['八哥', bage],
  ['大山雀', daShanQue],
  ['鸽子', gezi],
  ['灰椋鸟', huiLiangNiao],
  ['灰喜鹊', huiXiQue],
  ['麻雀', maque],
  ['红耳鹎', hongErBei],
  ['夜鹭', yeLu],
  ['喜鹊', xique],
  ['燕子', yanzi],
  ['乌鸦', wuya],
  ['乌鸫', wudong],
  ['绣眼鸟', xiuyan],
  ['珠颈斑鸠', zhuJingBanJiu],
  ['白鹡鸰', baiJiLing],
]);

export function getPixelBirdAsset(name: string) {
  const normalizedName = name.trim();
  const exactMatch = birdAssetMap.get(normalizedName);

  if (exactMatch) {
    return exactMatch;
  }

  const fuzzyMatch = Array.from(birdAssetMap.entries()).find(
    ([birdName]) => normalizedName.includes(birdName) || birdName.includes(normalizedName),
  );

  return fuzzyMatch?.[1] ?? null;
}
