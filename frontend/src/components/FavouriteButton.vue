<!-- frontend/src/components/FavoriteButton.vue -->
<template>
    <button @click="toggleFavorite" :disabled="loading" class="favorite-btn"
        :class="{ 'is-favorited': isFavorited, 'loading': loading }"
        :title="isFavorited ? 'Remove from favorites' : 'Add to favorites'">
        <span v-if="loading">⏳</span>
        <span v-else-if="isFavorited">⭐</span>
        <span v-else>☆</span>
    </button>
</template>

<script>
import API_BASE_URL from '../config/api.js';


export default {
    name: 'FavoriteButton',
    props: {
        questionId: {
            type: [Number, String],
            required: true
        },
        subject: {
            type: String,
            required: true
        },
        banding: {
            type: String,
            required: true
        },
        level: {
            type: String,
            required: true
        },
        topicLabel: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: 'medium' // 'small', 'medium', 'large'
        }
    },
    data() {
        return {
            isFavorited: false,
            loading: false
        };
    },
    async mounted() {
        await this.checkFavoriteStatus();
    },
    methods: {
        async checkFavoriteStatus() {
            try {
                const params = new URLSearchParams({
                    question_id: this.questionId,
                    subject: this.subject,
                    banding: this.banding,
                    level: this.level,
                    topic_label: this.topicLabel
                });

                const response = await fetch(`${API_BASE_URL}/api/favorites/check-question?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.isFavorited = data.is_favorited;
                }
            } catch (error) {
                console.error('❌ Error checking favorite status:', error);
            }
        },
        getUserId() {
            const userStr = sessionStorage.getItem('user');
            if (!userStr) return null;

            try {
                const user = JSON.parse(userStr);
                return user.id;
            } catch (e) {
                console.error('❌ Failed to parse session user:', e);
                return null;
            }
        },

        async toggleFavorite() {
            if (this.loading) return;

            this.loading = true;
            try {
                const url = this.isFavorited
                    ? `${API_BASE_URL}/api/favourites/remove-question`
                    : `${API_BASE_URL}/api/favourites/add-question`;

                const method = this.isFavorited ? 'DELETE' : 'POST';
                const userId = this.getUserId();
                if (!userId) {
                    alert("User not logged in or session expired.");
                    this.loading = false;
                    return;
                }


                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        question_id: parseInt(this.questionId),
                        subject: this.subject,
                        banding: this.banding,
                        level: this.level,
                        topic_label: this.topicLabel
                    })


                });

                if (response.ok) {
                    this.isFavorited = !this.isFavorited;

                    // Emit event for parent components to listen to
                    this.$emit('favoriteChanged', {
                        questionId: this.questionId,
                        isFavorited: this.isFavorited
                    });
                } else {
                    throw new Error('Failed to update favorite status');
                }
            } catch (error) {
                console.error('❌ Error toggling favorite:', error);
                alert('Failed to update favorite. Please try again.');
            } finally {
                this.loading = false;
            }
        }
    }
};
</script>

<style scoped>
.favorite-btn {
    background: none;
    border: 2px solid #ddd;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

/* Size variants */
.favorite-btn {
    width: 36px;
    height: 36px;
}

.favorite-btn.small {
    width: 28px;
    height: 28px;
    font-size: 1rem;
}

.favorite-btn.large {
    width: 44px;
    height: 44px;
    font-size: 1.4rem;
}

/* States */
.favorite-btn:hover {
    border-color: #ff9500;
    background-color: #fff9e6;
}

.favorite-btn.is-favorited {
    border-color: #ff9500;
    background-color: #fff3cd;
    color: #ff9500;
}

.favorite-btn.is-favorited:hover {
    background-color: #ff9500;
    color: white;
}

.favorite-btn.loading {
    opacity: 0.6;
    cursor: not-allowed;
}

.favorite-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
</style>