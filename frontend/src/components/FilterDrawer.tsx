import type { PublicRecordOptions, RecordFilter } from '../types/models';
import DrawerShell from './DrawerShell';

const dateOptions: Array<{ label: string; value: RecordFilter['dateRange'] }> = [
  { label: '全部', value: 'all' },
  { label: '近 7 天', value: 'week' },
  { label: '近 30 天', value: 'month' },
];

function FilterDrawer({
  open,
  value,
  options,
  onChange,
  onClose,
}: {
  open: boolean;
  value: RecordFilter;
  options: PublicRecordOptions;
  onChange: (value: RecordFilter) => void;
  onClose: () => void;
}) {
  const hasActiveFilter = value.dateRange !== 'all' || Boolean(value.birdName || value.locationName);
  const birdOptions = options.bird_names.slice(0, 12);
  const locationOptions = Object.keys(options.locations);

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

        <section className="filter-section">
          <h3>鸟种</h3>
          <div className="option-chip-grid">
            {birdOptions.map((birdName) => (
              <button
                className={value.birdName === birdName ? 'active' : ''}
                key={birdName}
                type="button"
                onClick={() => onChange({ ...value, birdName: value.birdName === birdName ? undefined : birdName })}
              >
                {birdName}
              </button>
            ))}
            {birdOptions.length === 0 && <p>暂无鸟种选项</p>}
          </div>
        </section>

        <section className="filter-section">
          <h3>地点范围</h3>
          <div className="option-chip-grid">
            {locationOptions.map((locationName) => (
              <button
                className={value.locationName === locationName ? 'active' : ''}
                key={locationName}
                type="button"
                onClick={() =>
                  onChange({ ...value, locationName: value.locationName === locationName ? undefined : locationName })
                }
              >
                {locationName}
              </button>
            ))}
            {locationOptions.length === 0 && <p>暂无地点选项</p>}
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
