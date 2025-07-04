/**
 * GraphState.js - Tracks and manages graph partitions and debugging state
 * 
 * Maintains the state of graph partitions for debugging and visualization purposes.
 * Provides APIs for tracking graph splits, highlighting sections, and managing debugging data.
 */

import { GraphUtils } from './GraphUtils.js';

/**
 * Graph state manager for tracking partitions and debugging
 */
export class GraphState {
  constructor() {
    /** @type {Array<Object>} Original complete graph snapshots */
    this.snapshots = [];
    
    /** @type {Array<Object>} Current available graph partitions */
    this.currentPartitions = [];
    
    /** @type {Array<Object>} History of all graph operations */
    this.operationHistory = [];
    
    /** @type {Map<string, Object>} Metadata for each partition */
    this.partitionMetadata = new Map();
    
    /** @type {Object|null} Currently highlighted partition */
    this.highlightedPartition = null;
    
    /** @type {number} Counter for unique partition IDs */
    this.partitionIdCounter = 0;
    
    /** @type {Array<Function>} Event listeners for state changes */
    this.listeners = [];
    
    this.settings = {};
    console.log('GraphState: Initialized graph state manager');
  }

  /**
   * Initialize with the original complete graph
   * @param {Object} originalGraph - The initial complete graph data
   * @param {Object} settings - Graph generation settings
   */
  initialize(originalGraph, settings = {}) {
    this.reset();
    
    const snapshot = {
      id: 'original',
      timestamp: new Date().toISOString(),
      graph: GraphUtils.createDeepCopyOfGraph(originalGraph),
      settings: { ...settings },
      description: 'Original complete graph'
    };
    console.log(snapshot);
    
    this.snapshots.push(snapshot);
    
    // Create initial partition
    const initialPartition = this._createPartition(
      GraphUtils.createDeepCopyOfGraph(originalGraph),
      'initial',
      'Complete original graph'
    );
    
    this.currentPartitions = [initialPartition];
    
    this._recordOperation('initialize', {
      description: 'Initialized graph state with original graph',
      partitionCount: 1,
      vertexCount: initialPartition.graph.circumcenters.filter(v => v !== null).length
    });
    
    this._notifyListeners('initialized', { initialPartition });
    console.log(`GraphState: Initialized with ${initialPartition.graph.circumcenters.length} vertices`);
  }

  /**
   * Split a graph partition by removing a path of vertices (generic splitting)
   * @param {string} partitionId - ID of partition to split
   * @param {Array<number>} pathVertices - Array of vertex indices that form the splitting path
   * @param {Object} splitMetadata - Metadata about what's causing the split
   * @returns {Array<Object>} New partitions created from the split
   */
  splitGraphByPath(partitionId, pathVertices, splitMetadata = {}) {
    console.log(`GraphState: Splitting partition ${partitionId} by path of ${pathVertices.length} vertices`);
    
    // Find the partition to split
    const partitionIndex = this.currentPartitions.findIndex(p => p.id === partitionId);
    if (partitionIndex === -1) {
      console.error(`GraphState: Partition ${partitionId} not found for splitting`);
      return [];
    }
    
    const targetPartition = this.currentPartitions[partitionIndex];
    
    // Remove vertices from the graph
    GraphUtils.removeUsedVerticesFromGraph(targetPartition.graph, pathVertices);
    
    // Find connected subgraphs in the remaining graph  
    const newSubgraphs = GraphUtils.findConnectedSubgraphs(targetPartition.graph);
    
    // Remove the original partition
    this.currentPartitions.splice(partitionIndex, 1);
    
    // Create new partitions from subgraphs
    const newPartitions = newSubgraphs.map((subgraph, index) => 
      this._createPartition(
        subgraph,
        `${splitMetadata.featureType || 'split'}-${splitMetadata.featureIndex || 0}-${index}`,
        `${splitMetadata.description || 'Split'} ${index} from ${targetPartition.description}`,
        {
          splitFeatureType: splitMetadata.featureType,
          splitFeatureIndex: splitMetadata.featureIndex,
          splitPath: [...pathVertices],
          parentPartition: partitionId,
          splitIndex: index,
          ...splitMetadata.additionalData
        }
      )
    );
    
    // Add new partitions to current set
    this.currentPartitions.push(...newPartitions);
    
    // Record the operation
    this._recordOperation('graph_split', {
      splitType: splitMetadata.featureType || 'unknown',
      featureIndex: splitMetadata.featureIndex,
      parentPartition: partitionId,
      pathLength: pathVertices.length,
      resultingPartitions: newPartitions.length,
      description: splitMetadata.description || `Split graph into ${newPartitions.length} partitions`
    });
    
    // Notify listeners
    this._notifyListeners('graph_split', {
      splitType: splitMetadata.featureType,
      featureIndex: splitMetadata.featureIndex,
      parentPartition: partitionId,
      newPartitions,
      splitPath: pathVertices,
      splitMetadata
    });
    
    console.log(`GraphState: Split complete, created ${newPartitions.length} new partitions`);
    return newPartitions;
  }
  
