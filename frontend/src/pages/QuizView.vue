<template>
    <div class="quiz-view-page">
        <Navbar />

        <div v-if="loading" class="loading-container">
            <p>Loading quiz...</p>
        </div>

        <div v-else-if="error" class="error-container">
            <p>{{ error }}</p>
            <button @click="fetchQuizData" class="retry-btn">Try Again</button>
            <button @click="goBack" class="back-btn">Back to Quizzes</button>
        </div>

        <div v-else class="quiz-container">
            <div class="quiz-header">
                <button @click="goBack" class="back-btn">← Back to Quizzes</button>
                <div class="quiz-meta">
                    <h1 class="quiz-title">{{ quiz.folder_name }}</h1>
                    <div class="quiz-tags">
                        <span class="quiz-tag">{{ quiz.subject }}</span>
                        <span class="quiz-tag">{{ quiz.level }}</span>
                        <span class="quiz-tag">{{ quiz.question_count }} questions</span>
                    </div>
                </div>
                <button @click="editQuiz" class="edit-btn">Edit Quiz</button>
            </div>

            <div class="quiz-controls">
                <div class="quiz-progress">
                    <p>Question {{ currentQuestionIndex + 1 }} of {{ questions.length }}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
                    </div>
                </div>

                <div class="quiz-mode">
                    <button :class="{ active: mode === 'learn' }" @click="mode = 'learn'">Learn Mode</button>
                    <button :class="{ active: mode === 'test' }" @click="mode = 'test'">Test Mode</button>
                </div>
            </div>

            <div class="question-container">
                <div class="question-content">
                    <h2>Question {{ currentQuestion.question_number }}</h2>
                    <div class="question-text" v-html="formattedQuestionText"></div>

                    <div v-if="currentQuestion.image_paths && currentQuestion.image_paths.length"
                        class="question-images">
                        <img v-for="(image, index) in currentQuestion.image_paths" :key="index" :src="image"
                            :alt="`Question ${currentQuestion.question_number} diagram ${index + 1}`"
                            class="question-image" />
                    </div>

                    <div v-if="hasOptions" class="answer-options">
                        <div v-for="option in currentQuestion.answer_options" :key="option.option" :class="[
                            'answer-option',
                            { 'selected': selectedOption === option.option },
                            { 'correct': showAnswer && option.option === correctAnswer },
                            { 'incorrect': showAnswer && selectedOption === option.option && option.option !== correctAnswer }
                        ]" @click="selectOption(option.option)">
                            <span class="option-label">{{ option.option }}</span>
                            <span class="option-text" v-html="option.text"></span>
                        </div>
                    </div>

                    <div v-else class="free-response">
                        <textarea v-model="userAnswer" placeholder="Enter your answer here..." :disabled="showAnswer"
                            rows="4"></textarea>
                    </div>
                </div>

                <div class="question-actions">
                    <button v-if="!showAnswer" @click="checkAnswer" class="check-btn"
                        :disabled="mode === 'test' && !canCheckAnswer">
                        Check Answer
                    </button>

                    <div v-if="showAnswer" class="answer-feedback">
                        <div :class="['feedback-message', isCorrect ? 'correct' : 'incorrect']">
                            <span v-if="isCorrect">✓ Correct!</span>
                            <span v-else>✗ Incorrect</span>
                        </div>

                        <div class="correct-answer">
                            <h3>Correct Answer:</h3>
                            <div v-html="formattedAnswer"></div>
                        </div>

                        <button @click="nextQuestion" class="next-btn">
                            {{ isLastQuestion ? 'Finish Quiz' : 'Next Question' }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="question-navigator">
                <button v-for="(q, index) in questions" :key="index" :class="['nav-dot', {
                    'current': index === currentQuestionIndex,
                    'answered': answeredQuestions.includes(index)
                }]" @click="jumpToQuestion(index)">
                    {{ index + 1 }}
                </button>
            </div>
        </div>

        <div v-if="showResults" class="results-container">
            <h2>Quiz Results</h2>
            <div class="results-summary">
                <div class="score-circle">
                    <span class="score-percentage">{{ scorePercentage }}%</span>
                </div>
                <div class="score-details">
                    <p>You answered {{ correctAnswers }} out of {{ questions.length }} questions correctly.</p>
                </div>
            </div>

            <div class="results-actions">
                <button @click="restartQuiz" class="restart-btn">Restart Quiz</button>
                <button @click="goBack" class="back-btn">Back to Quizzes</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { marked } from 'marked';

