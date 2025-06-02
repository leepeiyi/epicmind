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

        <!-- Initial Mode Selection Screen -->
        <div v-else-if="!modeSelected" class="mode-selection-screen">
            <div class="mode-selection-container">
                <button @click="goBack" class="back-btn">← Back to Quizzes</button>

                <div class="quiz-intro">
                    <h1 class="quiz-title">{{ quiz.folder_name }}</h1>
                    <div class="quiz-tags">
                        <span class="quiz-tag">{{ quiz.subject }}</span>
                        <span class="quiz-tag">{{ quiz.level }}</span>
                        <span class="quiz-tag">{{ quiz.question_count }} questions</span>
                    </div>

                    <p class="quiz-description">Choose how you'd like to practice:</p>

                    <div class="mode-options">
                        <div class="mode-card" @click="selectMode('learn')">
                            <div class="mode-icon">📚</div>
                            <h3>Learn Mode</h3>
                            <p>Practice with immediate feedback</p>
                            <ul class="mode-features">
                                <li>✅ See correct answers immediately</li>
                                <li>✅ Learn from mistakes</li>
                                <li>✅ No time pressure</li>
                                <li>✅ Jump between questions</li>
                            </ul>
                            <button class="mode-select-btn learn-btn">Start Learning</button>
                        </div>

                        <div class="mode-card" @click="selectMode('test')">
                            <div class="mode-icon">⏱️</div>
                            <h3>Test Mode</h3>
                            <p>Simulate exam conditions</p>
                            <ul class="mode-features">
                                <li>🎯 Timed experience</li>
                                <li>🎯 No immediate feedback</li>
                                <li>🎯 Results at the end</li>
                                <li>🎯 {{ Math.floor(remainingTime / 60) }} minutes total</li>
                            </ul>
                            <button class="mode-select-btn test-btn">Start Test</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Test Mode Start Screen -->
        <div v-else-if="mode === 'test' && !timerStarted" class="test-start-screen">
            <div class="test-start-container">
                <button @click="goBack" class="back-btn">← Back to Quizzes</button>

                <div class="test-info">
                    <h1 class="quiz-title">{{ quiz.folder_name }}</h1>
                    <div class="quiz-tags">
                        <span class="quiz-tag">{{ quiz.subject }}</span>
                        <span class="quiz-tag">{{ quiz.level }}</span>
                        <span class="quiz-tag">{{ quiz.question_count }} questions</span>
                    </div>

                    <div class="test-details">
                        <div class="test-detail-item">
                            <div class="detail-icon">⏱️</div>
                            <div class="detail-content">
                                <h3>Time Limit</h3>
                                <p>{{ Math.floor(remainingTime / 60) }} minutes total</p>
                                <small>{{ quiz.time_per_question_minutes || 1 }} minute(s) per question</small>
                            </div>
                        </div>

                        <div class="test-detail-item">
                            <div class="detail-icon">📝</div>
                            <div class="detail-content">
                                <h3>Questions</h3>
                                <p>{{ questions.length }} questions</p>
                                <small>Answer all questions before time runs out</small>
                            </div>
                        </div>

                        <div class="test-detail-item">
                            <div class="detail-icon">🎯</div>
                            <div class="detail-content">
                                <h3>Test Mode</h3>
                                <p>No hints or immediate feedback</p>
                                <small>Results shown at the end</small>
                            </div>
                        </div>
                    </div>

                    <div class="start-button-container">
                        <button @click="startTest" class="start-test-btn">
                            🚀 Start Test Now
                        </button>
                        <button @click="backToModeSelection" class="switch-mode-btn">
                            ← Back to Mode Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Quiz Interface -->
        <div v-else class="quiz-container">
            <div class="quiz-header">
                <button @click="backToModeSelection" class="back-btn">← Back to Mode Selection</button>
                <div class="quiz-meta">
                    <h1 class="quiz-title">{{ quiz.folder_name }}</h1>
                    <div class="quiz-tags">
                        <span class="quiz-tag">{{ quiz.subject }}</span>
                        <span class="quiz-tag">{{ quiz.level }}</span>
                        <span class="quiz-tag">{{ quiz.question_count }} questions</span>
                    </div>
                </div>
                <div class="current-mode-badge" :class="mode">
                    {{ mode === 'learn' ? '📚 Learn Mode' : '⏱️ Test Mode' }}
                </div>
            </div>

            <!-- Timer Bar (only show in test mode) -->
            <div v-if="mode === 'test' && timerStarted" class="timer-container">
                <div class="timer-bar">
                    <div class="timer-fill" :style="{ width: `${timerPercentage}%` }"
                        :class="{ 'timer-warning': remainingTime < 300 }"></div>
                </div>
                <div class="timer-text">
                    <span class="time-remaining" :class="{ 'time-warning': remainingTime < 300 }">
                        ⏱️ {{ formattedTime }}
                    </span>
                    <span class="timer-label">remaining</span>
                </div>
            </div>

            <div class="quiz-controls">
                <div class="quiz-progress">
                    <p>Question {{ currentQuestionIndex + 1 }} of {{ questions.length }}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
                    </div>
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

                        <button @click="showMathEditor = !showMathEditor" class="toggle-editor-btn">
                            {{ showMathEditor ? 'Hide Math Editor ✖️' : 'Show Math Editor ✍️' }}
                        </button>

                        <div v-if="showMathEditor" class="math-editor-section">
                            <MathEditor v-model="mathInput" />
                        </div>


                        <textarea v-model="userAnswer" placeholder="Enter your answer here..." :disabled="showAnswer"
                            rows="4"></textarea>
                    </div>
                </div>

                <div class="question-actions">
                    <button v-if="!showAnswer" @click="checkAnswer" class="check-btn"
                        :disabled="mode === 'test' && !canCheckAnswer">
                        {{ mode === 'test' ? 'Submit Answer' : 'Check Answer' }}
                    </button>

                    <div v-if="showAnswer && mode === 'learn'" class="answer-feedback">
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

                    <!-- Test mode: just move to next question without showing answer -->
                    <div v-if="showAnswer && mode === 'test'" class="test-mode-next">
                        <button @click="nextQuestion" class="next-btn">
                            {{ isLastQuestion ? 'Finish Test' : 'Next Question' }}
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
            <h2>{{ mode === 'test' ? 'Test Results' : 'Quiz Results' }}</h2>
            <div class="results-summary">
                <div class="score-circle">
                    <span class="score-percentage">{{ scorePercentage }}%</span>
                </div>
                <div class="score-details">
                    <p>You answered {{ correctAnswers }} out of {{ questions.length }} questions correctly.</p>
                    <p v-if="mode === 'test' && timeExpired" class="time-expired">⏰ Time expired during test</p>
                    <p v-if="mode === 'test'" class="test-completion-info">
                        📊 Test completed in {{ formatTimeTaken }}
                    </p>
                </div>
            </div>

            <div class="results-actions">
                <button @click="restartQuiz" class="restart-btn">{{ mode === 'test' ? 'Retake Test' : 'Restart Quiz'
                }}</button>
                <button @click="backToModeSelection" class="back-btn">Try Different Mode</button>
                <button @click="goBack" class="back-btn">Back to Quizzes</button>
            </div>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { marked } from 'marked';
