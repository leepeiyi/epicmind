<template>
  <div class="epicmind-loader" :class="[size, { 'with-text': showText }]">
    <div class="loader-container">
      <!-- Animated rings -->
      <div class="ring ring-1"></div>
      <div class="ring ring-2"></div>
      <div class="ring ring-3"></div>

      <!-- Logo -->
      <img :src="logoImage" alt="Loading" class="logo" />
    </div>

    <!-- Optional loading text -->
    <p v-if="showText" class="loading-text">{{ text }}</p>
  </div>
</template>

<script>
import logoImage from '../assets/epic-mind-logo.png';

export default {
  name: 'EpicMindLoader',
  props: {
    size: {
      type: String,
      default: 'medium', // 'small', 'medium', 'large'
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    },
    showText: {
      type: Boolean,
      default: true
    },
    text: {
      type: String,
      default: 'Loading...'
    }
  },
  data() {
    return {
      logoImage
    };
  }
};
</script>

<style scoped>
.epicmind-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.loader-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Size variants */
.small .loader-container {
  width: 60px;
  height: 60px;
}

.small .logo {
  width: 35px;
  height: 35px;
}

.medium .loader-container {
  width: 100px;
  height: 100px;
}

.medium .logo {
  width: 55px;
  height: 55px;
}

.large .loader-container {
  width: 140px;
  height: 140px;
}

.large .logo {
  width: 80px;
  height: 80px;
}

/* Animated rings */
.ring {
  position: absolute;
  border-radius: 50%;
  border: 3px solid transparent;
}

.ring-1 {
  width: 100%;
  height: 100%;
  border-top-color: #3a8dde;
  border-right-color: #3a8dde;
  animation: spin 1.5s linear infinite;
}

.ring-2 {
  width: 85%;
  height: 85%;
  border-bottom-color: #66CC99;
  border-left-color: #66CC99;
  animation: spin 2s linear infinite reverse;
}

.ring-3 {
  width: 70%;
  height: 70%;
  border-top-color: #3a8dde;
  border-right-color: #66CC99;
  animation: spin 2.5s linear infinite;
}

/* Logo styling */
.logo {
  position: relative;
  z-index: 1;
  object-fit: contain;
  animation: pulse 2s ease-in-out infinite;
}

/* Loading text */
.loading-text {
  margin: 0;
  font-size: 0.95rem;
  color: #666;
  font-weight: 500;
  animation: fadeInOut 2s ease-in-out infinite;
}

.small .loading-text {
  font-size: 0.8rem;
}

.large .loading-text {
  font-size: 1.1rem;
}

/* Animations */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

@keyframes fadeInOut {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
</style>
