import { useState, useMemo, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { SearchBar } from './SearchBar';
import { DatasetCard } from './DatasetCard';
import { PublicDirectoryProps } from './types';
import { Grid, List } from 'lucide-react';

export function PublicDirectory({ datasets, onExploreDataset }: PublicDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{
    tags: string[];
    dateRange: 'all' | 'week' | 'month' | 'year';
    sizeRange: 'all' | 'x-small' | 'small' | 'medium' | 'large' | 'x-large' | 'xx-large';
  }>({
    tags: [],
    dateRange: 'all',
    sizeRange: 'all'
  });
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const filteredDatasets = useMemo(() => {
    let filtered = datasets;

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dataset =>
        dataset.name.toLowerCase().includes(query) ||
        dataset.description.toLowerCase().includes(query) ||
        dataset.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(dataset =>
        dataset.tags.some(tag => filters.tags.includes(tag))
      );
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date(now);

      if (filters.dateRange === 'week') {
        cutoff.setDate(now.getDate() - 7);
      } else if (filters.dateRange === 'month') {
        cutoff.setMonth(now.getMonth() - 1);
      } else if (filters.dateRange === 'year') {
        cutoff.setFullYear(now.getFullYear() - 1);
      }

      filtered = filtered.filter((dataset) => {
        if (!dataset.uploadDate) return false;
        const uploadDate = new Date(dataset.uploadDate);
        if (Number.isNaN(uploadDate.getTime())) return false;
        return uploadDate >= cutoff;
      });
    }

    // Apply size range filter
    if (filters.sizeRange !== 'all') {
      const parseSizeToBytes = (size: string): number => {
        const match = size.trim().match(/^([\d.]+)\s*(bytes|kb|mb|gb|tb)$/i);
        if (!match) return 0;

        const value = Number.parseFloat(match[1]);
        if (Number.isNaN(value)) return 0;

        const unit = match[2].toLowerCase();
        switch (unit) {
          case 'tb':
            return value * 1024 * 1024 * 1024 * 1024;
          case 'gb':
            return value * 1024 * 1024 * 1024;
          case 'mb':
            return value * 1024 * 1024;
          case 'kb':
            return value * 1024;
          case 'bytes':
            return value;
          default:
            return 0;
        }
      };

      filtered = filtered.filter((dataset) => {
        const sizeBytes = typeof dataset.sizeBytes === 'number'
          ? dataset.sizeBytes
          : parseSizeToBytes(dataset.size);

        // x-small: <100MB, small: 100MB-1GB, medium: 1GB-100GB,
        // large: 100GB-1TB, x-large: 1TB-10TB, xx-large: >10TB
        const MB = 1024 * 1024;
        const GB = 1024 * MB;
        const TB = 1024 * GB;

        if (filters.sizeRange === 'x-small') {
          return sizeBytes < 100 * MB;
        }
        if (filters.sizeRange === 'small') {
          return sizeBytes >= 100 * MB && sizeBytes <= 1 * GB;
        }
        if (filters.sizeRange === 'medium') {
          return sizeBytes > 1 * GB && sizeBytes <= 100 * GB;
        }
        if (filters.sizeRange === 'large') {
          return sizeBytes > 100 * GB && sizeBytes <= 1 * TB;
        }
        if (filters.sizeRange === 'x-large') {
          return sizeBytes > 1 * TB && sizeBytes <= 10 * TB;
        }
        if (filters.sizeRange === 'xx-large') {
          return sizeBytes > 10 * TB;
        }
        return true;
      });
    }

    return filtered;
  }, [datasets, searchQuery, filters]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFiltersChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <SearchBar
            onSearch={handleSearch}
            onFiltersChange={handleFiltersChange}
            placeholder="Search datasets, origins, or tags..."
            className="max-w-2xl"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            className={viewMode === 'cards' ? "bg-chart-1 hover:bg-chart-1/90 text-white" : ""}
            onClick={() => setViewMode('cards')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            className={viewMode === 'list' ? "bg-chart-1 hover:bg-chart-1/90 text-white" : ""}
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredDatasets.length} of {datasets.length} dataset{filteredDatasets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Dataset Grid/List */}
      {filteredDatasets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No datasets found matching your criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className={
          viewMode === 'cards' 
            ? "grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
            : "space-y-4"
        }>
          {filteredDatasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              isAdmin={false}
              onExplore={onExploreDataset}
            />
          ))}
        </div>
      )}
    </div>
  );
}