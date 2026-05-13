import { bootstrapAdminPage, defaultMeta, renderAdminList, setAdminNotice } from "./shared.js";
import { deleteGalleryItem, listAdminGalleryItems, saveGalleryItem } from "../services/gallery-service.js";
import { STORAGE_BUCKETS, uploadPublicAsset } from "../services/storage.js";

const listRoot = document.querySelector("#adminRecordList");
const form = document.querySelector("#adminEditorForm");
const newButton = document.querySelector("#createNewRecord");
const deleteButton = document.querySelector("#deleteRecord");
let records = [];
let activeId = null;

function normalizeCategory(value) {
  if (value === "画画") {
    return "drawing";
  }
  if (value === "摄影") {
    return "photo";
  }
  if (value === "杂项") {
    return "misc";
  }
  return value || "misc";
}

function resetForm() {
  form?.reset();
  form.elements.id.value = "";
  form.elements.image_url.value = "";
  form.elements.thumbnail_url.value = "";
  activeId = null;
}

function populateForm(record) {
  if (!form || !record) {
    return;
  }

  form.elements.id.value = record.id || "";
  form.elements.title.value = record.title || "";
  form.elements.category.value = normalizeCategory(record.category);
  form.elements.publish_date.value = (record.publish_date || "").slice(0, 16);
  form.elements.sort_order.value = record.sort_order ?? "";
  form.elements.description.value = record.description || "";
  form.elements.image_url.value = record.image_url || "";
  form.elements.thumbnail_url.value = record.thumbnail_url || "";
  form.elements.is_published.checked = Boolean(record.is_published);
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
  records = await listAdminGalleryItems();
  if (selectId) {
    const target = records.find((record) => record.id === selectId);
    if (target) {
      populateForm(target);
    }
  }
  refreshList();
}

async function initGalleryAdminPage() {
  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }

  try {
    await loadRecords();
  } catch (error) {
    setAdminNotice("视觉作品列表读取失败，请确认 Supabase 配置完成。", "error");
  }

  newButton?.addEventListener("click", () => {
    resetForm();
    refreshList();
  });

  deleteButton?.addEventListener("click", async () => {
    if (!activeId) {
      return;
    }

    if (!window.confirm("确定删除这条视觉作品吗？")) {
      return;
    }

    try {
      await deleteGalleryItem(activeId);
      setAdminNotice("视觉作品已删除。", "success");
      resetForm();
      await loadRecords();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      let imageUrl = form.elements.image_url.value.trim();
      let thumbnailUrl = form.elements.thumbnail_url.value.trim();
      const imageFile = form.elements.image_file.files?.[0];

      if (imageFile) {
        const uploaded = await uploadPublicAsset({
          bucket: STORAGE_BUCKETS.images,
          file: imageFile,
          folder: "gallery",
          baseName: form.elements.title.value
        });

        imageUrl = uploaded.url;
        thumbnailUrl = thumbnailUrl || uploaded.url;
      }

      const payload = {
        id: form.elements.id.value || undefined,
        title: form.elements.title.value.trim(),
        category: form.elements.category.value,
        publish_date: form.elements.publish_date.value ? new Date(form.elements.publish_date.value).toISOString() : new Date().toISOString(),
        sort_order: form.elements.sort_order.value,
        description: form.elements.description.value.trim(),
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl || null,
        is_published: form.elements.is_published.checked
      };

      const record = await saveGalleryItem(payload);
      setAdminNotice("视觉作品已保存。", "success");
      await loadRecords(record.id);
    } catch (error) {
      setAdminNotice(error.message || "保存失败，请检查权限配置。", "error");
    }
  });
}

initGalleryAdminPage();
