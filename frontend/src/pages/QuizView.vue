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
            <!-- API Limit Notification -->
            <div v-if="apiLimitReached" class="api-notification">
                <p>⚠️ API limit reached. Quiz will work normally but without automatic question segmentation.</p>
            </div>
            
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
                        <div class="question-actions-header">
                            <button
                                v-if="isTeacher"
                                class="edit-question-btn"
                                @click="openEditModal"
                                title="Edit this question"
                            >
                                ✏️ Edit Question
                            </button>
                            <button
                                class="report-question-btn"
                                @click="showReportModal = true"
                                title="Report an issue with this question"
                            >
                                🚩 Report
                            </button>
                        </div>
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
                                class="question-part" :class="{ 'show-that-part': part.answer === null }">

                                <div class="part-header">
                                    <h4 class="part-label">{{ part.part_label }}</h4>
                                    <span v-if="part.answer === null" class="show-that-badge">Show that</span>
                                </div>

                                <!-- Answer input for parts that require answers -->
                                <div v-if="part.answer !== null" class="part-answer-section">
                                    <div class="part-question-text">
                                        <div class="part-text-content" v-html="formatPartText(part.text)"></div>
                                    </div>
                                    
                                    <div class="part-answer-controls">
                                        <button @click="togglePartMathEditor(partIndex)" class="toggle-editor-btn">
                                            {{ partMathEditors[partIndex] ? 'Hide Math Editor ✖️' : 'Show Math Editor ✍️' }}
                                        </button>

                                        <div v-if="partMathEditors[partIndex]" class="math-editor-section">
                                            <MathEditor v-model="partMathInputs[partIndex]" />
                                        </div>

                                        <textarea 
                                            v-model="partAnswers[partIndex]" 
                                            :placeholder="`Enter your answer for ${part.part_label}...`" 
                                            :disabled="showAnswer"
                                            rows="3"
                                            class="part-textarea"></textarea>
                                    </div>

                                    <!-- Show correct answer for this part in learn mode -->
                                    <div v-if="showAnswer && mode === 'learn'" class="part-answer-feedback">
                                        <div :class="['part-feedback-message', (partResults && partResults[partIndex]) ? 'correct' : 'incorrect']">
                                            <span v-if="partResults && partResults[partIndex]">✓ Correct!</span>
                                            <span v-else>✗ Incorrect</span>
                                        </div>
                                        <div class="part-correct-answer">
                                            <strong>Correct Answer:</strong>
                                            <div v-html="formatPartText(part.answer)"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Show that parts - just display the text -->
                                <div v-else class="show-that-section">
                                    <div class="part-text" v-html="formatPartText(part.text)"></div>
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

        <!-- Question Edit Modal (for teachers) -->
        <QuestionEditModal
            :isOpen="showEditModal"
            :question="editingQuestion"
            @close="closeEditModal"
            @saved="handleQuestionSaved"
        />

        <!-- Report Question Modal (for students) -->
        <ReportQuestionModal
            :isOpen="showReportModal"
            :question="currentQuestion"
            :quizId="quizId"
            :quizName="quiz.folder_name"
            @close="showReportModal = false"
            @reported="handleQuestionReported"
        />
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { marked } from 'marked';
import API_BASE_URL from '../config/api.js';
import MathEditor from '../components/MathEditor.vue';
import QuestionEditModal from '../components/QuestionEditModal.vue';
import ReportQuestionModal from '../components/ReportQuestionModal.vue';

