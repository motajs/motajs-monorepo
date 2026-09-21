import type { FC } from 'react';
import type { FlagUsageIndex } from '@/project/model/projectModel';

interface SearchFlagsContentProps {
  selectedFlag: string;
  index?: FlagUsageIndex;
}

export const SearchFlagsContent: FC<SearchFlagsContentProps> = ({ selectedFlag, index }) => {
  const flag = selectedFlag.replace(/^flag:/, '');
  const list = index?.usages[flag] ?? [];
  return (
    <div id="uieventExtraBody" data-test-id="flag-usage-results" style={{ display: 'block', marginTop: '-10px' }}>
      <p style={{ marginLeft: 10 }}>该变量出现的所有位置如下：</p>
      <ul>
        {list.map((item) => (
          <li key={`${item.source}:${item.path}`}>
            {item.label} ({item.path})
          </li>
        ))}
      </ul>
    </div>
  );
};
