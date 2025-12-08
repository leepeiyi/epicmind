<template>
  <div class="login-page">
    <!-- Animated Background -->
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
      <div class="shape shape-4"></div>
    </div>

    <!-- Login Card -->
    <div class="login-card">
      <div class="logo-section">
        <img :src="logoImage" alt="The Epic Mind Learning Loft" class="logo" />
      </div>

      <h1>Welcome Back!</h1>
      <p class="subtitle">Sign in to continue your learning journey</p>

      <form @submit.prevent="handleLogin">
        <div class="input-group">
          <span class="input-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
          </span>
          <input type="email" placeholder="Email address" v-model="email" required />
        </div>

        <div class="input-group">
          <span class="input-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          </span>
          <input :type="showPassword ? 'text' : 'password'" placeholder="Password" v-model="password" required />
          <button type="button" class="toggle-password" @click="showPassword = !showPassword">
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
          </button>
        </div>

        <div class="actions">
          <label class="remember-me">
            <input type="checkbox" v-model="remember" />
            <span class="checkmark"></span>
            Remember me
          </label>
          <a class="forgot-link" @click.prevent="$router.push('/forgot-password')">Forgot Password?</a>
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          <span v-if="!isLoading">Sign In</span>
          <span v-else class="btn-loader"></span>
        </button>
      </form>

      <div class="divider">
        <span>or continue with</span>
      </div>

      <button class="google-btn" @click="handleGoogleLogin">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
        Google
      </button>

      <p class="register-text">
        Don't have an account? <router-link to="/register">Sign up</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import logoImage from '../assets/epic-mind-logo.png';
import axios from 'axios';
import API_BASE_URL from '../config/api.js';
import { toast } from 'vue-sonner';

export default {
  name: 'LoginPage',
  data() {
    return {
      email: '',
      password: '',
      remember: false,
      showPassword: false,
      isLoading: false,
      logoImage
    };
  },
  methods: {
    async handleLogin() {
      this.isLoading = true;
      try {
        const response = await axios.post(`${API_BASE_URL}/api/user/login`, {
          email: this.email,
          password: this.password,
        });

        const { token, user } = response.data;

        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));

        window.dispatchEvent(new Event('storage'));

        if (user.role === 'admin') {
          this.$router.push('/admin-panel');
        } else if (user.role === 'teacher') {
          this.$router.push('/insert-paper');
        } else {
          this.$router.push('/mathstery');
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Login failed');
      } finally {
        this.isLoading = false;
      }
    },
    handleGoogleLogin() {
      toast.info('Google login coming soon!');
    }
  },
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3a8dde 0%, #66CC99 100%);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}

/* Animated background shapes */
.background-shapes {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
}

.shape {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 20s infinite ease-in-out;
}

.shape-1 {
  width: 400px;
  height: 400px;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.shape-2 {
  width: 300px;
  height: 300px;
  bottom: -50px;
  right: -50px;
  animation-delay: -5s;
}

.shape-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  left: 10%;
  animation-delay: -10s;
}

.shape-4 {
  width: 150px;
  height: 150px;
  top: 20%;
  right: 15%;
  animation-delay: -15s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(20px, -20px) rotate(5deg);
  }
  50% {
    transform: translate(-10px, 20px) rotate(-5deg);
  }
  75% {
    transform: translate(-20px, -10px) rotate(3deg);
  }
}

/* Login Card */
.login-card {
  background: white;
  border-radius: 24px;
  padding: 3rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  position: relative;
  z-index: 1;
}

.logo-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.logo {
  width: 140px;
  height: auto;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a2e;
  text-align: center;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #6b7280;
  text-align: center;
  margin: 0 0 2rem 0;
  font-size: 0.95rem;
}

/* Input Groups */
.input-group {
  position: relative;
  margin-bottom: 1rem;
}

.input-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  display: flex;
  align-items: center;
}

.input-group input {
  width: 100%;
  padding: 1rem 3rem;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: #f9fafb;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #3a8dde;
  background: white;
  box-shadow: 0 0 0 4px rgba(58, 141, 222, 0.1);
}

.input-group input::placeholder {
  color: #9ca3af;
}

.toggle-password {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

.toggle-password:hover {
  color: #3a8dde;
}

/* Actions Row */
.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  color: #4b5563;
}

.remember-me input {
  width: 18px;
  height: 18px;
  accent-color: #66CC99;
  cursor: pointer;
}

.forgot-link {
  color: #3a8dde;
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: #66CC99;
}

/* Submit Button */
.submit-btn {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, #3a8dde 0%, #66CC99 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(58, 141, 222, 0.3);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Loading Spinner */
.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Divider */
.divider {
  display: flex;
  align-items: center;
  margin: 1.5rem 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.divider span {
  padding: 0 1rem;
  color: #9ca3af;
  font-size: 0.85rem;
}

/* Google Button */
.google-btn {
  width: 100%;
  padding: 0.875rem;
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  transition: all 0.3s ease;
}

.google-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

/* Register Text */
.register-text {
  text-align: center;
  margin-top: 1.5rem;
  color: #6b7280;
  font-size: 0.95rem;
}

.register-text a {
  color: #3a8dde;
  text-decoration: none;
  font-weight: 600;
}

.register-text a:hover {
  text-decoration: underline;
}

/* Responsive */
@media (max-width: 480px) {
  .login-page {
    padding: 1rem;
  }

  .login-card {
    padding: 2rem 1.5rem;
    border-radius: 16px;
  }

  h1 {
    font-size: 1.5rem;
  }

  .logo {
    width: 120px;
  }
}
</style>
