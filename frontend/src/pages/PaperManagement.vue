<template>
    <div class="paper-management">
        <Navbar />

        <div class="paper-management-container">
            <!-- Sidebar Navigation -->
            <aside class="sidebar">
                <h2 class="sidebar-title">Paper Management</h2>
                <nav class="sidebar-nav">
                    <button
                        v-for="item in sidebarItems"
                        :key="item.value"
                        :class="['sidebar-item', { active: activeTab === item.value }]"
                        @click="activeTab = item.value"
                    >
                        <component :is="item.icon" class="sidebar-icon" />
                        <div class="sidebar-item-content">
                            <span class="sidebar-item-title">{{ item.title }}</span>
                            <span class="sidebar-item-desc">{{ item.description }}</span>
                        </div>
                    </button>
                </nav>
            </aside>

            <!-- Main Content Area -->
            <main class="main-content">
                <!-- Upload Files Section -->
                <InsertPaperContent v-if="activeTab === 'upload'" @upload-success="handleUploadSuccess" />

                <!-- From Mathpix Section -->
                <MarkdownInsertPaperContent v-else-if="activeTab === 'mathpix'" @upload-success="handleUploadSuccess" />

                <!-- View All Papers Section -->
                <AllPapersEditContent v-else-if="activeTab === 'view-all'" />
            </main>
        </div>
    </div>
</template>

<script>
import Navbar from '../components/Navbar.vue';
import InsertPaperContent from '../components/InsertPaperContent.vue';
import MarkdownInsertPaperContent from '../components/MarkdownInsertPaperContent.vue';
import AllPapersEditContent from '../components/AllPapersEditContent.vue';
import { Upload, FileText, FolderOpen } from 'lucide-vue-next';

export default {
    name: 'PaperManagement',
    components: {
        Navbar,
        InsertPaperContent,
        MarkdownInsertPaperContent,
        AllPapersEditContent,
        Upload,
        FileText,
        FolderOpen,
    },
    data() {
        return {
            activeTab: 'upload',
            sidebarItems: [
                {
                    value: 'upload',
                    title: 'Upload Files',
                    description: 'Upload PDF papers directly',
                    icon: 'Upload',
                },
                {
                    value: 'mathpix',
                    title: 'From Mathpix',
                    description: 'Paste markdown from Mathpix',
                    icon: 'FileText',
                },
                {
                    value: 'view-all',
                    title: 'View All Papers',
                    description: 'Browse and edit all papers',
                    icon: 'FolderOpen',
                },
            ],
        };
    },
    created() {
        // Check if there's a tab query parameter
        const tab = this.$route.query.tab;
        if (tab && ['upload', 'mathpix', 'view-all'].includes(tab)) {
            this.activeTab = tab;
        }
    },
    watch: {
        activeTab(newTab) {
            // Update URL without navigation
            this.$router.replace({ query: { tab: newTab } });
        }
    },
    methods: {
        handleUploadSuccess() {
            // Switch to view-all tab after successful upload
            this.activeTab = 'view-all';
        }
    }
};
</script>

<style scoped>
.paper-management {
    min-height: 100vh;
    background-color: #f8f9fa;
}

.paper-management-container {
    display: flex;
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
    gap: 2rem;
}

/* Sidebar Styles */
.sidebar {
    width: 200px;
    flex-shrink: 0;
    background: white;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    height: fit-content;
    position: sticky;
    top: 2rem;
}

.sidebar-title {
    font-size: 1rem;
    font-weight: 700;
    color: #333;
    margin: 0 0 1rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #eee;
}

.sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    width: 100%;
}

.sidebar-item:hover {
    background-color: #f5f5f5;
}

.sidebar-item.active {
    background-color: #e8f5e9;
    border-left: 3px solid #66CC99;
}

.sidebar-icon {
    width: 18px;
    height: 18px;
    color: #666;
    flex-shrink: 0;
}

.sidebar-item.active .sidebar-icon {
    color: #66CC99;
}

.sidebar-item-content {
    display: flex;
    flex-direction: column;
}

.sidebar-item-title {
    font-weight: 500;
    font-size: 0.85rem;
    color: #333;
}

.sidebar-item.active .sidebar-item-title {
    color: #2e7d32;
}

.sidebar-item-desc {
    display: none;
}

/* Main Content Styles */
.main-content {
    flex: 1;
    min-width: 0;
}

/* Responsive Design */
@media (max-width: 900px) {
    .paper-management-container {
        flex-direction: column;
        padding: 1rem;
    }

    .sidebar {
        width: 100%;
        position: static;
    }

    .sidebar-nav {
        flex-direction: row;
        overflow-x: auto;
        gap: 0.75rem;
    }

    .sidebar-item {
        flex-shrink: 0;
        min-width: 160px;
    }

    .sidebar-item.active {
        border-left: none;
        border-bottom: 3px solid #66CC99;
    }
}
</style>
