<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal-container">
      <div class="modal-header">
        <h3>Assign Quiz to Students</h3>
        <button class="close-btn" @click="close">×</button>
      </div>

      <div class="modal-body">
        <div class="search-container">
          <input type="text" v-model="searchQuery" placeholder="Search students by name..." class="student-search" />
        </div>

        <div v-if="loading" class="loading-indicator">
          <p>Loading students...</p>
        </div>

        <div v-else-if="error" class="error-message">
          <p>{{ error }}</p>
          <button @click="fetchStudents" class="retry-btn">Try Again</button>
        </div>

        <div v-else-if="filteredStudents.length === 0" class="empty-state">
          <p v-if="searchQuery">No students match your search. Try a different search term.</p>
          <p v-else>No students found. You need to have students to assign quizzes.</p>
        </div>

        <div v-else class="student-list">
          <div v-for="student in filteredStudents" :key="student.id" class="student-item">
            <label class="checkbox-container">
              <input type="checkbox" :checked="isStudentAssigned(student.id)" @change="toggleAssignment(student.id)" />
              <span class="student-name">{{ student.name }}</span>
              <span class="student-email">{{ student.email }}</span>
            </label>
          </div>
        </div>

        <!-- New Due Date Field -->
        <div class="due-date-field">
          <label>📅 Set Due Date:</label>
          <input type="date" v-model="dueDate" />
        </div>
      </div>


      <div class="modal-footer">
        <button class="cancel-btn" @click="close">Cancel</button>
        <button class="save-btn" @click="saveAssignments" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save Assignments' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import API_BASE_URL, { authFetch } from '../config/api.js';
import { toast } from 'vue-sonner';
export default {
  name: 'AssignQuizModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    quizId: {
      type: [String, Number],
      required: true
    }
  },
  data() {
    return {
      searchQuery: '',
      students: [],
      assignedStudentIds: [], // IDs of students currently assigned to this quiz
      loading: true,
      saving: false,
      error: null,
      dueDate: null,
      newAssignments: [], // Track changes during this session
      removedAssignments: [] // Track removals during this session
    };
  },
  computed: {
    filteredStudents() {
      if (!this.searchQuery.trim()) {
        return this.students;
      }

      const query = this.searchQuery.toLowerCase();
      return this.students.filter(student =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      );
    }
  },
  watch: {
    show(newVal) {
      if (newVal) {
        // When modal is shown, fetch data
        this.fetchStudents();
        this.fetchAssignments();
      }
    }
  },
  methods: {
    async fetchStudents() {
      this.loading = true;
      this.error = null;

      try {
        // Get the teacher's ID from session storage
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
          throw new Error('You must be logged in to assign quizzes');
        }

        const user = JSON.parse(userStr);
        const teacherId = user.id;

        // Fetch students (assuming endpoint exists to get students for a teacher)
        const response = await authFetch(`${API_BASE_URL}/api/quiz/teacher/${teacherId}/students`, {
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
        console.error('Failed to fetch students:', err);
        this.error = err.message || 'Could not load students. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    async fetchAssignments() {
      try {
        // Fetch current assignments for this quiz
        const response = await authFetch(`${API_BASE_URL}/api/quiz/${this.quizId}/assignments`, {
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
        // We don't set the main error here to avoid blocking the UI
        // Just log it and continue with empty assignments
        this.assignedStudentIds = [];
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
      this.saving = true;

      try {
        // Get the teacher's ID from session storage
        const userStr = sessionStorage.getItem('user');
        if (!userStr) {
          throw new Error('You must be logged in to assign quizzes');
        }
        if (!this.newAssignments.length && !this.removedAssignments.length) {
          toast.info("No changes to save.");
          return;
        }

        if (!this.dueDate) {
          toast.warning("Please set a due date before saving.");
          return;
        }

        const user = JSON.parse(userStr);
        const teacherId = user.id;

        // Save the assignments
        const response = await authFetch(`${API_BASE_URL}/api/quiz/${this.quizId}/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
          },
          body: JSON.stringify({
            teacher_id: teacherId,
            quiz_id: this.quizId,
            add_student_ids: this.newAssignments,
            remove_student_ids: this.removedAssignments,
            due_date: this.dueDate
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save assignments');
        }

        // Close the modal on success
        this.$emit('assignments-saved');
        this.close();
      } catch (err) {
        console.error('Failed to save assignments:', err);
        toast.error(err.message || 'Failed to save assignments. Please try again.');
      } finally {
        this.saving = false;
      }
    },

    close() {
      this.$emit('close');
    }
  }
};
</script>

<style scoped>
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

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  max-height: 60vh;
}

.search-container {
  margin-bottom: 1rem;
}

.student-search {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
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

.save-btn {
  padding: 0.6rem 1.2rem;
  background-color: #66CC99;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.loading-indicator,
.error-message,
.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.retry-btn {
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  background-color: #66CC99;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.due-date-field {
  margin-top: 1.5rem;
  font-size: 1rem;
}

.due-date-field input[type="date"] {
  width: 100%;
  padding: 0.6rem;
  margin-top: 0.3rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

</style>