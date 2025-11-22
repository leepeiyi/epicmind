<template>
  <div class="admin-panel">
    <Navbar />

    <div class="panel-container">
      <h1>Admin Panel</h1>
      <p class="subtitle">Manage teacher accounts and system settings</p>

      <!-- Create Teacher Account Section -->
      <div class="card">
        <div class="card-header">
          <UserPlus class="header-icon" />
          <h2>Create Teacher Account</h2>
        </div>

        <form @submit.prevent="createTeacherAccount" class="teacher-form">
          <div class="form-group">
            <label for="name">Full Name *</label>
            <input
              id="name"
              type="text"
              v-model="teacherForm.name"
              placeholder="e.g., John Smith"
              required
            />
          </div>

          <div class="form-group">
            <label for="email">Email Address *</label>
            <input
              id="email"
              type="email"
              v-model="teacherForm.email"
              placeholder="e.g., john.smith@school.com"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">Password *</label>
            <input
              id="password"
              type="password"
              v-model="teacherForm.password"
              placeholder="Minimum 8 characters"
              minlength="8"
              required
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              type="password"
              v-model="teacherForm.confirmPassword"
              placeholder="Re-enter password"
              minlength="8"
              required
            />
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <UserPlus v-if="!loading" class="btn-icon" />
            <span v-if="loading">Creating Account...</span>
            <span v-else>Create Teacher Account</span>
          </button>
        </form>

        <!-- Success/Error Messages -->
        <div v-if="successMessage" class="message success">
          <Check class="message-icon" />
          {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="message error">
          <AlertCircle class="message-icon" />
          {{ errorMessage }}
        </div>
      </div>

      <!-- Future Admin Features Placeholder -->
      <div class="card placeholder">
        <div class="card-header">
          <Settings class="header-icon" />
          <h2>System Settings</h2>
        </div>
        <p class="placeholder-text">More admin features coming soon...</p>
      </div>
    </div>
  </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import { UserPlus, Settings, Check, AlertCircle } from 'lucide-vue-next';
import axios from 'axios';
import API_BASE_URL from '../config/api.js';

export default {
  name: 'AdminPanel',
  components: {
    Navbar,
    UserPlus,
    Settings,
    Check,
    AlertCircle,
  },
  data() {
    return {
      teacherForm: {
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      },
      loading: false,
      successMessage: '',
      errorMessage: '',
    };
  },
  methods: {
    async createTeacherAccount() {
      // Reset messages
      this.successMessage = '';
      this.errorMessage = '';

      // Validate passwords match
      if (this.teacherForm.password !== this.teacherForm.confirmPassword) {
        this.errorMessage = 'Passwords do not match';
        return;
      }

      // Validate password length
      if (this.teacherForm.password.length < 8) {
        this.errorMessage = 'Password must be at least 8 characters';
        return;
      }

      this.loading = true;

      try {
        const token = sessionStorage.getItem('token');

        if (!token) {
          this.errorMessage = 'Authentication required. Please log in again.';
          this.loading = false;
          return;
        }

        const response = await axios.post(
          `${API_BASE_URL}/api/user/admin/create-teacher`,
          {
            name: this.teacherForm.name,
            email: this.teacherForm.email,
            password: this.teacherForm.password,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        this.successMessage = `✅ Teacher account created successfully for ${this.teacherForm.email}`;

        // Reset form
        this.teacherForm = {
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
        };

        // Clear success message after 5 seconds
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);

      } catch (error) {
        console.error('Error creating teacher account:', error);

        if (error.response?.status === 403) {
          this.errorMessage = 'Access denied. Only administrators can create teacher accounts.';
        } else if (error.response?.status === 400) {
          this.errorMessage = error.response.data.message || 'Email already exists';
        } else {
          this.errorMessage = error.response?.data?.message || 'Failed to create teacher account. Please try again.';
        }
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.admin-panel {
  min-height: 100vh;
  background-color: #f5f5f5;
  font-family: 'Arial', sans-serif;
}

.panel-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #666;
  margin-bottom: 2rem;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.header-icon {
  width: 24px;
  height: 24px;
  color: #66CC99;
}

.card-header h2 {
  font-size: 1.5rem;
  color: #333;
  margin: 0;
}

.teacher-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #66CC99;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: #0055B8;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}

.submit-btn:hover:not(:disabled) {
  background: #003e8a;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 20px;
  height: 20px;
}

.message {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1.5rem;
  font-weight: 500;
}

.message-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.placeholder {
  opacity: 0.6;
}

.placeholder-text {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 2rem;
}
</style>
