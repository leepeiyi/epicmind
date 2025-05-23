<template>
    <div>
      <Navbar />
      <div class="main-header">
        <h1 class="main-title">📁 Paper Logs Dashboard</h1>
        <p class="description">Click a paper to view its upload and processing logs.</p>
      </div>
  
      <div class="log-dashboard">
        <!-- Sidebar: Paper List -->
        <div class="paper-list">
          <h3>Recent Papers</h3>
          <ul>
            <li
              v-for="paper in papers"
              :key="paper.paper_name"
              :class="{ active: selectedPaper === paper.paper_name }"
              @click="selectPaper(paper.paper_name)"
            >
              {{ paper.paper_name }}
              <span v-if="paper.topic_label" class="badge">{{ paper.topic_label }}</span>
              <div class="timestamp">{{ formatDate(paper.last_uploaded) }}</div>
            </li>
          </ul>
        </div>
  
        <!-- Main panel: Logs -->
        <div class="log-panel">
          <h3 v-if="selectedPaper">Logs for <strong>{{ selectedPaper }}</strong></h3>
          <div v-if="loadingLogs" class="loading">Loading logs...</div>
          <div v-else-if="logs.length === 0">No logs found for this paper.</div>
          <ul v-else class="log-list">
            <li v-for="log in logs" :key="log.id" class="log-entry" :class="log.log_type">
              <div class="log-header">
                <span class="timestamp">{{ formatDate(log.timestamp) }}</span>
                <strong>[{{ log.log_type.toUpperCase() }}]</strong>
                <span v-if="log.question_number">Q{{ log.question_number }}:</span>
              </div>
              <div class="log-message">{{ log.message }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </template>
  
  <script>
  import axios from "axios";
  import Navbar from "../components/Navbar.vue";
  
  export default {
    name: "PaperLogViewer",
    components: { Navbar },
    data() {
      return {
        papers: [],
        selectedPaper: null,
        logs: [],
        loadingLogs: false,
      };
    },
    async mounted() {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/paper/recent`);
        this.papers = res.data.recent || [];
      } catch (err) {
        console.error("❌ Failed to load papers:", err);
      }
    },
    methods: {
      async selectPaper(paperName) {
        this.selectedPaper = paperName;
        this.logs = [];
        this.loadingLogs = true;
        try {
          const res = await axios.get(`${API_BASE_URL}/api/paper/logs/${paperName}`);
          this.logs = res.data.logs || [];
        } catch (err) {
          console.error("❌ Failed to load logs:", err);
        } finally {
          this.loadingLogs = false;
        }
      },
      formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleString();
      },
    },
  };
  </script>
  
  <style scoped>
  .main-header {
    padding: 20px;
    border-bottom: 1px solid #ddd;
  }
  .main-title {
    font-size: 24px;
    margin: 0 0 10px 0;
  }
  .description {
    color: #666;
  }
  .log-dashboard {
    display: flex;
    padding: 20px;
    gap: 20px;
  }
  .paper-list {
    width: 300px;
    background: #f4f4f4;
    padding: 15px;
    border-radius: 6px;
  }
  .paper-list h3 {
    margin-bottom: 10px;
  }
  .paper-list ul {
    list-style: none;
    padding: 0;
  }
  .paper-list li {
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 4px;
    cursor: pointer;
    background: white;
    border-left: 5px solid transparent;
  }
  .paper-list li:hover {
    background: #f0f0f0;
  }
  .paper-list li.active {
    border-left-color: #3498db;
    font-weight: bold;
    background: #e6f0fb;
  }
  .badge {
    background: #eee;
    border-radius: 5px;
    padding: 3px 6px;
    margin-left: 6px;
    font-size: 0.85em;
  }
  .timestamp {
    font-size: 0.8em;
    color: #999;
  }
  .log-panel {
    flex: 1;
  }
  .log-list {
    list-style: none;
    padding: 0;
  }
  .log-entry {
    background: #f9f9f9;
    border-left: 5px solid #bbb;
    margin-bottom: 14px;
    padding: 12px 15px;
    border-radius: 6px;
  }
  .log-entry.info {
    border-color: #4caf50;
  }
  .log-entry.error {
    border-color: #f44336;
  }
  .log-header {
    margin-bottom: 4px;
  }
  .log-message {
    font-family: monospace;
    white-space: pre-wrap;
  }
  .loading {
    font-style: italic;
    color: #777;
  }
  </style>
  