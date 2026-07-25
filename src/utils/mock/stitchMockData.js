// stitch-frontend/src/utils/mock/stitchMockData.js

export const mockMessages = {
  // ==========================================
  // THREAD A (Standard tree + outgoing link)
  // ==========================================
  'msg_A1': {
    id: 'msg_A1',
    content: "Thread A: Root message. I'm going to link to a new thread.",
    author: { display_name: "Alice", user_tag: "alice" },
    parent_id: null,
    child_ids: ['msg_A2'],
    stitch_parent_ids: [],
    stitch_child_ids: [],
    timestamp: "2024-05-08T10:00:00Z"
  },
  'msg_A2': {
    id: 'msg_A2',
    content: "Thread A: Reply 1. This has a reply child, AND it stitches out to Thread B.",
    author: { display_name: "Bob", user_tag: "bob" },
    parent_id: 'msg_A1',
    child_ids: ['msg_A3'],
    stitch_parent_ids: [],
    stitch_child_ids: ['msg_B1'], // Outgoing inter-thread link to root
    timestamp: "2024-05-08T10:05:00Z"
  },
  'msg_A3': {
    id: 'msg_A3',
    content: "Thread A: Leaf message. I also stitch out to Thread C.",
    author: { display_name: "Alice", user_tag: "alice" },
    parent_id: 'msg_A2',
    child_ids: [],
    stitch_parent_ids: [],
    stitch_child_ids: ['msg_C1'], // Outgoing inter-thread link from leaf
    timestamp: "2024-05-08T10:10:00Z"
  },

  // ==========================================
  // THREAD B (Linked Root + Intra-thread link)
  // ==========================================
  'msg_B1': {
    id: 'msg_B1',
    content: "Thread B: Root. I have an incoming stitch from Thread A. I also skip B2 and stitch directly to B3.",
    author: { display_name: "Charlie", user_tag: "charlie" },
    parent_id: null,
    child_ids: ['msg_B2'],
    stitch_parent_ids: ['msg_A2'], // Incoming link to root
    stitch_child_ids: ['msg_B3'],  // Intra-thread outgoing link
    timestamp: "2024-05-08T10:15:00Z"
  },
  'msg_B2': {
    id: 'msg_B2',
    content: "Thread B: Reply. Standard reply to B1.",
    author: { display_name: "Dave", user_tag: "dave" },
    parent_id: 'msg_B1',
    child_ids: ['msg_B3'],
    stitch_parent_ids: [],
    stitch_child_ids: [],
    timestamp: "2024-05-08T10:20:00Z"
  },
  'msg_B3': {
    id: 'msg_B3',
    content: "Thread B: Leaf. I have a reply parent (B2) AND an incoming intra-thread stitch from B1. I also stitch to C1.",
    author: { display_name: "Charlie", user_tag: "charlie" },
    parent_id: 'msg_B2',
    child_ids: [],
    stitch_parent_ids: ['msg_B1'], // Intra-thread incoming link
    stitch_child_ids: ['msg_C1'],  // Outgoing link to C1
    timestamp: "2024-05-08T10:25:00Z"
  },

  // ==========================================
  // THREAD C (Multiple incoming links, 0 outgoing)
  // ==========================================
  'msg_C1': {
    id: 'msg_C1',
    content: "Thread C: Root/Leaf. I have NO reply parent and NO reply children. But I have 2 incoming stitches (from A3 and B3).",
    author: { display_name: "Eve", user_tag: "eve" },
    parent_id: null,
    child_ids: [],
    stitch_parent_ids: ['msg_A3', 'msg_B3'], // Multiple incoming links
    stitch_child_ids: [],
    timestamp: "2024-05-08T10:30:00Z"
  }
};
