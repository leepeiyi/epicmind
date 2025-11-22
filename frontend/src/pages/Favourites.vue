<!-- frontend/src/pages/Favourites.vue -->
<template>
    <div>
        <Navbar />
        <div class="favourites-page">
            <h1>⭐ My Favourites</h1>
            <p class="subtitle">
                Organize your favorite questions by topic for quick access and review.
            </p>

            <!-- Filter Section -->
            <div class="filter-section">
                <h3>📚 Browse Topics</h3>
                <PaperDetails v-model:subject="filterSubject" v-model:banding="filterBanding"
                    v-model:level="filterLevel" v-model:topic_label="selectedTopic" upload-type="topical" />
                <div v-if="selectedTopic" class="selected-topic-info">
                    <p><strong>Selected Topic:</strong> {{ getTopicLabel() }} </p>
                    <button @click="browseTopicQuestions" class="browse-btn">
                        Browse {{ getTopicLabel() }} Questions
                    </button>
                </div>
            </div>

            <!-- Topic Questions Display -->
            <div v-if="showTopicQuestions" class="questions-list">
                <h3>📄 Questions for "{{ getTopicLabel() }}"</h3>

                <div v-if="topicQuestions.length === 0" class="empty-state">
                    <p>No questions found for this topic.</p>
                </div>

                <div v-else>
                    <div v-for="question in topicQuestions" :key="question.id" class="question-item">
                        <div class="question-header">
                            <div class="left-info">
                                <span class="question-number">Q{{ question.question_number }}</span>
                                <span class="paper-name">{{ question.paper_name }}</span>
                            </div>
                            <!-- Fixed: Pass topic-label as string and add event handler -->
                            <FavouriteButton :question-id="question.id" :subject="filterSubject"
                                :banding="filterBanding" :level="filterLevel" :topic-label="getTopicLabel()"
                                @favoriteChanged="handleFavoriteChanged" />
                        </div>

                        <div class="question-content">
                            <div class="question-text" v-html="renderMath(question.question_text)"></div>

                            <!-- Answer Options -->
                            <div v-if="question.answer_options && question.answer_options.length > 0"
                                class="answer-options">
                                <div v-for="option in parseAnswerOptions(question.answer_options)" :key="option.option"
                                    class="option">
                                    <strong>{{ option.option }}.</strong>
                                    <span v-html="renderMath(option.text)"></span>
                                </div>
                            </div>

                            <!-- Images -->
                            <div v-if="question.image_paths && question.image_paths.length > 0" class="question-images">
                                <img v-for="(image, index) in parseImagePaths(question.image_paths)" :key="index"
                                    :src="image" class="question-image" :alt="`Diagram ${index + 1}`" />
                            </div>

                            <!-- Answer Key -->
                            <div v-if="question.answer_key" class="answer-key">
                                <strong>Answer:</strong>
                                <span v-html="renderMath(parseAnswerKey(question.answer_key))"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- My Favorites Section -->
            <div class="my-favorites-section">
                <h3>⭐ My Favorite Topics</h3>

                <div v-if="loadingFavorites" class="loading-state">
                    <p>Loading your favorites...</p>
                </div>

                <div v-else-if="myFavorites.length === 0" class="empty-state">
                    <p>You haven't added any favorites yet. Browse topics above to get started!</p>
                </div>

                <div v-else class="favorites-grid">
                    <div v-for="favorite in myFavorites" :key="favorite.id" class="favorite-card">
                        <div class="favorite-header">
                            <h4>{{ favorite.topic_label }}</h4>
                            <button @click="deleteFavourite(favorite)" class="delete-btn"
                                title="Delete this favorite topic">
                                🗑️
                            </button>
                        </div>
                        <div class="favorite-meta">
                            <span class="subject-info">{{ favorite.subject }} • {{ favorite.banding }} • {{
                                favorite.level }}</span>
                            <span class="question-count">{{ favorite.question_count }} questions</span>
                        </div>
                        <div class="favorite-actions">
                            <button @click="viewFavoriteQuestions(favorite)" class="view-btn">
                                View Questions
                            </button>
                            <button @click="generateQuizFromFavorite(favorite)" class="quiz-btn">
                                Create Quiz
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Questions Modal -->
            <div v-if="showQuestionsModal" class="modal-overlay" @click="closeQuestionsModal">
                <div class="modal-container" @click.stop>
                    <div class="modal-header">
                        <h3>{{ selectedFavorite?.topic_label }} - Favorite Questions</h3>
                        <button class="close-btn" @click="closeQuestionsModal">✕</button>
                    </div>

                    <div class="modal-body">
                        <div v-if="loadingQuestions" class="loading-state">
                            <p>Loading questions...</p>
                        </div>

                        <div v-else-if="favoriteQuestions.length === 0" class="empty-state">
                            <p>No questions found in this favorite topic.</p>
                        </div>

                        <div v-else class="questions-list">
                            <div v-for="question in favoriteQuestions" :key="question.id" class="question-item">
                                <div class="question-header">
                                    <span class="question-number">Q{{ question.question_number }}</span>
                                    <span class="paper-name">{{ question.paper_name }}</span>
                                    <!-- Inside the modal, for each question -->
                                    <button @click="removeFromFavorites(question.id)" class="remove-btn"
                                        title="Remove from favorites">
                                        ❌
                                    </button>
                                </div>

                                <div class="question-content">
                                    <div class="question-text" v-html="renderMath(question.question_text)"></div>

                                    <!-- Answer Options -->
                                    <div v-if="question.answer_options && question.answer_options.length > 0"
                                        class="answer-options">
                                        <div v-for="option in parseAnswerOptions(question.answer_options)"
                                            :key="option.option" class="option">
                                            <strong>{{ option.option }}.</strong> <span
                                                v-html="renderMath(option.text)"></span>
                                        </div>
                                    </div>

                                    <!-- Images -->
                                    <div v-if="question.image_paths && question.image_paths.length > 0"
                                        class="question-images">
                                        <img v-for="(image, index) in parseImagePaths(question.image_paths)"
                                            :key="index" :src="image"
                                            :alt="`Question ${question.question_number} diagram ${index + 1}`"
                                            class="question-image" />
                                    </div>

                                    <!-- Answer Key -->
                                    <div v-if="question.answer_key" class="answer-key">
                                        <strong>Answer:</strong>
                                        <span v-html="renderMath(parseAnswerKey(question.answer_key))"></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import PaperDetails from '../components/PaperDetails.vue';
