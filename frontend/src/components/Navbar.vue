<template>
  <nav class="navbar">
    <!-- Left: Logo -->
    <div class="nav-left">
      <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
    </div>

    <!-- Right: Nav Items -->
    <div class="nav-right">
      <router-link v-for="item in filteredNavItems" :key="item.label" :to="item.route" class="nav-item">
        <component :is="item.icon" class="icon" />
        <span class="label">{{ item.label }}</span>
      </router-link>

      <!-- User info and logout button -->
      <div class="user-section">
        <span class="username" v-if="user">{{ user.name }}</span>
        <div @click="logout" class="nav-item logout-btn">
          <LogOut class="icon" />
          <span class="label">Logout</span>
        </div>
      </div>
    </div>
  </nav>
</template>

<script>
import { FileText, BookOpen, FolderOpen, Star, HelpCircle, FilePlus, LogOut } from 'lucide-vue-next';

export default {
  name: 'Navbar',
  components: {
    FileText,
    BookOpen,
    FolderOpen,
    Star,
    HelpCircle,
    FilePlus,
    LogOut,
  },
  data() {
    return {
      user: null,
      navItems: [
        { icon: 'FileText', label: 'Insert Paper', route: '/insert-paper' },
        { icon: 'BookOpen', label: 'Mathstery', route: '/mathstery' },
        { icon: 'FolderOpen', label: 'Topical Revision', route: '/generate-topical' },
        { icon: 'Star', label: 'Favourites', route: '/favourites' },
        { icon: 'HelpCircle', label: 'Quiz Folder', route: '/quiz-folder' },
        { icon: 'FilePlus', label: 'For Tutors', route: '/tutor-vetting', requiresRole: 'teacher' },
        { icon: 'FolderOpen', label: 'Paper Logs', route: '/paper-logs', requiresRole: 'admin' }, // 👈 added
      ],

    };
  },
  computed: {
    filteredNavItems() {
      return this.navItems.filter(item => {
        // ✅ Admins can see all items regardless of required role
        if (this.user?.role === 'admin') {
          return true;
        }

        // ✅ Regular role-based filtering for others
        if (item.requiresRole && this.user?.role !== item.requiresRole) {
          return false;
        }

        return true;
      });
    }

  },
  mounted() {
    // Get user info from session storage when component mounts
    this.getUserFromSession();
    console.log('Current user:', this.user); 

    // Add event listener to update user when session storage changes
    window.addEventListener('storage', this.getUserFromSession);
  },
  beforeUnmount() {
    // Remove event listener when component is destroyed
    window.removeEventListener('storage', this.getUserFromSession);
  },
  methods: {
    getUserFromSession() {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        this.user = JSON.parse(userStr);
      } else {
        this.user = null;
      }
    },
    logout() {
      // Clear session storage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');

      // Dispatch a custom event to notify other components
      window.dispatchEvent(new Event('userLoggedOut'));

      // Redirect to login page
      this.$router.push('/');
    }
  }
};
</script>

<style scoped>
.navbar {
  font-family: 'Arial', sans-serif;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 2rem;
  background-color: #66CC99;
  /* black background */
  color: black;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.logo {
  height: 50px;
}

.nav-right {
  display: flex;
  gap: 1.5rem;
  align-items: center;
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
  color: #F1FF3F;
  /* Neon Yellow on hover */
}

.icon {
  width: 20px;
  height: 20px;
}

.label {
  font-size: 16px;
}

.logout-btn {
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.logout-btn:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.user-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: 1rem;
  padding-left: 1rem;
  border-left: 1px solid rgba(0, 0, 0, 0.2);
}

.username {
  font-weight: bold;
  font-size: 14px;
}
</style>