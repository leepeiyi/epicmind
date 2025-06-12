<template>
    <div>
        <Navbar />
        <div class="completion-logs-page">
            <h1>📊 Student Completion Logs</h1>
            <p class="subtitle">
                Track your students' quiz completion progress and send reminders for pending assignments.
            </p>

            <!-- Statistics Cards -->
            <div class="stats-cards">
                <div class="stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-content">
                        <h3>{{ completedCount }}</h3>
                        <p>Completed This Week</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⏳</div>
                    <div class="stat-content">
                        <h3>{{ pendingCount }}</h3>
                        <p>Pending Assignments</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-content">
                        <h3>{{ averageScore }}%</h3>
                        <p>Average Score</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">👥</div>
                    <div class="stat-content">
                        <h3>{{ totalStudents }}</h3>
                        <p>Active Students</p>
                    </div>
                </div>
            </div>

            <!-- Filter Section -->
            <div class="filter-section">
                <div class="filter-controls">
                    <select v-model="filterStatus" class="filter-select">
                        <option value="">All Assignments</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    
                    <select v-model="filterStudent" class="filter-select">
                        <option value="">All Students</option>
                        <option v-for="student in allStudents" :key="student.id" :value="student.id">
                            {{ student.name }}
                        </option>
                    </select>

                    <input type="date" v-model="filterDate" class="filter-date" />
                    
                    <button @click="refreshLogs" class="refresh-btn" :disabled="loading">
                        <RefreshCw class="icon" :class="{ 'spinning': loading }" />
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Completion Logs -->
            <div class="logs-section">
                <h3>📋 Recent Activity</h3>
                
                <div v-if="loading" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading completion logs...</p>
                </div>

                <div v-else-if="filteredLogs.length === 0" class="empty-state">
                    <p>No completion logs found for the selected filters.</p>
                </div>

                <div v-else class="logs-list">
                    <div v-for="log in filteredLogs" :key="log.id" class="log-item" 
                         :class="{ 'completed': log.completed, 'pending': !log.completed, 'overdue': isOverdue(log) }">
                        
                        <div class="log-content">
                            <div class="log-header">
                                <div class="student-info">
                                    <span class="student-name">{{ log.student_name }}</span>
                                    <span class="quiz-name">{{ log.quiz_name }}</span>
                                </div>
                                <div class="log-status">
                                    <span v-if="log.completed" class="status-badge completed">
                                        ✅ Completed
                                    </span>
                                    <span v-else-if="isOverdue(log)" class="status-badge overdue">
                                        🔴 Overdue
                                    </span>
                                    <span v-else class="status-badge pending">
                                        ⏳ Pending
                                    </span>
                                </div>
                            </div>

                            <div class="log-details">
                                <div class="assignment-info">
                                    <span class="assigned-date">
                                        Assigned: {{ formatDate(log.assigned_at) }}
                                    </span>
                                    <span v-if="log.due_date" class="due-date">
                                        Due: {{ formatDate(log.due_date) }}
                                    </span>
                                </div>
                                
                                <div v-if="log.completed" class="completion-info">
                                    <span class="completed-date">
                                        Completed: {{ formatDate(log.completed_at) }}
                                    </span>
                                    <span v-if="log.score !== null" class="score">
                                        Score: {{ log.score }}%
                                    </span>
                                </div>
                            </div>

                            <div class="quiz-meta">
                                <span class="subject">{{ log.subject }}</span>
                                <span class="level">{{ log.level }}</span>
                                <span class="question-count">{{ log.question_count }} questions</span>
                            </div>
                        </div>

                        <div class="log-actions">
                            <button v-if="!log.completed" 
                                    @click="sendReminder(log)" 
                                    class="remind-btn"
                                    :disabled="log.sending_reminder">
                                <Mail class="icon" />
                                <span v-if="log.sending_reminder">Sending...</span>
                                <span v-else>Remind</span>
                            </button>
                            
                            <button @click="viewQuizDetails(log)" class="view-btn">
                                <Eye class="icon" />
                                View Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bulk Actions -->
            <div v-if="pendingLogs.length > 0" class="bulk-actions">
                <h3>📤 Bulk Actions</h3>
                <div class="bulk-controls">
                    <button @click="sendBulkReminders" 
                            class="bulk-remind-btn"
                            :disabled="sendingBulkReminders">
                        <Mail class="icon" />
                        <span v-if="sendingBulkReminders">Sending Reminders...</span>
                        <span v-else>Send Reminders to All Pending ({{ pendingLogs.length }})</span>
                    </button>
                </div>
            </div>

            <!-- Success/Error Messages -->
            <div v-if="message" class="message" :class="messageType">
                {{ message }}
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { RefreshCw, Mail, Eye } from 'lucide-vue-next';
import API_BASE_URL from '../config/api.js';

