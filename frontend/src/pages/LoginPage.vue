<template>
  <div class="login-page">
    <!-- Left Panel -->
    <div class="left-panel" :style="{ backgroundImage: `url(${studentImage})` }">
    </div>



    <!-- Right Panel -->
    <div class="right-panel">
      <img :src="logoImage" alt="The Epic Mind Learning Loft" class="logo" />
      <h2>Login to your Account</h2>
      <p class="subtitle">See what’s going on with your learning</p>

      <button class="google-login">
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
        Continue with Google
      </button>

      <div class="divider">or Sign in with Email</div>

      <form @submit.prevent="handleLogin">
        <input type="email" placeholder="Email" v-model="email" required />
        <input type="password" placeholder="Password" v-model="password" required />
        <div class="actions">
          <label><input type="checkbox" v-model="remember" /> Remember me</label>
          <a @click.prevent="$router.push('/forgot-password')">Forgot Password?</a>
        </div>
        <button type="submit" class="submit-btn">Login</button>
      </form>

      <p class="register">
        Not Registered Yet? <router-link to="/register">Create an account</router-link>
      </p>

    </div>
  </div>
</template>

<script>
import studentImage from '../assets/student-illustration.png';
import logoImage from '../assets/epic-mind-logo.png';
import axios from 'axios';
import API_BASE_URL from '../config/api.js';

export default {
  name: 'LoginPage',
  data() {
    return {
      email: '',
      password: '',
      remember: false,
      studentImage,
      logoImage
    };
  },
  methods: {
    async handleLogin() {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/user/login`, {
          email: this.email,
          password: this.password,
        });

        const { token, user } = response.data;

        // Store in sessionStorage instead of localStorage
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));

        // Dispatch a custom event to notify components that user logged in
        window.dispatchEvent(new Event('storage'));

        this.$router.push('/insert-paper');
      } catch (err) {
        alert(err.response?.data?.error || 'Login failed');
      }
    },
  },
};
</script>

<style scoped>
.login-page {
  display: flex;
  height: 100vh;
  font-family: 'Arial', sans-serif;
}

/* Left Side */
.left-panel {
  flex: 1;
  background-size: cover;
  /* Ensures the image covers the entire panel */
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 3rem 2rem;
  color: white;
  position: relative;
  text-align: center;
}



.character-box img.character {
  max-width: 280px;
  /* slightly bigger */
  margin-bottom: 1.5rem;
}

.character-box h2 {
  font-size: 28px;
  /* larger headline */
  font-weight: bold;
  margin-bottom: 0.75rem;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
  /* subtle shadow */
}

.character-box p {
  font-size: 18px;
  max-width: 320px;
}

/* Right Side */
.right-panel {
  flex: 1;
  background-color: #FFFFFF;
  padding: 4rem 3rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  /* Add this to center content horizontally */
  text-align: center;
  /* Optional: Center text under the logo */
}

.logo {
  width: 200px;
}

.subtitle {
  color: #666;
  margin-bottom: 1.5rem;
}

.google-login {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #66CC99;
  color: white;
  border: none;
  padding: 0.8rem;
  border-radius: 5px;
  cursor: pointer;
  margin-bottom: 1rem;
}

.google-login img {
  width: 20px;
  margin-right: 10px;
}

.divider {
  text-align: center;
  margin: 1rem 0;
  color: #999;
}

form input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid #ccc;
  border-radius: 5px;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  margin-bottom: 1rem;
}

.submit-btn {
  background-color: #0055B8;
  color: white;
  border: none;
  width: 100%;
  padding: 0.8rem;
  border-radius: 5px;
  font-weight: bold;
  cursor: pointer;
}

.register {
  margin-top: 1rem;
  font-size: 14px;
}

.register a {
  color: #0055B8;
  font-weight: bold;
  text-decoration: none;
}


@media (max-width: 768px) {
  .left-panel {
    display: none;
  }

  .right-panel {
    flex: 1;
    width: 100%;
    padding: 2rem;
  }

  .login-page {
    flex-direction: column;
  }
}

@media (min-width: 769px) and (max-width: 1200px) {
  .left-panel {
    background-size: contain;
    /* Adjust the image size for medium screens */
    padding: 2rem 1rem;
    /* Reduce padding for better fit */
  }
}
</style>
