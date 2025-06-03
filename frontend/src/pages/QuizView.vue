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
                    <div class="question-header">
                        <h2>Question {{ currentQuestion.question_number }}</h2>
                    </div>

                    <!-- Loading state for question splitting -->
                    <div v-if="splittingQuestion" class="splitting-loader">
                        <p>🤖 Analyzing question structure...</p>
                    </div>

                    <!-- Single question display (original format) -->
                    <div v-if="!currentQuestion.questionParts && !splittingQuestion" class="single-question">
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

                            <textarea v-model="userAnswer" placeholder="Enter your answer here..."
                                :disabled="showAnswer" rows="4"></textarea>
                        </div>
                    </div>

                    <!-- Multi-part question display -->
                    <div v-if="currentQuestion.questionParts && !splittingQuestion" class="multi-part-question">
                        <div class="main-question-text" v-html="formattedQuestionText"></div>

                        <div v-if="currentQuestion.image_paths && currentQuestion.image_paths.length"
                            class="question-images">
                            <img v-for="(image, index) in currentQuestion.image_paths" :key="index" :src="image"
                                :alt="`Question ${currentQuestion.question_number} diagram ${index + 1}`"
                                class="question-image" />
                        </div>

                        <div class="question-parts">
                            <div v-for="(part, partIndex) in currentQuestion.questionParts" :key="partIndex"
                                class="question-part" :class="{ 'show-that-part': part.requiresAnswer === false }">

                                <div class="part-header">
                                    <h4 class="part-label">{{ part.partLabel }}</h4>
                                    <span v-if="part.requiresAnswer === false" class="show-that-badge">Show that</span>
                                </div>

                                <div class="part-text" v-html="formatPartText(part.partText)"></div>

                                <!-- Answer input for parts that require answers -->
                                <div v-if="part.requiresAnswer !== false" class="part-answer-section">
                                    <div v-if="part.hasOptions" class="part-answer-options">
                                        <div v-for="option in part.answerOptions" :key="option.option" :class="[
                                            'answer-option',
                                            { 'selected': partAnswers[partIndex] === option.option },
                                            { 'correct': showAnswer && option.option === part.correctAnswer },
                                            { 'incorrect': showAnswer && partAnswers[partIndex] === option.option && option.option !== part.correctAnswer }
                                        ]" @click="selectPartOption(partIndex, option.option)">
                                            <span class="option-label">{{ option.option }}</span>
                                            <span class="option-text" v-html="option.text"></span>
                                        </div>
                                    </div>

                                    <div v-else class="part-free-response">
                                        <h5 v-html="part.text"></h5>
                                        <button @click="togglePartMathEditor(partIndex)" class="toggle-editor-btn">
                                            {{ partMathEditors[partIndex] ? 'Hide Math Editor ✖️' : 'Show Math Editor✍️' }}
                                        </button>

                                        <div v-if="partMathEditors[partIndex]" class="math-editor-section">
                                            <MathEditor v-model="partMathInputs[partIndex]" />
                                        </div>

                                        <textarea v-model="partAnswers[partIndex]"
                                            :placeholder="`Enter your answer for part ${part.part_label}...`"
                                            :disabled="showAnswer" rows="3" class="part-textarea"></textarea>
                                    </div>

                                    <!-- Show correct answer for this part in learn mode -->
                                    <div v-if="showAnswer && mode === 'learn'" class="part-answer-feedback">
                                        <div
                                            :class="['part-feedback-message', isPartCorrect(partIndex) ? 'correct' : 'incorrect']">
                                            <span v-if="isPartCorrect(partIndex)">✓ Correct!</span>
                                            <span v-else>✗ Incorrect</span>
                                        </div>
                                        <div class="part-correct-answer">
                                            <strong>Correct Answer:</strong>
                                            <div v-html="formatPartText(part.answer)"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="question-actions">
                    <button v-if="!showAnswer" @click="checkAnswer" class="check-btn"
                        :disabled="mode === 'test' && !canCheckAnswer">
                        {{ mode === 'test' ? 'Submit Answer' : 'Check Answer' }}
                    </button>

                    <div v-if="showAnswer && mode === 'learn'" class="answer-feedback">
                        <div :class="['feedback-message', overallCorrect ? 'correct' : 'incorrect']">
                            <span v-if="overallCorrect">✓ All parts correct!</span>
                            <span v-else>{{ getOverallFeedback() }}</span>
                        </div>

                        <!-- Single question answer display -->
                        <div v-if="!currentQuestion.questionParts" class="correct-answer">
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
            modeSelected: false,
            currentQuestionIndex: 0,
            selectedOption: '',
            userAnswer: '',
            mathInput: '',
            showAnswer: false,
            mode: '',
            answeredQuestions: [],
            correctAnswers: 0,
            showResults: false,
            showMathEditor: true,
            // Timer related
            timerStarted: false,
            remainingTime: 0,
            totalTime: 0,
            timerInterval: null,
            timeExpired: false,
            // Multi-part question support
            splittingQuestion: false,
            partAnswers: {},
            partMathInputs: {},
            partMathEditors: {}
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
            this.resetQuestionState();
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise().catch((err) =>
                        console.warn('MathJax rendering error:', err)
                    );
                }
            });

        },

    },
    computed: {
        currentQuestion() {
            return this.questions[this.currentQuestionIndex] || {
                question_number: 1,
                question_text: '',
                answer_options: [],
                answer_key: null,
                image_paths: [],
                questionParts: null
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
            if (this.currentQuestion.questionParts) {
                return this.overallCorrect;
            }

            if (this.hasOptions) {
                return this.selectedOption === this.correctAnswer;
            } else {
                return this.userAnswer.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase();
            }
        },
        overallCorrect() {
            if (!this.currentQuestion.questionParts) return this.isCorrect;

            return this.currentQuestion.questionParts.every((part, index) => {
                // If answer is null, it's a "show that" question - always considered correct
                if (part.answer === null) return true;
                return this.isPartCorrect(index);
            });
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
            if (this.currentQuestion.questionParts) {
                // For multi-part questions, check if all required parts have answers
                return this.currentQuestion.questionParts.every((part, index) => {
                    // If answer is null, it's a "show that" question - no answer required
                    if (part.answer === null) return true;

                    // Check if this part has an answer
                    return this.partAnswers[index] && this.partAnswers[index].trim() !== '';
                });
            }

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
                // Fetch quiz metadata
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

                // Auto-split all questions into parts
                await this.autoSplitAllQuestions();

                // Calculate timer
                const timePerQuestion = metaData.time_per_question_minutes || 1;
                this.totalTime = Math.round(timePerQuestion * this.questions.length * 60);
                this.remainingTime = this.totalTime;

                // Reset quiz state
                this.currentQuestionIndex = 0;
                this.answeredQuestions = [];
                this.correctAnswers = 0;
                this.showResults = false;
                this.timeExpired = false;
                this.modeSelected = false;

            } catch (error) {
                console.error('❌ Failed to fetch quiz data:', error);
                this.error = 'Could not load quiz. Please try again later.';
            } finally {
                this.loading = false;
            }
        },

        async autoSplitAllQuestions() {
            console.log('🔄 Auto-splitting all questions...');

            for (let i = 0; i < this.questions.length; i++) {
                const question = this.questions[i];

                try {
                    const response = await fetch(`${API_BASE_URL}/api/mathpix/gemini/split-question-parts`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            question_text: question.question_text,
                            answer_key_text: question.answer_key
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log(result)

                        // Only add parts if there are multiple parts
                        if (result.parts && result.parts.length > 1) {
                            this.questions[i].questionParts = result.parts;
                            console.log(`✅ Question ${i + 1} split into ${result.parts.length} parts`);
                        } else {
                            console.log(`ℹ️ Question ${i + 1} is single-part`);
                        }
                    } else {
                        console.warn(`⚠️ Failed to split question ${i + 1}`);
                    }
                } catch (error) {
                    console.error(`❌ Error splitting question ${i + 1}:`, error);
                }
            }

            console.log('✅ Finished auto-splitting questions');
        },

        async splitIntoparts() {
            this.splittingQuestion = true;

            try {
                const response = await fetch(`${API_BASE_URL}/api/mathpix/gemini/split-question-parts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question_text: this.currentQuestion.question_text,
                        answer_key_text: this.currentQuestion.answer_key
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to split question parts');
                }

                const result = await response.json();

                // Update the current question with the split parts
                this.questions[this.currentQuestionIndex].questionParts = result.parts;

                // Initialize part answers and math editor states
                this.initializePartAnswers();

                console.log('Question split successfully:', result);

            } catch (error) {
                console.error('❌ Failed to split question:', error);
                alert('Failed to split question into parts. Please try again.');
            } finally {
                this.splittingQuestion = false;
            }
        },

        initializePartAnswers() {
            const questionIndex = this.currentQuestionIndex;

            if (this.currentQuestion.questionParts) {
                const newPartAnswers = {};
                const newPartMathInputs = {};
                const newPartMathEditors = {};

                this.currentQuestion.questionParts.forEach((part, index) => {
                    // If answer is null, it's likely a "show that" question
                    if (part.answer !== null) {
                        newPartAnswers[index] = '';
                        newPartMathInputs[index] = '';
                        newPartMathEditors[index] = false;
                    }
                });

                this.partAnswers = { ...this.partAnswers, ...newPartAnswers };
                this.partMathInputs = { ...this.partMathInputs, ...newPartMathInputs };
                this.partMathEditors = { ...this.partMathEditors, ...newPartMathEditors };
            }
        },

        resetQuestionState() {
            this.selectedOption = '';
            this.userAnswer = '';
            this.mathInput = '';
            this.showAnswer = false;
            this.partAnswers = {};
            this.partMathInputs = {};
            this.partMathEditors = {};

            // Initialize part answers for multi-part questions
            if (this.currentQuestion.questionParts) {
                this.initializePartAnswers();
            }
        },

        selectMode(selectedMode) {
            this.mode = selectedMode;
            this.modeSelected = true;

            if (selectedMode === 'learn') {
                this.$nextTick(() => {
                    this.processMathJax();
                });
            }
        },

        backToModeSelection() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            this.modeSelected = false;
            this.mode = '';
            this.timerStarted = false;
            this.resetQuestionState();
            this.currentQuestionIndex = 0;
            this.answeredQuestions = [];
            this.correctAnswers = 0;
            this.showResults = false;
            this.timeExpired = false;
            this.remainingTime = this.totalTime;
        },

        startTest() {
            this.timerStarted = true;
            this.startTimer();
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
                    this.finishQuiz(false);
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

        selectPartOption(partIndex, option) {
            if (this.showAnswer && this.mode === 'learn') return;
            this.partAnswers = { ...this.partAnswers, [partIndex]: option };
        },

        togglePartMathEditor(partIndex) {
            this.partMathEditors = { ...this.partMathEditors, [partIndex]: !this.partMathEditors[partIndex] };
        },

        formatPartText(text) {
            return text ? marked(text) : '';
        },

        isPartCorrect(partIndex) {
            const part = this.currentQuestion.questionParts[partIndex];
            const userAnswer = this.partAnswers[partIndex];

            // Simple text comparison (you can enhance this logic as needed)
            return userAnswer && userAnswer.trim().toLowerCase() === part.answer.trim().toLowerCase();
        },

        getOverallFeedback() {
            if (!this.currentQuestion.questionParts) return '';

            const totalParts = this.currentQuestion.questionParts.filter(part => part.answer !== null).length;
            const correctParts = this.currentQuestion.questionParts.filter((part, index) => {
                if (part.answer === null) return false;
                return this.isPartCorrect(index);
            }).length;

            return `${correctParts}/${totalParts} parts correct`;
        },

        checkAnswer() {
            this.showAnswer = true;

            if (!this.answeredQuestions.includes(this.currentQuestionIndex)) {
                this.answeredQuestions.push(this.currentQuestionIndex);

                if (this.isCorrect) {
                    this.correctAnswers++;
                }
            }

            if (this.mode === 'test') {
                setTimeout(() => {
                    this.nextQuestion();
                }, 500);
            } else {
                this.$nextTick(() => {
                    this.processMathJax();
                });
            }
        },

        nextQuestion() {
            this.showAnswer = false;
            this.resetQuestionState();

            if (this.isLastQuestion) {
                this.finishQuiz();
            } else {
                this.currentQuestionIndex++;
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
                alert('Please answer the current question before moving to another one.');
                return;
            }

            this.currentQuestionIndex = index;
            this.resetQuestionState();
            this.$nextTick(() => {
                this.processMathJax();
            });
        },

        restartQuiz() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }

            this.currentQuestionIndex = 0;
            this.resetQuestionState();
            this.answeredQuestions = [];
            this.correctAnswers = 0;
            this.showResults = false;
            this.timerStarted = false;
            this.timeExpired = false;
            this.remainingTime = this.totalTime;

            this.$nextTick(() => {
                this.processMathJax();
            });
        },

        goBack() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
            this.$router.push('/quiz-folder');
        }
    }
};
</script>

<style scoped>
.quiz-view-page {
    font-family: Arial, sans-serif;
    min-height: 100vh;
}

/* Part Question Text Styling */
.part-question-text {
    background-color: #f8f9fa;
    border-left: 4px solid #66CC99;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 0 6px 6px 0;
}

.part-text-label {
    font-weight: bold;
    color: #333;
    margin-bottom: 0.5rem;
    font-size: 1rem;
}

.part-text-content {
    line-height: 1.5;
    color: #555;
}

.part-answer-controls {
    width: 100%;
}

.show-that-section {
    padding: 1rem;
    background-color: #f0f8ff;
    border-radius: 6px;
    border-left: 4px solid #4285f4;
}

.show-that-section .part-text {
    margin: 0;
    line-height: 1.5;
    color: #333;
}

/* Question Header */
.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.split-question-btn {
    padding: 0.5rem 1rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: background-color 0.2s ease;
}

.split-question-btn:hover {
    background-color: #4CAF50;
}

.split-question-btn:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

.splitting-loader {
    text-align: center;
    padding: 2rem;
    color: #666;
    font-style: italic;
}

/* Multi-part Question Styles */
.multi-part-question {
    width: 100%;
}

.main-question-text {
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f0f0f0;
}

.question-parts {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.question-part {
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    padding: 1.5rem;
    background-color: #fafafa;
    transition: border-color 0.2s ease;
}

.question-part:hover {
    border-color: #66CC99;
}

.show-that-part {
    background-color: #f0f8ff;
    border-color: #b3d9ff;
}

.part-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.part-label {
    font-size: 1.1rem;
    font-weight: bold;
    color: #333;
    margin: 0;
}

.show-that-badge {
    background-color: #e3f2fd;
    color: #1565c0;
    padding: 0.3rem 0.8rem;
    border-radius: 15px;
    font-size: 0.8rem;
    font-weight: 500;
}

.part-text {
    margin-bottom: 1rem;
    line-height: 1.5;
}

.part-answer-section {
    margin-top: 1rem;
}

.part-answer-options {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
}

.part-free-response {
    width: 100%;
}

.part-textarea {
    width: 100%;
    padding: 0.8rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    resize: vertical;
    font-family: inherit;
    font-size: 1rem;
    margin-top: 0.5rem;
}

.part-answer-feedback {
    margin-top: 1rem;
    padding: 1rem;
    border-radius: 6px;
    background-color: #f9f9f9;
}

.part-feedback-message {
    font-weight: bold;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
}

.part-feedback-message.correct {
    color: #4CAF50;
    background-color: #ebffef;
}

.part-feedback-message.incorrect {
    color: #FF4444;
    background-color: #fff0f0;
}

.part-correct-answer {
    margin-top: 0.5rem;
    color: #333;
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

    .question-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .split-question-btn {
        align-self: flex-end;
    }

    .question-parts {
        gap: 1.5rem;
    }

    .question-part {
        padding: 1rem;
    }
}
</style>