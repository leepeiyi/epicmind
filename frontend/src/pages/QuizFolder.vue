<template>
    <div class="quiz-folder-page">
        <Navbar />

        <div class="main-header">
            <div>
                <h1 class="main-title">📚 My Quizzes</h1>
                <p class="description">View and manage all your saved quiz folders below.</p>
            </div>

            <!-- Teacher-only section for student management -->
            <div v-if="userRole === 'teacher'" class="teacher-actions">
                <button class="manage-students-btn" @click="showStudentManagement = !showStudentManagement">
                    {{ showStudentManagement ? 'Hide Student Management' : 'Manage Students' }}
                </button>
            </div>
        </div>

        <!-- Student Management Section (Teacher Only) -->
        <div v-if="userRole === 'teacher' && showStudentManagement" class="student-management-section">
            <h2>Student Management</h2>
            <p class="description">Add and manage students associated with your account.</p>

            <!-- Search and Add Section -->
            <div class="action-bar">
                <div class="search-container">
                    <input type="text" v-model="studentSearchQuery" placeholder="Search students..."
                        class="search-input" />
                </div>
                <button @click="showAddStudentModal = true" class="add-student-btn">
                    + Add New Student
                </button>
            </div>

            <!-- Students List -->
            <div v-if="studentsLoading" class="loading-state">
                <p>Loading your students...</p>
            </div>

            <div v-else-if="studentsError" class="error-state">
                <p>{{ studentsError }}</p>
                <button @click="fetchStudents" class="retry-btn">Try Again</button>
            </div>

            <div v-else-if="filteredStudents.length === 0" class="empty-state">
                <p v-if="studentSearchQuery">No students match your search. Try a different search term.</p>
                <p v-else>You don't have any students yet. Add students to get started.</p>
            </div>

            <div v-else class="students-list">
                <div v-for="student in filteredStudents" :key="student.id" class="student-card">
                    <div class="student-info">
                        <h3>{{ student.name }}</h3>
                        <p class="student-email">{{ student.email }}</p>
                    </div>
                    <div class="student-actions">
                        <button @click="viewAssignments(student.id)" class="assignments-btn">
                            View Assignments
                        </button>
                        <button @click="removeStudent(student.id)" class="remove-btn">
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quiz Management Section -->
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
                            <!-- Show different options based on user role -->
                            <button v-if="userRole === 'teacher'" @click="assignQuiz(quiz.id)">Assign</button>
                            <button v-else-if="userRole === 'student'" @click="viewQuiz(quiz.id)">View</button>
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

        <!-- Add Student Modal -->
        <div v-if="showAddStudentModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Manage Students</h3>
                    <button class="close-btn" @click="closeAddStudentModal">×</button>
                </div>

                <div class="modal-body">
                    <div class="search-container">
                        <input type="text" v-model="availableStudentSearch" placeholder="Search students..."
                            class="student-search" />
                    </div>

                    <div v-if="loadingAvailableStudents" class="loading-indicator">
                        <p>Loading students...</p>
                    </div>

                    <div v-else-if="availableStudentsError" class="error-message">
                        <p>{{ availableStudentsError }}</p>
                        <button @click="fetchAvailableStudents" class="retry-btn">Try Again</button>
                    </div>

                    <div v-else-if="filteredAvailableStudents.length === 0" class="empty-state">
                        <p v-if="availableStudentSearch">No students match your search. Try a different search term.</p>
                        <p v-else>No students found in the system.</p>
                    </div>

                    <div v-else class="student-list">
                        <div v-for="student in filteredAvailableStudents" :key="student.id" class="student-item">
                            <label class="checkbox-container">
                                <input type="checkbox" :checked="isStudentLinked(student.id)"
                                    @change="toggleStudentLink(student.id)" />
                                <span class="student-name">{{ student.name }}</span>
                                <span class="student-email">{{ student.email }}</span>
                            </label>
                        </div>
                    </div>

                    <div class="info-text">
                        <p>Check the box to add a student to your list. Uncheck to remove them.</p>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="cancel-btn" @click="closeAddStudentModal">Cancel</button>
                    <button class="save-btn" @click="saveStudentLinks" :disabled="savingStudentLinks">
                        {{ savingStudentLinks ? 'Saving...' : 'Save Changes' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Student Assignments Modal -->
        <div v-if="showAssignmentsModal" class="modal-overlay">
            <div class="modal-container assignments-modal">
                <div class="modal-header">
                    <h3>Quizzes Assigned to {{ currentStudentName }}</h3>
                    <button class="close-btn" @click="closeAssignmentsModal">×</button>
                </div>
                
                <div class="modal-body">
                    <div v-if="loadingAssignments" class="loading-indicator">
                        <p>Loading assignments...</p>
                    </div>
                    
                    <div v-else-if="assignmentsError" class="error-message">
                        <p>{{ assignmentsError }}</p>
                        <button @click="fetchStudentAssignments(currentStudentId)" class="retry-btn">Try Again</button>
                    </div>
                    
                    <div v-else-if="studentAssignments.length === 0" class="empty-state">
                        <p>No quizzes have been assigned to this student yet.</p>
                    </div>
                    
                    <div v-else class="assignments-list">
                        <div v-for="assignment in studentAssignments" :key="assignment.id" class="assignment-item">
                            <div class="assignment-details">
                                <h4 class="quiz-title">{{ assignment.folder_name || 'Untitled Quiz' }}</h4>
                                <div class="quiz-info">
                                    <span class="quiz-subject">{{ assignment.subject }}</span>
                                    <span class="dot">•</span>
                                    <span class="quiz-level">{{ assignment.level }}</span>
                                    <span class="dot">•</span>
                                    <span class="questions-count">{{ assignment.question_count }} questions</span>
                                </div>
                                <div class="assignment-meta">
                                    <span class="assigned-date">Assigned: {{ formatDate(assignment.assigned_at) }}</span>
                                    <span v-if="assignment.completed" class="completion-info">
                                        <span class="completion-date">Completed: {{ formatDate(assignment.completion_date) }}</span>
                                        <span v-if="assignment.score !== null" class="quiz-score">Score: {{ assignment.score }}%</span>
                                    </span>
                                </div>
                            </div>
                            <div class="assignment-status">
                                <span v-if="assignment.completed" class="status completed">
                                    ✅ Completed
                                </span>
                                <span v-else class="status pending">
                                    ⏳ Pending
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <button class="close-btn" @click="closeAssignmentsModal">Close</button>
                </div>
            </div>
        </div>

        <!-- Assignment Modal -->
        <div v-if="showAssignModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3>Assign Quiz to Students</h3>
                    <button class="close-btn" @click="closeAssignModal">×</button>
                </div>

                <div class="modal-body">
                    <div class="search-container">
                        <input type="text" v-model="assignSearchQuery" placeholder="Search students by name..."
                            class="student-search" />
                    </div>

                    <div v-if="assignLoading" class="loading-indicator">
                        <p>Loading students...</p>
                    </div>

                    <div v-else-if="assignError" class="error-message">
                        <p>{{ assignError }}</p>
                        <button @click="fetchStudentsForAssignment" class="retry-btn">Try Again</button>
                    </div>

                    <div v-else-if="filteredAssignStudents.length === 0" class="empty-state">
                        <p v-if="assignSearchQuery">No students match your search. Try a different search term.</p>
                        <p v-else>No students found. You need to have students to assign quizzes.</p>
                    </div>

                    <div v-else class="student-list">
                        <div v-for="student in filteredAssignStudents" :key="student.id" class="student-item">
                            <label class="checkbox-container">
                                <input type="checkbox" :checked="isStudentAssigned(student.id)"
                                    @change="toggleAssignment(student.id)" />
                                <span class="student-name">{{ student.name }}</span>
                                <span class="student-email">{{ student.email }}</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="cancel-btn" @click="closeAssignModal">Cancel</button>
                    <button class="save-btn" @click="saveAssignments" :disabled="savingAssignments">
                        {{ savingAssignments ? 'Saving...' : 'Save Assignments' }}
                    </button>
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
            // Quiz list data
            searchQuery: '',
            quizzes: [],
            loading: true,
            error: null,
            activeDropdown: null,

            // User data
            userRole: null,
            userId: null,

            // Student management data
            showStudentManagement: false,
            students: [],
            studentSearchQuery: '',
            studentsLoading: false,
            studentsError: null,
            showAddStudentModal: false,
            newStudentEmail: '',
            newStudent: {
                name: '',
                email: '',
                password: ''
            },
            addingStudent: false,
            teacherEmail: null,

            // Quiz assignment data
            showAssignModal: false,
            activeQuizId: null,
            assignedStudentIds: [],
            newAssignments: [],
            removedAssignments: [],
            assignSearchQuery: '',
            assignLoading: false,
            assignError: null,
            savingAssignments: false,
            
            // Available students data
            availableStudents: [],
            availableStudentSearch: '',
            loadingAvailableStudents: false,
            availableStudentsError: null,
            linkedStudentIds: [],         // IDs of students already linked to this teacher
            studentLinksToAdd: [],        // IDs of students to link
            studentLinksToRemove: [],     // IDs of students to unlink
            savingStudentLinks: false,
            
            // Student assignments modal data
            showAssignmentsModal: false,
            currentStudentId: null,
            currentStudentName: '',
            studentAssignments: [],
            loadingAssignments: false,
            assignmentsError: null,
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
        },
        filteredStudents() {
            if (!this.studentSearchQuery.trim()) {
                return this.students;
            }

            const query = this.studentSearchQuery.toLowerCase();
            return this.students.filter(student =>
                student.name.toLowerCase().includes(query) ||
                student.email.toLowerCase().includes(query)
            );
        },
        filteredAssignStudents() {
            if (!this.assignSearchQuery.trim()) {
                return this.students;
            }

            const query = this.assignSearchQuery.toLowerCase();
            return this.students.filter(student =>
                student.name.toLowerCase().includes(query) ||
                student.email.toLowerCase().includes(query)
            );
        },
        filteredAvailableStudents() {
            if (!this.availableStudentSearch.trim()) {
                return this.availableStudents;
            }

            const query = this.availableStudentSearch.toLowerCase();
            return this.availableStudents.filter(student =>
                student.name.toLowerCase().includes(query) ||
                student.email.toLowerCase().includes(query)
            );
        },
    },
    created() {
        this.getUserFromSession();
        this.fetchQuizFolders();

        // Listen for user logout event
        window.addEventListener('userLoggedOut', this.handleUserLogout);
        // Listen for storage changes (login/logout)
        window.addEventListener('storage', this.getUserFromSession);
    },
    beforeUnmount() {
        // Remove event listeners
        window.removeEventListener('userLoggedOut', this.handleUserLogout);
        window.removeEventListener('storage', this.getUserFromSession);
    },
    methods: {
        getUserFromSession() {
            const userStr = sessionStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    this.userRole = user.role;
                    this.userId = user.id;
                    this.teacherEmail = user.email;
                } catch (e) {
                    console.error('Failed to parse user from session storage:', e);
                    this.userRole = null;
                    this.userId = null;
                }
            } else {
                this.userRole = null;
                this.userId = null;
            }
        },

        handleUserLogout() {
            // Redirect to login if user logs out
            this.$router.push('/');
        },

        // QUIZ FOLDER METHODS
        async fetchQuizFolders() {
            this.loading = true;
            this.error = null;

            try {
                const response = await fetch('http://localhost:5008/api/quiz/folders/all', {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

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
        
        // AVAILABLE STUDENTS METHODS
        async fetchAvailableStudents() {
            this.loadingAvailableStudents = true;
            this.availableStudentsError = null;

            try {
                // Fetch ALL students (both linked and not linked to this teacher)
                const response = await fetch(`http://localhost:5008/api/quiz/students/all`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch students');
                }

                const data = await response.json();
                this.availableStudents = data.students || [];

                // Now get IDs of students already linked to this teacher
                await this.fetchLinkedStudentIds();
            } catch (err) {
                console.error('❌ Failed to fetch available students:', err);
                this.availableStudentsError = err.message || 'Could not load students. Please try again.';
            } finally {
                this.loadingAvailableStudents = false;
            }
        },

        async fetchLinkedStudentIds() {
            try {
                const response = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch linked students');
                }

                const data = await response.json();
                this.linkedStudentIds = data.students.map(student => student.id) || [];

                // Reset tracking arrays when we load fresh data
                this.studentLinksToAdd = [];
                this.studentLinksToRemove = [];
            } catch (err) {
                console.error('Failed to fetch linked students:', err);
                // Don't set error, as this is a secondary operation
            }
        },

        isStudentLinked(studentId) {
            // Check if student is in the linked list and not in the to-remove list,
            // or if they're in the to-add list
            return (
                (this.linkedStudentIds.includes(studentId) &&
                    !this.studentLinksToRemove.includes(studentId)) ||
                this.studentLinksToAdd.includes(studentId)
            );
        },

        toggleStudentLink(studentId) {
            if (this.isStudentLinked(studentId)) {
                // If currently linked, mark for removal
                if (this.linkedStudentIds.includes(studentId)) {
                    // Only add to studentLinksToRemove if it was already linked
                    if (!this.studentLinksToRemove.includes(studentId)) {
                        this.studentLinksToRemove.push(studentId);
                    }
                }

                // Remove from studentLinksToAdd if it was just added
                const addIndex = this.studentLinksToAdd.indexOf(studentId);
                if (addIndex !== -1) {
                    this.studentLinksToAdd.splice(addIndex, 1);
                }
            } else {
                // If not currently linked, mark for addition
                if (!this.studentLinksToAdd.includes(studentId)) {
                    this.studentLinksToAdd.push(studentId);
                }

                // Remove from studentLinksToRemove if it was marked for removal
                const removeIndex = this.studentLinksToRemove.indexOf(studentId);
                if (removeIndex !== -1) {
                    this.studentLinksToRemove.splice(removeIndex, 1);
                }
            }
        },

        async saveStudentLinks() {
            this.savingStudentLinks = true;

            try {
                // Add new student links
                if (this.studentLinksToAdd.length > 0) {
                    const addResponse = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                        },
                        body: JSON.stringify({
                            student_ids: this.studentLinksToAdd
                        })
                    });

                    if (!addResponse.ok) {
                        const error = await addResponse.json();
                        throw new Error(error.error || 'Failed to add students');
                    }
                }

                // Remove student links
                for (const studentId of this.studentLinksToRemove) {
                    console.log('Removing student:', studentId);
                    console.log('Teacher ID:', this.userId);
                    const removeResponse = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students/${studentId}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                        }
                    });

                    if (!removeResponse.ok) {
                        const error = await removeResponse.json();
                        throw new Error(error.error || 'Failed to remove student');
                    }
                }

                // Refresh the student list
                await this.fetchStudents();

                // Close the modal
                alert('Student list updated successfully!');
                this.closeAddStudentModal();
            } catch (err) {
                console.error('❌ Failed to update student list:', err);
                alert(err.message || 'Failed to update student list. Please try again.');
            } finally {
                this.savingStudentLinks = false;
            }
        },

        closeAddStudentModal() {
            this.showAddStudentModal = false;
            this.availableStudentSearch = '';
            this.availableStudents = [];
            this.linkedStudentIds = [];
            this.studentLinksToAdd = [];
            this.studentLinksToRemove = [];
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

        viewQuiz(quizId) {
            // Student view of a quiz
            this.$router.push(`/quiz/${quizId}/view`);
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
        },

        async deleteQuiz(quizId) {
            if (!confirm('Are you sure you want to delete this quiz?')) {
                this.activeDropdown = null;
                return;
            }

            try {
                const response = await fetch(`http://localhost:5008/api/folders/${quizId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
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
        },

        // STUDENT MANAGEMENT METHODS
        async fetchStudents() {
            if (!this.userId || this.userRole !== 'teacher') return;

            this.studentsLoading = true;
            this.studentsError = null;

            try {
                const response = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch students');
                }

                const data = await response.json();
                this.students = data.students || [];
            } catch (err) {
                console.error('❌ Failed to fetch students:', err);
                this.studentsError = err.message || 'Could not load students. Please try again.';
            } finally {
                this.studentsLoading = false;
            }
        },

        async addStudent() {
            this.addingStudent = true;

            try {
                if (this.newStudentEmail) {
                    // Option 1: Link existing student by email
                    await this.linkExistingStudent();
                } else if (this.newStudent.name && this.newStudent.email && this.newStudent.password) {
                    // Option 2: Create new student account
                    await this.createNewStudentAccount();
                } else {
                    alert('Please provide either an existing student email or complete the new student form.');
                    this.addingStudent = false;
                    return;
                }

                // Refresh the list after adding
                await this.fetchStudents();
                this.showAddStudentModal = false;
                this.resetForm();
            } catch (err) {
                console.error('❌ Failed to add student:', err);
                alert(err.message || 'Failed to add student. Please try again.');
            } finally {
                this.addingStudent = false;
            }
        },

        async linkExistingStudent() {
            const response = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    student_email: this.newStudentEmail
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to link existing student');
            }

            return response.json();
        },

        async createNewStudentAccount() {
            // First create the student account
            const createResponse = await fetch('http://localhost:5008/api/user/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.newStudent.name,
                    email: this.newStudent.email,
                    password: this.newStudent.password,
                    role: 'student',
                    parent_email: this.teacherEmail // Use the teacher's email
                })
            });

            if (!createResponse.ok) {
                const error = await createResponse.json();
                throw new Error(error.error || 'Failed to create student account');
            }

            const student = await createResponse.json();

            // Then link the student to this teacher
            await this.linkExistingStudent(student.user.id);

            return student;
        },

        async removeStudent(studentId) {
            if (!confirm('Are you sure you want to remove this student?')) {
                return;
            }

            try {
                const response = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students/${studentId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to remove student');
                }

                // Update the local list
                this.students = this.students.filter(s => s.id !== studentId);
            } catch (err) {
                console.error('❌ Failed to remove student:', err);
                alert(err.message || 'Failed to remove student. Please try again.');
            }
        },

        // STUDENT ASSIGNMENTS METHODS
        viewAssignments(studentId) {
            // Find the student to get their name
            const student = this.students.find(s => s.id === studentId);
            if (!student) return;
            
            this.currentStudentId = studentId;
            this.currentStudentName = student.name;
            this.showAssignmentsModal = true;
            
            // Fetch the student's assignments
            this.fetchStudentAssignments(studentId);
        },
        
        async fetchStudentAssignments(studentId) {
            this.loadingAssignments = true;
            this.assignmentsError = null;
            
            try {
                const response = await fetch(`http://localhost:5008/api/quiz/student/${studentId}/assigned-quizzes`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to fetch student assignments');
                }
                
                const data = await response.json();
                this.studentAssignments = data.assignments || [];
            } catch (err) {
                console.error('❌ Failed to fetch student assignments:', err);
                this.assignmentsError = err.message || 'Could not load assignments. Please try again.';
            } finally {
                this.loadingAssignments = false;
            }
        },
        
        closeAssignmentsModal() {
            this.showAssignmentsModal = false;
            this.currentStudentId = null;
            this.currentStudentName = '';
            this.studentAssignments = [];
        },

        resetForm() {
            this.newStudentEmail = '';
            this.newStudent = {
                name: '',
                email: '',
                password: ''
            };
        },

        // QUIZ ASSIGNMENT METHODS
        assignQuiz(quizId) {
            this.activeQuizId = quizId;
            this.showAssignModal = true;
            this.activeDropdown = null; // Close the dropdown

            // If we haven't loaded students yet, load them now
            if (this.students.length === 0) {
                this.fetchStudents();
            }

            // Fetch current assignments for this quiz
            this.fetchAssignments(quizId);
        },

        async fetchAssignments(quizId) {
            this.assignLoading = true;
            this.assignError = null;

            try {
                // Fetch current assignments for this quiz
                const response = await fetch(`http://localhost:5008/api/quiz/${quizId}/assignments`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch quiz assignments');
                }

                const data = await response.json();
                this.assignedStudentIds = data.assignments.map(a => a.student_id) || [];

                // Reset tracking arrays when we load fresh data
                this.newAssignments = [];
                this.removedAssignments = [];
            } catch (err) {
                console.error('Failed to fetch assignments:', err);
                this.assignError = err.message || 'Could not load assignments';
            } finally {
                this.assignLoading = false;
            }
        },

        async fetchStudentsForAssignment() {
            // Same as fetchStudents but updates assign-specific loading states
            if (!this.userId || this.userRole !== 'teacher') return;

            this.assignLoading = true;
            this.assignError = null;

            try {
                const response = await fetch(`http://localhost:5008/api/quiz/teacher/${this.userId}/students`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch students');
                }

                const data = await response.json();
                this.students = data.students || [];
            } catch (err) {
                console.error('❌ Failed to fetch students:', err);
                this.assignError = err.message || 'Could not load students. Please try again.';
            } finally {
                this.assignLoading = false;
            }
        },

        isStudentAssigned(studentId) {
            // Check if student is in the assigned list and not in the removed list,
            // or if they're in the new assignments list
            return (
                (this.assignedStudentIds.includes(studentId) &&
                    !this.removedAssignments.includes(studentId)) ||
                this.newAssignments.includes(studentId)
            );
        },

        toggleAssignment(studentId) {
            if (this.isStudentAssigned(studentId)) {
                // If currently assigned, track for removal
                if (this.assignedStudentIds.includes(studentId)) {
                    // Only add to removedAssignments if it was already assigned
                    if (!this.removedAssignments.includes(studentId)) {
                        this.removedAssignments.push(studentId);
                    }
                }

                // Remove from newAssignments if it was just added
                const newIndex = this.newAssignments.indexOf(studentId);
                if (newIndex !== -1) {
                    this.newAssignments.splice(newIndex, 1);
                }
            } else {
                // If not currently assigned, track for addition
                if (!this.newAssignments.includes(studentId)) {
                    this.newAssignments.push(studentId);
                }

                // Remove from removedAssignments if it was marked for removal
                const removeIndex = this.removedAssignments.indexOf(studentId);
                if (removeIndex !== -1) {
                    this.removedAssignments.splice(removeIndex, 1);
                }
            }
        },

        async saveAssignments() {
            if (!this.activeQuizId) return;

            this.savingAssignments = true;

            try {
                // Save the assignments
                const response = await fetch(`http://localhost:5008/api/quiz/${this.activeQuizId}/assignments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        teacher_id: this.userId,
                        add_student_ids: this.newAssignments,
                        remove_student_ids: this.removedAssignments
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to save assignments');
                }

                alert('Quiz assignments saved successfully!');

                // Close the modal on success
                this.closeAssignModal();
            } catch (err) {
                console.error('Failed to save assignments:', err);
                alert(err.message || 'Failed to save assignments. Please try again.');
            } finally {
                this.savingAssignments = false;
            }
        },

        closeAssignModal() {
            this.showAssignModal = false;
            this.activeQuizId = null;
            this.assignedStudentIds = [];
            this.newAssignments = [];
            this.removedAssignments = [];
            this.assignSearchQuery = '';
        }
    },
    watch: {
        // When student management section is shown, fetch students
        showStudentManagement(newVal) {
            if (newVal && this.students.length === 0 && this.userRole === 'teacher') {
                this.fetchStudents();
            }
        },
        // When user role changes to teacher, prepare for student management
        userRole(newVal) {
            if (newVal === 'teacher' && this.showStudentManagement) {
                this.fetchStudents();
            }
        },
        showAddStudentModal(newVal) {
            if (newVal) {
                // When modal is opened, fetch all available students
                this.fetchAvailableStudents();
            }
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

.main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.main-title {
    font-size: 2rem;
    color: #0055B8;
    margin-bottom: 0.5rem;
}

.description {
    color: #666;
    margin-bottom: 1.5rem;
}

.teacher-actions {
    display: flex;
    gap: 1rem;
}

.manage-students-btn {
    background-color: #0055B8;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
}

.manage-students-btn:hover {
    background-color: #003e8a;
}

/* Student Management Section */
.student-management-section {
    background-color: #f9f9f9;
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    border: 1px solid #eee;
}

.student-management-section h2 {
    color: #0055B8;
    margin-top: 0;
}

.action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.search-input,
.student-search {
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    width: 300px;
}

.add-student-btn {
    background-color: #66CC99;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
}

.students-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
}

.student-card {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: white;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.student-info h3 {
    margin: 0 0 0.25rem 0;
    color: #333;
}

.student-email {
    color: #666;
    margin: 0;
    font-size: 0.9rem;
}

.student-actions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.assignments-btn {
    background-color: #0055B8;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
}

.remove-btn {
    background-color: white;
    color: #ff4444;
    border: 1px solid #ff4444;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
}

/* Quiz Management Section */
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

.loading-state,
.error-state,
.empty-state,
.loading-indicator {
    text-align: center;
    padding: 2rem;
    background-color: #f9f9f9;
    border-radius: 10px;
    margin-top: 1rem;
    color: #666;
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

/* Modal styling */
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
    z-index: 100;
}

.modal-container {
    background-color: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-container.assignments-modal {
    max-width: 700px;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
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
}

.modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    max-height: 60vh;
}

.modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
}

.cancel-btn {
    padding: 0.6rem 1.2rem;
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
}

.save-btn,
.add-btn {
    padding: 0.6rem 1.2rem;
    background-color: #66CC99;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.save-btn:disabled,
.add-btn:disabled {
    background-color: #aaa;
    cursor: not-allowed;
}

.form-group {
    margin-bottom: 1.5rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #333;
}

.form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-bottom: 0.75rem;
}

.option-select {
    text-align: center;
    margin: 1.5rem 0;
    position: relative;
}

.option-select:before,
.option-select:after {
    content: "";
    display: block;
    width: 40%;
    height: 1px;
    background-color: #ccc;
    position: absolute;
    top: 50%;
}

.option-select:before {
    left: 0;
}

.option-select:after {
    right: 0;
}

.option-select span {
    background-color: white;
    padding: 0 10px;
    position: relative;
    z-index: 1;
    color: #666;
}

.student-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.student-item {
    padding: 0.75rem;
    border: 1px solid #eee;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.student-item:hover {
    background-color: #f9f9f9;
}

.checkbox-container {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.checkbox-container input[type="checkbox"] {
    margin-right: 0.75rem;
    cursor: pointer;
    width: 18px;
    height: 18px;
}

.student-name {
    font-weight: bold;
    margin-right: 0.5rem;
}

.student-email {
    color: #666;
    font-size: 0.9rem;
}

.info-text {
    margin-top: 1rem;
    padding: 0.8rem;
    background-color: #f8f8f8;
    border-radius: 4px;
    border-left: 4px solid #66CC99;
}

.info-text p {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
}

/* Student Assignments Modal Styles */
.assignments-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 60vh;
    overflow-y: auto;
}

.assignment-item {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: white;
}

.assignment-details {
    flex: 1;
}

.quiz-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.1rem;
    color: #333;
}

.quiz-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: #666;
    font-size: 0.9rem;
}

.assignment-meta {
    font-size: 0.85rem;
    color: #888;
}

.assigned-date, .completion-date {
    margin-right: 1rem;
}

.quiz-score {
    font-weight: bold;
    color: #0055B8;
}

.assignment-status {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 100px;
}

.status {
    display: inline-block;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: bold;
}

.status.completed {
    background-color: #e6f7ee;
    color: #2e7d32;
}

.status.pending {
    background-color: #fff8e1;
    color: #f57c00;
}

.completion-info {
    display: block;
    margin-top: 0.25rem;
}
</style>