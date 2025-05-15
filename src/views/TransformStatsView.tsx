import React, { useState } from 'react';
import { Search, Activity, AlertTriangle, ChevronDown, ChevronRight, Clock, Database, Filter } from 'lucide-react';
import type { TransformStats, TransformConfigResponse } from '../types';

interface TransformStatsViewProps {
  stats: TransformStats | null;
  config: TransformConfigResponse | null;
}

export function TransformStatsView({ stats, config }: TransformStatsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTransforms, setExpandedTransforms] = useState<Set<string>>(new Set());

  if (!stats) {
    return (
      <div className="text-center py-12">
        <Activity className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Transform Stats Not Available
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          No transform statistics are available in the uploaded diagnostic data.
        </p>
      </div>
    );
  }

  const toggleTransform = (transformId: string) => {
    setExpandedTransforms(prev => {
      const next = new Set(prev);
      if (next.has(transformId)) {
        next.delete(transformId);
      } else {
        next.add(transformId);
      }
      return next;
    });
  };

  const filteredTransforms = stats.transforms.filter(transform =>
    transform.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTransformConfig = (transformId: string) => {
    if (!config) return null;
    return config.transforms.find(t => t.id === transformId);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Activity className="w-8 h-8 text-blue-500 mr-3" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Transform Statistics
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {stats.count} transforms configured
        </p>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search transforms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredTransforms.map((transform) => {
          const transformConfig = getTransformConfig(transform.id);
          return (
            <div key={transform.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => toggleTransform(transform.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <Activity className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {transform.id}
                    </h3>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        transform.state === 'started'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                      }`}>
                        {transform.state}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        transform.health.status === 'green'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      }`}>
                        {transform.health.status}
                      </span>
                    </div>
                  </div>
                </div>
                {expandedTransforms.has(transform.id) ? (
                  <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>

              {expandedTransforms.has(transform.id) && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Transform Configuration */}
                  {transformConfig && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                          Transform Configuration
                        </h4>
                        <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto">
                          {JSON.stringify(transformConfig, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Statistics */}
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                      Transform Statistics
                    </h4>
                    <pre className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-auto bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                      {JSON.stringify(transform, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}