export default {
    name: 'QuizView',
    components: { Navbar },
    data() {
        return {
            quizId: null,
            quiz: {
                folder_name: '',
                subject: '',
                level: '',
                question_count: 0
            },
            questions: [],
            loading: true,
            error: null,
            currentQuestionIndex: 0,
            selectedOption: '',
            userAnswer: '',
            showAnswer: false,
            mode: 'learn', // 'learn' or 'test'
            answeredQuestions: [],
            correctAnswers: 0,
            showResults: false
        };
    },
    watch: {
        formattedQuestionText() {
            this.$nextTick(() => {
                window.MathJax?.typesetPromise?.();
            });
        },
        formattedAnswer() {
            this.$nextTick(() => {
                window.MathJax?.typesetPromise?.();
            });
        }
    }

    ,
    computed: {
        currentQuestion() {
            return this.questions[this.currentQuestionIndex] || {
                question_number: 1,
                question_text: '',
                answer_options: [],
                answer_key: null,
                image_paths: []
            };
        },
        hasOptions() {
            return this.currentQuestion.answer_options &&
                this.currentQuestion.answer_options.length > 0;
        },
        correctAnswer() {
            if (!this.currentQuestion.answer_key) return '';

            let answerKey;
            try {
                answerKey = typeof this.currentQuestion.answer_key === 'string'
                    ? JSON.parse(this.currentQuestion.answer_key)
                    : this.currentQuestion.answer_key;
            } catch (e) {
                return '';
            }

            return answerKey.correct_answer || '';
        },
        isCorrect() {
            if (this.hasOptions) {
                return this.selectedOption === this.correctAnswer;
            } else {
                // Simple text comparison for free-response questions
                return this.userAnswer.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase();
            }
        },
        isLastQuestion() {
            return this.currentQuestionIndex === this.questions.length - 1;
        },
        progressPercentage() {
            return (this.currentQuestionIndex / this.questions.length) * 100;
        },
        formattedQuestionText() {
            return this.currentQuestion.question_text ? marked(this.currentQuestion.question_text) : '';
        },
        formattedAnswer() {
            try {
                const parsed = typeof this.currentQuestion.answer_key === 'string'
                    ? JSON.parse(this.currentQuestion.answer_key)
                    : this.currentQuestion.answer_key;

                return parsed.correct_answer || '';
            } catch {
                return '';
            }
        },
        scorePercentage() {
            if (this.questions.length === 0) return 0;
            return Math.round((this.correctAnswers / this.questions.length) * 100);
        },
        canCheckAnswer() {
            return this.hasOptions ? this.selectedOption !== '' : this.userAnswer.trim() !== '';
        }
    },
   
    created() {
        this.quizId = this.$route.params.id;
        this.fetchQuizData();
    },
    methods: {
        async fetchQuizData() {
            this.loading = true;
            this.error = null;

            try {
                // Fetch quiz details

                // Fetch quiz questions
                const questionsResponse = await fetch(`http://localhost:5008/api/quiz/folders/getQuestionsByFolderId?folderId=${this.quizId}`);
                console.log(questionsResponse);

                if (!questionsResponse.ok) {
                    throw new Error(`Server responded with status: ${questionsResponse.status}`);
                }

                const questionsData = await questionsResponse.json();
                this.questions = questionsData || [];

                // Reset quiz state
                this.currentQuestionIndex = 0;
                this.answeredQuestions = [];
                this.correctAnswers = 0;
                this.showResults = false;

            } catch (error) {
                console.error('❌ Failed to fetch quiz data:', error);
                this.error = 'Could not load quiz. Please try again later.';
            } finally {
                this.loading = false;
            }
        },

        selectOption(option) {
            if (this.showAnswer && this.mode === 'learn') return;
            this.selectedOption = option;
        },

        checkAnswer() {
            this.showAnswer = true;

            if (!this.answeredQuestions.includes(this.currentQuestionIndex)) {
                this.answeredQuestions.push(this.currentQuestionIndex);

                if (this.isCorrect) {
                    this.correctAnswers++;
                }
            }

            this.$nextTick(() => {
                if (window.MathJax?.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });
        }
        ,

        nextQuestion() {
            this.showAnswer = false;
            this.selectedOption = '';
            this.userAnswer = '';

            if (this.isLastQuestion) {
                this.showResults = true;
            } else {
                this.currentQuestionIndex++;
            }
        },

        jumpToQuestion(index) {
            if (this.mode === 'test' && !this.answeredQuestions.includes(this.currentQuestionIndex)) {
                // In test mode, require answering the current question before jumping
                alert('Please answer the current question before moving to another one.');
                return;
            }

            this.currentQuestionIndex = index;
            this.showAnswer = false;
            this.selectedOption = '';
            this.userAnswer = '';
        },

        restartQuiz() {
            this.currentQuestionIndex = 0;
            this.selectedOption = '';
            this.userAnswer = '';
            this.showAnswer = false;
            this.answeredQuestions = [];
            this.correctAnswers = 0;
            this.showResults = false;
        },


        goBack() {
            this.$router.push('/quiz-folder');
        }
    }
};
</script>

<style scoped>
.quiz-view-page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
}