export default {
    name: 'QuizView',
    components: { Navbar, MathEditor, QuestionEditModal, ReportQuestionModal },
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
            partMathEditors: {},
            // Answer checking results
            currentAnswerResult: null,
            partResults: [],
            // API availability tracking
            apiLimitReached: false,
            usingFallback: false,
            // Question editing (for teachers)
            showEditModal: false,
            editingQuestion: null,
            isTeacher: false,
            // Question reporting (for students)
            showReportModal: false
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
            // This will be updated in checkAnswer method with async results
            return this.currentAnswerResult?.isCorrect || false;
        },
        overallCorrect() {
            return this.currentAnswerResult?.isCorrect || false;
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
        this.checkIfTeacher();
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
                
                // Debug: Check if questions already have segmentation
                console.log('📊 Questions loaded:', this.questions.length);
                const segmentedCount = this.questions.filter(q => q.questionParts).length;
                console.log(`📊 Already segmented: ${segmentedCount}/${this.questions.length}`);
                
                // Only auto-split if needed
                if (segmentedCount < this.questions.length) {
                    await this.autoSplitAllQuestions();
                } else {
                    console.log('✅ All questions already segmented, skipping API calls completely');
                }

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
            console.log('🔄 Checking for pre-segmented questions...');

            const updatedQuestions = [...this.questions];
            let needsSplitting = false;

            // Check if any questions need splitting
            for (const question of updatedQuestions) {
                if (!question.questionParts) {
                    needsSplitting = true;
                    break;
                }
            }

            if (!needsSplitting) {
                console.log('✅ All questions already segmented, skipping API calls');
                return;
            }

            console.log('🔄 Some questions need splitting...');

            // Track if we've had API failures
            let apiFailureCount = 0;
            const maxFailures = 3;

            for (let i = 0; i < updatedQuestions.length; i++) {
                const question = updatedQuestions[i];

                // Skip if already has parts
                if (question.questionParts) {
                    console.log(`ℹ️ Question ${i + 1} already segmented`);
                    continue;
                }

                // If we've had too many API failures, skip remaining questions
                if (apiFailureCount >= maxFailures) {
                    console.warn('⚠️ Too many API failures, skipping remaining question splitting');
                    this.apiLimitReached = true;
                    break;
                }

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

                        // Only add parts if there are multiple parts
                        if (result.parts && result.parts.length > 1) {
                            updatedQuestions[i] = {
                                ...updatedQuestions[i],
                                questionParts: result.parts
                            };
                            console.log(`✅ Question ${i + 1} split into ${result.parts.length} parts`);
                        } else {
                            console.log(`ℹ️ Question ${i + 1} is single-part`);
                        }
                    } else {
                        console.warn(`⚠️ Failed to split question ${i + 1} - Status: ${response.status}`);
                        apiFailureCount++;
                        
                        // If it's a server error or API limit, we can use fallback
                        if (response.status >= 500 || response.status === 429) {
                            if (response.status === 429) {
                                this.apiLimitReached = true;
                            }
                            console.log('🔄 Using local fallback for question splitting');
                            const fallbackParts = this.localQuestionSplitter(question);
                            if (fallbackParts && fallbackParts.length > 1) {
                                updatedQuestions[i] = {
                                    ...updatedQuestions[i],
                                    questionParts: fallbackParts
                                };
                                console.log(`✅ Question ${i + 1} split locally into ${fallbackParts.length} parts`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error splitting question ${i + 1}:`, error);
                    apiFailureCount++;
                    
                    // Use local fallback on network errors
                    console.log('🔄 Using local fallback due to network error');
                    const fallbackParts = this.localQuestionSplitter(question);
                    if (fallbackParts && fallbackParts.length > 1) {
                        updatedQuestions[i] = {
                            ...updatedQuestions[i],
                            questionParts: fallbackParts
                        };
                        console.log(`✅ Question ${i + 1} split locally into ${fallbackParts.length} parts`);
                    }
                }
            }

            // Update the reactive questions array
            this.questions = updatedQuestions;
            console.log('✅ Finished processing questions');
            
            // Save segmented questions back to database if any were processed
            if (needsSplitting) {
                await this.saveSegmentedQuestions();
            }
        },
        
        async saveSegmentedQuestions() {
            console.log('💾 Saving segmented questions to database...');
            
            // Create a map of question ID to segmented data
            const segmentedData = {};
            for (const question of this.questions) {
                if (question.questionParts && question.questionParts.length > 1) {
                    segmentedData[question.id] = {
                        questionParts: question.questionParts
                    };
                }
            }
            
            if (Object.keys(segmentedData).length === 0) {
                console.log('ℹ️ No segmented questions to save');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/quiz/folders/saveSegmentedQuestions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        folderId: parseInt(this.quizId, 10),
                        segmentedQuestions: segmentedData
                    })
                });
                
                if (response.ok) {
                    console.log('✅ Segmented questions saved successfully');
                } else {
                    console.warn('⚠️ Failed to save segmented questions');
                }
            } catch (error) {
                console.error('❌ Error saving segmented questions:', error);
            }
        },

        async checkAnswerWithGemini(userAnswer, correctAnswer, questionText = '') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/mathpix/gemini/check-answer-similarity`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_answer: userAnswer,
                        correct_answer: correctAnswer,
                        question_context: questionText
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    return {
                        isCorrect: result.is_correct || false,
                        similarity: result.similarity || 0,
                        explanation: result.explanation || ''
                    };
                } else {
                    console.warn('Failed to check answer with Gemini, falling back to basic comparison');
                    return this.basicAnswerCheck(userAnswer, correctAnswer);
                }
            } catch (error) {
                console.error('Error checking answer with Gemini:', error);
                return this.basicAnswerCheck(userAnswer, correctAnswer);
            }
        },

        basicAnswerCheck(userAnswer, correctAnswer) {
            // Fallback basic comparison
            const cleanUser = userAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
            const cleanCorrect = correctAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
            return {
                isCorrect: cleanUser === cleanCorrect,
                similarity: cleanUser === cleanCorrect ? 1 : 0,
                explanation: 'Basic text comparison'
            };
        },

        async isPartCorrect(partIndex) {
            const part = this.currentQuestion.questionParts[partIndex];
            const userAnswer = this.partAnswers[partIndex];
            
            if (!userAnswer || !part.answer) return false;
            
            // Use Gemini for intelligent answer checking
            const checkResult = await this.checkAnswerWithGemini(
                userAnswer, 
                part.answer, 
                part.text
            );
            
            return checkResult.isCorrect;
        },

        async checkSingleQuestionAnswer() {
            if (this.hasOptions) {
                return this.selectedOption === this.correctAnswer;
            } else {
                // Use Gemini for free-response questions
                const checkResult = await this.checkAnswerWithGemini(
                    this.userAnswer,
                    this.correctAnswer,
                    this.currentQuestion.question_text
                );
                return checkResult.isCorrect;
            }
        },

        initializePartAnswers() {
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
            this.currentAnswerResult = null;
            this.partResults = [];

            // Initialize part answers for multi-part questions
            this.$nextTick(() => {
                if (this.currentQuestion.questionParts) {
                    this.initializePartAnswers();
                }
            });
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

        getOverallFeedback() {
            if (!this.currentQuestion.questionParts || !this.partResults) return '';
            
            // Count only parts that require answers (exclude "show that" parts)
            let correctCount = 0;
            let totalCount = 0;
            
            this.currentQuestion.questionParts.forEach((part, index) => {
                if (part.answer !== null) {  // Only count parts that require answers
                    totalCount++;
                    if (this.partResults[index] === true) {
                        correctCount++;
                    }
                }
            });
            
            return `${correctCount}/${totalCount} parts correct`;
        },

        async checkAnswer() {
            this.showAnswer = true;
            let isCorrect = false;

            // Check answer based on question type
            if (this.currentQuestion.questionParts) {
                // Multi-part question - check all parts
                const partResults = [];
                for (let i = 0; i < this.currentQuestion.questionParts.length; i++) {
                    const part = this.currentQuestion.questionParts[i];
                    if (part.answer !== null) {
                        const partCorrect = await this.isPartCorrect(i);
                        partResults.push(partCorrect);
                    } else {
                        partResults.push(true); // "Show that" parts are always correct
                    }
                }
                isCorrect = partResults.every(result => result === true);
                this.partResults = partResults; // Store for individual feedback
            } else {
                // Single question
                isCorrect = await this.checkSingleQuestionAnswer();
            }

            // Store the result for reactive updates
            this.currentAnswerResult = { isCorrect };

            if (!this.answeredQuestions.includes(this.currentQuestionIndex)) {
                this.answeredQuestions.push(this.currentQuestionIndex);

                if (isCorrect) {
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
        },

        localQuestionSplitter(question) {
            // Local fallback for splitting questions when API is unavailable
            console.log('🔧 Attempting local question splitting');

            if (!question.question_text) return null;

            const parts = [];
            const text = question.question_text;

            // Common patterns for sub-questions
            const patterns = [
                /\(([a-z])\)/gi,  // (a), (b), (c)
                /\b([a-z])\)/gi,  // a), b), c)
                /\(([ivx]+)\)/gi, // (i), (ii), (iii)
                /\b([ivx]+)\)/gi, // i), ii), iii)
            ];

            // Try to find sub-parts in the question
            let foundParts = [];
            for (const pattern of patterns) {
                const matches = [...text.matchAll(pattern)];
                if (matches.length > 1) {
                    foundParts = matches;
                    break;
                }
            }

            if (foundParts.length > 1) {
                // Split the question into parts based on found patterns
                for (let i = 0; i < foundParts.length; i++) {
                    const match = foundParts[i];
                    const label = match[0];
                    const startIndex = match.index;
                    const endIndex = i < foundParts.length - 1 ? foundParts[i + 1].index : text.length;

                    const partText = text.substring(startIndex + label.length, endIndex).trim();

                    // Try to extract answer from answer_key if available
                    let answer = null;
                    if (question.answer_key) {
                        try {
                            const answerKey = typeof question.answer_key === 'string'
                                ? JSON.parse(question.answer_key)
                                : question.answer_key;

                            // Look for matching part in answer
                            const answerText = answerKey.correct_answer || '';
                            const answerPattern = new RegExp(`${label}\\s*([^,\\n]+)`, 'i');
                            const answerMatch = answerText.match(answerPattern);

                            if (answerMatch) {
                                answer = answerMatch[1].trim();
                            }
                        } catch (e) {
                            console.warn('Could not parse answer key:', e);
                        }
                    }

                    parts.push({
                        part_label: label,
                        text: partText,
                        answer: answer
                    });
                }

                console.log(`✅ Locally split into ${parts.length} parts`);
                return parts;
            }

            // If no multi-part structure found, return null (will be treated as single question)
            console.log('ℹ️ No multi-part structure detected locally');
            return null;
        },

        // Teacher role check
        checkIfTeacher() {
            const user = JSON.parse(sessionStorage.getItem('user') || '{}');
            this.isTeacher = user.role === 'teacher' || user.role === 'admin';
        },

        // Question editing methods (for teachers)
        openEditModal() {
            if (!this.isTeacher) return;
            this.editingQuestion = { ...this.currentQuestion };
            this.showEditModal = true;
        },

        closeEditModal() {
            this.showEditModal = false;
            this.editingQuestion = null;
        },

        handleQuestionSaved(updatedQuestion) {
            // Update the question in the questions array
            const index = this.questions.findIndex(q => q.id === updatedQuestion.id);
            if (index !== -1) {
                this.questions[index] = {
                    ...this.questions[index],
                    question_text: updatedQuestion.text || updatedQuestion.question_text,
                    answer_options: updatedQuestion.options || updatedQuestion.answer_options,
                    answer_key: updatedQuestion.answer_key || { correct_answer: updatedQuestion.answer },
                    topic_label: updatedQuestion.topic || updatedQuestion.topic_label,
                    difficulty_level: updatedQuestion.difficulty || updatedQuestion.difficulty_level,
                    // Clear segmentation to force re-processing
                    questionParts: null
                };
            }
            this.closeEditModal();

            // Re-render MathJax
            this.$nextTick(() => {
                if (window.MathJax && window.MathJax.typesetPromise) {
                    window.MathJax.typesetPromise();
                }
            });
        },

        // Handle question reported
        handleQuestionReported(flag) {
            console.log('Question reported:', flag);
            // Could add visual indicator that question was reported
        }
    }
};
</script>

<style scoped>
.quiz-view-page {
    font-family: Arial, sans-serif;
    min-height: 100vh;
}

/* API Notification */
.api-notification {
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 6px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    text-align: center;
}

.api-notification p {
    margin: 0;
    color: #856404;
    font-size: 0.9rem;
}

/* Part Question Text Styling */
.part-question-text {
    background-color: #f8f9fa;
    border-left: 4px solid #66CC99;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    border-radius: 0 6px 6px 0;
}

.part-text-label {
    font-weight: bold;
    color: #333;
    margin-bottom: 0.5rem;
    font-size: 1rem;
}

.part-text-content {
    line-height: 1;
    color: #555;
}

.part-answer-controls {
    width: 100%;
}

.show-that-section {
    padding: 0.3cqi;
    background-color: #f0f8ff;
    border-radius: 6px;
    border-left: 4px solid #4285f4;
}

.show-that-section .part-text {
    margin: 0;
    line-height: 1;
    color: #333;
}

/* Question Header */
.question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.question-actions-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
}

.report-question-btn {
    padding: 0.4rem 0.8rem;
    background-color: #fff;
    color: #856404;
    border: 1px solid #ffc107;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.report-question-btn:hover {
    background-color: #fff3cd;
    border-color: #e0a800;
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
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
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

/* Edit Question Button (for teachers) */
.edit-question-btn {
    padding: 0.4rem 0.8rem;
    background-color: #fff3cd;
    color: #856404;
    border: 1px solid #ffeeba;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.2s ease;
}

.edit-question-btn:hover {
    background-color: #ffeeba;
    border-color: #ffda6a;
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

    .question-parts {
        gap: 1.5rem;
    }

    .question-part {
        padding: 1rem;
    }
}
</style>