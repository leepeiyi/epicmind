import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '../pages/LoginPage.vue';
import CreateAccount from '../pages/CreateAccount.vue';
import InsertPaper from '../pages/InsertPaper.vue';

const routes = [
  { path: '/', name: 'Login', component: LoginPage },
  { path: '/register', name: 'Register', component: CreateAccount },
  { path: '/insert-paper', name: 'InsertPaper', component: InsertPaper },

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
