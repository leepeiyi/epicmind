<template>
    <div class="register-page">
        <div class="register-box">
            <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
            <h2>Create an account</h2>
            <p>Select your role and get started</p>

            <div class="role-toggle">
                <button :class="{ active: role === 'teacher' }" @click="role = 'teacher'">
                    👩‍🏫 I'm a Teacher
                </button>
                <button :class="{ active: role === 'student' }" @click="role = 'student'">
                    🧑‍🎓 I'm a Student
                </button>
            </div>

            <form @submit.prevent="handleSubmit">
                <input type="text" v-model="form.name" placeholder="Full Name" required />
                <input type="email" v-model="form.email" placeholder="Email Address" required />
                <input type="password" v-model="form.password" placeholder="Password" required />
                <input type="password" v-model="form.confirm" placeholder="Confirm Password" required />

                <input v-if="role === 'student'" type="email" v-model="form.parentEmail"
                    placeholder="Parent's Email Address" required />

                <button type="submit" class="submit">Sign Up</button>
            </form>

            <p class="login-link">Already have an account? <a href="/">Log in</a></p>
        </div>
    </div>
</template>

<script>
import axios from 'axios';

export default {
    name: "CreateAccount",
    data() {
        return {
            role: 'teacher',
            form: {
                name: '',
                email: '',
                password: '',
                confirm: '',
                parentEmail: '',
            },
        };
    },
    methods: {
    async handleSubmit() {
      if (this.form.password !== this.form.confirm) {
        alert("Passwords do not match!");
        return;
      }

      try {
        const response = await axios.post('http://localhost:5008/api/user/register', {
          name: this.form.name,
          email: this.form.email,
          password: this.form.password,
          role: this.role,
          parentEmail: this.role === 'student' ? this.form.parentEmail : null,
        });

        alert('Registration successful!');
        this.$router.push('/'); // go to login
      } catch (err) {
        alert(err.response?.data?.error || 'Registration failed');
      }
    },
  },
};
</script>

<style scoped>
.register-page {
    min-height: 100vh;
    background: linear-gradient(to bottom right, #0055B8, #66CC99);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family: 'Arial', sans-serif;
    /* Set Arial as the font */
}

.register-box {
    background: white;
    border-radius: 16px;
    padding: 2.5rem;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    text-align: center;
    font-family: 'Arial', sans-serif;
    /* Ensure Arial applies here too */
}

.logo {
    width: 100px;
    margin-bottom: 1rem;
}

h2 {
    margin-bottom: 0.25rem;
    font-size: 24px;
}

p {
    font-size: 14px;
    margin-bottom: 1.5rem;
    color: #333;
}

.role-toggle {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    background: #f0f0f0;
    border-radius: 999px;
    padding: 0.3rem;
}

.role-toggle button {
    flex: 1;
    padding: 0.6rem;
    border: none;
    background: transparent;
    font-weight: bold;
    cursor: pointer;
    border-radius: 999px;
    transition: background 0.2s;
}

.role-toggle button.active {
    background: #F1FF3F;
    color: #000;
}

form input {
    width: 100%;
    padding: 0.75rem;
    margin: 0.5rem 0;
    border: 1px solid #ccc;
    border-radius: 8px;
}

.submit {
    width: 100%;
    padding: 0.75rem;
    background: #0055B8;
    color: white;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    margin-top: 1rem;
    cursor: pointer;
    transition: background 0.2s;
}

.submit:hover {
    background: #003e8a;
}

.login-link {
    margin-top: 1rem;
    font-size: 14px;
}

.login-link a {
    color: #0055B8;
    font-weight: bold;
    text-decoration: none;
}
</style>