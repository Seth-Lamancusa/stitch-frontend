<template>
  <div class="stitch-playground">
    <div class="header">
      <h2>Stitch UI Playground</h2>
      <div class="controls">
        <button v-for="msg in rootMessages" :key="msg.id" @click="startFrom(msg.id)">
          Load {{ msg.id }}
        </button>
      </div>
    </div>
    
    <div class="thread-container">
      <div v-for="node in renderedPath" :key="node.id" class="mock-message-wrapper">
        
        <!-- Link Switcher -->
        <LinkSwitcher
          v-if="shouldShowLinkSwitcher(node)"
          :activeParentId="node.activeParentId"
          :replyParentId="node.parent_id"
          :stitchParentIds="node.stitch_parent_ids"
          @switchParent="(parentId) => handleSwitchParent(node.id, parentId)"
        />
        
        <!-- Fake Message Node -->
        <div class="mock-message-node">
          <div class="author-tag">@{{ node.author.user_tag }}</div>
          <div class="content">{{ node.content }}</div>
          
          <div class="mock-metadata">
            <span v-if="node.parent_id">parent: {{ node.parent_id }}</span>
            <span v-if="node.child_ids.length">children: [{{ node.child_ids.join(', ') }}]</span>
            <span v-if="node.stitch_parent_ids.length" class="stitch-pill">stitch_parent: [{{ node.stitch_parent_ids.join(', ') }}]</span>
            <span v-if="node.stitch_child_ids.length" class="stitch-pill">stitch_child: [{{ node.stitch_child_ids.join(', ') }}]</span>
          </div>
          
          <!-- Mock Sibling Navigator -->
          <div v-if="hasMultipleOutgoing(node)" class="mock-sibling-navigator" :class="{ 'stitch-active': isOutgoingStitch(node) }">
            <button class="nav-btn" @click="cycleOutgoing(node.id, -1)">◀</button>
            <span class="nav-dots">
              <span 
                v-for="(childId, index) in getAllOutgoing(node)" 
                :key="childId"
                class="dot"
                :class="{ 
                  'active': childId === node.activeChildId,
                  'is-stitch': isStitchId(node, childId)
                }"
              ></span>
            </span>
            <button class="nav-btn" @click="cycleOutgoing(node.id, 1)">▶</button>
          </div>
          
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { mockMessages } from '../../utils/mock/stitchMockData.js';
import LinkSwitcher from '../../components/LinkSwitcher.vue';

// Local state tracking paths.
// In Vuex this would be branch_child and branch_parent.
const branchChildMap = ref({});
const branchParentMap = ref({});
const rootMessageId = ref('msg_A1');

// Initialize defaults
const initMaps = () => {
  for (const id in mockMessages) {
    const msg = mockMessages[id];
    
    // Default child: reply children first, then stitch children
    const allOutgoing = [...(msg.child_ids || []), ...(msg.stitch_child_ids || [])];
    if (allOutgoing.length > 0) {
      branchChildMap.value[id] = allOutgoing[0];
    }
    
    // Default parent: reply parent first, then stitch parents
    const allIncoming = [];
    if (msg.parent_id) allIncoming.push(msg.parent_id);
    if (msg.stitch_parent_ids) allIncoming.push(...msg.stitch_parent_ids);
    
    if (allIncoming.length > 0) {
      branchParentMap.value[id] = allIncoming[0];
    }
  }
};

onMounted(() => {
  initMaps();
});

const startFrom = (id) => {
  rootMessageId.value = id;
};

// Root messages for the buttons
const rootMessages = computed(() => {
  return Object.values(mockMessages).filter(m => m.parent_id === null && m.stitch_parent_ids.length === 0);
});

