import { getCurrentSession, isCurrentUserAdmin, signInWithPassword, signOutCurrentUser } from "../lib/auth.js";

const form = document.querySelector("#adminLoginForm");
const notice = document.querySelector("#loginNotice");

function setNotice(message) {
  if (notice) {
    notice.hidden = !message;
    notice.textContent = message || "";
  }
}

function getNextPath() {
  return new URL(window.location.href).searchParams.get("next") || "index.html";
}

async function redirectIfAlreadyAuthed() {
  const session = await getCurrentSession().catch(() => null);
  if (!session) {
    return;
  }

  const isAdmin = await isCurrentUserAdmin();
  if (isAdmin) {
    window.location.href = getNextPath();
  }
}

async function initLoginPage() {
  await redirectIfAlreadyAuthed();

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setNotice("");

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      await signInWithPassword(email, password);
      const isAdmin = await isCurrentUserAdmin();

      if (!isAdmin) {
        await signOutCurrentUser();
        throw new Error("当前账号不是管理员账号。");
      }

      window.location.href = getNextPath();
    } catch (error) {
      setNotice(error.message || "登录失败，请检查邮箱和密码。");
    }
  });
}

initLoginPage();