export default {
    name: 'CompletionLogs',
    components: {
        Navbar,
        RefreshCw,
        Mail,
        Eye
    },
    data() {
        return {
            logs: [],
            allStudents: [],
            loading: false,
            sendingBulkReminders: false,
            
            // Filters
            filterStatus: '',
            filterStudent: '',
            filterDate: '',
            
            // Statistics
            completedCount: 0,
            pendingCount: 0,
            averageScore: 0,
            totalStudents: 0,
            
            // Messages
            message: '',
            messageType: 'success' // 'success' or 'error'
        };
    },
    computed: {
        filteredLogs() {
            let filtered = this.logs;

            if (this.filterStatus) {
                if (this.filterStatus === 'completed') {
                    filtered = filtered.filter(log => log.completed);
                } else if (this.filterStatus === 'pending') {
                    filtered = filtered.filter(log => !log.completed && !this.isOverdue(log));
                } else if (this.filterStatus === 'overdue') {
                    filtered = filtered.filter(log => !log.completed && this.isOverdue(log));
                }
            }

            if (this.filterStudent) {
                filtered = filtered.filter(log => log.student_id === parseInt(this.filterStudent));
            }

            if (this.filterDate) {
                const filterDate = new Date(this.filterDate);
                filtered = filtered.filter(log => {
                    const assignedDate = new Date(log.assigned_at);
                    return assignedDate.toDateString() === filterDate.toDateString();
                });
            }

            return filtered.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));
        },
        
        pendingLogs() {
            return this.logs.filter(log => !log.completed);
        }
    },
    async mounted() {
        await this.loadData();
    },
    methods: {
        async loadData() {
            this.loading = true;
            try {
                await Promise.all([
                    this.fetchCompletionLogs(),
                    this.fetchStudents(),
                    this.calculateStatistics()
                ]);
            } catch (error) {
                console.error('❌ Error loading data:', error);
                this.showMessage('Failed to load completion logs', 'error');
            } finally {
                this.loading = false;
            }
        },

        async fetchCompletionLogs() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/completion-log`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) throw new Error('Failed to fetch completion logs');

                const data = await response.json();
                this.logs = data.logs || [];
            } catch (error) {
                console.error('❌ Error fetching completion logs:', error);
                throw error;
            }
        },

        async fetchStudents() {
            try {
                const userId = JSON.parse(sessionStorage.getItem('user'))?.id;
                const response = await fetch(`${API_BASE_URL}/api/quiz/teacher/${userId}/students`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) throw new Error('Failed to fetch students');

                const data = await response.json();
                this.allStudents = data.students || [];
                this.totalStudents = this.allStudents.length;
            } catch (error) {
                console.error('❌ Error fetching students:', error);
                throw error;
            }
        },

        calculateStatistics() {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

            this.completedCount = this.logs.filter(log => 
                log.completed && new Date(log.completed_at) >= oneWeekAgo
            ).length;

            this.pendingCount = this.logs.filter(log => !log.completed).length;

            const completedLogs = this.logs.filter(log => log.completed && log.score !== null);
            if (completedLogs.length > 0) {
                const totalScore = completedLogs.reduce((sum, log) => sum + log.score, 0);
                this.averageScore = Math.round(totalScore / completedLogs.length);
            } else {
                this.averageScore = 0;
            }
        },

        async sendReminder(log) {
            log.sending_reminder = true;
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/completion-log/send-reminder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        assignment_id: log.id,
                        student_email: log.student_email,
                        student_name: log.student_name,
                        quiz_name: log.quiz_name,
                        due_date: log.due_date
                    })
                });

                if (!response.ok) throw new Error('Failed to send reminder');

                this.showMessage(`Reminder sent to ${log.student_name}`, 'success');
            } catch (error) {
                console.error('❌ Error sending reminder:', error);
                this.showMessage(`Failed to send reminder to ${log.student_name}`, 'error');
            } finally {
                log.sending_reminder = false;
            }
        },

        async sendBulkReminders() {
            this.sendingBulkReminders = true;
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/completion-log/send-bulk-reminders`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        assignment_ids: this.pendingLogs.map(log => log.id)
                    })
                });

                if (!response.ok) throw new Error('Failed to send bulk reminders');

                const data = await response.json();
                this.showMessage(`Reminders sent to ${data.sent_count} students`, 'success');
            } catch (error) {
                console.error('❌ Error sending bulk reminders:', error);
                this.showMessage('Failed to send bulk reminders', 'error');
            } finally {
                this.sendingBulkReminders = false;
            }
        },

        async refreshLogs() {
            await this.loadData();
            this.showMessage('Logs refreshed', 'success');
        },

        viewQuizDetails(log) {
            this.$router.push({
                path: `/quiz/${log.quiz_id}`,
                query: { student: log.student_id }
            });
        },

        isOverdue(log) {
            if (!log.due_date || log.completed) return false;
            return new Date(log.due_date) < new Date();
        },

        formatDate(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },

        showMessage(text, type) {
            this.message = text;
            this.messageType = type;
            setTimeout(() => {
                this.message = '';
            }, 5000);
        }
    }
};
</script>

