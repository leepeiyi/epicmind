<template>
    <div class="quiz-folder-page">
        <Navbar />

        <h1 class="main-title">📚 My Quizzes</h1>
        <p class="description">View and manage all your saved quiz folders below.</p>

        <div class="quiz-controls">
            <input type="text" v-model="searchQuery" placeholder="Search quizzes..." class="search-bar" />
            <button class="new-quiz-btn" @click="navigateToNewQuiz">+ New Quiz</button>
        </div>

        <div v-if="loading" class="loading-state">
            <p>Loading your quizzes...</p>
        </div>

        <div v-else-if="error" class="error-state">
            <p>{{ error }}</p>
            <button @click="fetchQuizFolders" class="retry-btn">Try Again</button>
        </div>

        <div v-else-if="filteredQuizzes.length === 0" class="empty-state">
            <p>No quizzes match your search. Try a different search term or create a new quiz.</p>
        </div>

        <div v-else class="quiz-grid">
            <div v-for="quiz in filteredQuizzes" :key="quiz.id" class="quiz-card">
                <div class="quiz-title-row">
                    <span class="quiz-title">📝 {{ quiz.name || quiz.title }}</span>
                    <div class="quiz-menu-dropdown">
                        <span class="quiz-menu" @click="toggleDropdown(quiz.id)">⋮</span>
                        <div v-if="activeDropdown === quiz.id" class="dropdown-menu">
                            <button @click="editQuiz(quiz.id)">Edit</button>
                            <button @click="deleteQuiz(quiz.id)" class="delete-btn">Delete</button>
                        </div>
                    </div>
                </div>
                <div class="quiz-meta">
                    <span>{{ quiz.question_count || quiz.questionCount }} questions</span>
                    <span class="dot">•</span>
                    <span>{{ formatDate(quiz.last_modified || quiz.created_at) }}</span>
                </div>
                <div class="quiz-tags">
                    <span class="quiz-tag">{{ quiz.subject }}</span>
                    <span class="quiz-tag">{{ quiz.level }}</span>
                </div>
                <div class="quiz-actions">
                    <button class="open-btn" @click="openQuiz(quiz.id)">Open Quiz</button>
                    <button @click="printQuiz(quiz)" class="print-btn">Print</button>
                </div>

            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';

export default {
    name: 'QuizFolder',
    components: { Navbar },
    data() {
        return {
            searchQuery: '',
            quizzes: [],
            loading: true,
            error: null,
            activeDropdown: null
        };
    },
    computed: {
        filteredQuizzes() {
            const query = this.searchQuery.toLowerCase();
            return this.quizzes.filter(q => {
                const title = (q.folder_name || q.title || '').toLowerCase();
                const subject = (q.subject || '').toLowerCase();
                const level = (q.level || '').toLowerCase();
                return title.includes(query) || subject.includes(query) || level.includes(query);
            });
        }
    },
    created() {
        this.fetchQuizFolders();
    },
    methods: {
        async fetchQuizFolders() {
            this.loading = true;
            this.error = null;

            try {
                const response = await fetch('http://localhost:5008/api/quiz/folders/all');

                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                const data = await response.json();
                this.quizzes = data.folders || [];
            } catch (error) {
                console.error('❌ Failed to fetch quiz folders:', error);
                this.error = 'Could not load quiz folders. Please try again later.';
            } finally {
                this.loading = false;
            }
        },

        formatDate(dateString) {
            if (!dateString) return 'Unknown date';

            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                return 'Today';
            } else if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                return `${months} ${months === 1 ? 'month' : 'months'} ago`;
            } else {
                const years = Math.floor(diffDays / 365);
                return `${years} ${years === 1 ? 'year' : 'years'} ago`;
            }
        },

        toggleDropdown(quizId) {
            this.activeDropdown = this.activeDropdown === quizId ? null : quizId;
        },

        navigateToNewQuiz() {
            // Navigate to the quiz creation page
            this.$router.push('/create-quiz');
        },

        openQuiz(quizId) {
            // Navigate to the quiz view/edit page
            this.$router.push(`/quiz/${quizId}`);
        },

        editQuiz(quizId) {
            // Navigate to the quiz edit page
            this.$router.push(`/edit-quiz/${quizId}`);
            this.activeDropdown = null;
        },
        printQuiz(quiz) {
            this.$router.push({
                path: '/print-view',
                query: {
                    folderId: quiz.id,
                    folder_name: quiz.name || quiz.title || 'Untitled Quiz',
                    subject: quiz.subject,
                    level: quiz.level
                }
            });
        }

        ,


        async deleteQuiz(quizId) {
            if (!confirm('Are you sure you want to delete this quiz?')) {
                this.activeDropdown = null;
                return;
            }

            try {
                const response = await fetch(`http://localhost:5008/api/folders/${quizId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }

                // Remove the deleted quiz from the local array
                this.quizzes = this.quizzes.filter(quiz => quiz.id !== quizId);
                alert('Quiz deleted successfully');
            } catch (error) {
                console.error('❌ Failed to delete quiz:', error);
                alert('Failed to delete quiz. Please try again later.');
            }

            this.activeDropdown = null;
        }
    }
};
</script>

<style scoped>
.quiz-folder-page {
    max-width: 1200px;
    margin: auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
}

.main-title {
    font-size: 2rem;
    color: #0055B8;
}

.description {
    color: #666;
    margin-bottom: 1.5rem;
}

.quiz-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.search-bar {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    margin-right: 1rem;
}

.new-quiz-btn {
    background-color: #66CC99;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
}

.quiz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
}

.quiz-card {
    border: 1px solid #eee;
    border-radius: 10px;
    padding: 1.2rem;
    background-color: #fff;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.quiz-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    font-size: 1.1rem;
    color: #333;
    margin-bottom: 0.5rem;
}

.quiz-meta {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 1rem;
}

.quiz-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.quiz-tag {
    background-color: #f0f0f0;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    font-size: 0.8rem;
    color: #555;
}

.dot {
    margin: 0 0.4rem;
}

.open-btn {
    margin-top: auto;
    align-self: flex-start;
    padding: 0.5rem 1rem;
    background-color: white;
    color: #66CC99;
    border: 2px solid #66CC99;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.open-btn:hover {
    background-color: #66CC99;
    color: white;
}

.loading-state,
.error-state,
.empty-state {
    text-align: center;
    padding: 3rem;
    background-color: #f9f9f9;
    border-radius: 10px;
    margin-top: 2rem;
}

.retry-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
}

.quiz-menu-dropdown {
    position: relative;
}

.quiz-menu {
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
}

.dropdown-menu {
    position: absolute;
    right: 0;
    top: 100%;
    background-color: white;
    border: 1px solid #eee;
    border-radius: 6px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 10;
    min-width: 100px;
}

.dropdown-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    cursor: pointer;
}

.dropdown-menu button:hover {
    background-color: #f5f5f5;
}

.dropdown-menu .delete-btn {
    color: #ff4444;
}

.dropdown-menu .delete-btn:hover {
    background-color: #fff0f0;
}

.print-btn {
    margin-top: 0.5rem;
    align-self: flex-start;
    padding: 0.5rem 1rem;
    background-color: white;
    color: #0055B8;
    border: 2px solid #0055B8;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.print-btn:hover {
    background-color: #0055B8;
    color: white;
}

.quiz-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
}
</style>