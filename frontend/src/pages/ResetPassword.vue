<template>
    <div class="auth-page">
      <div class="auth-box">
        <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
        <h2>Reset your password</h2>
        <form @submit.prevent="submitPassword">
          <input type="password" v-model="password" placeholder="New Password" required minlength="6" />
          <button type="submit" :disabled="isLoading">
            {{ isLoading ? 'Resetting...' : 'Reset Password' }}
          </button>
          <p v-if="message" :class="{ 'info': isSuccess, 'error': !isSuccess }">{{ message }}</p>
        </form>
        <br>
        <router-link to="/">Back to Login</router-link>
      </div>
    </div>
  </template>

  <script>
  import axios from 'axios';
  import API_BASE_URL from '../config/api.js';
  export default {
    data() {
      return {
        password: '',
        message: '',
        isLoading: false,
        isSuccess: false,
        token: this.$route.query.token
      };
    },
    mounted() {
      if (!this.token) {
        this.message = 'Invalid reset link. No token provided.';
        this.isSuccess = false;
      }
    },
    methods: {
      async submitPassword() {
        if (!this.token) {
          this.message = 'Invalid reset link. Please request a new password reset.';
          this.isSuccess = false;
          return;
        }

        if (this.password.length < 6) {
          this.message = 'Password must be at least 6 characters.';
          this.isSuccess = false;
          return;
        }

        this.isLoading = true;
        this.message = '';

        try {
          const response = await axios.post(`${API_BASE_URL}/api/user/reset-password`, {
            token: this.token,
            newPassword: this.password
          });
          this.message = 'Password reset successful! You can now login with your new password.';
          this.isSuccess = true;
          this.password = '';
        } catch (error) {
          console.error('Reset password error:', error);
          this.isSuccess = false;
          if (error.response?.data?.error) {
            this.message = error.response.data.error;
          } else {
            this.message = 'Token expired or invalid. Please request a new password reset.';
          }
        } finally {
          this.isLoading = false;
        }
      }
    }
  };
  </script>
  
  <style scoped>
  .auth-page {
    display: flex;
    height: 100vh;
    align-items: center;
    justify-content: center;
    background: linear-gradient(to bottom right, #3a8dde, #67d6b8);
    font-family: 'Arial', sans-serif;
  }
  .auth-box {
    background: white;
    padding: 2.5rem;
    border-radius: 12px;
    width: 360px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  .logo {
    width: 120px;
    margin-bottom: 1rem;
  }
  form input {
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border-radius: 8px;
    border: 1px solid #ccc;
  }
  button {
    background-color: #0055b8;
    color: white;
    border: none;
    padding: 0.75rem;
    width: 100%;
    border-radius: 8px;
    margin-top: 1rem;
    font-weight: bold;
    cursor: pointer;
  }
  .info {
    color: green;
    margin-top: 0.5rem;
  }
  .error {
    color: red;
    margin-top: 0.5rem;
  }
  button:disabled {
    background-color: #999;
    cursor: not-allowed;
  }
  </style>
  