<style scoped>
.completion-logs-page {
    padding: 3rem;
    max-width: 1400px;
    margin: auto;
    font-family: Arial, sans-serif;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #e9ecef;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    display: flex;
    align-items: center;
    gap: 1rem;
}

.stat-icon {
    font-size: 2rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 8px;
}

.stat-content h3 {
    margin: 0;
    font-size: 2rem;
    color: #333;
}

.stat-content p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
}

.filter-section {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
}

.filter-controls {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.filter-select,
.filter-date {
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
    background-color: white;
}

.refresh-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
}

.refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.logs-section {
    margin-bottom: 2rem;
}

.logs-section h3 {
    color: #333;
    margin-bottom: 1.5rem;
}

.loading-state,
.empty-state {
    text-align: center;
    padding: 3rem;
    background-color: #f9f9f9;
    border-radius: 10px;
    color: #666;
}

.spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #66CC99;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

.logs-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.log-item {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #e9ecef;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.log-item.completed {
    border-left: 4px solid #28a745;
}

.log-item.pending {
    border-left: 4px solid #ffc107;
}

.log-item.overdue {
    border-left: 4px solid #dc3545;
}

.log-content {
    flex: 1;
}

.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.student-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.student-name {
    font-weight: bold;
    color: #333;
    font-size: 1.1rem;
}

.quiz-name {
    color: #666;
    font-size: 0.9rem;
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: bold;
}

.status-badge.completed {
    background-color: #d4edda;
    color: #155724;
}

.status-badge.pending {
    background-color: #fff3cd;
    color: #856404;
}

.status-badge.overdue {
    background-color: #f8d7da;
    color: #721c24;
}

.log-details {
    margin-bottom: 0.75rem;
    font-size: 0.9rem;
    color: #666;
}

.assignment-info,
.completion-info {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
}

.score {
    font-weight: bold;
    color: #0055B8;
}

.quiz-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
}

.subject,
.level,
.question-count {
    background-color: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
}

.log-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.remind-btn,
.view-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    min-width: 100px;
}

.remind-btn {
    background-color: #ff9500;
    color: white;
}

.remind-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.view-btn {
    background-color: white;
    color: #0055B8;
    border: 1px solid #0055B8;
}

.view-btn:hover {
    background-color: #0055B8;
    color: white;
}

.bulk-actions {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #dee2e6;
}

.bulk-actions h3 {
    margin-top: 0;
    color: #333;
}

.bulk-controls {
    display: flex;
    gap: 1rem;
}

.bulk-remind-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background-color: #ff9500;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
}

.bulk-remind-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.message {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 6px;
    font-weight: bold;
    z-index: 1000;
    animation: slideIn 0.3s ease;
}

.message.success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.message.error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.icon {
    width: 16px;
    height: 16px;
}

/* Responsive Design */
@media (max-width: 768px) {
    .completion-logs-page {
        padding: 1.5rem;
    }

    .stats-cards {
        grid-template-columns: 1fr;
    }

    .filter-controls {
        flex-direction: column;
    }

    .log-item {
        flex-direction: column;
        gap: 1rem;
    }

    .log-actions {
        flex-direction: row;
        justify-content: flex-start;
    }
}
</style>