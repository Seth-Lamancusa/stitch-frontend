import { hierarchy } from 'd3-hierarchy';
import { scaleLinear } from 'd3-scale';

/**
 * Core layout algorithms for thread graph visualization
 * Implements Sugiyama layered DAG layout with conversation-aware positioning
 */

/**
 * Calculate positions for all nodes in a message DAG
 * @param {Array} messages - Array of message objects with parent_id relationships
 * @param {Object} options - Layout configuration options
 * @returns {Map} Map of messageId -> {x, y, layer} positions
 */
export function calculateLayout(messages, options = {}) {
  const config = {
    layerHeight: 100,
    nodeSpacing: 240,
    rootSpacing: 150,
    maxWidth: 1200,
    ...options
  };

  // Build message lookup map
  const messageMap = new Map();
  messages.forEach(msg => messageMap.set(msg.id, msg));

  // Find root messages (no parent_id or parent not in set)
  const rootMessages = messages.filter(msg => 
    !msg.parent_id || !messageMap.has(msg.parent_id)
  );

  if (rootMessages.length === 0) {
    return new Map();
  }

  // Create position map
  const positions = new Map();
  let globalY = 0;

  // Process each root as a separate conversation tree
  rootMessages.forEach((rootMsg, rootIndex) => {
    const treePositions = layoutConversationTree(rootMsg, messageMap, config);
    
    // Offset each tree vertically
    const treeOffset = rootIndex * config.rootSpacing;
    treePositions.forEach((pos, msgId) => {
      positions.set(msgId, {
        ...pos,
        y: pos.y + treeOffset
      });
    });

    globalY = Math.max(globalY, Math.max(...Array.from(treePositions.values()).map(p => p.y)) + config.rootSpacing);
  });

  return positions;
}

/**
 * Layout a single conversation tree using Sugiyama method
 * @param {Object} rootMessage - Root message of the conversation
 * @param {Map} messageMap - Map of all messages by ID
 * @param {Object} config - Layout configuration
 * @returns {Map} Positions for this tree
 */
function layoutConversationTree(rootMessage, messageMap, config) {
  // Build tree structure
  const tree = buildMessageTree(rootMessage, messageMap);
  
  // Assign layers (depth levels)
  const layers = assignLayers(tree);
  
  // Calculate horizontal positions within each layer
  const positions = calculateHorizontalPositions(layers, config);
  
  return positions;
}

/**
 * Build a tree structure from a root message
 * @param {Object} rootMessage - Root message
 * @param {Map} messageMap - All messages map
 * @returns {Object} Tree node with children
 */
function buildMessageTree(rootMessage, messageMap) {
  const visited = new Set();
  
  function buildNode(message) {
    if (visited.has(message.id)) {
      return null; // Prevent cycles
    }
    visited.add(message.id);
    
    const children = Array.from(messageMap.values())
      .filter(msg => msg.parent_id === message.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(buildNode)
      .filter(Boolean);
    
    return {
      message,
      children,
      id: message.id
    };
  }
  
  return buildNode(rootMessage);
}

/**
 * Assign layer numbers to each node (depth-first)
 * @param {Object} tree - Tree structure
 * @returns {Array} Array of layers, each containing nodes
 */
function assignLayers(tree) {
  const layers = [];
  
  function traverse(node, depth = 0) {
    if (!layers[depth]) {
      layers[depth] = [];
    }
    
    node.layer = depth;
    layers[depth].push(node);
    
    node.children.forEach(child => traverse(child, depth + 1));
  }
  
  traverse(tree);
  return layers;
}

/**
 * Calculate horizontal positions for nodes in each layer
 * @param {Array} layers - Array of layers containing nodes
 * @param {Object} config - Layout configuration
 * @returns {Map} Position map
 */
function calculateHorizontalPositions(layers, config) {
  const positions = new Map();
  
  // Pass 1: assign provisional positions
  layers.forEach((layer, layerIndex) => {
    const layerY = layerIndex * config.layerHeight;
    const siblingsByParent = new Map();

    // Bucket nodes by parent_id
    layer.forEach(node => {
      const parentId = node.message.parent_id || '__root__';
      if (!siblingsByParent.has(parentId)) siblingsByParent.set(parentId, []);
      siblingsByParent.get(parentId).push(node);
    });

    // For each sibling group
    siblingsByParent.forEach(nodes => {
      // Sort siblings by timestamp
      nodes.sort((a, b) => new Date(a.message.timestamp) - new Date(b.message.timestamp));

      // Determine center X: align under parent if present, else center of layer
      let centerX = config.maxWidth / 2;
      const parentId = nodes[0].message.parent_id;
      if (parentId && positions.has(parentId)) {
        centerX = positions.get(parentId).x;
      }

      if (nodes.length === 1) {
        // Single child aligns vertically under parent
        positions.set(nodes[0].id, {
          x: centerX,
          y: layerY,
          layer: layerIndex,
          message: nodes[0].message
        });
      } else {
        // Multiple children spread horizontally around centerX
        const totalWidth = (nodes.length - 1) * config.nodeSpacing;
        const startX = centerX - totalWidth / 2;
        nodes.forEach((n, i) => {
          positions.set(n.id, {
            x: startX + i * config.nodeSpacing,
            y: layerY,
            layer: layerIndex,
            message: n.message
          });
        });
      }
    });
  });
  
  return positions;
}

/**
 * Get the earliest timestamp among a node and all its descendants
 * @param {Object} node - Tree node
 * @returns {Date} Earliest timestamp
 */
function getEarliestDescendantTime(node) {
  let earliest = new Date(node.message.timestamp);
  
  function traverse(n) {
    const nodeTime = new Date(n.message.timestamp);
    if (nodeTime < earliest) {
      earliest = nodeTime;
    }
    n.children.forEach(traverse);
  }
  
  traverse(node);
  return earliest;
}

/**
 * Optimize layout by reducing edge crossings
 * @param {Map} positions - Current positions
 * @param {Array} messages - Message array
 * @returns {Map} Optimized positions
 */
export function optimizeLayout(positions, messages) {
  // For Phase 1, return positions as-is
  // Future optimization: implement crossing reduction
  return positions;
}

/**
 * Calculate bounding box for the entire layout
 * @param {Map} positions - Node positions
 * @returns {Object} {minX, minY, maxX, maxY, width, height}
 */
export function calculateBounds(positions) {
  if (positions.size === 0) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
  }
  
  const allPositions = Array.from(positions.values());
  const minX = Math.min(...allPositions.map(p => p.x)) - 60; // Node width buffer
  const maxX = Math.max(...allPositions.map(p => p.x)) + 60;
  const minY = Math.min(...allPositions.map(p => p.y)) - 30; // Node height buffer
  const maxY = Math.max(...allPositions.map(p => p.y)) + 30;
  
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
} 