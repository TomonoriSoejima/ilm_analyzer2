import React, { useState } from 'react';
import { Search, Database, HardDrive, FileText, ChevronDown, ChevronRight, BarChart3, Clock, AlertTriangle } from 'lucide-react';

interface SegmentData {
  generation: number;
  num_docs: number;
  deleted_docs: number;
  size: string;
  size_in_bytes: number;
  committed: boolean;
  search: boolean;
  version: string;
  compound: boolean;
  attributes: Record<string, any>;
  sort?: Array<{
    field: string;
    missing?: string;
    mode?: string;
    reverse?: boolean;
  }>;
}

interface ShardData {
  routing: {
    state: string;
    primary: boolean;
    node: string;
  };
  num_committed_segments: number;
  num_search_segments: number;
  segments: Record<string, SegmentData>;
}

interface IndexData {
  shards: {
    [key: string]: ShardData[];
  };
}

interface SegmentsData {
  _shards: {
    total: number;
    successful: number;
    failed: number;
  };
  indices: Record<string, IndexData>;
}

interface SegmentsAnalysisProps {
  data: SegmentsData;
}

export function SegmentsAnalysis({ data }: SegmentsAnalysisProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIndices, setExpandedIndices] = useState<Set<string>>(new Set());
  const [expandedShards, setExpandedShards] = useState<Set<string>>(new Set());

  const toggleIndex = (indexName: string) => {
    const newExpandedIndices = new Set(expandedIndices);
    if (newExpandedIndices.has(indexName)) {
      newExpandedIndices.delete(indexName);
    } else {
      newExpandedIndices.add(indexName);
    }
    setExpandedIndices(newExpandedIndices);
  };

  const toggleShard = (key: string) => {
    const newExpandedShards = new Set(expandedShards);
    if (newExpandedShards.has(key)) {
      newExpandedShards.delete(key);
    } else {
      newExpandedShards.add(key);
    }
    setExpandedShards(newExpandedShards);
  };

  // Calculate index statistics
  const indexStats = React.useMemo(() => {
    const stats: Record<string, {
      totalDocs: number;
      totalDeletedDocs: number;
      totalSizeBytes: number;
      totalSegments: number;
      avgSegmentSize: number;
      segmentCount: number;
      nonCompoundSegments: number;
      oldestVersion: string;
      newestVersion: string;
      maxGeneration: number;
    }> = {};

    Object.entries(data.indices).forEach(([indexName, indexData]) => {
      let totalDocs = 0;
      let totalDeletedDocs = 0;
      let totalSizeBytes = 0;
      let totalSegments = 0;
      let nonCompoundSegments = 0;
      let versions = new Set<string>();
      let maxGeneration = 0;

      Object.values(indexData.shards).forEach(shards => {
        shards.forEach(shard => {
          Object.values(shard.segments).forEach(segment => {
            totalDocs += segment.num_docs;
            totalDeletedDocs += segment.deleted_docs;
            totalSizeBytes += segment.size_in_bytes;
            totalSegments++;
            if (!segment.compound) {
              nonCompoundSegments++;
            }
            versions.add(segment.version);
            maxGeneration = Math.max(maxGeneration, segment.generation);
          });
        });
      });

      const versionsArray = Array.from(versions).sort();
      
      stats[indexName] = {
        totalDocs,
        totalDeletedDocs,
        totalSizeBytes,
        totalSegments,
        avgSegmentSize: totalSegments > 0 ? totalSizeBytes / totalSegments : 0,
        segmentCount: totalSegments,
        nonCompoundSegments,
        oldestVersion: versionsArray[0] || 'N/A',
        newestVersion: versionsArray[versionsArray.length - 1] || 'N/A',
        maxGeneration
      };
    });

    return stats;
  }, [data.indices]);

  // Sort indices by size (largest first)
  const sortedIndices = React.useMemo(() => {
    return Object.entries(data.indices)
      .filter(([indexName]) => indexName.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const statsA = indexStats[a[0]];
        const statsB = indexStats[b[0]];
        return statsB.totalSizeBytes - statsA.totalSizeBytes;
      });
  }, [data.indices, indexStats, searchTerm]);

  // Calculate cluster-wide statistics
  const clusterStats = React.useMemo(() => {
    let totalIndices = Object.keys(data.indices).length;
    let totalShards = 0;
    let totalSegments = 0;
    let totalDocs = 0;
    let totalDeletedDocs = 0;
    let totalSizeBytes = 0;
    let largestIndex = { name: '', size: 0 };
    let mostSegmentedIndex = { name: '', segments: 0 };
    let highestDeleteRatio = { name: '', ratio: 0 };
    let nonCompoundSegments = 0;

    Object.entries(data.indices).forEach(([indexName, indexData]) => {
      const stats = indexStats[indexName];
      totalSegments += stats.segmentCount;
      totalDocs += stats.totalDocs;
      totalDeletedDocs += stats.totalDeletedDocs;
      totalSizeBytes += stats.totalSizeBytes;
      nonCompoundSegments += stats.nonCompoundSegments;
      
      // Count shards
      Object.values(indexData.shards).forEach(shards => {
        totalShards += shards.length;
      });

      // Track largest index
      if (stats.totalSizeBytes > largestIndex.size) {
        largestIndex = { name: indexName, size: stats.totalSizeBytes };
      }

      // Track most segmented index
      if (stats.segmentCount > mostSegmentedIndex.segments) {
        mostSegmentedIndex = { name: indexName, segments: stats.segmentCount };
      }

      // Track highest delete ratio
      const deleteRatio = stats.totalDocs > 0 ? stats.totalDeletedDocs / (stats.totalDocs + stats.totalDeletedDocs) : 0;
      if (deleteRatio > highestDeleteRatio.ratio) {
        highestDeleteRatio = { name: indexName, ratio: deleteRatio };
      }
    });

    return {
      totalIndices,
      totalShards,
      totalSegments,
      totalDocs,
      totalDeletedDocs,
      totalSizeBytes,
      largestIndex,
      mostSegmentedIndex,
      highestDeleteRatio,
      nonCompoundSegments,
      avgSegmentSize: totalSegments > 0 ? totalSizeBytes / totalSegments : 0
    };
  }, [data.indices, indexStats]);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(2) + '%';
  };

  // Identify potential issues
  const identifyIssues = () => {
    const issues = [];
    
    // Check for high delete ratio
    if (clusterStats.totalDeletedDocs / (clusterStats.totalDocs + clusterStats.totalDeletedDocs) > 0.1) {
      issues.push({
        severity: 'high',
        title: 'High Delete Ratio',
        description: 'Your indices have a high number of deleted documents. Consider running force merge to reclaim space.',
        action: 'Run force merge on affected indices'
      });
    }
    
    // Check for too many segments
    if (clusterStats.totalSegments > 1000) {
      issues.push({
        severity: 'medium',
        title: 'High Segment Count',
        description: 'Your cluster has a high number of segments which can impact search performance.',
        action: 'Consider force merging indices with many small segments'
      });
    }
    
    // Check for non-compound segments
    if (clusterStats.nonCompoundSegments > 50) {
      issues.push({
        severity: 'medium',
        title: 'Many Non-Compound Segments',
        description: 'Your cluster has many non-compound segments which can impact file descriptors usage.',
        action: 'Consider optimizing your merge policy'
      });
    }
    
    // Check for very large segments
    Object.entries(indexStats).forEach(([indexName, stats]) => {
      if (stats.avgSegmentSize > 5 * 1024 * 1024 * 1024) { // 5GB
        issues.push({
          severity: 'medium',
          title: 'Very Large Segments',
          description: `Index ${indexName} has very large segments which can impact recovery time.`,
          action: 'Consider adjusting your merge policy to limit segment size'
        });
      }
    });
    
    return issues;
  };

  const issues = identifyIssues();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Elasticsearch Segments Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Analyze segment distribution across your Elasticsearch cluster
        </p>

        {/* Search Bar */}
        <div className="relative max-w-md mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search indices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Cluster Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">Cluster Overview</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{clusterStats.totalIndices}</span>
              </div>
              <h3 className="text-gray-600 dark:text-gray-400 text-sm">Indices</h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <HardDrive className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{clusterStats.totalShards}</span>
              </div>
              <h3 className="text-gray-600 dark:text-gray-400 text-sm">Shards</h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{clusterStats.totalSegments}</span>
              </div>
              <h3 className="text-gray-600 dark:text-gray-400 text-sm">Segments</h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="bg-orange-100 dark:bg-orange-900/20 p-3 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatBytes(clusterStats.totalSizeBytes)}</span>
              </div>
              <h3 className="text-gray-600 dark:text-gray-400 text-sm">Total Size</h3>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Documents</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Documents:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{clusterStats.totalDocs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Deleted Documents:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{clusterStats.totalDeletedDocs.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Delete Ratio:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {formatPercentage(clusterStats.totalDeletedDocs / (clusterStats.totalDocs + clusterStats.totalDeletedDocs))}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Segments</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Average Segment Size:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{formatBytes(clusterStats.avgSegmentSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Non-Compound Segments:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{clusterStats.nonCompoundSegments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Largest Index:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{clusterStats.largestIndex.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Potential Issues */}
        {issues.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
              <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
              Potential Issues
            </h2>
            
            <div className="space-y-4">
              {issues.map((issue, index) => (
                <div 
                  key={index} 
                  className={`p-4 rounded-lg border ${
                    issue.severity === 'high' 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <h3 className={`text-sm font-semibold mb-1 ${
                    issue.severity === 'high' 
                      ? 'text-red-800 dark:text-red-300' 
                      : 'text-amber-800 dark:text-amber-300'
                  }`}>
                    {issue.title}
                  </h3>
                  <p className={`text-sm ${
                    issue.severity === 'high' 
                      ? 'text-red-700 dark:text-red-400' 
                      : 'text-amber-700 dark:text-amber-400'
                  }`}>
                    {issue.description}
                  </p>
                  <div className={`mt-2 text-sm font-medium ${
                    issue.severity === 'high'
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-amber-900 dark:text-amber-200'
                  }`}>
                    Recommended action: <span className="font-bold">{issue.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indices List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Indices</h2>
          </div>
          
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedIndices.map(([indexName, indexData]) => {
              const stats = indexStats[indexName];
              const isExpanded = expandedIndices.has(indexName);
              
              return (
                <div key={indexName} className="transition-all">
                  <button
                    onClick={() => toggleIndex(indexName)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <Database className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {indexName}
                        </h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-700 dark:text-gray-400">
                            {formatBytes(stats.totalSizeBytes)}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-400">
                            {stats.totalDocs.toLocaleString()} docs
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-400">
                            {stats.segmentCount} segments
                          </span>
                        </div>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Index Statistics</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Total Documents:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.totalDocs.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Deleted Documents:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.totalDeletedDocs.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Total Size:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{formatBytes(stats.totalSizeBytes)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Segments:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.segmentCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Non-Compound Segments:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.nonCompoundSegments}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Version Information</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Oldest Version:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.oldestVersion}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Newest Version:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.newestVersion}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Max Generation:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.maxGeneration}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Average Segment Size:</span>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{formatBytes(stats.avgSegmentSize)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Shards */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Shards</h4>
                        
                        {Object.entries(indexData.shards).map(([shardId, shards]) => (
                          <div key={`${indexName}-${shardId}`} className="space-y-2">
                            {shards.map((shard, shardIndex) => {
                              const shardKey = `${indexName}-${shardId}-${shardIndex}`;
                              const isShardExpanded = expandedShards.has(shardKey);
                              
                              return (
                                <div key={shardKey} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                                  <button
                                    onClick={() => toggleShard(shardKey)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className={`p-1.5 rounded-md ${
                                        shard.routing.primary 
                                          ? 'bg-green-100 dark:bg-green-900/20' 
                                          : 'bg-blue-100 dark:bg-blue-900/20'
                                      }`}>
                                        <HardDrive className={`w-4 h-4 ${
                                          shard.routing.primary 
                                            ? 'text-green-600 dark:text-green-400' 
                                            : 'text-blue-600 dark:text-blue-400'
                                        }`} />
                                      </div>
                                      <div>
                                        <span className="font-medium text-gray-800 dark:text-gray-200">
                                          Shard {shardId} {shard.routing.primary ? '(Primary)' : '(Replica)'}
                                        </span>
                                        <div className="flex items-center space-x-3 mt-0.5">
                                          <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {shard.num_search_segments} search segments
                                          </span>
                                          <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {shard.num_committed_segments} committed segments
                                          </span>
                                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                                            shard.routing.state === 'STARTED' 
                                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                          }`}>
                                            {shard.routing.state}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {isShardExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                    )}
                                  </button>

                                  {isShardExpanded && (
                                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                                      <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                          <thead className="bg-gray-50 dark:bg-gray-700">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Segment</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Generation</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Docs</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Deleted</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Version</th>
                                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                            {Object.entries(shard.segments)
                                              .sort(([, a], [, b]) => b.size_in_bytes - a.size_in_bytes)
                                              .map(([segmentId, segment]) => (
                                                <tr key={segmentId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-gray-200">{segmentId}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{segment.generation}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{segment.num_docs.toLocaleString()}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{segment.deleted_docs.toLocaleString()}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{segment.size} ({formatBytes(segment.size_in_bytes)})</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-1">
                                                      {segment.committed && (
                                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                                          Committed
                                                        </span>
                                                      )}
                                                      {segment.search && (
                                                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
                                                          Searchable
                                                        </span>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">{segment.version}</td>
                                                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                      segment.compound 
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                                                    }`}>
                                                      {segment.compound ? 'Compound' : 'Non-Compound'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}