.loading-container,
.error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    background-color: #f9f9f9;
    border-radius: 10px;
    padding: 2rem;
    text-align: center;
}

.quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.quiz-meta {
    text-align: center;
    flex-grow: 1;
}

.quiz-title {
    font-size: 1.8rem;
    color: #0055B8;
    margin-bottom: 0.5rem;
}

.quiz-tags {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
}

.quiz-tag {
    background-color: #f0f0f0;
    padding: 0.2rem 0.6rem;
    border-radius: 20px;
    font-size: 0.8rem;
    color: #555;
}

.back-btn {
    padding: 0.5rem 1rem;
    background-color: white;
    color: #555;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
}

.edit-btn {
    padding: 0.5rem 1rem;
    background-color: white;
    color: #66CC99;
    border: 2px solid #66CC99;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
}

.quiz-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
}

.quiz-progress {
    flex-grow: 1;
    margin-right: 1rem;
}

.progress-bar {
    height: 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 0.5rem;
}

.progress-fill {
    height: 100%;
    background-color: #66CC99;
    transition: width 0.3s ease;
}

.quiz-mode {
    display: flex;
    gap: 0.5rem;
}

.quiz-mode button {
    padding: 0.5rem 1rem;
    background-color: white;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
}

.quiz-mode button.active {
    background-color: #66CC99;
    color: white;
    border-color: #66CC99;
}

.question-container {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 2rem;
    margin-bottom: 2rem;
}

.question-content h2 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
    color: #333;
}

.question-text {
    margin-bottom: 1.5rem;
    line-height: 1.5;
}

.question-images {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.question-image {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border: 1px solid #eee;
    border-radius: 6px;
}

.answer-options {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
}

.answer-option {
    display: flex;
    align-items: flex-start;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.answer-option:hover {
    background-color: #f9f9f9;
}

.answer-option.selected {
    border-color: #66CC99;
    background-color: #f0fff7;
}

.answer-option.correct {
    border-color: #4CAF50;
    background-color: #ebffef;
}

.answer-option.incorrect {
    border-color: #FF4444;
    background-color: #fff0f0;
}

.option-label {
    font-weight: bold;
    min-width: 30px;
    margin-right: 0.5rem;
}

.free-response textarea {
    width: 100%;
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    resize: vertical;
    font-family: inherit;
    font-size: 1rem;
}

.question-actions {
    display: flex;
    justify-content: center;
    margin-top: 2rem;
}

.check-btn,
.next-btn {
    padding: 0.75rem 1.5rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    min-width: 150px;
    text-align: center;
}

.check-btn:disabled {
    background-color: #ddd;
    cursor: not-allowed;
}

.answer-feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.feedback-message {
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
}

.feedback-message.correct {
    color: #4CAF50;
    background-color: #ebffef;
}

.feedback-message.incorrect {
    color: #FF4444;
    background-color: #fff0f0;
}

.correct-answer {
    margin-bottom: 1.5rem;
    text-align: center;
    max-width: 600px;
}

.question-navigator {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 2rem;
}

.nav-dot {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    background-color: white;
    border: 1px solid #ddd;
    cursor: pointer;
}

.nav-dot.current {
    border-color: #0055B8;
    background-color: #0055B8;
    color: white;
}

.nav-dot.answered {
    background-color: #e0f5ed;
    border-color: #66CC99;
}

.results-container {
    background-color: white;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 3rem;
    text-align: center;
}

.results-summary {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 2rem 0;
}

.score-circle {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    border: 10px solid #66CC99;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.5rem;
}

.score-percentage {
    font-size: 2.5rem;
    font-weight: bold;
    color: #333;
}

.results-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
}

.restart-btn {
    padding: 0.75rem 1.5rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
}

@media (max-width: 768px) {
    .quiz-header {
        flex-direction: column;
        gap: 1rem;
    }

    .quiz-controls {
        flex-direction: column;
        gap: 1rem;
    }

    .quiz-progress {
        width: 100%;
        margin-right: 0;
    }
}
</style>