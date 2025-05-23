import { createRouter, createWebHistory } from "vue-router";
import LoginPage from "../pages/LoginPage.vue";
import CreateAccount from "../pages/CreateAccount.vue";
import InsertPaper from "../pages/InsertPaper.vue";
import ResetPassword from "../pages/ResetPassword.vue";
import ForgetPassword from "../pages/ForgetPassword.vue";
import GenerateTopical from "../pages/GenerateTopical.vue";
import TutorVetting from "../pages/TutorVetting.vue";
import QuizFolder from "../pages/QuizFolder.vue";
import QuizView from "../pages//QuizView.vue";
import PrintView from "../components/PrintView.vue";
import PaperLogs from "../pages/PaperLogs.vue";

const routes = [
  {
    path: "/",
    name: "Login",
    component: LoginPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/register",
    name: "Register",
    component: CreateAccount,
    meta: { requiresAuth: false },
  },
  {
    path: "/insert-paper",
    name: "InsertPaper",
    component: InsertPaper,
    meta: { requiresAuth: true },
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: ResetPassword,
    meta: { requiresAuth: false },
  },
  {
    path: "/forgot-password",
    name: "ForgetPassword",
    component: ForgetPassword,
    meta: { requiresAuth: false },
  },
  {
    path: "/generate-topical",
    name: "GenerateTopical",
    component: GenerateTopical,
    meta: { requiresAuth: true },
  },
  {
    path: "/tutor-vetting",
    name: "TutorVetting",
    component: TutorVetting,
    meta: { requiresAuth: true, requiresRole: ["teacher", "admin"] },
  },

  {
    path: "/quiz-folder",
    name: "QuizFolder",
    component: QuizFolder,
    meta: { requiresAuth: true },
  },
  {
    path: "/quiz/:id",
    name: "QuizView",
    component: QuizView,
    meta: { requiresAuth: true },
  },
  {
    path: "/print-view",
    name: "PrintView",
    component: PrintView,
    meta: { requiresAuth: true },
  },
  {
    path: "/paper-logs",
    name: "PaperLogs",
    component: PaperLogs,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiredRole = to.meta.requiresRole;

  const token = sessionStorage.getItem("token");
  const userStr = sessionStorage.getItem("user");
  let user = null;

  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user from session storage:", e);
    }
  }

  // 🔐 Redirect to login if not authenticated
  if (requiresAuth && !token) {
    return next({ path: "/" });
  }

  // 🛡 If a role is required and user isn't the right role, block unless admin
  if (requiredRole && user && user.role !== requiredRole) {
    if (user.role !== "admin") {
      return next({ path: "/insert-paper" });
    }
    // If admin, proceed
  }

  // 🚫 Block access to login/register if already logged in
  if (!requiresAuth && token && (to.path === "/" || to.path === "/register")) {
    return next({ path: "/insert-paper" });
  }

  next();
});

export default router;