import API_BASE_URL from '../config/api.js';
import MathEditor from '../components/MathEditor.vue';

export default {
    name: 'QuizView',
    components: { Navbar, MathEditor },
    data() {
        return {
            quizId: null,
            quiz: {
                folder_name: '',
                subject: '',
                level: '',
                question_count: 0,
                time_per_question_minutes: 1
            },
            questions: [],
            loading: true,
            error: null,
            modeSelected: false, // New: tracks if user has selected a mode
            currentQuestionIndex: 0,
            selectedOption: '',
            userAnswer: '',
            mathInput: '',
            showAnswer: false,
            mode: '', // Start empty until user selects
            answeredQuestions: [],
            correctAnswers: 0,
            showResults: false,
            showMathEditor: true,
            // Timer related
            timerStarted: false,
            remainingTime: 0,
            totalTime: 0,
            timerInterval: null,
            timeExpired: false
        };
    },
    watch: {
        formattedQuestionText() {
            this.$nextTick(() => {
                this.processMathJax();
            });
        },
        formattedAnswer() {
            this.$nextTick(() => {
                this.processMathJax();
            });
        },
        currentQuestionIndex() {
            // Process MathJax when question changes (important for test mode)
            this.$nextTick(() => {
                this.processMathJax();
            });
        }
    },
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

                // Process through marked just like the question text
                return parsed.correct_answer ? marked(parsed.correct_answer) : '';
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
        },
        formattedTime() {
            const min = Math.floor(this.remainingTime / 60);
            const sec = this.remainingTime % 60;
            return `${min}:${sec < 10 ? '0' : ''}${sec}`;
        },
        timerPercentage() {
            if (this.totalTime === 0) return 100;
            return (this.remainingTime / this.totalTime) * 100;
        },
        formatTimeTaken() {
            const timeTaken = this.totalTime - this.remainingTime;
            const minutes = Math.floor(timeTaken / 60);
            const seconds = timeTaken % 60;
            return `${minutes}m ${seconds}s`;
        }
    },

    created() {
        this.quizId = this.$route.params.id;
        this.fetchQuizData();
    },
    beforeUnmount() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    },
    methods: {
        async fetchQuizData() {
            this.loading = true;
            this.error = null;

            try {
                // Fetch quiz metadata (includes time_per_question_minutes)
                const metaResponse = await fetch(`${API_BASE_URL}/api/quiz/${this.quizId}`);
                if (!metaResponse.ok) {
                    throw new Error(`Quiz metadata fetch failed: ${metaResponse.status}`);
                }
                const metaData = await metaResponse.json();
                this.quiz = metaData;

                // Fetch quiz questions
                const questionsResponse = await fetch(`${API_BASE_URL}/api/quiz/folders/getQuestionsByFolderId?folderId=${this.quizId}`);
                if (!questionsResponse.ok) {
                    throw new Error(`Question fetch failed: ${questionsResponse.status}`);
                }

                const questionsData = await questionsResponse.json();
                this.questions = questionsData || [];

                // Calculate timer (in seconds)
                const timePerQuestion = metaData.time_per_question_minutes || 1;
                this.totalTime = Math.round(timePerQuestion * this.questions.length * 60);
                this.remainingTime = this.totalTime;

                // Reset quiz state but don't show questions yet
                this.currentQuestionIndex = 0;
                this.answeredQuestions = [];
                this.correctAnswers = 0;
                this.showResults = false;
                this.timeExpired = false;
                this.modeSelected = false; // Show mode selection first

            } catch (error) {
                console.error('❌ Failed to fetch quiz data:', error);
                this.error = 'Could not load quiz. Please try again later.';
            } finally {
                this.loading = false;
            }
        },

        selectMode(selectedMode) {
            this.mode = selectedMode;
            this.modeSelected = true;

            // If learn mode, start immediately. If test mode, show test start screen
            if (selectedMode === 'learn') {
                this.$nextTick(() => {
                    this.processMathJax();
                });
            }
        },

        backToModeSelection() {
            // Clear timer if running
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            // Reset quiz state
            this.modeSelected = false;
            this.mode = '';
            this.timerStarted = false;
            this.currentQuestionIndex = 0;
            this.selectedOption = '';
            this.userAnswer = '';
            this.showAnswer = false;
            this.answeredQuestions = [];
            this.correctAnswers = 0;
            this.showResults = false;
            this.timeExpired = false;
            this.remainingTime = this.totalTime;
        },

        startTest() {
            this.timerStarted = true;
            this.startTimer();
            // Process MathJax for the first question when test starts
            this.$nextTick(() => {
                this.processMathJax();
            });
        },

        startTimer() {
            this.timerInterval = setInterval(() => {
                if (this.remainingTime > 0) {
                    this.remainingTime--;
                } else {
                    this.timeExpired = true;
                    this.finishQuiz(false); // ⏰ timer expired
                }
            }, 1000);
        },

        processMathJax() {
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise().catch((err) => {
                    console.warn('MathJax processing error:', err);
                });
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

            // In test mode, automatically move to next question after a brief delay
            if (this.mode === 'test') {
                setTimeout(() => {
                    this.nextQuestion();
                }, 500);
            } else {
                // In learn mode, process MathJax for the answer
                this.$nextTick(() => {
                    this.processMathJax();
                });
            }
        },

        nextQuestion() {
            this.showAnswer = false;
            this.selectedOption = '';
            this.userAnswer = '';

            if (this.isLastQuestion) {
                this.finishQuiz();
            } else {
                this.currentQuestionIndex++;
                // Process MathJax for the new question
                this.$nextTick(() => {
                    this.processMathJax();
                });
            }
        },

        async finishQuiz(completed = true) {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            this.showResults = true;
            this.timerStarted = false;

            // ✅ Send completion update if in test mode
            if (this.mode === 'test') {
                const user = JSON.parse(sessionStorage.getItem('user') || '{}');
                const payload = {
                    student_id: user.id,
                    quiz_id: this.quizId,
                    completed,
                    completion_date: new Date().toISOString(),
                    score: this.scorePercentage
                };

                try {
                    await fetch(`${API_BASE_URL}/api/quiz-assignment/complete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                } catch (err) {
                    console.error('❌ Failed to record quiz completion:', err);
                }
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

            // Process MathJax for the new question
            this.$nextTick(() => {
                this.processMathJax();
            });
        },

        restartQuiz() {
            // Clear timer
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            // Reset all state
            this.currentQuestionIndex = 0;
            this.selectedOption = '';
            this.userAnswer = '';
            this.showAnswer = false;
            this.answeredQuestions = [];
            this.correctAnswers = 0;
            this.showResults = false;
            this.timerStarted = false;
            this.timeExpired = false;
            this.remainingTime = this.totalTime;

            // Process MathJax for the first question
            this.$nextTick(() => {
                this.processMathJax();
            });
        },

        goBack() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.$router.push('/quiz-folder');
        },

        editQuiz() {
            // Implementation for edit quiz functionality
            console.log('Edit quiz clicked');
        }
    }
};
</script>

<style scoped>
.quiz-view-page {
    font-family: Arial, sans-serif;
    min-height: 100vh;
}

/* Mode Selection Screen */
.mode-selection-screen {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.mode-selection-container {
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    padding: 3rem;
    max-width: 900px;
    width: 100%;
    position: relative;
}

.mode-selection-container .back-btn {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.5rem 1rem;
    background-color: white;
    color: #555;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.mode-selection-container .back-btn:hover {
    background-color: #f5f5f5;
}

.quiz-intro {
    text-align: center;
    margin-top: 2rem;
}

.quiz-description {
    font-size: 1.1rem;
    color: #666;
    margin: 2rem 0;
}

.mode-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 2rem;
}

.mode-card {
    border: 2px solid #e9ecef;
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    background: white;
}

.mode-card:hover {
    border-color: #66CC99;
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(102, 204, 153, 0.15);
}

.mode-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.mode-card h3 {
    color: #333;
    margin-bottom: 0.5rem;
    font-size: 1.3rem;
}

.mode-card p {
    color: #666;
    margin-bottom: 1.5rem;
}

.mode-features {
    list-style: none;
    padding: 0;
    margin: 1.5rem 0;
    text-align: left;
}

.mode-features li {
    padding: 0.3rem 0;
    font-size: 0.9rem;
    color: #555;
}

.mode-select-btn {
    width: 100%;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
}

.learn-btn {
    background-color: #66CC99;
    color: white;
}

.learn-btn:hover {
    background-color: #4CAF50;
}

.test-btn {
    background-color: #0055B8;
    color: white;
}

.test-btn:hover {
    background-color: #003d82;
}

/* Current Mode Badge */
.current-mode-badge {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: bold;
    font-size: 0.9rem;
}

.current-mode-badge.learn {
    background-color: #e8f5e8;
    color: #2e7d32;
}

.current-mode-badge.test {
    background-color: #e3f2fd;
    color: #1565c0;
}

/* Test Start Screen */
.test-start-screen {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.test-start-container {
    background: white;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    padding: 3rem;
    max-width: 600px;
    width: 100%;
    text-align: center;
    position: relative;
}

.test-start-container .back-btn {
    position: absolute;
    top: 1rem;
    left: 1rem;
    padding: 0.5rem 1rem;
    background-color: white;
    color: #555;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
}

.test-info {
    margin-top: 2rem;
}

.test-details {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin: 3rem 0;
}

.test-detail-item {
    display: flex;
    align-items: center;
    text-align: left;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 12px;
    border-left: 4px solid #66CC99;
}

.detail-icon {
    font-size: 2rem;
    margin-right: 1rem;
    min-width: 60px;
}

.detail-content h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.1rem;
}

.detail-content p {
    margin: 0 0 0.2rem 0;
    font-weight: 600;
    color: #0055B8;
}

.detail-content small {
    color: #666;
    font-size: 0.9rem;
}

.start-button-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
}

.start-test-btn {
    background: linear-gradient(135deg, #66CC99 0%, #4CAF50 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s ease;
    min-width: 200px;
}

.start-test-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 204, 153, 0.3);
}

.switch-mode-btn {
    background: white;
    color: #66CC99;
    border: 2px solid #66CC99;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
}

/* Timer Container */
.timer-container {
    background: white;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 1rem;
    margin-bottom: 2rem;
    border-left: 4px solid #66CC99;
}

.timer-bar {
    height: 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
}

.timer-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50 0%, #66CC99 50%, #FFA726 100%);
    transition: width 1s linear;
}

.timer-fill.timer-warning {
    background: linear-gradient(90deg, #FF5252 0%, #FF7043 100%);
    animation: pulse 1s infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.7;
    }
}

.timer-text {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.time-remaining {
    font-size: 1.1rem;
    font-weight: bold;
    color: #333;
}

.time-remaining.time-warning {
    color: #FF5252;
    animation: pulse 1s infinite;
}

.timer-label {
    color: #666;
    font-size: 0.9rem;
}

/* Existing styles */
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

.test-mode-next {
    display: flex;
    justify-content: center;
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

.time-expired {
    color: #FF5252;
    font-weight: 600;
    margin-top: 0.5rem;
}

.test-completion-info {
    color: #66CC99;
    font-weight: 500;
    margin-top: 0.5rem;
}

.results-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    flex-wrap: wrap;
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

.math-editor-section {
    background-color: #f9f9f9;
    padding: 1.5rem;
    border-radius: 10px;
    margin-top: 0.5rem;
    width: 100%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}


.math-editor-section h3 {
    margin-bottom: 1rem;
    font-weight: 600;
    font-size: 1.1rem;
    color: #333;
}

.toggle-editor-btn {
  margin-bottom: 1rem;
  background: #f8f9fa;
  border: 1px solid #ccc;
  color: #333;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s ease;
}

.toggle-editor-btn:hover {
  background: #e6f3ec;
  border-color: #66CC99;
}


@media (max-width: 768px) {
    .mode-options {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

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

    .test-start-container,
    .mode-selection-container {
        margin: 1rem;
        padding: 2rem;
    }

    .test-details {
        gap: 1rem;
    }

    .test-detail-item {
        flex-direction: column;
        text-align: center;
    }

    .detail-icon {
        margin: 0 0 1rem 0;
    }

    .start-button-container {
        margin-top: 2rem;
    }

    .results-actions {
        flex-direction: column;
        align-items: center;
    }

    .results-actions button {
        width: 100%;
        max-width: 300px;
    }
}
</style>