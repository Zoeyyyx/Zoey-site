import { bootstrapAdminPage, defaultMeta, renderAdminList, setAdminNotice, textPreview } from "./shared.js";
import { deleteNote, listAdminNotes, saveNote } from "../services/notes-service.js";
import { getSupabaseClient } from "../lib/supabase-client.js";
import { normalizeTagsInput, tagsToInput } from "../lib/utils.js";

const listRoot = document.querySelector("#adminRecordList");
const form = document.querySelector("#adminEditorForm");
const newButton = document.querySelector("#createNewRecord");
const deleteButton = document.querySelector("#deleteRecord");
const regenerateTitleButton = document.querySelector("#regenerateNoteTitle");
const regenerateAllTitleButton = document.querySelector("#regenerateAllNoteTitles");
let records = [];
let activeId = null;

function resetForm() {
  form?.reset();
  const idInput = form?.querySelector("[name='id']");
  if (idInput) {
    idInput.value = "";
  }
  activeId = null;
}

function populateForm(record) {
  if (!form || !record) {
    return;
  }

  form.elements.id.value = record.id || "";
  form.elements.title.value = record.title || "";
  form.elements.publish_date.value = (record.publish_date || "").slice(0, 16);
  form.elements.mood.value = record.mood || "";
  form.elements.tags.value = tagsToInput(record.tags);
  form.elements.order_index.value = record.order_index ?? "";
  form.elements.content.value = record.content || "";
  form.elements.is_published.checked = Boolean(record.is_published);
  activeId = record.id;
}

function refreshList() {
  renderAdminList(
    listRoot,
    records,
    activeId,
    (item) => `${defaultMeta(item)} · ${textPreview(item.content)}`
  );

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
  records = await listAdminNotes();
  if (selectId) {
    const target = records.find((record) => record.id === selectId);
    if (target) {
      populateForm(target);
    }
  }
  refreshList();
}

async function initNotesAdminPage() {
  const session = await bootstrapAdminPage();
  if (!session) {
    return;
  }

  try {
    await loadRecords();
  } catch (error) {
    setAdminNotice("碎碎念列表读取失败，请确认 Supabase 配置完成。", "error");
  }

  newButton?.addEventListener("click", () => {
    resetForm();
    refreshList();
  });

  deleteButton?.addEventListener("click", async () => {
    if (!activeId) {
      return;
    }

    if (!window.confirm("确定删除这条碎碎念吗？")) {
      return;
    }

    try {
      await deleteNote(activeId);
      setAdminNotice("已删除碎碎念。", "success");
      resetForm();
      await loadRecords();
    } catch (error) {
      setAdminNotice(error.message || "删除失败，请检查权限配置。", "error");
    }
  });

  regenerateAllTitleButton?.addEventListener("click", async () => {
    if (!window.confirm("将重新生成所有碎碎念标题并覆盖现有标题。继续吗？")) {
      return;
    }

    try {
      regenerateAllTitleButton.disabled = true;
      setAdminNotice("正在重新生成全部标题，请稍等。", "info");
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke("backfill-note-titles", {
        body: {
          force: true,
          limit: 300
        }
      });

      if (error) {
        throw error;
      }

      setAdminNotice(`全部标题重取完成：${data?.count || 0} 条。`, "success");
      await loadRecords(activeId);
    } catch (error) {
      setAdminNotice(error.message || "全部重新取标题失败，请检查 Edge Function 和 DeepSeek secret。", "error");
    } finally {
      regenerateAllTitleButton.disabled = false;
    }
  });

  regenerateTitleButton?.addEventListener("click", async () => {
    const content = form?.elements.content.value.trim();

    if (!content) {
      setAdminNotice("请先填写正文，再重新取标题。", "error");
      return;
    }

    try {
      regenerateTitleButton.disabled = true;
      setAdminNotice("正在重新取标题。", "info");
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke("generate-note-title", {
        body: {
          content
        }
      });

      if (error) {
        throw error;
      }

      const title = String(data?.title || "").trim();
      if (!title) {
        throw new Error("标题生成结果为空。");
      }

      form.elements.title.value = title;
      setAdminNotice("已重新取标题，保存后生效。", "success");
    } catch (error) {
      setAdminNotice(error.message || "重新取标题失败，请检查 Edge Function 和 DeepSeek secret。", "error");
    } finally {
      regenerateTitleButton.disabled = false;
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const payload = {
        id: form.elements.id.value || undefined,
        title: form.elements.title.value.trim(),
        publish_date: form.elements.publish_date.value ? new Date(form.elements.publish_date.value).toISOString() : new Date().toISOString(),
        mood: form.elements.mood.value.trim(),
        tags: normalizeTagsInput(form.elements.tags.value),
        order_index: form.elements.order_index.value,
        content: form.elements.content.value.trim(),
        is_published: form.elements.is_published.checked
      };

      const record = await saveNote(payload);
      setAdminNotice("碎碎念已保存。", "success");
      await loadRecords(record.id);
    } catch (error) {
      setAdminNotice(error.message || "保存失败，请检查权限配置。", "error");
    }
  });
}

initNotesAdminPage();
