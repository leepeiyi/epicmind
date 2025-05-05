<template>
    <div class="auth-page">
        <div class="auth-box">
            <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
            <h2>Forgot your password?</h2>
            <p>Enter your email and we’ll send you a reset link.</p>
            <form @submit.prevent="submitEmail">
                <input v-model="email" type="email" placeholder="Email Address" required />
                <button type="submit">Send Reset Link</button>
                <p v-if="message" class="info">{{ message }}</p>
            </form>
            <br>
            <router-link to="/">Back to Login</router-link>
        </div>
    </div>
</template>

<script>
import axios from 'axios';
export default {
    data() {
        return {
            email: '',
            message: ''
        };
    },
    methods: {
        async submitEmail() {
            try {
                await axios.post('http://localhost:5008/api/user/forgot-password', { email: this.email });
                this.message = 'Check your email for a reset link.';
            } catch (err) {
                if (err.response?.status === 404) {
                    this.message = 'Email does not exist in our system.';
                } else {
                    this.message = 'Something went wrong. Please try again.';
                }
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
</style>