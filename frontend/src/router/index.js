import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../pages/LoginPage.vue";
import CreateAccount from "../pages/CreateAccount.vue";
import InsertPaper from "../pages/InsertPaper.vue";
import ResetPassword from "../pages/ResetPassword.vue";
import ForgetPassword from "../pages/ForgetPassword.vue";
import GenerateTopical from "../pages/GenerateTopical.vue";
import TutorVetting from "../pages/TutorVetting.vue";

const routes = [
  { path: "/", name: "Login", component: LoginPage },
  { path: "/register", name: "Register", component: CreateAccount },
  { path: "/insert-paper", name: "InsertPaper", component: InsertPaper },
  { path: "/reset-password", name: "ResetPassword", component: ResetPassword },
  { path: "/forgot-password", name: "ForgetPassword", component: ForgetPassword },
  { path: "/generate-topical", name: "GenerateTopical", component: GenerateTopical},
  { path: "/tutor-vetting", name: "TutorVetting", component: TutorVetting },

];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
