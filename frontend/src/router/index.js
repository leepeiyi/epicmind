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
import AllPapersEdit from "../pages/AllPapersEdit.vue";
import Favourites from "../pages/Favourites.vue";
import Mathstery from "../pages/Mathstery.vue";
import CompletionLogs from "../pages/CompletionLogs.vue";
import AdminPanel from "../pages/AdminPanel.vue";

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
    meta: { requiresAuth: true, requiresRole: "teacher" },
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
  {
    path: "/markdown-insertpaper",
    name: "MarkdownInsertPaper",
    component: () => import("../pages/MarkdownInsertPaper.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/all-papers-edit",
    name: "AllPapersEdit",
    component: AllPapersEdit,
    meta: { requiresAuth: true, requiresRole: "teacher" },
  },
  {
    path: "/favourites",
    name: "Favourites",
    component: Favourites,
    meta: { requiresAuth: true },
  },
  {
    path: "/mathstery",
    name: "Mathstery",
    component: Mathstery,
    meta: { requiresAuth: true },
  },
  {
    path: "/completion-logs",
    name: "CompletionLogs",
    component: CompletionLogs,
    meta: { requiresAuth: true, requiresRole: "teacher" },
  },
  {
    path: "/admin-panel",
    name: "AdminPanel",
    component: AdminPanel,
    meta: { requiresAuth: true, requiresRole: "admin" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const requiresRole = to.matched.some((record) => record.meta.requiresRole);

  // Get token and user from session storage
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

  // Handle authentication
  if (requiresAuth && !token) {
    // Redirect to login if authentication is required but user is not logged in
    return next({ path: "/" });
  }

  // Handle role-based access
  if (requiresRole && (!user || user.role !== to.meta.requiresRole)) {
    // If page requires specific role that user doesn't have, redirect to role-appropriate page
    if (user.role === 'admin') {
      return next({ path: "/admin-panel" });
    } else if (user.role === 'teacher') {
      return next({ path: "/insert-paper" });
    } else {
      return next({ path: "/mathstery" });
    }
  }

  // Redirect to dashboard if user is already logged in and tries to access login/register
  if (!requiresAuth && token && (to.path === "/" || to.path === "/register")) {
    if (user.role === 'admin') {
      return next({ path: "/admin-panel" });
    } else if (user.role === 'teacher') {
      return next({ path: "/insert-paper" });
    } else {
      return next({ path: "/mathstery" });
    }
  }

  // Otherwise, proceed normally
  next();
});

export default router;
