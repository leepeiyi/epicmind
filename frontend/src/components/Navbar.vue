<template>
    <nav class="navbar">
      <!-- Left: Logo -->
      <div class="nav-left">
        <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
      </div>
  
      <!-- Right: Nav Items -->
      <div class="nav-right">
        <div class="nav-item" v-for="item in navItems" :key="item.label">
          <span class="icon">{{ item.icon }}</span>
          <span class="label">{{ item.label }}</span>
        </div>
      </div>
    </nav>
  </template>
  
  <script>
  export default {
    name: 'Navbar',
    data() {
      return {
        navItems: [
          { icon: '📄', label: 'Insert Paper' },
          { icon: '🧠', label: 'Mathstery' },
          { icon: '📚', label: 'Topical Revision' },
          { icon: '⭐', label: 'Favourites' },
          { icon: '❓', label: 'Quiz Folder' },
        ],
      };
    },
  };
  </script>
  
  <style scoped>
  .navbar {
    font-family: 'Arial', sans-serif;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 2rem;
    background-color: #66cc99; /* SAPPHIRE */
    color:black;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  
  .logo {
    height: 50px;
  }
  
  .nav-right {
    display: flex;
    gap: 1.5rem;
  }
  
  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: bold;
    cursor: pointer;
    transition: color 0.2s;
  }
  
  .nav-item:hover {
    color: #F1FF3F; /* NEON YELLOW */
  }
  
  .icon {
    font-size: 18px;
  }
  
  .label {
    font-size: 16px;
  }
  </style>
  