// Calculate the 1D path from the current root up to leaf
const renderedPath = computed(() => {
  const path = [];
  
  // To avoid infinite loops in mock
  const visited = new Set();
  
  // First, trace UP from the selected root (if we selected a node deep in the graph)
  // Actually, for simplicity, let's just trace DOWN from whatever root is selected.
  // If the user clicks "Load B3", we should trace UP from B3 to find the top, then render down.
  
  let currentId = rootMessageId.value;
  
  // TRACE UP
  let topNodeId = currentId;
  let safety1 = 100;
  while(topNodeId && mockMessages[topNodeId] && safety1-- > 0) {
    const msg = mockMessages[topNodeId];
    // Use branchParentMap to go up!
    const parentId = branchParentMap.value[topNodeId];
    if (!parentId) break; // Reached absolute top
    topNodeId = parentId;
  }
  
  // TRACE DOWN
  currentId = topNodeId;
  let safety2 = 100;
  while(currentId && mockMessages[currentId] && safety2-- > 0) {
    if (visited.has(currentId)) {
      console.warn("Loop detected!", currentId);
      break;
    }
    visited.add(currentId);
    
    const msg = mockMessages[currentId];
    
    // Enrich with path state
    const enrichedMsg = {
      ...msg,
      activeParentId: branchParentMap.value[currentId] || null,
      activeChildId: branchChildMap.value[currentId] || null
    };
    
    path.push(enrichedMsg);
    
    // Continue down via branch_child
    const nextId = branchChildMap.value[currentId];
    if (!nextId) break; // Leaf
    currentId = nextId;
  }
  
  return path;
});

// Link Switcher logic
const shouldShowLinkSwitcher = (node) => {
  // If this is the very first node rendered, only show if we got here via a stitch OR we have incoming stitches and NO reply parent
  // In the real app, "is at top of viewport" vs "is mid-thread" matters.
  // For the playground, if the activeParent is a stitch, show it.
  const isStitchActive = node.activeParentId !== node.parent_id && node.activeParentId !== null;
  const hasStitches = node.stitch_parent_ids.length > 0;
  
  return isStitchActive || hasStitches;
};

const handleSwitchParent = (nodeId, newParentId) => {
  branchParentMap.value[nodeId] = newParentId;
  
  // If we switch parents, we effectively change the branch above us.
  // To keep the view stable, we anchor on the current node.
  // Our renderedPath computed property traces UP from rootMessageId, so we just set rootMessageId = nodeId!
  rootMessageId.value = nodeId;
};

// Sibling navigator logic
const getAllOutgoing = (node) => {
  return [...(node.child_ids || []), ...(node.stitch_child_ids || [])];
};

const hasMultipleOutgoing = (node) => {
  return getAllOutgoing(node).length > 1;
};

const isStitchId = (node, id) => {
  return node.stitch_child_ids.includes(id);
};

const isOutgoingStitch = (node) => {
  return isStitchId(node, node.activeChildId);
};

const cycleOutgoing = (nodeId, direction) => {
  const node = mockMessages[nodeId];
  const allOutgoing = getAllOutgoing(node);
  if (allOutgoing.length <= 1) return;
  
  const currentIdx = allOutgoing.indexOf(branchChildMap.value[nodeId]);
  let nextIdx = currentIdx + direction;
  
  if (nextIdx >= allOutgoing.length) nextIdx = 0;
  if (nextIdx < 0) nextIdx = allOutgoing.length - 1;
  
  const nextChildId = allOutgoing[nextIdx];
  branchChildMap.value[nodeId] = nextChildId;
  
  // When we cycle a child, we need to ensure that the chosen child's active parent points back to us!
  branchParentMap.value[nextChildId] = nodeId;
  
  // Set root to current node to re-render from here down
  rootMessageId.value = nodeId;
};

</script>

<style scoped>
.stitch-playground {
  padding: 2rem;
  background-color: var(--color-background, #f5f5f5);
  min-height: 100vh;
  font-family: sans-serif;
  color: #333;
}

.header {
  margin-bottom: 2rem;
  border-bottom: 1px solid #ddd;
  padding-bottom: 1rem;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #eee;
}

.thread-container {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mock-message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mock-message-node {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  width: 100%;
  position: relative;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.author-tag {
  font-weight: bold;
  font-size: 0.9em;
  color: #555;
  margin-bottom: 0.5rem;
}

.content {
  margin-bottom: 1rem;
  line-height: 1.4;
}

.mock-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.75em;
  color: #888;
  margin-top: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid #eee;
}

.stitch-pill {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Mock Sibling Navigator */
.mock-sibling-navigator {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  background: white;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}

.mock-sibling-navigator.stitch-active {
  border-color: #4caf50;
  box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2);
}

.nav-btn {
  background: transparent;
  border: none;
  font-size: 0.8em;
  padding: 2px 6px;
  color: #666;
}

.mock-sibling-navigator.stitch-active .nav-btn {
  color: #4caf50;
}

.nav-dots {
  display: flex;
  gap: 4px;
  padding: 0 4px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ccc;
}

.dot.active {
  background: #666;
}

.dot.is-stitch {
  border: 1px solid #4caf50;
  background: transparent;
}

.dot.is-stitch.active {
  background: #4caf50;
}
</style>
