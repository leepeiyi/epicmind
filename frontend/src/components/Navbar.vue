<template>
  <nav class="navbar">
    <!-- Left: Logo -->
    <div class="nav-left">
      <img src="../assets/epic-mind-logo.png" alt="Logo" class="logo" />
    </div>

    <!-- Right: Nav Items -->
    <div class="nav-right">
      <div v-for="item in filteredNavItems" :key="item.label" class="nav-item-wrapper">
        <!-- Special handling for Insert Paper with dropdown -->
        <div v-if="item.label === 'Insert Paper'" class="nav-item-dropdown" @mouseenter="showDropdown = true" @mouseleave="showDropdown = false">
          <div class="dropdown-trigger">
            <component :is="item.icon" class="icon" />
            <span class="label">{{ item.label }}</span>
            <ChevronDown class="dropdown-arrow" />
          </div>
          
          <!-- Dropdown Menu -->
          <div v-show="showDropdown" class="dropdown-menu">
            <router-link to="/insert-paper" class="dropdown-item" @click="showDropdown = false">
              <Upload class="dropdown-icon" />
              <span>Upload Files</span>
            </router-link>
            <router-link to="/markdown-insertpaper" class="dropdown-item" @click="showDropdown = false">
              <FileText class="dropdown-icon" />
              <span>From Mathpix</span>
            </router-link>
          </div>
        </div>
        
        <!-- Regular nav items -->
        <router-link v-else :to="item.route" class="nav-item">
          <component :is="item.icon" class="icon" />
          <span class="label">{{ item.label }}</span>
        </router-link>
      </div>

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
import { FileText, BookOpen, FolderOpen, Star, HelpCircle, FilePlus, LogOut, ChevronDown, Upload } from 'lucide-vue-next';

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
    ChevronDown,
    Upload,
  },
  data() {
    return {
      user: null,
      showDropdown: false,
      navItems: [
        { icon: 'FileText', label: 'Insert Paper', route: '/insert-paper' },
        { icon: 'BookOpen', label: 'Mathstery', route: '/mathstery' },
        { icon: 'FolderOpen', label: 'Topical Revision', route: '/generate-topical' },
        { icon: 'Star', label: 'Favourites', route: '/favourites' },
        { icon: 'HelpCircle', label: 'Quiz Folder', route: '/quiz-folder' },
        { icon: 'FilePlus', label: 'For Tutors', route: '/tutor-vetting', requiresRole: 'teacher' },
        { icon: 'FolderOpen', label: 'Paper Logs', route: '/paper-logs', requiresRole: 'admin' },
      ],
    };
  },
  computed: {
    filteredNavItems() {
      console.log('🔍 Filtering nav items for user:', this.user);

      return this.navItems.filter(item => {
        console.log(`\n📋 Checking item: ${item.label}`);
        console.log(`   - requiresRole: ${item.requiresRole}`);
        console.log(`   - user role: ${this.user?.role}`);

        // ✅ Admins can see all items regardless of required role
        if (this.user?.role === 'admin') {
          console.log(`   ✅ Admin access - showing ${item.label}`);
          return true;
        }

        // ✅ Regular role-based filtering for others
        if (item.requiresRole && this.user?.role !== item.requiresRole) {
          console.log(`   ❌ Role mismatch - hiding ${item.label} (requires: ${item.requiresRole}, user has: ${this.user?.role})`);
          return false;
        }

        console.log(`   ✅ Access granted - showing ${item.label}`);
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

.nav-item-wrapper {
  position: relative;
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
}

.nav-item-dropdown {
  position: relative;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: bold;
  cursor: pointer;
  transition: color 0.2s;
  color: inherit;
  padding: 0.5rem;
}

.dropdown-trigger:hover {
  color: #F1FF3F;
}

.dropdown-arrow {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.nav-item-dropdown:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  padding: 0.5rem 0;
  margin-top: 0.25rem;
}

/* Add a small bridge to prevent hover issues */
.dropdown-menu::before {
  content: '';
  position: absolute;
  top: -0.25rem;
  left: 0;
  right: 0;
  height: 0.25rem;
  background: transparent;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #333;
  text-decoration: none;
  transition: background-color 0.2s;
  font-weight: 500;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
  color: #66CC99;
}

.dropdown-icon {
  width: 18px;
  height: 18px;
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