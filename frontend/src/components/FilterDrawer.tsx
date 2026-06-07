import type { RecordFilter } from '../types/models';
import DrawerShell from './DrawerShell';

const dateOptions: Array<{ label: string; value: RecordFilter['dateRange'] }> = [
  { label: '全部', value: 'all' },
  { label: '近 7 天', value: 'week' },
  { label: '近 30 天', value: 'month' },
];

function FilterDrawer({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: RecordFilter;
  onChange: (value: RecordFilter) => void;
  onClose: () => void;
}) {
  const hasActiveFilter = value.dateRange !== 'all';

  function resetFilters() {
    onChange({ dateRange: 'all' });
  }

  return (
    <DrawerShell open={open} title="筛选记录" onClose={onClose}>
      <div className="filter-panel">
        <section className="filter-section">
          <h3>时间范围</h3>
          <div className="segmented-control three">
            {dateOptions.map((option) => (
              <button
                className={value.dateRange === option.value ? 'active' : ''}
                key={option.value}
                type="button"
                onClick={() => onChange({ ...value, dateRange: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <button className="settings-action" type="button" onClick={onClose}>
          应用筛选
        </button>
        {hasActiveFilter && (
          <button className="settings-action danger" type="button" onClick={resetFilters}>
            清空筛选
          </button>
        )}
      </div>
    </DrawerShell>
  );
}

export default FilterDrawer;