  /**
   * Get the largest available partition for feature generation
   * @returns {Object|null} Largest partition or null if none available
   */
  getLargestPartition() {
    if (this.currentPartitions.length === 0) return null;
    
    const largestIndex = GraphUtils.findLargestGraph(this.currentPartitions.map(p => p.graph));
    return this.currentPartitions[largestIndex];
  }
  
  /**
   * Get partitions filtered by criteria
   * @param {Function} filterFn - Filter function to apply to partitions
   * @returns {Array<Object>} Filtered partitions
   */
  getPartitionsBy(filterFn) {
    return this.currentPartitions.filter(filterFn);
  }

  /**
   * Get all current graph partitions with metadata
   * @returns {Array<Object>} Array of partition objects with metadata
   */
  getCurrentPartitions() {
    return this.currentPartitions.map(partition => ({
      ...partition,
      centroid: GraphUtils.determineCentroid(partition.graph),
      stats: GraphUtils.validateGraphData(partition.graph).stats
    }));
  }

  /**
   * Get partition by ID
   * @param {string} partitionId - Partition ID to retrieve
   * @returns {Object|null} Partition object or null if not found
   */
  getPartition(partitionId) {
    return this.currentPartitions.find(p => p.id === partitionId) || null;
  }

  /**
   * Highlight a specific partition for visualization
   * @param {string} partitionId - ID of partition to highlight
   * @returns {Object|null} Highlighted partition or null if not found
   */
  highlightPartition(partitionId) {
    const partition = this.getPartition(partitionId);
    if (!partition) {
      console.warn(`GraphState: Partition '${partitionId}' not found`);
      return null;
    }
    
    this.highlightedPartition = partition;
    this._notifyListeners('partition_highlighted', { partition });
    console.log(`GraphState: Highlighted partition '${partitionId}'`);
    return partition;
  }

  /**
   * Clear current partition highlighting
   */
  clearHighlight() {
    if (this.highlightedPartition) {
      const previousPartition = this.highlightedPartition;
      this.highlightedPartition = null;
      this._notifyListeners('highlight_cleared', { previousPartition });
      console.log('GraphState: Cleared partition highlight');
    }
  }

  /**
   * Get operation history for debugging
   * @returns {Array<Object>} Array of operation records
   */
  getOperationHistory() {
    return [...this.operationHistory];
  }

  /**
   * Get detailed statistics about current state
   * @returns {Object} Comprehensive state statistics
   */
  getStatistics() {
    const totalVertices = this.currentPartitions.reduce((sum, partition) => 
      sum + partition.graph.circumcenters.filter(v => v !== null).length, 0
    );
    
    const partitionSizes = this.currentPartitions.map(partition => 
      partition.graph.circumcenters.filter(v => v !== null).length
    );
    
    return {
      totalPartitions: this.currentPartitions.length,
      totalVertices,
      largestPartition: Math.max(...partitionSizes, 0),
      smallestPartition: Math.min(...partitionSizes, Infinity),
      averagePartitionSize: totalVertices / this.currentPartitions.length || 0,
      operationsCount: this.operationHistory.length,
      hasHighlight: !!this.highlightedPartition,
      highlightedPartitionId: this.highlightedPartition?.id || null
    };
  }

  /**
   * Add event listener for state changes
   * @param {Function} callback - Callback function to call on state changes
   */
  addEventListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove event listener
   * @param {Function} callback - Callback function to remove
   */
  removeEventListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Reset the entire graph state
   */
  reset() {
    this.snapshots = [];
    this.currentPartitions = [];
    this.operationHistory = [];
    this.partitionMetadata.clear();
    this.highlightedPartition = null;
    this.partitionIdCounter = 0;
    this._notifyListeners('reset', {});
    console.log('GraphState: Reset all state');
  }

  /**
   * Create a new partition object with metadata
   * @private
   */
  _createPartition(graph, type, description, additionalMetadata = {}) {
    const id = `${type}-${this.partitionIdCounter++}`;
    const partition = {
      id,
      type,
      description,
      graph: graph,
      createdAt: new Date().toISOString(),
      metadata: {
        vertexCount: graph.circumcenters.filter(v => v !== null).length,
        edgeCount: graph.voronoiEdges.size,
        ...additionalMetadata
      }
    };
    
    this.partitionMetadata.set(id, partition.metadata);
    return partition;
  }

  /**
   * Find partition ID for a given graph object
   * @private
   */
  _findPartitionId(targetGraph) {
    const partition = this.currentPartitions.find(p => p.graph === targetGraph);
    return partition ? partition.id : 'unknown';
  }

  /**
   * Record an operation in the history
   * @private
   */
  _recordOperation(type, details) {
    const operation = {
      type,
      timestamp: new Date().toISOString(),
      details,
      stateSnapshot: {
        partitionCount: this.currentPartitions.length,
        totalVertices: this.currentPartitions.reduce((sum, p) => 
          sum + p.graph.circumcenters.filter(v => v !== null).length, 0
        )
      }
    };
    
    this.operationHistory.push(operation);
  }

  /**
   * Notify all listeners of state changes
   * @private
   */
  _notifyListeners(eventType, data) {
    this.listeners.forEach(callback => {
      try {
        callback(eventType, data, this);
      } catch (error) {
        console.error('GraphState: Error in event listener:', error);
      }
    });
  }
}