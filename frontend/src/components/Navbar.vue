<template>
  <nav class="navbar">
    <!-- Left: Logo -->
    <div class="nav-left">
      <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
    </div>

    <!-- Right: Nav Items -->
    <div class="nav-right">
      <router-link
        v-for="item in navItems"
        :key="item.label"
        :to="item.route"
        class="nav-item"
      >
        <component :is="item.icon" class="icon" />
        <span class="label">{{ item.label }}</span>
      </router-link>
    </div>
  </nav>
</template>

<script>
import { FileText, BookOpen, FolderOpen, Star, HelpCircle, FilePlus } from 'lucide-vue-next';

export default {
  name: 'Navbar',
  components: {
    FileText,
    BookOpen,
    FolderOpen,
    Star,
    HelpCircle,
    FilePlus,
  },
  data() {
    return {
      navItems: [
        { icon: 'FileText', label: 'Insert Paper', route: '/insert-paper' },
        { icon: 'BookOpen', label: 'Mathstery', route: '/mathstery' },
        { icon: 'FolderOpen', label: 'Topical Revision', route: '/generate-topical' },
        { icon: 'Star', label: 'Favourites', route: '/favourites' },
        { icon: 'HelpCircle', label: 'Quiz Folder', route: '/quiz-folder' },
        { icon: 'FilePlus', label: 'Insert Syllabus', route: '/insert-syllabus' },
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
  background-color: #66CC99; /* black background */
  color: black;
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
  text-decoration: none;
  color: inherit;
}

.nav-item:hover {
  color: #F1FF3F; /* Neon Yellow on hover */
}

.icon {
  width: 20px;
  height: 20px;
}

.label {
  font-size: 16px;
}
</style>
