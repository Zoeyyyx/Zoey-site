import { bootstrapAdminPage, defaultMeta, renderAdminList, setAdminNotice } from "./shared.js";
import { deletePost, listAdminPosts, savePost } from "../services/posts-service.js";
import { STORAGE_BUCKETS, uploadPublicAsset } from "../services/storage.js";
import { slugify } from "../lib/utils.js";

const listRoot = document.querySelector("#adminRecordList");
const form = document.querySelector("#adminEditorForm");
const newButton = document.querySelector("#createNewRecord");
const deleteButton = document.querySelector("#deleteRecord");
let records = [];
let activeId = null;

function resetForm() {
  form?.reset();
  form.elements.id.value = "";
  form.elements.cover_image_url.value = "";
  activeId = null;
}

function populateForm(record) {
  if (!form || !record) {
    return;
  }

  form.elements.id.value = record.id || "";
  form.elements.slug.value = record.slug || "";
  form.elements.title.value = record.title || "";
  form.elements.summary.value = record.summary || "";
  form.elements.category.value = record.category || "";
  form.elements.publish_date.value = (record.publish_date || "").slice(0, 16);
  form.elements.cover_image_url.value = record.cover_image_url || "";
  form.elements.content_html.value = record.content_html || "";
  form.elements.is_published.checked = Boolean(record.is_published);
  form.elements.featured.checked = Boolean(record.featured);
  activeId = record.id;
}

function refreshList() {
  renderAdminList(listRoot, records, activeId, (item) => `${item.category} · ${defaultMeta(item)}`);

  listRoot?.querySelectorAll("[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-record-id");
      const record = records.find((entry) => entry.id === id);
      if (record) {
        populateForm(record);
        refreshList();
      }
    });
  });
}

async function loadRecords(selectId) {
  records = await listAdminPosts();
  if (selectId) {
    const target = records.find((record) => record.id === selectId);
    if (target) {
      populateForm(target);
    }
  }
  refreshList();
}

async function initPostsAdminPage() {
  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }

  try {
    await loadRecords();
  } catch (error) {
    setAdminNotice("文章列表读取失败，请确认 Supabase 配置完成。", "error");
  }

  form?.elements.title.addEventListener("blur", () => {
    if (!form.elements.slug.value.trim()) {
      form.elements.slug.value = slugify(form.elements.title.value);
    }
  });

  newButton?.addEventListener("click", () => {
    resetForm();
    refreshList();
  });

  deleteButton?.addEventListener("click", async () => {
    if (!activeId) {
      return;
    }

    if (!window.confirm("确定删除这篇文章吗？")) {
      return;
    }

    try {
      await deletePost(activeId);
      setAdminNotice("文章已删除。", "success");
      resetForm();
      await loadRecords();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      let coverImageUrl = form.elements.cover_image_url.value.trim();
      const coverFile = form.elements.cover_file.files?.[0];

      if (coverFile) {
        const uploaded = await uploadPublicAsset({
          bucket: STORAGE_BUCKETS.covers,
          file: coverFile,
          folder: "posts",
          baseName: form.elements.slug.value || form.elements.title.value
        });

        coverImageUrl = uploaded.url;
      }

      const payload = {
        id: form.elements.id.value || undefined,
        slug: slugify(form.elements.slug.value || form.elements.title.value),
        title: form.elements.title.value.trim(),
        summary: form.elements.summary.value.trim(),
        category: form.elements.category.value.trim(),
        publish_date: form.elements.publish_date.value ? new Date(form.elements.publish_date.value).toISOString() : new Date().toISOString(),
        cover_image_url: coverImageUrl || null,
        content_html: form.elements.content_html.value.trim(),
        is_published: form.elements.is_published.checked,
        featured: form.elements.featured.checked
      };

      const record = await savePost(payload);
      setAdminNotice("文章已保存。", "success");
      await loadRecords(record.id);
    } catch (error) {
      setAdminNotice(error.message || "保存失败，请检查权限配置和 slug 唯一性。", "error");
    }
  });
}

initPostsAdminPage();
