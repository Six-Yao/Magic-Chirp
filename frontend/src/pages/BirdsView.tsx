import { BookOpen, Sparkles } from 'lucide-react';
import type { MapRecord } from '../types/models';
import './views.css';

function BirdsView({ records }: { records: MapRecord[] }) {
  const speciesCount = new Set(records.map((record) => record.bird_name)).size;

  return (
    <section className="birds-view">
      <div className="empty-book">
        <BookOpen size={56} />
        <h2>鸟种图鉴整理中</h2>
        <p>未来这里会从后端聚合观鸟记录，生成校园常见鸟类、出现地点和发现次数。</p>
        <div className="book-stats">
          <span>
            <Sparkles size={16} />
            已有公开记录 {records.length}
          </span>
          <span>已出现鸟种 {speciesCount}</span>
        </div>
      </div>
    </section>
  );
}

export default BirdsView;
