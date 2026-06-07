import { BookOpen, Sparkles } from 'lucide-react';
import type { MapRecord } from '../types/models';
import './views.css';

function BirdsView({ records, searchQuery }: { records: MapRecord[]; searchQuery: string }) {
  const speciesCount = new Set(records.map((record) => record.bird_name)).size;

  return (
    <section className="birds-view">
      <div className="empty-book">
        <BookOpen size={56} />
        <h2>{searchQuery ? '搜索到的鸟种' : '鸟种图鉴整理中'}</h2>
        <p>{searchQuery ? '当前图鉴统计会跟随顶部搜索词实时变化。' : '未来这里会聚合观鸟记录，生成校园常见鸟类、出现地点和发现次数。'}</p>
        <div className="book-stats">
          <span>
            <Sparkles size={16} />
            匹配公开记录 {records.length}
          </span>
          <span>已出现鸟种 {speciesCount}</span>
        </div>
      </div>
    </section>
  );
}

export default BirdsView;