import FavouriteButton from '../components/FavouriteButton.vue';
import API_BASE_URL from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
    name: 'Favourites',
    components: {
        Navbar,
        PaperDetails,
        FavouriteButton
    },
    data() {
        return {
            // Filter state
            filterSubject: '',
            filterBanding: '',
            filterLevel: '',
            selectedTopic: '',

            // Data
            myFavorites: [],
            availableTopics: [],
            favoriteQuestions: [],
            selectedFavorite: null,

            // Loading states
            loadingFavorites: false,
            loadingTopics: false,
            loadingQuestions: false,

            // Modal state
            showQuestionsModal: false,

            topicQuestions: [],
            showTopicQuestions: false,
        };
    },
    watch: {
        filterSubject() {
            this.selectedTopic = '';
            this.onFilterChange();
        },
        filterBanding() {
            this.selectedTopic = '';
            this.onFilterChange();
        },
        filterLevel() {
            this.selectedTopic = '';
            this.onFilterChange();
        },
        selectedTopic() {
            this.onFilterChange();
        }
    },
    async mounted() {
        await this.loadMyFavorites();
        this.configureMathJax();
    },
    methods: {
        // Helper method to get topic label as string
        getTopicLabel() {
            if (typeof this.selectedTopic === 'object' && this.selectedTopic?.label) {
                return this.selectedTopic.label;
            }
            return this.selectedTopic || '';
        },

        // Handle favorite changes from FavouriteButton
        handleFavoriteChanged(data) {
            console.log('Favorite changed:', data);
            // Optionally refresh favorites list if needed
            // this.loadMyFavorites();
        },

        configureMathJax() {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]']],
                    processEscapes: true
                },
                options: {
                    enableMenu: false
                }
            };

            if (!window.MathJax || !window.MathJax.typesetPromise) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
                script.async = true;
                document.head.appendChild(script);
            }
        },

        renderMath(text) {
            if (!text) return '';

            const decoded = text
                .replace(/\\\\/g, '\\') // convert double-backslashes to single
                .replace(/\\\(/g, '\\(')
                .replace(/\\\)/g, '\\)')
                .replace(/\\\[/g, '\\[')
                .replace(/\\\]/g, '\\]')
                .replace(/\\text/g, '\\text'); // Optional: fix extra backslashes

            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });

            return decoded;
        },

        async browseTopicQuestions() {
            if (!this.selectedTopic) return;

            const topicLabel = this.getTopicLabel();
            if (!topicLabel.trim()) return;

            const queryParams = new URLSearchParams({
                subject: this.filterSubject,
                banding: this.filterBanding,
                level: this.filterLevel,
                topic_label: topicLabel.trim(),
            });

            try {
                const response = await fetch(`${API_BASE_URL}/api/favourite/by-topic?${queryParams.toString()}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("❌ API Error:", errorData);
                    toast.error("Failed to load topic questions.");
                    return;
                }

                const data = await response.json();
                this.topicQuestions = data.questions || [];
                this.showTopicQuestions = true;

                // Trigger MathJax
                this.$nextTick(() => {
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise();
                    }
                });

            } catch (err) {
                console.error("❌ Fetch failed:", err);
                toast.error("An error occurred while loading topic questions.");
            }
        },

        async loadMyFavorites() {
            this.loadingFavorites = true;

            const userStr = sessionStorage.getItem("user");
            let userId = null;
            try {
                userId = JSON.parse(userStr)?.id;
            } catch (e) {
                console.error("❌ Failed to parse user from sessionStorage", e);
            }

            if (!userId) {
                toast.error("User session missing. Please log in again.");
                this.loadingFavorites = false;
                return;
            }

            // Prepare query parameters - fix the topic_label handling
            const queryParams = new URLSearchParams({
                user_id: userId,
                subject: this.filterSubject,
                banding: this.filterBanding,
                level: this.filterLevel,
                topic_label: this.getTopicLabel() || ""
            });

            try {
                const response = await fetch(`${API_BASE_URL}/api/favourite?${queryParams.toString()}`);

                if (!response.ok) throw new Error("Failed to load favorites");

                const data = await response.json();
                this.myFavorites = data.favorites || [];
            } catch (error) {
                console.error("❌ Error loading favorites:", error);
                toast.error("Failed to load your favorites");
            } finally {
                this.loadingFavorites = false;
            }
        },

        async onFilterChange() {
            if (this.filterSubject && this.filterBanding && this.filterLevel) {
                await this.loadAvailableTopics();
            } else {
                this.availableTopics = [];
            }
        },

        async loadAvailableTopics() {
            // Add this method if you need it for topic browsing
            console.log('Loading available topics...');
        },

        async viewFavoriteQuestions(favorite) {
            this.selectedFavorite = favorite;
            this.showQuestionsModal = true;
            this.loadingQuestions = true;

            const userStr = sessionStorage.getItem("user");
            let userId = null;
            try {
                userId = JSON.parse(userStr)?.id;
            } catch (e) {
                console.error("❌ Failed to parse user from sessionStorage", e);
            }

            if (!userId) {
                toast.error("User session missing. Please log in again.");
                this.loadingQuestions = false;
                return;
            }

            const queryParams = new URLSearchParams({
                user_id: userId,
                subject: favorite.subject,
                banding: favorite.banding,
                level: favorite.level,
                topic_label: favorite.topic_label.trim()
            });

            try {
                const response = await fetch(`${API_BASE_URL}/api/favourite/my-fav-topic?${queryParams.toString()}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("❌ API Error:", errorData);
                    toast.error("Failed to load favorite questions.");
                    return;
                }

                const data = await response.json();
                this.favoriteQuestions = data.questions || [];

                // MathJax render
                this.$nextTick(() => {
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise();
                    }
                });

            } catch (error) {
                console.error("❌ Error loading favorite questions:", error);
                toast.error("Failed to load questions.");
            } finally {
                this.loadingQuestions = false;
            }
        },

        async deleteFavourite(favorite) {
            const userStr = sessionStorage.getItem("user");
            let userId = null;
            try {
                userId = JSON.parse(userStr)?.id;
            } catch (e) {
                console.error("❌ Failed to parse user from sessionStorage", e);
            }

            if (!userId) {
                toast.error("User session missing. Please log in again.");
                return;
            }

            if (!confirm(`Delete all saved questions under "${favorite.topic_label}"?`)) return;

            try {
                // Loop through each question in this favorite and delete them
                for (const questionId of favorite.question_ids || []) {
                    const response = await fetch(`${API_BASE_URL}/api/favourite/remove-question`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            question_id: questionId,
                            subject: favorite.subject,
                            banding: favorite.banding,
                            level: favorite.level,
                            topic_label: favorite.topic_label.trim()
                        })
                    });

                    if (!response.ok) {
                        const err = await response.json();
                        console.error("❌ Failed to delete:", err);
                    }
                }

                // Refresh favorites after deletion
                await this.loadMyFavorites();

            } catch (err) {
                console.error("❌ Request failed:", err);
                toast.error("Failed to remove favorite. Please try again.");
            }
        },

        async removeFromFavorites(questionId) {
            const userStr = sessionStorage.getItem("user");
            let userId = null;
            try {
                userId = JSON.parse(userStr)?.id;
            } catch (e) {
                console.error("❌ Failed to parse user from sessionStorage", e);
            }

            if (!userId || !this.selectedFavorite) {
                toast.error("Session missing or topic not selected.");
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/api/favourite/remove-question`, {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        question_id: questionId,
                        subject: this.selectedFavorite.subject,
                        banding: this.selectedFavorite.banding,
                        level: this.selectedFavorite.level,
                        topic_label: this.selectedFavorite.topic_label.trim()
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("❌ Backend error:", errorData);
                    toast.error("Failed to remove from favorites.");
                    return;
                }

                const data = await response.json();
                console.log("✅ Removed question from favorites:", data);

                // Remove from current display
                this.favoriteQuestions = this.favoriteQuestions.filter(q => q.id !== questionId);

                // If it's empty now, refresh outer list and close modal
                if (this.favoriteQuestions.length === 0) {
                    await this.loadMyFavorites();
                    this.closeQuestionsModal();
                }

            } catch (err) {
                console.error("❌ Request failed:", err);
                toast.error("Failed to remove favorite. Please try again.");
            }
        },

        closeQuestionsModal() {
            this.showQuestionsModal = false;
            this.selectedFavorite = null;
            this.favoriteQuestions = [];
        },

        parseAnswerOptions(options) {
            if (typeof options === 'string') {
                try {
                    return JSON.parse(options);
                } catch {
                    return [];
                }
            }
            return Array.isArray(options) ? options : [];
        },

        parseImagePaths(paths) {
            if (typeof paths === 'string') {
                try {
                    return JSON.parse(paths);
                } catch {
                    return [];
                }
            }
            return Array.isArray(paths) ? paths : [];
        },

        parseAnswerKey(answerKey) {
            if (typeof answerKey === 'string') {
                try {
                    const parsed = JSON.parse(answerKey);
                    return parsed.correct_answer || parsed;
                } catch {
                    return answerKey;
                }
            }
            return answerKey?.correct_answer || answerKey || '';
        },

        async generateQuizFromFavorite(favorite) {
            // Navigate to quiz generation with this favorite's questions
            this.$router.push({
                name: 'GenerateTopical',
                query: {
                    subject: favorite.subject,
                    banding: favorite.banding,
                    level: favorite.level,
                    topic: favorite.topic_label,
                    favoriteId: favorite.id
                }
            });
        },
    }
};
</script>

<style scoped>
.favourites-page {
    padding: 3rem;
    max-width: 1400px;
    margin: auto;
    font-family: Arial, sans-serif;
}

.subtitle {
    color: #666;
    margin-bottom: 2rem;
}

.filter-section {
    background-color: #f8f9fa;
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    border: 1px solid #dee2e6;
}

.filter-section h3 {
    margin-top: 0;
    color: #333;
}

.filter-controls {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.filter-select {
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 14px;
    background-color: white;
    min-width: 180px;
}

.topics-section,
.my-favorites-section {
    margin-bottom: 3rem;
}

.topics-section h3,
.my-favorites-section h3 {
    color: #333;
    margin-bottom: 1.5rem;
}

.topics-grid,
.favorites-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
}

.topic-card,
.favorite-card {
    background: white;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.topic-card:hover {
    border-color: #66CC99;
    box-shadow: 0 4px 12px rgba(102, 204, 153, 0.15);
    transform: translateY(-2px);
}

.topic-card h4,
.favorite-card h4 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
}

.topic-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
}

.total-questions {
    color: #666;
}

.left-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #ddd;
    margin-bottom: 1rem;
}

.favorite-count {
    color: #999;
    font-weight: 500;
}

.favorite-count.has-favorites {
    color: #ff9500;
    font-weight: bold;
}

.favorite-card {
    cursor: default;
}

.favorite-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.selected .topic .info {
    margin-top: 1rem;
    padding: 1rem;
    background-color: #e8f5e8;
    border-radius: 8px;
    border-left: 4px solid #66CC99;
}

.browse-btn {
    margin-top: 0.5rem;
    padding: 0.6rem 1.2rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
}

.browse-btn:hover {
    background-color: #4CAF50;
}

.delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.delete-btn:hover {
    background-color: #fee;
}

.favorite-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.9rem;
}

.subject-info {
    color: #666;
    font-weight: 500;
}

.question-count {
    color: #0055B8;
    font-weight: bold;
}

.favorite-actions {
    display: flex;
    gap: 0.75rem;
}

.view-btn,
.quiz-btn {
    flex: 1;
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
}

.view-btn {
    background-color: white;
    color: #0055B8;
    border: 2px solid #0055B8;
}

.view-btn:hover {
    background-color: #0055B8;
    color: white;
}

.quiz-btn {
    background-color: #66CC99;
    color: white;
    border: 2px solid #66CC99;
}

.quiz-btn:hover {
    background-color: #4CAF50;
    border-color: #4CAF50;
}

.loading-state,
.empty-state {
    text-align: center;
    padding: 2rem;
    background-color: #f9f9f9;
    border-radius: 10px;
    margin: 1rem 0;
    color: #666;
}

/* Modal Styles */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-container {
    background-color: white;
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #eee;
}

.modal-header h3 {
    margin: 0;
    color: #333;
}

.close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
    padding: 0.25rem;
}

.close-btn:hover {
    color: #333;
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    max-height: 70vh;
}

.questions-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.question-item {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1.5rem;
    background-color: #fafafa;
}

.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #ddd;
}

.question-number {
    font-weight: bold;
    color: #0055B8;
    font-size: 1.1rem;
}

.paper-name {
    color: #666;
    font-size: 0.9rem;
    font-style: italic;
}

.remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.remove-btn:hover {
    background-color: #fee;
}

.question-content {
    line-height: 1.6;
}

.question-text {
    margin-bottom: 1rem;
    font-size: 1rem;
    color: #333;
}

.answer-options {
    margin: 1rem 0;
    padding-left: 1rem;
}

.option {
    margin-bottom: 0.5rem;
    color: #333;
}

.question-images {
    margin: 1rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

.question-image {
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    border: 1px solid #ddd;
    object-fit: contain;
}

.answer-key {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: #f0f8ff;
    border-radius: 6px;
    border-left: 4px solid #0055B8;
    font-size: 0.95rem;
}

.answer-key strong {
    color: #0055B8;
}

/* Remove redundant filter-controls styles since we're using PaperDetails component */
.filter-controls {
    display: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
    .favourites-page {
        padding: 1.5rem;
    }

    .topics-grid,
    .favorites-grid {
        grid-template-columns: 1fr;
    }

    .favorite-actions {
        flex-direction: column;
    }

    .modal-container {
        width: 95%;
    }

    .question-images {
        flex-direction: column;
    }
}
</style>