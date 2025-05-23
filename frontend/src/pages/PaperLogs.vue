<template>
    <div>
        <Navbar />
        <div class="main-header">
            <h1 class="main-title">📁 Paper Logs Dashboard</h1>
            <p class="description">Filter by type and click a paper to view its upload and processing logs.</p>

        </div>

        <div class="log-dashboard">
            <!-- Sidebar: Paper List -->
            <div class="paper-list">
                <div class="filter-bar">
                    <label for="typeFilter">Filter by type:</label>
                    <select id="typeFilter" v-model="typeFilter">
                        <option value="all">All Papers</option>
                        <option value="exam">Exam Papers</option>
                        <option value="topical">Topical Papers</option>
                    </select>
                </div>
                <ul>
                    <li v-for="paper in filteredPapers" :key="paper.paper_name"
                        :class="[{ active: selectedPaper === paper.paper_name }, paper.paper_type]"
                        @click="selectPaper(paper.paper_name)">
                        {{ paper.paper_name }}
                        <div class="meta-line">
                            <span v-if="paper.topic_label" class="badge topic">{{ paper.topic_label }}</span>
                            <span class="badge type" :class="paper.paper_type">{{ paper.paper_type }}</span>
                        </div>
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
import API_BASE_URL from "../config/api.js";

export default {
    name: "PaperLogViewer",
    components: { Navbar },
    data() {
        return {
            papers: [],
            typeFilter: "all",
            selectedPaper: null,
            logs: [],
            loadingLogs: false,
        };
    },
    computed: {
        filteredPapers() {
            if (this.typeFilter === "all") return this.papers;
            return this.papers.filter(p => p.paper_type === this.typeFilter);
        },
    },
    async mounted() {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/paper/all-papers`);
            this.papers = res.data.papers || [];
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
    font-family: Arial, Helvetica, sans-serif;
}

.main-title {
    font-size: 24px;
    margin-bottom: 0.5rem;
}

.description {
    color: #666;
    margin-bottom: 1rem;
}

.filter-bar {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 1rem;
}

.filter-bar select {
    padding: 4px 8px;
    border-radius: 6px;
}

.log-dashboard {
    display: flex;
    padding: 20px;
    gap: 20px;
}

.paper-list {
    width: 420px;
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
    padding: 12px;
    margin-bottom: 12px;
    border-radius: 6px;
    cursor: pointer;
    background: white;
    border-left: 5px solid transparent;
    transition: background 0.2s;
}

.paper-list li:hover {
    background: #f0f0f0;
}

.paper-list li.active {
    border-left-color: #3498db;
    font-weight: bold;
    background: #e6f0fb;
}

.meta-line {
    margin-top: 6px;
}

.badge {
    display: inline-block;
    border-radius: 4px;
    padding: 3px 6px;
    margin-right: 6px;
    font-size: 0.75rem;
}

.badge.topic {
    background: #dfffe0;
    color: #2d6a2e;
}

.badge.type.exam {
    background: #ffe6e6;
    color: #b10000;
}

.badge.type.topical {
    background: #e6f2ff;
    color: #004c99;
}

.timestamp {
    font-size: 0.8em;
    color: #999;
    margin-top: 4px;
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
